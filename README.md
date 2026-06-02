# 🎧 Mixer8 — O Player de Multi-Stems Interativo com Superpoderes

Mixer8 é um ecossistema digital de alta fidelidade que combina a experiência clássica de streaming e descoberta musical estilo plataformas de streaming de referência com as capacidades analíticas de engenharia de áudio e separação de faixas baseadas em IA de serviços externos de processamento. 

A principal inovação do Mixer8 é conceitual: **uma música não é apenas um único arquivo estático de á áudio (.mp3), mas sim a fusão harmônica e síncrona de múltiplos arquivos de áudio (.mp3/.wav) correspondentes a cada uma de suas faixas e stems independentes (Voz, Baixo, Bateria, Teclado, Outros)**. O usuário interage com um player web dinâmico (estilo DAW/Mesa de Som) podendo gerenciar volumes individuais, ativar presets de mixagem em tempo real e extrair faixas de forma automatizada por um microserviço headless.

---

## 🚀 Arquitetura Geral do Ecossistema

O repositório está estruturado de forma modular e desacoplada, utilizando as stacks tecnológicas mais modernas de mercado:

```
                                 ┌──────────────┐
                                 │  mixer8-web  │  <-- React 19 + TypeScript + Vite
                                 └──────┬───────┘      TailwindCSS + Shadcn UI
                                        │ (JSON / PascalCase)
                                        ▼
                                 ┌──────────────┐
                                 │  mixer8-api  │  <-- ASP.NET Core 10 Web API
                                 └──────┬───────┘      Orquestrador / Banco de Dados
                                        │ (REST / Webhooks)
                                        ▼
                        ┌────────────────────────────────┐
                        │        mixer8-extractor        │  <-- .NET 10 Headless Bot
                        └────────────────────────────────┘      Browser Automation (Playwright)
```

1. **[mixer8-web](file:///g:/DEV/mixer8/mixer8-web/) (Frontend)**: SPA moderno construído com React LTS, TypeScript, Vite, TailwindCSS e Shadcn UI. Possui um player headless interativo que se mantém persistente durante toda a navegação e uma interface de mesa de som (DAW) para mixagem de stems.
2. **[mixer8-api](file:///g:/DEV/mixer8/mixer8-api/) (Backend API)**: API robusta desenvolvida em **.NET 10 (C# 13)** utilizando Clean Architecture, responsável pelas regras de negócio, autenticação com controle de acesso (RBAC), manipulação de metadados das tracks e orquestração de microsserviços.
3. **[mixer8-extractor](file:///g:/DEV/mixer8/mixer8-extractor/) (Microserviço/Bot)**: Serviço inteligente em **.NET 10** rodando headless com **Microsoft Playwright**. Ele simula interações de um usuário real no website do serviço de processamento de áudio externo de forma autônoma para realizar upload, extrair stems e baixar o pacote ZIP contendo as faixas isoladas de forma 100% automatizada.

---

## 🛠️ Stack Tecnológica

* **Backend Principal**: .NET 10 (C# 13), ASP.NET Core Web API, Entity Framework Core 10.
* **Microserviço Headless**: .NET 10 Worker Service, Microsoft Playwright (Chromium Headless).
* **Frontend**: React 19, Vite, TypeScript, TailwindCSS, Shadcn UI.
* **Persistência**: PostgreSQL.
* **Infraestrutura**: Docker & Docker Compose para orquestração local e de VPS Linux.

---

## 📦 Como Rodar o Ecossistema

### Pré-requisitos
* **Docker** & **Docker Compose** instalados na máquina.
* **.NET 10 SDK** (caso queira executar os projetos backend fora do Docker).
* **Node.js LTS** (caso queira rodar o frontend fora do Docker).

### Inicialização Rápida

1. **Configuração de Ambiente**:
   Copie o arquivo de exemplo de variáveis de ambiente para a raiz com o nome de `.env`:
   ```bash
   cp .env.example .env
   ```
   *Edite o arquivo `.env` preenchendo as variáveis de banco de dados, chaves JWT, portas e credenciais reais.*

2. **Subir a Infraestrutura com Docker Compose**:
   Na raiz do repositório `/mixer8`, execute:
   ```bash
   docker-compose up -d --build
   ```
   *Este comando iniciará o banco de dados PostgreSQL e o microserviço do mixer8-extractor pronto para rodar em segundo plano.*

---

## 📖 Deep Dives da Documentação Arquitetural

Para entender as regras rígidas do projeto, padrões de código e decisões de engenharia, consulte a nossa **long-term memory** na pasta de documentação:

* **[01. Diretrizes de Arquitetura e Padrões](file:///g:/DEV/mixer8/docs/01-architecture-and-standards.md)**: Detalhamento do contrato unificado em **PascalCase** (Soberania do Backend), segurança de tokens JWT, controle RBAC e políticas inegociáveis de zero hardcoding de dados sensíveis.
* **[02. Lógica de Domínio e Experiência do Usuário](file:///g:/DEV/mixer8/docs/02-core-domain-logic.md)**: Explicação detalhada da engrenagem do player de áudio síncrono composto de múltiplos stems e o fluxo dinâmico de upload e processamento via bot headless.
* **[03. Persistência de Dados e Mensageria](file:///g:/DEV/mixer8/docs/03-data-and-persistence.md)**: Estrutura do schema de banco de dados PostgreSQL, relacionamentos de tracks e stems, tracking de fila de conversão e resiliência de transações ACID.
