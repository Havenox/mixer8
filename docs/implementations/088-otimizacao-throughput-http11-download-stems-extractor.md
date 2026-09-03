# 088 - Extractor: Otimização de Throughput com HTTP/1.1 e Buffers de 1 MB para Download de Stems

**Autor:** Eduardo Nascimento (Havenox)  
**Data:** 03/09/2026  

---

## 🚀 Desafio de Engenharia

Após a implementação do desacoplamento do download do navegador e do watchdog anti-congelamento (Estudo de Caso 086), os logs de execução em produção revelaram dois comportamentos anômalos durante o download dos arquivos ZIP de stems no Google Cloud Storage (`moises-service-transcode.storage.googleapis.com`):

1. **Taxa de Transferência Estrangulada em ~400 KB/s (~3,4 Mbps):**  
   Mesmo com o servidor hospedeiro dispondo de link de alta velocidade (30+ Mbps de banda disponível), a taxa de download permanecia estagnada entre 300 KB/s e 450 KB/s. Para faixas volumosas com 7 a 10 stems (como *"This Dying Soul"*, com 182,7 MB), o download demorava mais de 35 minutos para concluir.

2. **Cancelamentos Prematuros de Conexão aos 35–42 MB (`TaskCanceledException` / `SocketException 125`):**  
   Em transferências longas, ao atingir cerca de 70% a 85% do arquivo, o download era abortado com o erro:
   ```text
   System.Threading.Tasks.TaskCanceledException: The operation was canceled.
    ---> System.IO.IOException: Unable to read data from the transport connection: Operation canceled.
    ---> System.Net.Sockets.SocketException (125): Operation canceled
   ```

### A Causa Raiz: O Teorema do Bandwidth-Delay Product e PINGs no HTTP/2

Ao investigar o runtime do .NET 10 e o comportamento do protocolo `SocketsHttpHandler`, diagnosticamos que o cliente negociava automaticamente **HTTP/2 (`h2`)** com o Google Cloud Storage.
* **Janela de Controle de Fluxo por Stream no .NET:** Diferente do HTTP/1.1 (onde o kernel Linux controla a janela TCP diretamente via *TCP Window Scaling* com buffers de dezenas de megabytes), o HTTP/2 implementa controle de fluxo na camada de aplicação. A propriedade `InitialHttp2StreamWindowSize` do .NET possui o valor padrão de apenas **65.535 bytes (64 KB)**.
* **Impacto da Latência Internacional (RTT):** O servidor está localizado no Brasil, enquanto o bucket do GCS do Moises reside nos Estados Unidos (`us-east1`, RTT médio de ~150 ms). Pelo princípio do *Bandwidth-Delay Product* ($BDP = \frac{\text{Window}}{\text{RTT}}$), a vazão teórica máxima é estritamente limitada a $\frac{65.535\text{ bytes}}{0,150\text{ s}} \approx 426\text{ KB/s} \approx 3,4\text{ Mbps}$, independentemente da largura de banda contratada.
* **Morte por Timeout de PING:** A configuração de `KeepAlivePingDelay = 15s` e `KeepAlivePingTimeout = 10s` forçava o envio contínuo de frames de PING. Como os servidores de borda do Google estavam ocupados despejando centenas de megabytes de dados de áudio na conexão, o frame `PING ACK` atrasava mais de 10s na fila de pacotes, acionando o timeout interno do .NET que derrubava seu próprio socket.

---

## 🧠 Estratégia da Solução

Para desbloquear a vazão total da rede e garantir estabilidade absoluta no download:

1. **Forçar Protocolo HTTP/1.1:**  
   Para downloads massivos de arquivos estáticos a partir de CDNs e storages de nuvem, o HTTP/1.1 é arquiteturalmente superior ao HTTP/2 por não impor limitações de janela em nível de aplicação. O HTTP/1.1 permite que o kernel Linux utilize **TCP Window Scaling** dinâmico (alocando buffers de 4 MB a 16 MB via `net.ipv4.tcp_rmem`), saturando 100% da banda da máquina.

2. **Remoção de PING Frames Periódicos:**  
   Eliminados os parâmetros `KeepAlivePingDelay` e `KeepAlivePingTimeout`, delegando a detecção de integridade exclusivamente ao TCP Keep-Alive do sistema operacional e ao nosso watchdog assíncrono de inatividade de dados (ajustado para 60 segundos).

3. **Expansão dos Buffers de Streaming para 1 MB:**  
   Elevação dos blocos de leitura e escrita (`FileStream`) de 80 KB para 1.048.576 bytes (1 MB), reduzindo chamadas de sistema (*syscalls*) em mais de 92%.

---

## 🛠️ Implementação Técnica

### Backend (`mixer8-extractor/Worker.cs`)

* **Configuração Explícita de HTTP/1.1 e SocketsHttpHandler Limpo:**
  ```csharp
  using var handler = new SocketsHttpHandler
  {
      AllowAutoRedirect = true,
      AutomaticDecompression = DecompressionMethods.All,
      ConnectTimeout = TimeSpan.FromSeconds(30),
      PooledConnectionIdleTimeout = TimeSpan.FromMinutes(2),
      ResponseDrainTimeout = TimeSpan.FromSeconds(30)
  };
  using var httpClient = new HttpClient(handler, disposeHandler: true)
  {
      DefaultRequestVersion = HttpVersion.Version11,
      DefaultVersionPolicy = HttpVersionPolicy.RequestVersionExact
  };

  using var request = new HttpRequestMessage(HttpMethod.Get, downloadUrl)
  {
      Version = HttpVersion.Version11,
      VersionPolicy = HttpVersionPolicy.RequestVersionExact
  };

  using var response = await httpClient.SendAsync(
      request, 
      HttpCompletionOption.ResponseHeadersRead, 
      totalCts.Token);
  ```

* **Buffers de 1 MB e Watchdog de 60s:**
  ```csharp
  const int bufferSize = 1024 * 1024; // 1 MB buffer
  await using var networkStream = await response.Content.ReadAsStreamAsync(totalCts.Token);
  await using var fileStream = new FileStream(destinationPath, FileMode.Create, FileAccess.Write, FileShare.None, bufferSize, useAsync: true);

  var buffer = new byte[bufferSize];
  ```

---

## 🎯 Impacto e Resultado

* **Velocidade Destravada:** O download de arquivos ZIP de stems passa de ~400 KB/s para a taxa total da banda disponível (30+ Mbps $\approx$ 3,75 MB/s).
* **Tempo de Download Reduzido em 97%:** Um arquivo de 182,7 MB (*This Dying Soul*) que levava mais de 35 minutos agora é concluído em aproximadamente **45 a 50 segundos**.
* **Eliminação de Quedas aos 40 MB:** A supressão dos frames de PING agressivos impede os falsos timeouts de `SocketException 125`, assegurando que o download flua até o último byte sem interrupção.
* **Integridade Transacional da Fila:** A fila de extração avança velozmente sem enfileiramentos acumulados.

---

**Nota do Desenvolvedor:** *O protocolo HTTP/2 é excelente para multiplexar centenas de pequenos recursos em páginas web, mas seu controle de fluxo em nível de aplicação com janela padrão de 64 KB se torna um estrangulador severo para downloads massivos em conexões de alta latência (BDP alto). Em cenários de streaming pesado de arquivos a partir de buckets de nuvem (GCS, S3), o bom e velho HTTP/1.1 com TCP Window Scaling do Linux é imbatível em velocidade e confiabilidade.*
