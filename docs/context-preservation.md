# Context Preservation (Save State) - Mixer8 Ecosystem

**Data da Última Atualização:** 30/05/2026  
**Status do Projeto:** Transição para Purga de Mocks e Decodificador de 10 Stems Opcionais.

---

## 📌 Visão Geral do Ecossistema

O **Mixer8** é uma aplicação moderna baseada em streaming multi-stems (estilo Spotify + DAW) que permite ao usuário isolar e mixar faixas independentes em tempo real de forma totalmente integrada ao banco relacional PostgreSQL do seu homelab.

### Stacks & Módulos
1. **Frontend (`mixer8-app`)**: React (LTS) + Vite + TailwindCSS + Lucide Icons + Web Audio API. Rodando na porta **`3000`** vinculada ao `.env`.
2. **Backend API (`mixer8-api`)**: ASP.NET Core (.NET 10 / C# 13) rodando na porta **`5000`** e mapeado estritamente em **PascalCase**.
3. **Background Worker (`mixer8-extractor`)**: Hosted Service C# (.NET 10) que realiza polling transacional na tabela `"Tracks"` (`FOR UPDATE SKIP LOCKED`) e orquestra a automação headless com cookies reais (`auth.json`).

---

## 🛠️ Fundações Consolidadas (Entregas Atuais)

1. **Geração Física de Migrations**: Criada e aplicada a primeira migração física `InitialCreate` mapeando a estrutura relacional real (`Users`, `Tracks`, `Stems`).
2. **Autenticação RBAC e BCrypt**: Senhas criptografadas com hash adaptativo BCrypt. Usuários semente (`admin`, `moderator`, `paiduser`, `user`) registrados com a senha `mixer8` e claims injetados nos tokens JWT.
3. **Importação e Validação de Cookies Headless**:
   * O painel administrativo persistente grava fisicamente o JSONEditThisCookie no arquivo `/config/auth.json`.
   * Criado o teste de conexão ativa que valida os cookies diretamente nos servidores da plataforma de Stems AI (`https://studio.moises.ai/`), retornando se a sessão está ativa ou expirada (evitando simulações no frontend).
4. **Portas Dinâmicas**: Configuração unificada via `.env` na raiz do projeto (sem arquivos duplicados nas pastas filhas).

---

## 🎯 Próximo Milestone: O Plano de Purga Total de Mocks

Na próxima iteração, executaremos o plano de purga total de mocks e implementação do decodificador de arquivos:

### 1. Limpeza de Mocks no Frontend (`mixer8-app`)
* **Página Explorar**: Removeremos as músicas e gêneros fictícios (Bohemian Rhapsody, Smooth, etc.) hardcodados. A página consumirá estritamente o endpoint `GET /api/Tracks` e os gêneros serão calculados dinamicamente das músicas registradas no banco de dados. Caso o banco esteja vazio, exibirá `"Nenhuma música disponível"`.
* **CRM de Usuários**: Substituiremos a lista estática de usuários por um consumo real à API (`GET /api/Auth/Users` ou `GET /api/Admin/Users`).
* **Player Principal (MesaPlayer)**: O tocador no rodapé iniciará oculto/inativo. Ele só aparecerá quando o usuário clicar em "Play" em uma música real carregada da biblioteca. Mapeará dinamicamente os GainNodes e sliders apenas para os canais retornados pelo banco.

### 2. A Arquitetura de 10 Stems Opcionais
Lidaremos com qualquer combinação de stems opcionais com base no mapeamento a seguir:
* `Metronomo` (`metronome` ──> `Metronomo.mp3`)
* `Voz` (`vocals` ──> `Voz.mp3`)
* `Bateria` (`drums` ──> `Bateria.mp3`)
* `Baixo` (`bass` ──> `Baixo.mp3`)
* `Guitarra` (`guitars` ──> `Guitarra.mp3`)
* `Piano` (`piano` ──> `Piano.mp3`)
* `Teclado` (`keyboards` ──> `Teclado.mp3`)
* `Sopro` (`wind` ──> `Sopro.mp3`)
* `Cordas` (`strings` ──> `Cordas.mp3`)
* `Outros` (`other` ──> `Outros.mp3`)

### 3. Decodificador e Renomeador de Arquivos no Extrator C#
* O Playwright descompactará o ZIP da plataforma externa contendo nomes do tipo `[NomeOriginal]-<stem>-<tonalidade>-<bpm>-<frequencia>.mp3`.
* O worker decodificará o trecho `<stem>`, renomeará o arquivo correspondente na pasta da música (ex: `/downloads/tracks/[TrackId]/Baixo.mp3`) e salvará os caminhos estruturadamente no PostgreSQL em uma única transação ACID.
* O player de áudio lerá a lista de stems registradas no banco e renderizará sliders correspondentes apenas para os arquivos existentes.

---
**Nota de Arquitetura:** *Nenhum dado ou tela deve simular atividade. Se a API retornar vazia, a UI renderizará feedback limpo. Isso estabelece o estado da arte em termos de fidelidade operacional do Mixer8.*
