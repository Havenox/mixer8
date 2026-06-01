# 023 - [API]: Resolução de Deadlock do FFmpeg em Uploads Multi-Stem

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 01/06/2026

---

## 🚀 Desafio de Engenharia
Ao tentar realizar o upload de faixas de música contendo múltiplos stems de tamanhos robustos (por exemplo, 7 arquivos de `14.5 MB` cada, totalizando mais de `100 MB` por música), a requisição POST de upload ficava travada indefinidamente no status `(pending)`. As requisições de CORS Preflight (`OPTIONS`) respondiam com sucesso (`204 No Content`), mas o servidor principal da API nunca retornava uma resposta, congelando a interface do uploader.

A investigação revelou uma vulnerabilidade clássica de concorrência e processos externos em .NET Core. No método `ConvertToOpusAsync` do controlador `TracksController.cs`, a API inicializava o processo do `ffmpeg` com o redirecionamento de erros habilitado (`RedirectStandardError = true`). Contudo, o consumo do stream `StandardError` só era iniciado **após** a chamada bloqueante `await process.WaitForExitAsync()`. 

Para arquivos grandes, o `ffmpeg` emite uma grande quantidade de logs e relatórios de progresso de frames decodificados no canal de erro (`stderr`). O buffer interno de comunicação (pipe) do sistema operacional (entre 4KB e 64KB) se enchia por completado. Uma vez cheio, o `ffmpeg` bloqueava aguardando que o C# liberasse o buffer, enquanto o C# continuava bloqueado esperando que o `ffmpeg` saísse. Esse impasse de espera mútua gerava um **deadlock** completo de threads, paralisando a requisição de upload indefinidamente.

## 🧠 Estratégia da Solução
Para garantir 100% de imunidade contra deadlocks em arquivos de qualquer tamanho, implementamos o padrão oficial de **leitura assíncrona baseada em eventos nativos do sistema operacional** oferecido pelo .NET Core, em substituição a tarefas parciais de leitura direta de streams de pipelines.

A correção aplicou as seguintes diretrizes:
1. **Consumo de Linhas por Evento**: Registramos handlers para o evento `process.ErrorDataReceived` no `ffmpeg` e no `ffprobe`. Ao chamar o método nativo do SO `process.BeginErrorReadLine()` (e `BeginOutputReadLine()` no caso do `ffprobe`), delegamos ao sistema operacional a leitura de linhas do buffer de forma contínua em segundo plano à medida que o executável escreve. Isso drena o pipe nativamente sem bloqueios.
2. **Logs em Tempo Real para Docker Compose**: Adicionamos impressões de console detalhadas (`Console.WriteLine`) no ciclo de vida de processamento das faixas e stems (`[API] Recebendo UploadDirect`, `[FFMPEG] Iniciando processo`, `[FFMPEG] Copiando inputStream`, `[FFPROBE] Finalizado`). Isso permite que os logs de progresso e eventuais problemas de conversão possam ser monitorados em tempo real simplesmente executando o comando `docker compose logs -f api` no CLI do servidor.

Com estas alterações, o `ffmpeg` executa a conversão em alta velocidade sem nenhum travamento de buffer, completando o upload instantaneamente e retornando `200 OK`.

## 🛠️ Implementação Técnica

### Backend (API)
* **[TracksController.cs](file:///g:/DEV/mixer8/mixer8-api/Controllers/TracksController.cs)**:
  * Inserida a diretiva `using System.Text;` no topo para permitir a coleta dos dados através de `StringBuilder`.
  * Adicionado log inicial em `UploadDirect` registrando o recebimento da requisição e metadados.
  * Refatorado o método `ConvertToOpusAsync` (linha ~510):
    * Vinculado o handler `process.ErrorDataReceived` para construir incrementalmente a saída de erros via `StringBuilder`.
    * Acionado `process.BeginErrorReadLine()` logo após `process.Start()`.
    * Inseridos logs de console detalhados para cada etapa do ciclo do FFmpeg.
  * Refatorado o método `GetAudioDurationAsync` (linha ~550):
    * Vinculados os handlers para `OutputDataReceived` e `ErrorDataReceived`.
    * Acionados `BeginOutputReadLine()` e `BeginErrorReadLine()`.
    * Inseridos logs de console com o resultado e ExitCode do FFprobe.

## 🎯 Impacto e Resultado
* **Uploads Estáveis de Alta Capacidade**: O Mixer8 agora é capaz de receber e processar áudios gigantescos e dezenas de stems simultâneas instantaneamente, sem travar ou sofrer gargalos de concorrência.
* **FFmpeg Sem Bloqueios**: A execução do decodificador FFmpeg atua com desempenho máximo, liberando a CPU e recursos de disco assim que o processamento do Opus estéreo finaliza.
* **Observabilidade Total**: Monitoramento fácil e preciso de toda a atividade interna de conversão e processamento do backend diretamente no CLI via docker compose.

---

**Nota do Desenvolvedor:** *Delegar a leitura de pipes para o mecanismo assíncrono baseado em eventos nativo do sistema operacional (`BeginErrorReadLine`) é a única forma verdadeiramente à prova de falhas de gerenciar buffers em subprocessos C#. A observabilidade com logs claros nas transições de I/O em tempo real é uma excelente aliada na segurança operacional da aplicação.*
