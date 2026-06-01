# 023 - [API]: Resolução de Deadlock do FFmpeg em Uploads Multi-Stem

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 01/06/2026

---

## 🚀 Desafio de Engenharia
Ao tentar realizar o upload de faixas de música contendo múltiplos stems de tamanhos robustos (por exemplo, 7 arquivos de `14.5 MB` cada, totalizando mais de `100 MB` por música), a requisição POST de upload ficava travada indefinidamente no status `(pending)`. As requisições de CORS Preflight (`OPTIONS`) respondiam com sucesso (`204 No Content`), mas o servidor principal da API nunca retornava uma resposta, congelando a interface do uploader.

A investigação revelou uma vulnerabilidade clássica de concorrência e processos externos em .NET Core. No método `ConvertToOpusAsync` do controlador `TracksController.cs`, a API inicializava o processo do `ffmpeg` com o redirecionamento de erros habilitado (`RedirectStandardError = true`). Contudo, o consumo do stream `StandardError` só era iniciado **após** a chamada bloqueante `await process.WaitForExitAsync()`. 

Para arquivos grandes, o `ffmpeg` emite uma grande quantidade de logs e relatórios de progresso de frames decodificados no canal de erro (`stderr`). O buffer interno de comunicação (pipe) do sistema operacional (entre 4KB e 64KB) se enchia por completo. Uma vez cheio, o `ffmpeg` bloqueava aguardando que o C# liberasse o buffer, enquanto o C# continuava bloqueado esperando que o `ffmpeg` saísse. Esse impasse de espera mútua gerava um **deadlock** completo de threads, paralisando a requisição de upload indefinidamente.

## 🧠 Estratégia da Solução
A estratégia de solução adotada consistiu em implementar o padrão de **leitura assíncrona concorrente** das saídas de processos no .NET Core, eliminando a dependência síncrona do término do processo para drenagem dos buffers.

A correção aplicou as seguintes diretrizes:
1. **Drenagem Asíncrona Contínua**: Iniciamos a tarefa de leitura do StandardError em paralelo (`var errorReaderTask = process.StandardError.ReadToEndAsync()`) **antes** de gravar dados na `stdin` e aguardar o término do processo (`WaitForExitAsync`). Desta forma, o buffer pequeno do sistema operacional é consumido e limpo continuamente em tempo real à medida que o `ffmpeg` escreve, evitando qualquer interrupção.
2. **Esvaziamento Concorrente de ffprobe**: Aplicamos o mesmo padrão no helper `GetAudioDurationAsync` para ler tanto `stdout` quanto `stderr` em paralelo usando tarefas concorrentes antes do `WaitForExitAsync`, garantindo imunidade total contra deadlocks de buffers.

Com estas alterações, o `ffmpeg` executa a conversão ultra-rápida das stems sem nenhuma interrupção, liberando a requisição imediatamente após a conclusão e retornando o status de sucesso `200 OK`.

## 🛠️ Implementação Técnico

### Backend (API)
* **[TracksController.cs](file:///g:/DEV/mixer8/mixer8-api/Controllers/TracksController.cs)**:
  * Refatorado o método `ConvertToOpusAsync` (linha ~510):
    * Declarada e iniciada a tarefa de leitura concorrente: `var errorReaderTask = process.StandardError.ReadToEndAsync();`.
    * Mantido o envio assíncrono dos dados de streaming na stdin do FFmpeg.
    * Await na tarefa após `process.WaitForExitAsync()` para capturar a saída de log do FFmpeg em caso de falha.
  * Refatorado o método `GetAudioDurationAsync` (linha ~550):
    * Modificada a leitura de `stdout` e `stderr` para tarefas paralelas: `var outputTask = process.StandardOutput.ReadToEndAsync();` e `var errorTask = process.StandardError.ReadToEndAsync();`.
    * Await nas tarefas após a conclusão segura do processo `ffprobe`.

## 🎯 Impacto e Resultado
* **Uploads Estáveis de Alta Capacidade**: O Mixer8 agora é capaz de receber e processar áudios gigantescos e dezenas de stems simultâneas instantaneamente, sem travar ou sofrer gargalos de concorrência.
* **FFmpeg Sem Bloqueios**: A execução do decodificador FFmpeg atua com desempenho máximo, liberando a CPU e recursos de disco assim que o processamento do Opus estéreo finaliza.
* **Segurança e Confiabilidade de Infraestrutura**: Prevenção total contra vazamentos de memória ou conexões HTTP órfãs/pendentes penduradas que degradavam a estabilidade do servidor baremetal.

---

**Nota do Desenvolvedor:** *Redirecionar streams de processos externos (`ffmpeg`, `ffprobe`, `git`, etc.) é uma faca de dois gumes no .NET Core. Nunca se deve bloquear aguardando o término do processo se houver redirecionamento ativo sem consumo paralelo em tempo real. A leitura concorrente e assíncrona é o único padrão ouro capaz de assegurar robustez em sistemas expostos a cargas reais e arquivos robustos de mídia.*
