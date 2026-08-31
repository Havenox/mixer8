# 085 - Extrator: Download Resiliente de Stems com Fallback HTTP e Memória Compartilhada

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 31/08/2026

---

## 🚀 Desafio de Engenharia
Durante a extração automatizada de stems através do microsserviço `mixer8-extractor` (bot headless Playwright / Chromium em ambiente Docker Linux), o processo de download dos arquivos ZIP de stems frequentemente falhava com exceções de `TargetClosedException` ou interrupções de conexão durante a chamada `download.SaveAsAsync`.

Duas causas principais geravam esse comportamento instável:
1. **Limitação de Memória Compartilhada no Container Docker (`/dev/shm`):** O Chromium headless dentro de containers Linux aloca por padrão apenas 64MB em `/dev/shm`. Ao abrir páginas pesadas de DAWs com WebAudio/Wasm e streaming de áudio, abas do Chromium sofriam crash silencioso ou timeout prematuro.
2. **Dependência Exclusiva do Handler de Download do Playwright:** Se o contexto do navegador fechasse ou houvesse oscilação de rede após o início do download, o arquivo baixado não era persistido em disco, causando falha fatal no pipeline de processamento da música.

## 🧠 Estratégia da Solução
A solução foi arquitetada em duas frentes complementares:
1. **Aumento de Recursos de IPC e Shared Memory no Docker Compose:** Foi configurado `shm_size: '2gb'` e `ipc: host` no container `mixer8-extractor`, eliminando falhas de memória e permitindo que o Chromium opere com estabilidade mesmo sob alta carga.
2. **Mecanismo de Download com Fallback Resiliente via HttpClient:**
   - O worker tenta gravar o ZIP via `download.SaveAsAsync(zipPath)` do Playwright.
   - Caso ocorra qualquer exceção ou se o arquivo resultante não for válido (0 bytes), o worker captura a URL do download disparado (`download.Url`) e executa um download direto e resiliente via `HttpClient` (com suporte a streaming `HttpCompletionOption.ResponseHeadersRead`, headers de autorização e descompressão automática).
   - Validações defensivas de integridade do arquivo em disco antes de prosseguir com a injeção de metadados (`chords.json`, `lyrics.json`).

## 🛠️ Implementação Técnica
* **Backend Extractor (`mixer8-extractor/Worker.cs`):**
  - Envolvimento do `download.SaveAsAsync` em bloco `try-catch` com monitoramento de integridade e logs detalhados de tamanho em bytes.
  - Implementação de canal de fallback com `HttpClient` + `FileStream` para streaming direto do arquivo ZIP a partir da URL capturada da DAW caso o handler do navegador feche precocemente.
  - Validação estrita de existência e tamanho antes da injeção de cifras/letras.
* **Infraestrutura (`docker-compose.yml`):**
  - Adicionado `shm_size: '2gb'` e `ipc: host` na definição do serviço `mixer8-extractor`.

## 🎯 Impacto e Resultado
* **Zero Falhas por Queda de Contexto:** O bot de extração consegue recuperar e baixar o ZIP completo de stems mesmo se a aba do navegador fechar antes do término do I/O do Playwright.
* **Estabilidade do Chromium em Produção:** Fim dos crashes aleatórios por falta de memória compartilhada em `/dev/shm` durante processamento multicanal de áudio.

---
**Nota do Desenvolvedor:** *Automações headless com Playwright em pipelines de mídia pesada exigem sempre desacoplamento entre a ação de disparo no navegador e o pipeline de transferência de dados. O fallback HTTP garante que a rede e o disco fiquem sob controle nativo do .NET, sem vulnerabilidade a instabilidades do ciclo de vida de abas do navegador.*
