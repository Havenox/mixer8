# Context Preservation (Save State) - Mixer8 Ecosystem

**Data da Última Atualização:** 17/07/2026  
Status do Projeto: Purga de Mocks Concluída, Player Multi-Stems Ativo, Uploader Direto Implementado, Conteinerização/Conversão Opus Concluída, Recursos Premium/Shuffle/Repeat Dinâmicos, Barra de Progresso Premium, Extrator Headless E2E via Playwright, Menu de Contexto Irrestrito Ativos, Acesso Anônimo com Endpoints de Segurança e Modal de Login Globais Integrados, Remoção de Cookies/Testes de Sessão Legados Concluída, Unificação de Login/Cadastro em Modal Único (Eliminação de Rotas Dedicadas), Microsserviço de Download Agnóstico (mixer8-downloader) com yt-dlp, Overhaul de Upload & Prévia Imediata (1-Stem) com Workers 100% Desacoplados via APIs HTTP Stateless, Extração Automática de Thumbnails do YouTube com Processamento WebP para Capas de Música, Extração e Exposição Segura de Cifras e Letras (chords.json e lyrics.json) com Validação Ativa contra Path Traversal, Zip Bomb e XSS, Monitoramento GraphQL Resiliente de Cifras e Metrônomo (BEATSCHORDS_A), Sistema de Auditoria de Logs Centralizado (`SystemEvents`) com Polling Contínuo e Categoria "Play" Dedicada, Gestão de Acesso Administrativo com Sincronização Silenciosa de Claims (JWT) e Busca Global Imune a Acentos, Filtros de Visibilidade, Padronização da Barra Lateral, Seções de Configurações Colapsáveis, Modal de Upload Assíncrono, Toasts Dinâmicos, Controles de Playlists com Toggle e Shuffle, Banner de Entrada Refinado e Exportação de Mix Customizada na DAW em MP3 192kbps 48kHz Assíncrono com Toast Não-Bloqueante Concluídos.

---

## 📌 Visão Geral do Ecossistema

O **Mixer8** é uma aplicação moderna baseada em streaming multi-stems (estilo reprodutor premium de referência + DAW) que permite ao usuário isolar e mixar faixas independentes em tempo real de forma totalmente integrada ao banco relacional PostgreSQL do seu homelab.

### Stacks & Módulos
1. **Frontend (`mixer8-app`)**: React (LTS) + Vite + TailwindCSS + Lucide Icons + Web Audio API. Rodando na porta **`3000`** vinculada ao `.env`.
2. **Backend API (`mixer8-api`)**: ASP.NET Core (.NET 10 / C# 13) rodando na porta **`5000`** e mapeado estritamente em **PascalCase**.
3. **Background Worker (`mixer8-extractor`)**: Hosted Service C# (.NET 10) que realiza polling transacional na tabela `"Tracks"` (`FOR UPDATE SKIP LOCKED`) e orquestra a automação headless com cookies reais e perfil de usuário persistente via ferramenta de automação.

---

## 🛠️ Fundações Consolidadas (Entregas Atuais)

1. **Geração Física de Migrations**: Criada e aplicada a primeira migração física `InitialCreate` mapeando a estrutura relacional real (`Users`, `Tracks`, `Stems`).
2. **Autenticação RBAC e BCrypt**: Senhas criptografadas com hash adaptativo BCrypt. Usuários semente (`admin`, `moderator`, `paiduser`, `user`) registrados com a senha `mixer8` e claims injetados nos tokens JWT.
3. **Automação Headless Baseada em Credenciais Locais (Desacoplamento de Cookies)**:
   * Removido o sistema legado de importação de cookies (`auth.json`) e testes de conexão do painel administrativo e do backend.
   * O bot/worker realiza a autenticação de forma 100% independente utilizando credenciais de ambiente (`.env`) e persistência nativa de sessão via perfil do navegador Playwright (`user_profile`), eliminando o armazenamento de cookies de terceiros no banco de dados.
4. **Portas Dinâmicas**: Configuração unificada via `.env` na raiz do projeto.
5. **Purga Completa de Mocks**:
   * **Página Explorar**: Dados de Queen, Santana e Eagles fictícios removidos por completo. O catálogo consome faixas reais via `/api/Tracks` e oculta seções de gêneros caso não existam músicas prontas.
   * **CRM Administrativo**: Lista de usuários fakeados removida. O CRM de controle do administrador faz requisições JWT autenticadas à API `/api/Users` listando contas registradas no PostgreSQL.
6. **Mesa de Mixagem Inteligente e Player Progressive**:
   * Utiliza progressive audio streaming com elementos `new Audio()` invisíveis acoplados a `MediaElementAudioSourceNode` e somados em um `GainNode` da `Web Audio API` por canal.
   * Faders na DAW renderizam-se dinamicamente conforme as stems presentes na música no banco, com verificação de presets traduzidos para português (`Vocais` e `Metrônomo` baseados na plataforma externa).
   * **Ajuste de Responsividade**: Adicionado encolhimento de layout de tela (`pb-24`) reativo à presença de áudio ativo para manter a sidebar e todos os botões do rodapé 100% clicáveis acima do player.
7. **Uploader Direto de Stems (ZIP/MP3)**:
   * **Payload de Alta Resiliência**: Backend com limits de Kestrel e `FormOptions` configurados para tankar requisições multipartes de até 500 MB.
   * **Static Files com CORS**: Servidor estático em `wwwroot/stems` habilitado com injeção manual de CORS (`Access-Control-Allow-Origin: *`) para permitir carregamento de áudios no player via Web Audio API.
   * **Validador de Sandbox**: Descompressão de ZIPs em memória (`ZipArchive`), extraindo e salvando estritamente arquivos com extensão de áudio permitida, blindando o ecossistema contra scripts maliciosos.
   * **Mapeamento Heurístico C#**: Conversão em tempo de execução de termos em inglês (ex: `bass.mp3`) para português (`Baixo.mp3`) e associação a metadados, capa e persistência no banco com status `Pronto`.
   * **UX Drag-and-Drop**: Uploader em React com drag-and-drop, preview de capa com URL temporária e classificação preditiva instantânea do tipo de stem na UI.
8. **Dockerização e Conversão Opus In-Memory**:
   * **Dockerfiles Multi-Stage**: Criados Dockerfiles para a API do backend (com instalação do `ffmpeg` com `libopus`), Worker de background e Frontend (com servidor Nginx Alpine otimizado).
   * **Orquestração Geral**: `docker-compose.yml` ajustado e ativado para subir todos os containers integrados sob volumes compartilhados de download e comunicação interna de rede.
   * **Conversão Opus**: Toda stem recebida (seja via upload direto ou extração do Worker) é transcodificada in-memory via pipes do FFmpeg para `.opus` (mono a 64k VBR para canais como Voz/Baixo, e estéreo a 96k VBR para os demais), reduzindo drasticamente o consumo de armazenamento sem perda perceptível de qualidade.
   * **Worker Realista com Automação de Navegador**: O `Worker.cs` faz a extração real de stems na plataforma externa de stems de ponta a ponta simulando cliques e uploads locais de forma emulada via Playwright. Utiliza perfis de usuário persistentes (`user_profile`), varredura dinâmica de IFrames, seleção explícita de MP3 no player, um portão de tempo dinâmico (3 a 5 minutos) baseado no tamanho do arquivo original para evitar downloads prematuros, um recarregamento de página (F5) com buffer de 30 segundos para contornar gargalos de renderização gráfica headless, invocando a API via `/api/Tracks/{id}/ProcessStemsZip` para conversão. O extrator executa em modo headless por padrão no ambiente de homologação e produção.
9. **Otimização de Transmissão (HTTP Range 206) e Sliders Premium**:
   * **Carregamento Otimizado**: Alterado o pré-carregamento das stems para `preload = 'metadata'`, evitando o download automático de arquivos inteiros de áudio e economizando banda.
   * **Streaming Parcial (HTTP 206)**: Servidor estático configurado com cabeçalhos de `Cache-Control` (30 dias) e suporte nativo a HTTP Range Requests, transmitindo bytes progressivamente em chunks.
   * **Timeline com Drag-and-Release**: A linha de progresso do player agora é um input de controle real com marcador circular verde. O seek do áudio só é executado no soltar do mouse/toque, evitando múltiplos requests repetitivos e travamentos do player.
   * **Volume Master Real**: Integrado um nó de ganho master (`masterGainNode`) na Web Audio API vinculado ao fader de volume, alterando o ganho de todas as stems em tempo real de forma local e imediata.
10. **Ajustes e Edição Completa de Playlists (Capas Físicas, Descrições e Deleção Segura)**:
    * **Propriedade de Descrição**: Adicionada propriedade nullable `Description` no modelo `Playlist.cs`, com migração EF Core robusta aplicada com sucesso no banco relacional PostgreSQL do homelab.
    * **Upload de Capa e Persistência Física**: Suporte a upload de arquivo de imagem (`multipart/form-data`) para persistência de capas customizadas em `wwwroot/playlists/{id}/`.
    * **Deleção Física Segura**: Implementadas regras de exclusão em disco que removem a imagem antiga/substituída ou deletada. A limpeza física é protegida, ocorrendo apenas caso o link inicie com `/playlists/`, mantendo as capas de músicas intactas. A deleção da playlist apaga síncronamente toda a sua pasta no servidor.
    * **Modais Centralizados no React**: Lógica de edição e exclusão de playlists migrada inteiramente para o escopo global reativo em `PlaylistContext.tsx`, limpando códigos duplicados das páginas internas.
    * **Timer de Segurança e Eventos Reativos**: A exclusão conta com aviso destrutivo e contagem regressiva reativa de 3 segundos no botão de ação. Ao salvar ou deletar, são emitidos os eventos personalizados `playlist-updated` e `playlist-deleted` garantindo atualização imediata sem recarregar a SPA.
11. **Correção do Autoplay contra Stale Closures (Refs Mutáveis)**:
    * O listener de fim de faixa (`ended`) no elemento master de áudio foi corrigido substituindo referências a funções locais por referências mutáveis (`useRef`). Isso evita closures congeladas/stale que impediam o avanço automático da fila de reprodução na SPA.
12. **Shuffle (Aleatório) e Repeat (Repetição) no Player**:
    * Implementados os modos Shuffle e Repeat no player com sincronização e persistência no `localStorage`.
    * A reprodução aleatória gerencia uma pilha interna de histórico para evitar repetições no avanço e permitir o retorno de faixas exato na ordem inversa. O Repeat suporta One, All e Off.
13. **Persistência Sem Perda del Mixer e Isenção de Faixa Única**:
    * A mesa de stems foi ajustada para persistir volumes, mutes e solos por canal no `localStorage`. Em vez de limpar o dicionário ao carregar novas músicas, realizamos uma mesclagem (merge) preservando chaves de canais ausentes.
    * A atualização de ganho de áudio foi otimizada com referências mutáveis para contornar atrasos de batching do React.
    * Adicionada isenção de ganho (1.0 constante) para faixas contendo apenas uma única stem, evitando silenciamento colateral.
14. **Parametrização Dinâmica de Recursos Premium (Roles & Anonymous)**:
    * Criada a tabela de banco de dados `SystemSettings` e o endpoint restrito `SystemSettingsController` no backend API.
    * Desenvolvido card de gerenciamento administrativo em `/admin` permitindo definir dinamicamente quais grupos de acesso (Roles) possuem o recurso premium de Download Offline.
    * Integrado suporte para usuários não autenticados (`anonymous`) baixarem e cachearem músicas localmente de forma transparente.
15. **Barra de Progresso Dinâmica Premium (Visual Estilo Reprodutor de Referência)**:
    * Substituído o comportamento anterior onde apenas a bolinha (thumb) se movia na barra de progresso do player.
    * Implementada a classe CSS `.dynamic-progress` com suporte a variáveis customizadas (`--slider-progress`) baseadas em `linear-gradient`.
    * A cor percorrida é pintada dinamicamente com o verde premium `#1db954`, enquanto a restante permanece cinza (`#282828` padrão ou `#333333` no hover), atualizando em tempo real com fluidez tanto na interface Desktop quanto na versão Mobile expandida.
16. **Interação e Exclusão Irrestrita na Biblioteca**:
    * Habilitado o menu de contexto personalizado do Mixer8 para todas as faixas (independentemente do status de extração: `Aguardando`, `Processando...`, `Falhou`, `Pronto`), evitando a exibição do menu padrão do navegador.
    * O editor de metadados e o fluxo relacional/físico de exclusão em cascata do backend foram validados para funcionar perfeitamente em faixas sem stems ou com processamento interrompido.
    * A injeção em playlists de músicas não prontas permanece bloqueada na interface de usuário.
17. **Suporte a URLs de Capas Personalizadas**:
    * Adicionado o campo "Ou URL Externa da Imagem" nos modais de edição de músicas e de playlists.
    * O backend foi estendido para receber CoverUrl nos payloads de atualização, limpando fisicamente as capas locais anteriores ao atualizar para URLs de terceiros, garantindo integridade de disco e prevenindo arquivos órfãos.
18. **Acesso Público, Endpoints Seguros, Lazy Playlists e Blindagem do SystemSettings**:
    * A rota raiz `/` (Explorar) tornou-se pública para visitantes deslogados, com play de faixas e playlists ativo anonimamente.
    * Criado o `ExploreController` no backend com endpoints especializados públicos (`/api/Explore/WeeklyTrends` e `/api/Explore/PopularPlaylists`) rigidamente limitados a 6 registros para prevenir scraping.
    * Adicionado filtro robusto no `/api/SystemSettings` para expor somente configurações públicas (`PremiumFeature_`), impedindo o vazamento de tokens sensíveis (`MoisesSession_AuthJson`).
    * Criado modal de autenticação global dinâmico (`LoginModal`) integrado ao `AuthContext` para interceptar cliques de usuários anônimos em ações que necessitem de privilégios.
    * Otimizado o carregamento de playlists com lazy loading reativo no `PlaylistContext` (eliminando a chamada inicial no mount geral).
19. **Unificação do Fluxo de Autenticação via Modal Global (Eliminação de Rotas Dedicadas)**:
    * As rotas `/login` e `/register` foram completamente removidas da SPA, e suas respectivas páginas deletadas.
    * Todas as ações e links que redirecionavam para o login foram alteradas para acionar o modal global de login reativamente.
    * Configurado o `ProtectedRoute` para redirecionar usuários não autenticados para a home com o parâmetro `?showLogin=true`, o qual é interceptado pelo layout do app para acionar o modal e limpar a URL de forma imediata e transparente.
20. **Microsserviço de Download Agnóstico (mixer8-downloader) com yt-dlp**:
    * **Banco de Dados**: Coluna `DownloadUrl` adicionada à tabela `Tracks` com migration EF Core robusta aplicada com sucesso no PostgreSQL.
    * **Backend API**: Adicionado endpoint `POST /api/Tracks/ImportUrl` (restrito a `Admin` e `PaidUser`) para registrar links externos e enfileirar downloads com status `AguardandoDownload`. Sanitiza URLs do YouTube extraindo apenas o ID do vídeo para gravação no banco.
    * **Worker Downloader**: Criado o novo worker de background `mixer8-downloader` (.NET 10) que realiza polling seguro (`FOR UPDATE SKIP LOCKED`) na fila de download, reconstrói o link limpo caso o banco de dados armazene apenas o ID do vídeo e invoca o `yt-dlp` com a flag `--no-playlist` para segurança. Converte o áudio para Opus (`.opus`), calcula a duração com `ffprobe` e atualiza o status via API.
    * **Dockerização**: Criado Dockerfile multi-stage com .NET 10, Python 3, `yt-dlp` e `ffmpeg` sob ambiente isolado `venv`. Atualizado o `docker-compose.yml` compartilhando o volume `/app/downloads`.
    * **Frontend SPA**: Adicionada aba de importação "Link de Mídia (URL)" no modal global de upload, controlando states de forma segura com concorrência blindada (botão desabilitado com carregamento visual) e contratos preservando **PascalCase**.
21. **Overhaul do Fluxo de Upload e Prévia Imediata (1-Stem)**:
    * **Prévia Imediata (Completo.opus)**: Faixas físicas e externas convertidas instantaneamente para Opus Estéreo leve (`Completo.opus`) em `wwwroot/stems/{id}/` e registradas sob uma stem temporária `"Completo"`. Ficam disponíveis imediatamente para play na SPA com faders bloqueados/ocultados e feedback visual informativo.
    * **Leitura de Metadados Ricos (TagLibSharp)**: Integrado o pacote NuGet `TagLibSharp` para auto-extrair Título, Artista e Capa física embutida de uploads diretos. Capas físicas são processadas in-memory para WebP 500x500 (80% qualidade) e salvas no disco.
    * **Workers 100% Stateless (Comunicação via APIs HTTP)**: Eliminada a dependência de volumes compartilhados em produção. O worker `mixer8-downloader` faz upload do áudio concluído via `POST /api/Tracks/{id}/ImportCompleted` e o worker `mixer8-extractor` baixa a prévia via `GET /stems/{id}/Completo.opus`, executa a automação Playwright e submete o ZIP final via `POST /api/Tracks/{id}/ProcessStemsZip`.
    * **Transição Atômica (ACID Swap)**: O endpoint `ProcessStemsZip` executa dentro de uma transação do Entity Framework, excluindo permanentemente a stem temporária `"Completo"`, deletando o arquivo `Completo.opus` e salvando as stems finais no banco de dados e no disco de forma 100% íntegra.
22. **Extração Automática de Thumbnails do YouTube e Conversão para WebP**:
    * **Downloader Resiliente**: O `mixer8-downloader` resolve o ID do vídeo do YouTube e baixa a thumbnail oficial diretamente de `img.youtube.com` via `HttpClient` (tentando `maxresdefault.jpg` com fallback automático para `hqdefault.jpg`), salvando temporariamente e anexando o Stream resultante à chamada multipart HTTP.
    * **Processamento e Salvamento WebP**: O backend API recebe o arquivo na assinatura de `ImportCompleted` sob o parâmetro `coverFile`, executa o `ImageHelper` (crop 1:1, resize 500x500 e codificação WebP a 80% de qualidade) e salva a capa física resultante em `wwwroot/stems/{id}/cover.webp` (associando-a à track no PostgreSQL).
23. **Extração e Exposição Segura de Cifras e Letras (chords.json e lyrics.json) com Monitoramento Resiliente de BEATSCHORDS_A**:
    * **Interceptação no Worker**: O `Worker.cs` intercepta assincronamente as requisições de rede contendo as cifras (`chords.json` ou identificador `BEATSCHORDS`) e letras sincronizadas (`lyrics.json`, `LYRICS` ou `transcription`) da DAW do Moises.ai, empacotando-as no ZIP usando `ZipFile.Open`.
    * **Monitoramento Resiliente via GraphQL**: O worker agora monitora ativamente a operação `BEATSCHORDS_A` via GraphQL. O processamento das stems principais (`SEPARATE_CUSTOM`) é tratado como falha fatal, enquanto as cifras e batidas (`BEATSCHORDS_A`) e letras (`LYRICS_B`) são tratadas como falhas não-fatais. O bot aguarda até 180 segundos adicionais por `BEATSCHORDS_A` após a conclusão das stems. Se expirar ou falhar, prossegue normalmente com o download apenas das stems e cifras/letras parciais obtidas.
    * **Descompressão Segura na API**: O `TracksController.cs` valida cada entrada de arquivo de texto: restringe o tamanho máximo de descompressão a 2MB (Anti-Zip Bomb), valida a estrutura dos dados através de parse com `System.Text.Json.JsonDocument` descartando dados inválidos (Anti-XSS/Malware) e grava os arquivos em caminhos estáticos fixados no servidor via `Path.Combine`, neutralizando ataques de Path Traversal (*Zip Slip*).
    * **Serviço Estático**: Cifras e letras são salvas como arquivos físicos estáticos independentes em `wwwroot/stems/{TrackId}/chords.json` e `lyrics.json`, prontas para escala stateless de CDN e Object Storage (S3/R2).
24. **Exibição Dinâmica do Acorde Atual no Player (Desktop e Mobile)**:
    * **Contexto de Transposição Global**: O estado de transposição de tom (`transpose`) foi movido para o `PlayerContext.tsx` global para sincronizar cifras e áudio de forma coerente. Mudar o tom no modal de letras reflete instantaneamente em todo o app. O estado é resetado ao carregar novas faixas.
    * **Mapeamento e Exibição de Acordes**: O player (`MesaPlayer.tsx`) baixa sob demanda o `/chords.json` da música ativa, calcula o acorde correspondente ao `currentTime` e o exibe como uma tag verde sutil (`bg-brand-green/10`, `border-brand-green/30`) apenas durante a reprodução.
    * **Alinhamento Responsivo**: No desktop, a tag Stems se move para cima ao lado do título da música, e a de acorde surge abaixo ao lado do artista. No mobile, a tag é renderizada inline na mesma linha do artista para otimizar espaço.
25. **Sistema de Auditoria de Logs Centralizado e CRM Administrativo**:
    * **Centralização de Observabilidade**: Todos os logs de execução do ecossistema (API, Extrator, Downloader, Waveformer) são centralizados na tabela `"SystemEvents"`, estruturados por categorias e níveis de severidade.
    * **Polling Contínuo e UX do CRM**: O CRM conta com busca inteligente sem acento, filtros e um polling de novos logs contínuo que roda em segundo plano. Notificações flutuantes sinalizam novos eventos sem layout shift. Ao atualizar, o feed mescla as entradas e reseta a paginação de volta para a Página 1 (`setPage(1)`).
Status do Projeto: Purga de Mocks Concluída, Player Multi-Stems Ativo, Uploader Direto Implementado, Conteinerização/Conversão Opus Concluída, Recursos Premium/Shuffle/Repeat Dinâmicos, Barra de Progresso Premium, Extrator Headless E2E via Playwright, Menu de Contexto Irrestrito Ativos, Acesso Anônimo com Endpoints de Segurança e Modal de Login Globais Integrados, Remoção de Cookies/Testes de Sessão Legados Concluída, Unificação de Login/Cadastro em Modal Único (Eliminação de Rotas Dedicadas), Microsserviço de Download Agnóstico (mixer8-downloader) com yt-dlp, Overhaul de Upload & Prévia Imediata (1-Stem) com Workers 100% Desacoplados via APIs HTTP Stateless, Extração Automática de Thumbnails do YouTube com Processamento WebP para Capas de Música, Extração e Exposição Segura de Cifras e Letras (chords.json e lyrics.json) com Validação Ativa contra Path Traversal, Zip Bomb e XSS, Monitoramento GraphQL Resiliente de Cifras e Metrônomo (BEATSCHORDS_A), Sistema de Auditoria de Logs Centralizado (`SystemEvents`) com Polling Contínuo e Categoria "Play" Dedicada, Gestão de Acesso Administrativo com Sincronização Silenciosa de Claims (JWT) e Busca Global Imune a Acentos.

---

## 📌 Visão Geral do Ecossistema

O **Mixer8** é uma aplicação moderna baseada em streaming multi-stems (estilo reprodutor premium de referência + DAW) que permite ao usuário isolar e mixar faixas independentes em tempo real de forma totalmente integrada ao banco relacional PostgreSQL do seu homelab.

### Stacks & Módulos
1. **Frontend (`mixer8-app`)**: React (LTS) + Vite + TailwindCSS + Lucide Icons + Web Audio API. Rodando na porta **`3000`** vinculada ao `.env`.
2. **Backend API (`mixer8-api`)**: ASP.NET Core (.NET 10 / C# 13) rodando na porta **`5000`** e mapeado estritamente em **PascalCase**.
3. **Background Worker (`mixer8-extractor`)**: Hosted Service C# (.NET 10) que realiza polling transacional na tabela `"Tracks"` (`FOR UPDATE SKIP LOCKED`) e orquestra a automação headless com cookies reais e perfil de usuário persistente via ferramenta de automação.

---

## 🛠️ Fundações Consolidadas (Entregas Atuais)

1. **Geração Física de Migrations**: Criada e aplicada a primeira migração física `InitialCreate` mapeando a estrutura relacional real (`Users`, `Tracks`, `Stems`).
2. **Autenticação RBAC e BCrypt**: Senhas criptografadas com hash adaptativo BCrypt. Usuários semente (`admin`, `moderator`, `paiduser`, `user`) registrados com a senha `mixer8` e claims injetados nos tokens JWT.
3. **Automação Headless Baseada em Credenciais Locais (Desacoplamento de Cookies)**:
   * Removido o sistema legado de importação de cookies (`auth.json`) e testes de conexão do painel administrativo e do backend.
   * O bot/worker realiza a autenticação de forma 100% independente utilizando credenciais de ambiente (`.env`) e persistência nativa de sessão via perfil do navegador Playwright (`user_profile`), eliminando o armazenamento de cookies de terceiros no banco de dados.
4. **Portas Dinâmicas**: Configuração unificada via `.env` na raiz do projeto.
5. **Purga Completa de Mocks**:
   * **Página Explorar**: Dados de Queen, Santana e Eagles fictícios removidos por completo. O catálogo consome faixas reais via `/api/Tracks` e oculta seções de gêneros caso não existam músicas prontas.
   * **CRM Administrativo**: Lista de usuários fakeados removida. O CRM de controle do administrador faz requisições JWT autenticadas à API `/api/Users` listando contas registradas no PostgreSQL.
6. **Mesa de Mixagem Inteligente e Player Progressive**:
   * Utiliza progressive audio streaming com elementos `new Audio()` invisíveis acoplados a `MediaElementAudioSourceNode` e somados em um `GainNode` da `Web Audio API` por canal.
   * Faders na DAW renderizam-se dinamicamente conforme as stems presentes na música no banco, com verificação de presets traduzidos para português (`Vocais` e `Metrônomo` baseados na plataforma externa).
   * **Ajuste de Responsividade**: Adicionado encolhimento de layout de tela (`pb-24`) reativo à presença de áudio ativo para manter a sidebar e todos os botões do rodapé 100% clicáveis acima do player.
7. **Uploader Direto de Stems (ZIP/MP3)**:
   * **Payload de Alta Resiliência**: Backend com limits de Kestrel e `FormOptions` configurados para tankar requisições multipartes de até 500 MB.
   * **Static Files com CORS**: Servidor estático em `wwwroot/stems` habilitado com injeção manual de CORS (`Access-Control-Allow-Origin: *`) para permitir carregamento de áudios no player via Web Audio API.
   * **Validador de Sandbox**: Descompressão de ZIPs em memória (`ZipArchive`), extraindo e salvando estritamente arquivos com extensão de áudio permitida, blindando o ecossistema contra scripts maliciosos.
   * **Mapeamento Heurístico C#**: Conversão em tempo de execução de termos em inglês (ex: `bass.mp3`) para português (`Baixo.mp3`) e associação a metadados, capa e persistência no banco com status `Pronto`.
   * **UX Drag-and-Drop**: Uploader em React com drag-and-drop, preview de capa com URL temporária e classificação preditiva instantânea do tipo de stem na UI.
8. **Dockerização e Conversão Opus In-Memory**:
   * **Dockerfiles Multi-Stage**: Criados Dockerfiles para a API do backend (com instalação do `ffmpeg` com `libopus`), Worker de background e Frontend (com servidor Nginx Alpine otimizado).
   * **Orquestração Geral**: `docker-compose.yml` ajustado e ativado para subir todos os containers integrados sob volumes compartilhados de download e comunicação interna de rede.
   * **Conversão Opus**: Toda stem recebida (seja via upload direto ou extração do Worker) é transcodificada in-memory via pipes do FFmpeg para `.opus` (mono a 64k VBR para canais como Voz/Baixo, e estéreo a 96k VBR para os demais), reduzindo drasticamente o consumo de armazenamento sem perda perceptível de qualidade.
   * **Worker Realista com Automação de Navegador**: O `Worker.cs` faz a extração real de stems na plataforma externa de stems de ponta a ponta simulando cliques e uploads locais de forma emulada via Playwright. Utiliza perfis de usuário persistentes (`user_profile`), varredura dinâmica de IFrames, seleção explícita de MP3 no player, um portão de tempo dinâmico (3 a 5 minutos) baseado no tamanho do arquivo original para evitar downloads prematuros, um recarregamento de página (F5) com buffer de 30 segundos para contornar gargalos de renderização gráfica headless, invocando a API via `/api/Tracks/{id}/ProcessStemsZip` para conversão. O extrator executa em modo headless por padrão no ambiente de homologação e produção.
9. **Otimização de Transmissão (HTTP Range 206) e Sliders Premium**:
   * **Carregamento Otimizado**: Alterado o pré-carregamento das stems para `preload = 'metadata'`, evitando o download automático de arquivos inteiros de áudio e economizando banda.
   * **Streaming Parcial (HTTP 206)**: Servidor estático configurado com cabeçalhos de `Cache-Control` (30 dias) e suporte nativo a HTTP Range Requests, transmitindo bytes progressivamente em chunks.
   * **Timeline com Drag-and-Release**: A linha de progresso do player agora é um input de controle real com marcador circular verde. O seek do áudio só é executado no soltar do mouse/toque, evitando múltiplos requests repetitivos e travamentos do player.
   * **Volume Master Real**: Integrado um nó de ganho master (`masterGainNode`) na Web Audio API vinculado ao fader de volume, alterando o ganho de todas as stems em tempo real de forma local e imediata.
10. **Ajustes e Edição Completa de Playlists (Capas Físicas, Descrições e Deleção Segura)**:
    * **Propriedade de Descrição**: Adicionada propriedade nullable `Description` no modelo `Playlist.cs`, com migração EF Core robusta aplicada com sucesso no banco relacional PostgreSQL do homelab.
    * **Upload de Capa e Persistência Física**: Suporte a upload de arquivo de imagem (`multipart/form-data`) para persistência de capas customizadas em `wwwroot/playlists/{id}/`.
    * **Deleção Física Segura**: Implementadas regras de exclusão em disco que removem a imagem antiga/substituída ou deletada. A limpeza física é protegida, ocorrendo apenas caso o link inicie com `/playlists/`, mantendo as capas de músicas intactas. A deleção da playlist apaga síncronamente toda a sua pasta no servidor.
    * **Modais Centralizados no React**: Lógica de edição e exclusão de playlists migrada inteiramente para o escopo global reativo em `PlaylistContext.tsx`, limpando códigos duplicados das páginas internas.
    * **Timer de Segurança e Eventos Reativos**: A exclusão conta com aviso destrutivo e contagem regressiva reativa de 3 segundos no botão de ação. Ao salvar ou deletar, são emitidos os eventos personalizados `playlist-updated` e `playlist-deleted` garantindo atualização imediata sem recarregar a SPA.
11. **Correção do Autoplay contra Stale Closures (Refs Mutáveis)**:
    * O listener de fim de faixa (`ended`) no elemento master de áudio foi corrigido substituindo referências a funções locais por referências mutáveis (`useRef`). Isso evita closures congeladas/stale que impediam o avanço automático da fila de reprodução na SPA.
12. **Shuffle (Aleatório) e Repeat (Repetição) no Player**:
    * Implementados os modos Shuffle e Repeat no player com sincronização e persistência no `localStorage`.
    * A reprodução aleatória gerencia uma pilha interna de histórico para evitar repetições no avanço e permitir o retorno de faixas exato na ordem inversa. O Repeat suporta One, All e Off.
13. **Persistência Sem Perda del Mixer e Isenção de Faixa Única**:
    * A mesa de stems foi ajustada para persistir volumes, mutes e solos por canal no `localStorage`. Em vez de limpar o dicionário ao carregar novas músicas, realizamos uma mesclagem (merge) preservando chaves de canais ausentes.
    * A atualização de ganho de áudio foi otimizada com referências mutáveis para contornar atrasos de batching do React.
    * Adicionada isenção de ganho (1.0 constante) para faixas contendo apenas uma única stem, evitando silenciamento colateral.
14. **Parametrização Dinâmica de Recursos Premium (Roles & Anonymous)**:
    * Criada a tabela de banco de dados `SystemSettings` e o endpoint restrito `SystemSettingsController` no backend API.
    * Desenvolvido card de gerenciamento administrativo em `/admin` permitindo definir dinamicamente quais grupos de acesso (Roles) possuem o recurso premium de Download Offline.
    * Integrado suporte para usuários não autenticados (`anonymous`) baixarem e cachearem músicas localmente de forma transparente.
15. **Barra de Progresso Dinâmica Premium (Visual Estilo Reprodutor de Referência)**:
    * Substituído o comportamento anterior onde apenas a bolinha (thumb) se movia na barra de progresso do player.
    * Implementada a classe CSS `.dynamic-progress` com suporte a variáveis customizadas (`--slider-progress`) baseadas em `linear-gradient`.
    * A cor percorrida é pintada dinamicamente com o verde premium `#1db954`, enquanto a restante permanece cinza (`#282828` padrão ou `#333333` no hover), atualizando em tempo real com fluidez tanto na interface Desktop quanto na versão Mobile expandida.
16. **Interação e Exclusão Irrestrita na Biblioteca**:
    * Habilitado o menu de contexto personalizado do Mixer8 para todas as faixas (independentemente do status de extração: `Aguardando`, `Processando...`, `Falhou`, `Pronto`), evitando a exibição do menu padrão do navegador.
    * O editor de metadados e o fluxo relacional/físico de exclusão em cascata do backend foram validados para funcionar perfeitamente em faixas sem stems ou com processamento interrompido.
    * A injeção em playlists de músicas não prontas permanece bloqueada na interface de usuário.
17. **Suporte a URLs de Capas Personalizadas**:
    * Adicionado o campo "Ou URL Externa da Imagem" nos modais de edição de músicas e de playlists.
    * O backend foi estendido para receber CoverUrl nos payloads de atualização, limpando fisicamente as capas locais anteriores ao atualizar para URLs de terceiros, garantindo integridade de disco e prevenindo arquivos órfãos.
18. **Acesso Público, Endpoints Seguros, Lazy Playlists e Blindagem do SystemSettings**:
    * A rota raiz `/` (Explorar) tornou-se pública para visitantes deslogados, com play de faixas e playlists ativo anonimamente.
    * Criado o `ExploreController` no backend com endpoints especializados públicos (`/api/Explore/WeeklyTrends` e `/api/Explore/PopularPlaylists`) rigidamente limitados a 6 registros para prevenir scraping.
    * Adicionado filtro robusto no `/api/SystemSettings` para expor somente configurações públicas (`PremiumFeature_`), impedindo o vazamento de tokens sensíveis (`MoisesSession_AuthJson`).
    * Criado modal de autenticação global dinâmico (`LoginModal`) integrado ao `AuthContext` para interceptar cliques de usuários anônimos em ações que necessitem de privilégios.
    * Otimizado o carregamento de playlists com lazy loading reativo no `PlaylistContext` (eliminando a chamada inicial no mount geral).
19. **Unificação do Fluxo de Autenticação via Modal Global (Eliminação de Rotas Dedicadas)**:
    * As rotas `/login` e `/register` foram completamente removidas da SPA, e suas respectivas páginas deletadas.
    * Todas as ações e links que redirecionavam para o login foram alteradas para acionar o modal global de login reativamente.
    * Configurado o `ProtectedRoute` para redirecionar usuários não autenticados para a home com o parâmetro `?showLogin=true`, o qual é interceptado pelo layout do app para acionar o modal e limpar a URL de forma imediata e transparente.
20. **Microsserviço de Download Agnóstico (mixer8-downloader) com yt-dlp**:
    * **Banco de Dados**: Coluna `DownloadUrl` adicionada à tabela `Tracks` com migration EF Core robusta aplicada com sucesso no PostgreSQL.
    * **Backend API**: Adicionado endpoint `POST /api/Tracks/ImportUrl` (restrito a `Admin` e `PaidUser`) para registrar links externos e enfileirar downloads com status `AguardandoDownload`. Sanitiza URLs do YouTube extraindo apenas o ID do vídeo para gravação no banco.
    * **Worker Downloader**: Criado o novo worker de background `mixer8-downloader` (.NET 10) que realiza polling seguro (`FOR UPDATE SKIP LOCKED`) na fila de download, reconstrói o link limpo caso o banco de dados armazene apenas o ID do vídeo e invoca o `yt-dlp` com a flag `--no-playlist` para segurança. Converte o áudio para Opus (`.opus`), calcula a duração com `ffprobe` e atualiza o status via API.
    * **Dockerização**: Criado Dockerfile multi-stage com .NET 10, Python 3, `yt-dlp` e `ffmpeg` sob ambiente isolado `venv`. Atualizado o `docker-compose.yml` compartilhando o volume `/app/downloads`.
    * **Frontend SPA**: Adicionada aba de importação "Link de Mídia (URL)" no modal global de upload, controlando states de forma segura com concorrência blindada (botão desabilitado com carregamento visual) e contratos preservando **PascalCase**.
21. **Overhaul do Fluxo de Upload e Prévia Imediata (1-Stem)**:
    * **Prévia Imediata (Completo.opus)**: Faixas físicas e externas convertidas instantaneamente para Opus Estéreo leve (`Completo.opus`) em `wwwroot/stems/{id}/` e registradas sob uma stem temporária `"Completo"`. Ficam disponíveis imediatamente para play na SPA com faders bloqueados/ocultados e feedback visual informativo.
    * **Leitura de Metadados Ricos (TagLibSharp)**: Integrado o pacote NuGet `TagLibSharp` para auto-extrair Título, Artista e Capa física embutida de uploads diretos. Capas físicas são processadas in-memory para WebP 500x500 (80% qualidade) e salvas no disco.
    * **Workers 100% Stateless (Comunicação via APIs HTTP)**: Eliminada a dependência de volumes compartilhados em produção. O worker `mixer8-downloader` faz upload do áudio concluído via `POST /api/Tracks/{id}/ImportCompleted` e o worker `mixer8-extractor` baixa a prévia via `GET /stems/{id}/Completo.opus`, executa a automação Playwright e submete o ZIP final via `POST /api/Tracks/{id}/ProcessStemsZip`.
    * **Transição Atômica (ACID Swap)**: O endpoint `ProcessStemsZip` executa dentro de uma transação do Entity Framework, excluindo permanentemente a stem temporária `"Completo"`, deletando o arquivo `Completo.opus` e salvando as stems finais no banco de dados e no disco de forma 100% íntegra.
22. **Extração Automática de Thumbnails do YouTube e Conversão para WebP**:
    * **Downloader Resiliente**: O `mixer8-downloader` resolve o ID do vídeo do YouTube e baixa a thumbnail oficial diretamente de `img.youtube.com` via `HttpClient` (tentando `maxresdefault.jpg` com fallback automático para `hqdefault.jpg`), salvando temporariamente e anexando o Stream resultante à chamada multipart HTTP.
    * **Processamento e Salvamento WebP**: O backend API recebe o arquivo na assinatura de `ImportCompleted` sob o parâmetro `coverFile`, executa o `ImageHelper` (crop 1:1, resize 500x500 e codificação WebP a 80% de qualidade) e salva a capa física resultante em `wwwroot/stems/{id}/cover.webp` (associando-a à track no PostgreSQL).
23. **Extração e Exposição Segura de Cifras e Letras (chords.json e lyrics.json) com Monitoramento Resiliente de BEATSCHORDS_A**:
    * **Interceptação no Worker**: O `Worker.cs` intercepta assincronamente as requisições de rede contendo as cifras (`chords.json` ou identificador `BEATSCHORDS`) e letras sincronizadas (`lyrics.json`, `LYRICS` ou `transcription`) da DAW do Moises.ai, empacotando-as no ZIP usando `ZipFile.Open`.
    * **Monitoramento Resiliente via GraphQL**: O worker agora monitora ativamente a operação `BEATSCHORDS_A` via GraphQL. O processamento das stems principais (`SEPARATE_CUSTOM`) é tratado como falha fatal, enquanto as cifras e batidas (`BEATSCHORDS_A`) e letras (`LYRICS_B`) são tratadas como falhas não-fatais. O bot aguarda até 180 segundos adicionais por `BEATSCHORDS_A` após a conclusão das stems. Se expirar ou falhar, prossegue normalmente com o download apenas das stems e cifras/letras parciais obtidas.
    * **Descompressão Segura na API**: O `TracksController.cs` valida cada entrada de arquivo de texto: restringe o tamanho máximo de descompressão a 2MB (Anti-Zip Bomb), valida a estrutura dos dados através de parse com `System.Text.Json.JsonDocument` descartando dados inválidos (Anti-XSS/Malware) e grava os arquivos em caminhos estáticos fixados no servidor via `Path.Combine`, neutralizando ataques de Path Traversal (*Zip Slip*).
    * **Serviço Estático**: Cifras e letras são salvas como arquivos físicos estáticos independentes em `wwwroot/stems/{TrackId}/chords.json` e `lyrics.json`, prontas para escala stateless de CDN e Object Storage (S3/R2).
24. **Exibição Dinâmica do Acorde Atual no Player (Desktop e Mobile)**:
    * **Contexto de Transposição Global**: O estado de transposição de tom (`transpose`) foi movido para o `PlayerContext.tsx` global para sincronizar cifras e áudio de forma coerente. Mudar o tom no modal de letras reflete instantaneamente em todo o app. O estado é resetado ao carregar novas faixas.
    * **Mapeamento e Exibição de Acordes**: O player (`MesaPlayer.tsx`) baixa sob demanda o `/chords.json` da música ativa, calcula o acorde correspondente ao `currentTime` e o exibe como uma tag verde sutil (`bg-brand-green/10`, `border-brand-green/30`) apenas durante a reprodução.
    * **Alinhamento Responsivo**: No desktop, a tag Stems se move para cima ao lado do título da música, e a de acorde surge abaixo ao lado do artista. No mobile, a tag é renderizada inline na mesma linha do artista para otimizar espaço.
25. **Sistema de Auditoria de Logs Centralizado e CRM Administrativo**:
    * **Centralização de Observabilidade**: Todos os logs de execução do ecossistema (API, Extrator, Downloader, Waveformer) são centralizados na tabela `"SystemEvents"`, estruturados por categorias e níveis de severidade.
    * **Polling Contínuo e UX do CRM**: O CRM conta com busca inteligente sem acento, filtros e um polling de novos logs contínuo que roda em segundo plano. Notificações flutuantes sinalizam novos eventos sem layout shift. Ao atualizar, o feed mescla as entradas e reseta a paginação de volta para a Página 1 (`setPage(1)`).
    * **Categoria Play Dedicada e Badges Coloridos**: Eventos de reprodução de áudio são gravados sob a categoria dedicada `"Play"`. O CRM renderiza badges dinamicamente coloridos conforme a categoria (verde para `Play`, roxo para `Auth`, azul para `API` e âmbar para `System`), proporcionando escaneamento visual imediato.
    * **Busca Global sem Acento**: Busca case/accent-insensitive estendida para biblioteca (via `unaccent`/`ILike` do PostgreSQL) e playlists (via normalização `NFD` client-side em JavaScript).
    * **Auditoria de Edições de Músicas**: Alterações em metadados textuais (título, artista, visibilidade) e manipulações físicas de arquivos de stems (adições, excluções e substituições) são detectadas na rota `PUT /api/Tracks` e gravadas no log de auditoria sob nível `Warning`.
    * **Prevenção de Duplicados do YouTube**: A API valida se o ID de vídeo extraído da URL já existe no banco. Se detectado duplicado, retorna `409 Conflict`. O frontend intercepta a falha, exibe um toast de aviso âmbar, fecha o modal e redireciona o usuário preenchendo a busca global para filtrar a música existente de imediato.
26. **Gestão de Acesso Administrativo e Sincronização Silenciosa de JWT**:
    * Refatorada a aba **Usuários Ativos** do CRM seguindo o padrão de filtros, buscas sem acento e scroll infinito. Administradores podem atualizar funções (Roles) de usuários, com proteção contra auto-rebaixamento para o último administrador ativo.
    * Criado endpoint de renovação silenciosa `POST /api/Auth/RefreshToken` no backend e o método `RefreshTokenClaims` no `AuthContext` da SPA, permitindo que a elevação de privilégios (ex: Free para Paid PRO) seja refletida no token JWT do cliente no mesmo instante, eliminando a necessidade de logoff manual.
27. **Estúdio DAW Multifaixas e Balanço Estéreo (Panning)**:
    * **Engenharia de Áudio (Panning)**: Integrado `StereoPannerNode` na Web Audio API do `PlayerContext.tsx` com estado de `stemsPan` persistido no `localStorage`.
    * **Knob Rotativo Físico e Arraste Linear**: Desenvolvido o componente `<RotaryKnob />` em SVG circular, com agulha indicadora e arraste linear vertical (Y delta) do cursor para precisão. O knob conta com atalho de clique duplo para retornar ao centro (0.0).
    * **Faders e Visual DAW**: Customizados faders de volume como retângulos de console analógico (sem "bolinhas" nativas). A tela `DawView` conta com waveforms em `<canvas>` 2D de alta densidade (1.5px de largura, 0.5px de espaçamento) pintadas em **preto sólido** sobre fundo **verde fosco do Mixer8** (verde fosco médio `#155f2e` na área reproduzida e verde fosco escuro `#0d2716` na área pendente). A agulha de playhead vertical é **branca brilhante** com guia triangular superior branca.
    * **Regra de Ocultação Mono**: O knob de Pan é condicionalmente ocultado nas pistas mono multifaixas (Voz, Baixo, Metrônomo), sendo visível apenas nas stems estéreo (Bateria, Guitarra, Outros) e na faixa Completo original.
28. **Motor de Áudio WASM de Alta Fidelidade (Modo Power) com Signalsmith Stretch**:
    * **Signalsmith Stretch WASM**: Integrado algoritmo MIT Spectral Phase-Locked Vocoder com suporte a WASM SIMD 128-bit (`-msimd128`) compilado via Emscripten em Docker.
    * **AudioWorklet Processor**: O processamento de áudio ocorre em thread dedicada, garantindo performance a 60fps sem travar a thread principal da UI.
    * **Bypass de Metrônomo**: Roteamento direto do canal Metrônomo contornando o processador de transposição para preservar a integridade do clique.
    * **Persistência de Perfil**: Modo do player (`AudioEngineMode` - Power vs Lite) exposto no backend API com migração EF Core no PostgreSQL e configurável via painel settings no front.
29. **Redesenho do Cabeçalho Fixo Global e Letras Integradas**:
    * **GlobalTopHeader**: Cabeçalho fixo no topo (`h-[72px]`) com caixas musicais (Acorde, Tom, BPM e Zoom) de altura padronizada (`h-[46px]`), visual dark Spotify-style e ícones Lucide. Os controles ficam fixados na direita e o zoom na esquerda após o título da música, prevenindo layout shifts ao navegar para a DAW.
    * **Reset Estável**: Botões de reset mantêm referências estáveis no DOM com opacidade/ponteiro desativados quando inativos, evitando saltos de dimensão horizontal.
    * **Letras Integradas sem Colisão**: Modal de letras descontinuado por exibição integrada de tela cheia. O botão voltar foi isolado em uma barra superior transparente de 56px (`h-14`), impedindo que o texto da cifra se choque com o botão durante o scroll vertical.
30. **Filtros de Visibilidade Avançados, Persistência Local e Padronização da Barra Lateral**:
    * **Mapeamento da API**: O endpoint `/api/Tracks` (`GetAll`) foi estendido para aceitar o parâmetro `[FromQuery] string? visibility = null` filtrando os resultados do banco de forma paginada e eficiente.
    * **Chips de Visibilidade e localStorage**: Substituídos os alternadores binários simples por chips contendo 4 estados (Públicas, Todas, Privadas, Não-Listadas) persistidos de forma individualizada no `localStorage` para cada tipo de listagem (ex: `mixer8_visibility_filter_library` para a biblioteca, e `mixer8_visibility_filter_playlists` para as playlists).
    * **Layout e Sidebar PC/Mobile**: Padronizado todo o texto da sidebar no PC para `text-sm font-semibold`. Introduzido divisor vertical físico no menu superior mobile e configurado o menu de abas do Admin para exibir apenas ícones em telas pequenas (`hidden sm:inline` nos textos).
31. **Seções de Configurações Colapsáveis (Acordeão) no Admin**:
    * **Interface Compacta e Limpa**: As três seções do painel de Configurações Globais (Download Offline, Webhooks, e Sincronização) foram encapsuladas em painéis colapsáveis do tipo acordeão.
    * **Navegação e Indicador Visual**: Cada cabeçalho possui um botão de clique com ícone `ChevronDown` com rotação de 180 graus integrada ao estado para sinalizar abertura. Ao carregar a página, todas as seções iniciam fechadas.
32. **Refatoração do Modal de Adicionar Música (Upload Assíncrono e Toasts Dinâmicos)**:
    * **Desacoplamento e Assincronismo**: O modal de upload de arquivos e link de importação não bloqueia mais a interface do usuário com um overlay de log de worker em tempo real. O fechamento é imediato assim que a API backend confirma o recebimento da tarefa (HTTP 200 OK).
    * **Notificações Toast Dinâmicas**: Desenvolvidos toasts com cores e ícones baseados no tipo de feedback (verde com `Check` para sucesso, vermelho com `AlertTriangle` para erros, e amarelo com `ShieldAlert` para alertas de faixas duplicadas).
    * **Ergonomia e Fechamento**: O modal de upload agora suporta fechamento ao clicar na área escura de fundo (fora da caixa) e possui um ícone "X" de fechamento no canto superior direito. Todos os inputs e botões de ação (como trocar nomes ou solicitar downloads) são desativados de forma robusta enquanto uma requisição está ativa.
33. **Controles de Reprodução de Playlists e Banner de Entrada Refinado**:
    * **Controles Integrados de Playlists**: Os botões de play nos cards de playlist (`PlaylistListing.tsx`, `ExploreShelf.tsx`, `PublicProfile.tsx`) e na página de detalhes da playlist (`PlaylistDetail.tsx`) agora detectam a playlist ativa e alternam entre play e pause. Ao iniciar a reprodução, respeitam o estado de `isShuffle` iniciando por uma faixa aleatória caso o aleatório esteja ativo.
    * **Banner de Entrada Otimizado**: O banner de entrada do painel Explorar foi simplificado para ocupar menos espaço. Exibe uma saudação personalizada destacando o nome do usuário ativo (ou username) em verde se logado, alinha perfeitamente a linha de base do logotipo da marca com `translateY(3.5px)` e exibe uma descrição resumida da DAW em fonte sutil.
34. **Remoção do Botão Redundante de Fechar (X) no Cabeçalho Fixo Global**:
    * **Otimização de Layout**: Como as telas de overlay (DAW e Letras) possuem suas próprias barras superiores completas com botão de fechar, o botão redundante "X" localizado na extremidade direita do `GlobalTopHeader` foi removido.
    * **Liberdade Espacial**: Com essa remoção, os controles de áudio (Cifra, Acorde, Tom, BPM e Zoom) ganharam liberdade para posicionar-se naturalmente no alinhamento à direita sem colisões ou margens mortas em resoluções Desktop e Mobile.
    * **Limpeza de Código**: Removidas a importação do ícone `X` da `lucide-react` e a desestruturação do estado não utilizado `setActiveOverlay` em `GlobalTopHeader.tsx`.
35. **Exportação de Mix Customizada na DAW em MP3 192kbps 48kHz Assíncrono com Toast Não-Bloqueante**:
    * **Motor de Renderização Client-Side**: O motor `mixExporter.ts` renderiza offline a mistura exata das stems (volumes, mutes, solos, panners estéreo, tom transposto e variação de BPM) via `OfflineAudioContext(2, totalSamples, 48000)` a 48000 Hz sem sobrecarregar a CPU do servidor.
    * **Codificação PCM para MP3**: Codifica a matriz Float32 PCM resultante diretamente no navegador em MP3 192 kbps utilizando `lamejs` em micro-blocos assíncronos que evitam o travamento da thread de UI.
    * **UX Não-Bloqueante com Toast**: Adicionado o botão "Exportar mix" no cabeçalho fixo (`GlobalTopHeader.tsx`) imediatamente à esquerda do controle de Zoom na DAW. Ao clicar, o processo roda de forma completamente assíncrona, exibindo uma notificação Toast flutuante com barra de progresso em tempo real (0% a 100%) enquanto o usuário navega ou escuta músicas livremente. O download automático é disparado ao concluir com o nome padronizado `<nomedamusica> - <nome do artista> (<tom> - <bpm>bpm).mp3`.

---

## 🎯 Próximo Milestone: Ajustes de Fluxo e Segurança de Rede
* Implementar autenticação via Refresh Token e renovação automática na SPA.
* Refinamento do worker de extração para suportar filas de prioridade (Premium vs Standard).
* Implementação de cache distribuído (Redis) para reduzir I/O de banco e otimizar listagens de exploradores.

---

## ❓ Perguntas Abertas / Notas
* O banco de dados PostgreSQL continua rodando de forma externa no homelab (`192.168.18.110`), mantendo-se comentado no compose para preservar a consistência relacional prévia.
