# 039 - Arquitetura de Microsserviços: Microsserviço de Download Agnóstico com yt-dlp

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 06/06/2026

---

## 🚀 Desafio de Engenharia
Atualmente, o ecossistema Mixer8 realiza downloads e extração de stems em um único fluxo monolítico e síncrono acoplado ao bot Playwright. Essa abordagem gera um tempo de espera passivo elevado para o usuário, além de expor o ecossistema a falhas de quebra da API de terceiros para extração. Havia a necessidade de descentralizar o download de áudio de fontes externas através de um microsserviço agnóstico de download que fosse tolerante a falhas, resiliente a atualizações de plataformas externas e integrado sem quebras ao fluxo atual de extração de stems.

## 🧠 Estratégia da Solução
A arquitetura proposta foi desenhada em camadas fracamente acopladas e integradas por fila relacional no PostgreSQL:
1. **Modelagem de Dados Resiliente**: Adicionada a coluna `DownloadUrl` à tabela `Tracks`. A API principal e o novo worker operam na mesma base de dados.
2. **Desacoplamento do Downloader**: Criado o microsserviço `mixer8-downloader` como um worker service independente em .NET 10. Ele realiza polling seguro (`FOR UPDATE SKIP LOCKED`) capturando registros com status `AguardandoDownload`.
3. **Robustez via yt-dlp**: Adotada a ferramenta de CLI `yt-dlp` executada em subprocesso C# para fazer o download e converter streams diretamente para Opus. O `yt-dlp` é a ferramenta de mercado mais resiliente a throttling e mudanças de APIs externas.
4. **Retrocompatibilidade de Fluxo**: Ao finalizar o download, o worker salva o arquivo Opus na pasta compartilhada de downloads `{trackId}.opus`, calcula a duração via `ffprobe` e altera o status para `Aguardando`. O worker extractor do Playwright assume dali por diante de forma idêntica e retrocompatível.

## 🛠️ Implementação Técnica

### Backend & Banco de Dados (API)
* **Entidade**: Adicionada propriedade `DownloadUrl` em `Track.cs` (`mixer8-api` e `mixer8-extractor`).
* **Migrations**: Gerada e aplicada migração física no PostgreSQL via EF Core (`AddDownloadUrl`).
* **Endpoint**: Criado DTO `ImportUrlRequest` e endpoint `POST /api/Tracks/ImportUrl` decorado com `[Authorize(Roles = "Admin,PaidUser")]` para enfileirar novas importações com status `AguardandoDownload`.

### Microsserviço Downloader (`mixer8-downloader`)
* **Estrutura**: Inicializado projeto Worker Service (.NET 10) utilizando pacotes `Npgsql.EntityFrameworkCore.PostgreSQL` e `dotenv.net`.
* **Poller**: Implementado polling no PostgreSQL a cada 5 segundos utilizando transações atômicas com locks skip locked.
* **Subprocesso C#**: Invocação limpa do `yt-dlp` e `ffprobe` via `System.Diagnostics.Process`, com leitura de streams stdout/stderr e captura resiliente de códigos de saída.

### Dockerização & Orquestração
* **Dockerfile**: Desenvolvido Dockerfile multi-stage com SDK .NET 10 e instalação de runtime de Python 3, `yt-dlp` (via ambiente virtual seguro venv) e `ffmpeg`.
* **docker-compose.yml**: Adicionado o container `mixer8-downloader` mapeando o volume compartilhado `/app/downloads` e as chaves de `.env`.

### Frontend SPA (`mixer8-app`)
* **Modal Global**: Adicionado toggle reativo de abas ("Upload de Arquivo" e "Link de Mídia") em `Dashboard.tsx`.
* **Validações**: Contratos de tipos em TypeScript em conformidade estrita com o **PascalCase** do backend. Bloqueio dinâmico defensivo (`disabled={isUploading}`) para evitar concorrência ou múltiplos cliques.

## 🎯 Impacto e Resultado
* **Arquitetura Descentralizada**: Isolamento de dependências de download do core da API e da automação Playwright, facilitando o escalonamento independente de workers.
* **Resiliência a Quebras de API**: Uso do `yt-dlp` blindou a aplicação contra eventuais throttling ou bloqueios geográficos de downloads comuns em bibliotecas C# puras.
* **UX Integrada**: O status de download é transmitido reativamente via polling para a SPA, permitindo que o usuário veja logs como `[WORKER STATUS] Processando: Baixando mídia` em tempo real.

---
**Nota do Desenvolvedor:** *O uso da barreira SKIP LOCKED do PostgreSQL para gerenciar filas em workers leves continua se mostrando uma das escolhas mais seguras e simples para sistemas distribuídos pequenos e médios, evitando o overhead de gerenciar corretores de mensageria complexos (RabbitMQ/Kafka) nesta fase inicial do Mixer8.*
