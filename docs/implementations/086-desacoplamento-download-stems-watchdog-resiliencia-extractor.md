# 086 - Extractor: Desacoplamento do Download de Stems e Resiliência com Watchdog HTTP

**Autor:** Eduardo Nascimento (Havenox)  
**Data:** 03/09/2026  

---

## 🚀 Desafio de Engenharia

Durante o processamento de faixas musicais em produção e em ambiente local, foram diagnosticados dois problemas críticos de confiabilidade no microsserviço `mixer8-extractor`:

1. **Race Condition no Playwright com Iframes e Destruição de Contexto:**  
   A DAW web do Moises opera isolada dentro de um `<iframe>` (`https://studio1.moises.ai/player2/...`). Ao clicar em "Exportar todos os canais", o JavaScript interno do iframe dispara a navegação para uma URL pré-assinada do Google Cloud Storage com o header `Content-Disposition: attachment`. Como a resposta não contém documento HTML renderizável, o motor do Chromium entrega o arquivo para a camada de downloads e descarta o contexto de navegação (*RenderFrameHost*) daquele iframe quase imediatamente. Ao invocar `download.SaveAsAsync(path)`, o Playwright tenta sincronizar via Chrome DevTools Protocol (CDP) com o canal do frame recém-destruído, lançando a exceção fatal `Microsoft.Playwright.TargetClosedException: Target page, context or browser has been closed`, mesmo em máquinas com memória e CPU abundantes.

2. **Deadlock Assíncrono Infinito no `HttpClient` com `ResponseHeadersRead`:**  
   A tentativa anterior de fallback via HTTP configurava `fallbackClient.Timeout = TimeSpan.FromMinutes(10)` combinada com `HttpCompletionOption.ResponseHeadersRead`. No runtime do .NET, esse timeout encerra assim que os primeiros cabeçalhos HTTP chegam (menos de 1 segundo). A cópia subsequente do stream (`Content.CopyToAsync(fs, stoppingToken)`) utilizava apenas o `stoppingToken` da aplicação, sem qualquer timeout de leitura de stream. Durante transferências pesadas de arquivos ZIP (130 MB a 200 MB), qualquer oscilação de rede ou estagnação de conexão TCP (*half-open socket* / drop de pacotes) colocava o thread assíncrono em espera indefinida. Como nenhuma exceção era lançada, o worker ficava congelado por dias, impedindo o loop de continuar consumindo as outras faixas da fila no PostgreSQL.

3. **Injeção Redundante de Header `Authorization` em URLs Pré-Assinadas:**  
   O fallback anterior injetava o cabeçalho `Authorization: Bearer <moises_token>` em requisições diretas ao domínio `storage.googleapis.com`. URLs pré-assinadas da Google já contêm autenticação completa na query string (`GoogleAccessId` + `Signature`), e o envio de headers conflitantes pode gerar rejeições silenciosas ou encerramento de conexão por proxies de rede.

---

## 🧠 Estratégia da Solução

Para sanar o problema de forma definitiva e à prova de falhas, a arquitetura do fluxo de exportação foi reestruturada em duas frentes complementares:

1. **Desacoplamento Total do Download (Bypass do Navegador):**  
   O Chromium não deve ser utilizado como gerenciador de download de arquivos pesados. Sua responsabilidade foi restrita a interagir com a interface da DAW e capturar a URL pré-assinada de exportação (`download.Url`). No exato milissegundo em que a URL é obtida, o Chromium é **imediatamente descartado e fechado** (`await context.DisposeAsync()`). Isso elimina a race condition de destruição do iframe, impede o `TargetClosedException` e devolve instantaneamente centenas de megabytes de memória RAM (alocados pelos AudioBuffers da Web Audio API) para o sistema operacional antes do download começar.

2. **Motor Nativo de Download Resiliente com Watchdog de Inatividade (Heartbeat):**  
   O download passa a ser realizado exclusivamente pelo .NET via `SocketsHttpHandler` em blocos de 80 KB (`81920` bytes). Cada bloco lido é monitorado por um `CancellationTokenSource` de inatividade de **45 segundos**. Se a conexão parar de entregar novos bytes por 45 segundos, a operação é abortada por timeout de inatividade. Além disso, há um timeout global de 10 minutos por tentativa, validação de integridade por `Content-Length`, expurgo automático de arquivos corrompidos e até 3 tentativas com backoff antes de lançar erro controlado, permitindo que a fila do worker nunca trave.

---

## 🛠️ Implementação Técnica

### Backend (`mixer8-extractor/Worker.cs`)

* **Declaração Escopada de Contexto e Fechamento Proativo:**  
  Promovida a variável `IBrowserContext? context = null;` para o escopo do método `ExecuteExtractionWorkflowAsync`. Assim que `download.Url` é capturada, `context.DisposeAsync()` é invocado proativamente, e uma verificação defensiva adicional foi incluída no bloco `finally` para garantir que nenhum processo órfão do Chromium permaneça em execução.
* **Remoção do `SaveAsAsync` e do Fallback Passivo:**  
  Removida a chamada frágil a `download.SaveAsAsync(zipPath)` e o antigo bloco de fallback com `CopyToAsync` sem timeout.
* **Implementação de `DownloadFileWithHeartbeatAsync`:**  
  Adicionado método assíncrono especializado com:
  - `SocketsHttpHandler` configurado com `KeepAlivePingDelay = 15s`, `KeepAlivePingTimeout = 10s`, `ConnectTimeout = 30s` e `EnableMultipleHttp2Connections = true`.
  - Supressão de qualquer header `Authorization` para requisições direcionadas a storage de terceiros (`storage.googleapis.com`).
  - Leitura em blocos de 80 KB com watchdog de inatividade (`inactivityTimeout: 45s`) usando tokens vinculados (`CreateLinkedTokenSource`).
  - Emissão periódica de logs em stdout com progresso percentual e megabytes transferidos a cada 5 segundos.
  - Validação estrita de bytes gravados em disco contra o `ContentLength` informado pelo servidor.

---

## 🎯 Impacto e Resultado

* **Eliminação Total de Travamentos Infinitos:** Nenhuma operação de rede do extrator pode ficar pendurada indefinidamente. Caso a conexão estagne, o watchdog cancela o stream em 45 segundos, retenta e, em caso de falha persistente, lança exceção controlada para avançar a fila.
* **Resolução da Race Condition de Iframe:** Com o fechamento imediato do navegador após a captura da URL do GCS, o Playwright nunca mais sofre de `TargetClosedException` decorrente do descarte do frame de áudio pelo Chromium.
* **Economia de Recursos e Performance:** A memória RAM alocada pelo Chromium (frequentemente superior a 1 GB em faixas longas) é liberada antes do download do ZIP iniciar, reduzindo a pressão de memória na máquina e em contêineres Docker.
* **Disponibilidade da Fila Preservada:** Falhas individuais de faixa são capturadas, registradas no PostgreSQL (`SystemEvents`) e a fila avança automaticamente a cada 5 segundos.

---

**Nota do Desenvolvedor:** *Tratar navegadores headless como ferramentas de download de binários pesados em produção é um antipattern que ignora o ciclo de vida efêmero de contextos de renderização (especialmente em SPAs complexas com Iframes e Web Audio API). A abordagem desacoplada — onde o bot atua unicamente como resolvedor de URLs assinadas e o runtime do .NET assume o I/O pesado de rede com watchdogs estritos — transforma um fluxo inerentemente frágil em uma esteira de processamento determinística e resiliente.*
