# Context Preservation (Save State) - Mixer8 Ecosystem

**Data da Última Atualização:** 20/07/2026  
Status do Projeto: Purga de Mocks Concluída, Player Multi-Stems Ativo, Uploader Direto Implementado, Conteinerização/Conversão Opus Concluída, Recursos Premium/Shuffle/Repeat Dinâmicos, Barra de Progresso Premium, Extrator Headless E2E via Playwright, Menu de Contexto Irrestrito Ativos, Acesso Anônimo com Endpoints de Segurança e Modal de Login Globais Integrados, Remoção de Cookies/Testes de Sessão Legados Concluída, Unificação de Login/Cadastro em Modal Único (Eliminação de Rotas Dedicadas), Microsserviço de Download Agnóstico (mixer8-downloader) com yt-dlp, Overhaul de Upload & Prévia Imediata (1-Stem) com Workers 100% Desacoplados via APIs HTTP Stateless, Extração Automática de Thumbnails do YouTube com Processamento WebP para Capas de Música, Extração e Exposição Segura de Cifras e Letras (chords.json e lyrics.json) com Validação Ativa contra Path Traversal, Zip Bomb e XSS, Monitoramento GraphQL Resiliente de Cifras e Metrônomo (BEATSCHORDS_A), Sistema de Auditoria de Logs Centralizado (`SystemEvents`) com Polling Contínuo e Categoria "Play" Dedicada, Gestão de Acesso Administrativo com Sincronização Silenciosa de Claims (JWT) e Busca Global Imune a Acentos, Filtros de Visibilidade, Padronização da Barra Lateral, Seções de Configurações Colapsáveis, Modal de Upload Assíncrono, Toasts Dinâmicos, Controles de Playlists com Toggle e Shuffle, Banner de Entrada Refinado, Exportação de Mix Customizada na DAW em MP3 192kbps 48kHz Assíncrono com Toast Não-Bloqueante, Desacoplamento e Sincronização Independente do Metrônomo, Remoção do Modo Lite, Modal de Confirmação com Congelamento de Exportação, Referências de Tom e Tempo Individuais, Fila Dinâmica por Provedores, Paginação de Playlists, Reverb por Canal, Robustez de Áudio no iOS, Algoritmo Title Case Inteligente, Sincronização de Tempo de Playlists, Unificação do Clique no Título com Play e Busca por Artista via Clique no Nome Concluídos.

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
35. **Exportação de Mix Customizada na DAW em MP3 192kbps 48kHz Assíncrono com Toast Não-Bloqueante, Vinil Giratório e Capa ID3v2**:
    * **Motor de Renderização Client-Side**: O motor `mixExporter.ts` renderiza offline a mistura exata das stems (volumes, mutes, solos, panners estéreo, tom transposto e variação de BPM) via `OfflineAudioContext(2, totalSamples, 48000)` a 48000 Hz sem sobrecarregar a CPU do servidor.
    * **Codificação PCM para MP3 & Metadados ID3v2**: Codifica a matriz Float32 PCM resultante em MP3 192 kbps utilizando `lamejs` em micro-blocos assíncronos e anexa metadados ID3v2.3 completos (Título, Artista, Álbum "Mixer8 DAW" e frame APIC contendo a capa física `cover.webp` da faixa) via `id3Writer.ts`.
    * **UX com Disco de Vinil Giratório e Toast**: Adicionado o botão "Exportar mix" no cabeçalho fixo (`GlobalTopHeader.tsx`) imediatamente à esquerda do controle de Zoom na DAW. O Toast flutuante (`ExportToast.tsx`) exibe um disco de vinil estilizado em rotação com o rótulo central da capa da música (`cover.webp`) e barra de progresso em tempo real (0% a 100%) sem travar a navegação. O download automático é disparado ao concluir com o nome padronizado `<nomedamusica> - <nome do artista> (<tom> - <bpm>bpm).mp3`.
36. **Desacoplamento e Sincronização Independente do Metrônomo em Tom e Tempo**:
    * **Isolamento de Tom (Pitch Shift):** Criada a função helper `isMetronomeStem(type)` em `PlayerContext.tsx` e `mixExporter.ts` que garante que o Metrônomo nunca sofra alterações de afinação (`transpose`), conectando-se diretamente ao ganho Master sem passar pelo AudioWorklet WASM de pitch shift.
    * **Acompanhamento Estrito de Tempo (BPM):** Garante que ao alterar simultaneamente o Tom (`transpose`) E o Tempo (`bpmDelta`), o Metrônomo continue escalando seu `playbackRate` estritamente na proporção de velocidade da música (`speedRatio = targetBpm / baseBpm`) sem perder o compasso nem sofrer alteração de timbre, tanto no player ao vivo da SPA quanto na exportação de áudio MP3 da DAW.

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
    * **Ergonomia e Fechamento**: O modal de upload agora suporta fechamento ao clicar na área escura de fundo (fora da caixa) and possui um ícone "X" de fechamento no canto superior direito. Todos os inputs e botões de ação (como trocar nomes ou solicitar downloads) são desativados de forma robusta enquanto uma requisição está ativa.
33. **Controles de Reprodução de Playlists e Banner de Entrada Refinado**:
    * **Controles Integrados de Playlists**: Os botões de play nos cards de playlist (`PlaylistListing.tsx`, `ExploreShelf.tsx`, `PublicProfile.tsx`) e na página de detalhes da playlist (`PlaylistDetail.tsx`) agora detectam a playlist ativa e alternam entre play e pause. Ao iniciar a reprodução, respeitam o estado de `isShuffle` iniciando por uma faixa aleatória caso o aleatório esteja ativo.
    * **Banner de Entrada Otimizado**: O banner de entrada do painel Explorar foi simplificado para ocupar menos espaço. Exibe uma saudação personalizada destacando o nome do usuário ativo (ou username) em verde se logado, alinha perfeitamente a linha de base do logotipo da marca com `translateY(3.5px)` e exibe uma descrição resumida da DAW em fonte sutil.
34. **Remoção do Botão Redundante de Fechar (X) no Cabeçalho Fixo Global**:
    * **Otimização de Layout**: Como as telas de overlay (DAW e Letras) possuem suas próprias barras superiores completas com botão de fechar, o botão redundante "X" localizado na extremidade direita do `GlobalTopHeader` foi removido.
    * **Liberdade Espacial**: Com essa remoção, os controles de áudio (Cifra, Acorde, Tom, BPM e Zoom) ganharam liberdade para posicionar-se naturalmente no alinhamento à direita sem colisões ou margens mortas em resoluções Desktop e Mobile.
35. **Exportação de Mix Customizada na DAW em MP3 192kbps 48kHz Assíncrono com Toast Não-Bloqueante, Vinil Giratório e Capa ID3v2**:
    * **Motor de Renderização Client-Side**: O motor `mixExporter.ts` renderiza offline a mistura exata das stems (volumes, mutes, solos, panners estéreo, tom transposto e variação de BPM) via `OfflineAudioContext(2, totalSamples, 48000)` a 48000 Hz sem sobrecarregar a CPU do servidor.
    * **Codificação PCM para MP3 & Metadados ID3v2**: Codifica a matriz Float32 PCM resultante em MP3 192 kbps utilizando `lamejs` em micro-blocos assíncronos e anexa metadados ID3v2.3 completos (Título, Artista, Álbum "Mixer8 DAW" e frame APIC contendo a capa física `cover.webp` da faixa) via `id3Writer.ts`.
    * **UX com Disco de Vinil Giratório e Toast**: Adicionado o botão "Exportar mix" no cabeçalho fixo (`GlobalTopHeader.tsx`) imediatamente à esquerda do controle de Zoom na DAW. O Toast flutuante (`ExportToast.tsx`) exibe um disco de vinil estilizado em rotação com o rótulo central da capa da música (`cover.webp`) e barra de progresso em tempo real (0% a 100%) sem travar a navegação. O download automático é disparado ao concluir com o nome padronizado `<nomedamusica> - <nome do artista> (<tom> - <bpm>bpm).mp3`.
36. **Desacoplamento e Sincronização Independente do Metrônomo em Tom e Tempo**:
    * **Isolamento de Tom (Pitch Shift):** Criada a função helper `isMetronomeStem(type)` em `PlayerContext.tsx` e `mixExporter.ts` que garante que o Metrônomo nunca sofra alterações de afinação (`transpose`), conectando-se diretamente ao ganho Master sem passar pelo AudioWorklet WASM de pitch shift.
    * **Acompanhamento Estrito de Tempo (BPM):** Garante que ao alterar simultaneamente o Tom (`transpose`) E o Tempo (`bpmDelta`), o Metrônomo continue escalando seu `playbackRate` estritamente na proporção de velocidade da música (`speedRatio = targetBpm / baseBpm`) sem perder o compasso nem sofrer alteração de timbre, tanto no player ao vivo da SPA quanto na exportação de áudio MP3 da DAW.

37. **Remoção do Modo Lite e Otimização do Processador WASM Offline**:
    * **Descontinuação da Engine Lite:** O "Modo Lite" de reprodução (baseado em Web Audio nativo puro) foi 100% descontinuado do player e das configurações do frontend para garantir a padronização no motor de alta fidelidade "Power" (Signalsmith Stretch WASM SIMD).
    * **Processamento Offline Direto nos Buffers:** A exportação de mixagem (`mixExporter.ts`) foi reescrita para aplicar time-stretching e pitch-shifting diretamente sobre os arrays Float32 dos buffers de áudio carregados em memória na thread principal usando a biblioteca WASM.
    * **Mixagem e Sincronia Estáveis:** As faixas processadas são injetadas na `OfflineAudioContext` em velocidade nativa `1.0`, eliminando qualquer desvio de tom (por falta de suporte a `preservesPitch` nas stems do navegador) e garantindo sincronia exata e sem latências residuais entre a música e o metrônomo.

38. **Modal de Confirmação de Cancelamento com Congelamento (Pausa) Imediato da Exportação e Refinamentos Visuais**:
    * **Rotulagem do Botão no Cabeçalho:** Simplificado o rótulo do botão de exportação no cabeçalho fixo (`GlobalTopHeader.tsx`) de 'Exportar mix' para 'Exportar'.
    * **Botão 'X' e Abortamento de Exportação:** Adicionado botão de fechar ('X') permanente no canto superior direito da notificação toast (`ExportToast.tsx`), ativo tanto no mobile quanto no desktop durante o processamento.
    * **Pausa Imediata & Modal de Confirmação:** Ao clicar em 'X' durante a exportação, o processo de exportação (download de stems, processamento WASM ou codificação MP3) é **congelado/pausado imediatamente** via `checkPause()` no `mixExporter.ts`, suspendendo o avanço de porcentagem e a renderização antes mesmo da escolha do usuário.
    * **Decisão do Usuário:** 
      * Ao clicar em **'Sim, cancelar'**, a exportação é interrompida via `AbortController` (`abortExport()`), limpando o estado de exportação sem gerar download.
      * Ao clicar em **'Não, continuar'**, o modal fecha e o processo de exportação é **despausado/retomado** via `resumeExport()`, continuando o download exatamente do ponto onde parou.

39. **Isolamento Estrito e Persistência Individual de Tom e Tempo por Faixa**:
    * **Eliminação de Vazamentos de Estado:** Removidos efeitos colaterais (`useEffects`) que reescreviam a transposição de tom (`transpose`) e delta de BPM (`bpmDelta`) no `localStorage` ao alternar entre faixas.
    * **Sincronização por Referências Mutáveis (`transposeRef` / `bpmDeltaRef`):** Implementadas referências mutáveis que sincronizam o tom e o tempo instantaneamente no ciclo de vida assíncrono do `loadTrack`, contornando o atraso de estado assíncrono do React.
    * **Carregamento Sincronizado por Música (`loadTrack`):** Ao carregar uma música (manual ou automaticamente via fila/autoplay), o `PlayerContext` lê as chaves `mixer8:track:<TrackId>:transpose` e `mixer8:track:<TrackId>:bpm-delta` no `localStorage`. Atualiza as refs e dispara `applyPitchAndTempoSettings(targetTranspose, targetBpmDelta)` imediatamente após a criação dos nós de áudio, aplicando a transposição correta desde o primeiro milissegundo de reprodução.
    * **Setters Dedicados por Faixa (`setTransposeSynced` / `setBpmDeltaSynced`):** A alteração de Tom ou BPM via interface do usuário salva a nova configuração exclusivamente sob a chave `TrackId` ativa no `localStorage`. Mudar de música não afeta nem sobrescreve os valores das faixas subsequentes.

40. **Arquitetura de Fila Dinâmica Agnóstica por Provedor (`IQueueProvider`)**:
    * **Padrão Strategy Agnóstico:** Criado o contrato `IQueueProvider` (`fetchNextPage: (page, pageSize) => Promise<IQueueProviderResult>`), tornando o `PlayerContext` 100% isolado de APIs específicas.
    * **Pré-busca em Segundo Plano (*Lazy Queue Pre-fetching*):** O player monitora o índice da faixa ativa em relação à fila. Quando restam 2 ou menos faixas na fila local (`remaining <= 2`), ele dispara `fetchNextQueueChunk()` silenciosamente, buscando a próxima página e anexando as faixas ao final da fila (`currentQueue`).
    * **Experiência de Reprodução Contínua:** Permite a reprodução ininterrupta de milhares de músicas da Biblioteca Geral, pesquisas filtradas ou Playlists extensas sem requisições pesadas ou gargalos de memória RAM na SPA.
    * **Padronização Global de Paginação (Tamanho 20):** Refatoradas as listagens e endpoints de scroll do frontend (`Dashboard.tsx`, `WeeklyTrends.tsx` e `PopularPlaylists.tsx`) para usar uniformemente `limit=20`. Isso elimina incongruências matemáticas de offset no banco de dados e alinha as páginas visuais com a velocidade do enfileiramento inteligente.
    * **Fábrica de Provedores (`src/utils/queueProviders.ts`):** Implementados `createLibraryQueueProvider`, `createPlaylistQueueProvider` e `createWeeklyTrendsQueueProvider` para integração imediata nos componentes e páginas do sistema (`TrackListing`, `Dashboard`, `WeeklyTrends`, `ExploreShelf`, `PlaylistListing` e `PublicProfile`).

41. **Refatoração Semântica da Rota `/dashboard` para `/library`**:
    * **Renomeação de Componente e Arquivo:** O arquivo `Dashboard.tsx` foi renomeado para `Library.tsx` e o componente interno renomeado para `Library`.
    * **Ajuste de Navegação e Rotas:** Alteradas todas as ocorrências de redirecionamentos e links internos de `/dashboard` para `/library` na SPA (`App.tsx`, `PersistentLayout.tsx`, `UploadDireto.tsx` e `Library.tsx`).

42. **Paginação Dinâmica e Queue para Playlists**:
    * **Novas Rotas de API:** Adicionado o endpoint `GET /api/Playlists/{id}/Tracks` com suporte a paginação (`page` e `limit`). A rota de detalhes principal (`GET /api/Playlists/{id}`) foi otimizada para retornar apenas as primeiras 20 faixas (`.Take(20)`) e a contagem total no novo campo `TracksCount`.
    * **Infinite Scroll na UI:** Integrado o hook `useInfiniteScroll` na página de detalhes da playlist (`PlaylistDetail.tsx`). Agora, as músicas são carregadas sob demanda, eliminando travamentos em playlists com milhares de músicas.
    * **Queue Provider Dinâmico:** Atualizada a fábrica de enfileiramento `createPlaylistQueueProvider` em `queueProviders.ts` para formatar e mapear a resposta da API perfeitamente para a interface `ITrack`, mantendo a reprodução e carregamento assíncrono em segundo plano estável.

43. **Reverb por Canal na DAW, Isolamento de Memória WASM do Shifter e Toggle de Efeitos**:
    * **Isolamento de Memória WASM do Shifter:** O processador `pitch-shift-processor.js` do AudioWorklet foi refatorado para agrupar o runtime e heap do WASM do Signalsmith em uma fábrica de closures (`createSignalsmithShifter`). Cada canal instanciado possui seu próprio heap de memória isolado, eliminando completamente os ruídos e craquelamento nas transposições de tom concorrentes.
    * **Roteamento Dinâmico de Efeitos e Toggle:** Implementada a persistência e controle do estado `stemsReverbEnabled` por canal e a função `updateStemReverbRouting(type, enabled)` que reconecta em tempo real as stems. Se o Reverb for desativado (OFF), o canal se conecta diretamente ao Master, e os nós de convolução e ganho do reverb são 100% desconectados do grafo para economizar processamento de CPU.
    * **Controles FX Integrados à DAW e Feedback Visual:** Os controles de reverb foram removidos do Mixer (`MesaPlayer.tsx`) e alocados no painel esquerdo dos canais da DAW (`DawView.tsx`). O botão **FX** expande a pista verticalmente de `88px` para `160px` de forma fluida. O botão assume cor amarela/âmbar se o reverb estiver ON, verde se o painel estiver apenas expandido com reverb OFF, e cinza neutro caso contrário. O canvas de waveform na direita se expande e se redesenha automaticamente 250ms após a transição.
    * **Correção de Rolagem dos Overlays:** Ajustada a dimensão dos overlays (DAW, Letras e Mixer) de `absolute inset-0` para `absolute top-0 left-0 right-0 bottom-16 md:bottom-24` para impedir que fiquem ocultos por baixo do player fixado de rodapé, liberando a rolagem vertical de todos os canais.
    * **Fidelidade de Exportação:** O motor de exportação offline (`mixExporter.ts`) valida `stemsReverbEnabled` para aplicar o reverb apenas em trilhas selecionadas.

44. **Algoritmo Inteligente de Naming (Metadata) e Botão de Inversão no Upload de Arquivos**:
    * **Utilitário de Parsing Unificado (`metadataParser.ts`)**: Criado um parser robusto para extrair nomes de músicas e artistas de filenames locais e títulos do YouTube. Remove tags promocionais, numerações iniciais de faixas (ex: `05 - `) e tags de gravação ao vivo (ex: `(Ao Vivo)`), estruturando as informações por delimitadores de forma limpa.
    * **Auto-Inversão via Heurística de Autor**: Compara a música extraída com o autor do canal do Youtube (`fallbackArtist`). Caso coincidam, inverte os campos automaticamente para manter o preenchimento correto.
    * **Botão de Inversão (Swap) no Upload de Arquivo**: Reestruturado o layout da aba de arquivo para usar `grid-cols-[1fr_auto_1fr]` e incluir o botão de setas bidirecionais (`ArrowLeftRight`), permitindo inverter os inputs de Música e Artista com 1 clique.
45. **Robustez e Estabilidade de Áudio Multicanal no iOS (Safari/WebKit)**:
    * **Anti-GC (Garbage Collection):** Mitigada a coleta de lixo prematura do WebKit anexando os nós de áudio (`GainNode`, `StereoPannerNode`, etc.) diretamente como propriedades customizadas da instância de `HTMLAudioElement` correspondente, além de registrá-los em um `Set` ativo no próprio `AudioContext` (`ctx._activeNodes`).
    * **Drift Threshold Adaptativo com Rate-Limiting:** Introduzida a detecção de ambiente Apple (iOS/Safari) para afrouxar dinamicamente o limite de desvio para 150ms (em comparação aos 50ms mantidos no Windows/Chrome) e limitar seeks de correção na mesma stem a uma vez a cada 2.5s. Isso elimina estalos e loops infinitos de busca no iOS.
    * **Auto-Recuperação de Contexto Suspenso:** Adicionados ouvintes ao evento `visibilitychange` da página e de clique/toque na janela para reativar (`.resume()`) o `AudioContext` caso o sistema operacional o tenha suspendido silenciosamente em background, realinhando pontualmente os playheads de todas as stems no retorno.
46. **Formatador Title Case Inteligente no Naming de Metadados**:
    * **Padronização Visual:** Implementada a rotina de conversão `toTitleCase` que atua sobre a saída do parser de metadados de músicas e artistas no uploader e na importação de URLs.
    * **Regras de Ligações e Conectores:** Mantém palavras de ligação comuns (e, de, do, da, com, and, or, the, of, to, with, etc.) em minúsculas se posicionadas no meio do texto, e força a capitalização maiúscula caso iniciem a frase.
    * **Preservação de Siglas e Romanos:** Detecta e mantém em maiúsculas termos e numerais específicos (DJ, MC, IV, III, etc.). Evita títulos inteiramente capitalizados em UPPERCASE e lowercase.
47. **Sincronização e Persistência de Tempo Total de Playlists**:
    * **Persistência Relacional:** Adicionada a propriedade `Duration` em segundos na tabela `Playlists` com migração EF Core dedicada e preenchimento de dados históricos automatizado via SQL.
    * **Atualizações Atômicas no Backend:** A duração da playlist é recalculada e incrementada/decrementada automaticamente no backend a cada inclusão de faixa, remoção de faixa ou deleção permanente de músicas no sistema.
    * **Mitigação de Paginação no Frontend:** Removidos os mocks de tempos aleatórios da listagem e o cálculo client-side dinâmico que sofria desvio de valor em decorrência da paginação infinita de faixas. O frontend agora consome estaticamente o valor de `Duration` repassado nos DTOs da API, contando com reatividade de atualização instantânea ao remover faixas.
48. **Unificação do Comportamento de Clique no Título da Música (Play em Vez de Navegação)**:
    * **Problema Original:** O clique no título da música em `PlaylistDetail`, `TrackListing` e `MesaPlayer` navegava o usuário para a rota `/daw`, interrompendo o fluxo de consumo e quebrando a expectativa de que o clique iniciaria a reprodução.
    * **Solução Adotada:** Todas as chamadas `navigate('/daw')` em handlers de clique de títulos foram substituídas por `togglePlay()` (quando a faixa já está carregada) ou `handlePlayClick()` (que encapsula a lógica de load + toggle). O sublinhado e cursor pointer foram preservados para manter o feedback visual de elemento clicável.
    * **Arquivos Impactados:** `PlaylistDetail.tsx` (4 handlers — desktop tabela e mobile lista), `TrackListing.tsx` (3 handlers — lista, mobile e grade/cards) e `MesaPlayer.tsx` (1 handler — título no player global de rodapé). Import morto de `useNavigate` removido do MesaPlayer.
    * **Correção Colateral:** O botão "Voltar para Playlists" em `PlaylistDetail` havia sido acidentalmente alterado de `navigate('/playlists')` para `togglePlay()` durante a substituição em massa — restaurado ao comportamento correto.
49. **Busca por Artista via Clique no Nome (Intermediário para Página de Artista)**:
    * **Problema Original:** Nomes de artistas exibiam estilos de elementos clicáveis (`cursor-pointer`, `hover:underline`) em múltiplas telas, mas não executavam nenhuma ação ao serem clicados — affordance visual enganosa.
    * **Solução Intermediária:** Ao clicar no nome do artista, o usuário é redirecionado para `/library?search=ArtistName`. A Library lê o parâmetro `?search=` da URL via `useEffect` + `URLSearchParams` e preenche o campo de busca imediatamente.
    * **Abrangência:** 13 handlers atualizados em 5 arquivos: `TrackListing` (3), `PlaylistDetail` (2), `MesaPlayer` (3), `ExploreShelf` (2). Todos usam `encodeURIComponent` para segurança.
    * **Evolução Planejada:** Quando a página `/artists/:name` for construída, basta alterar o `navigate` de `/library?search=X` para `/artists/X`.
50. **Correção de Race Condition na Library e Double-Fetch na Playlists**:
    * **Race Condition (Library):** Ao navegar para `/library?search=X`, dois fetches competiam — um sem filtro (estado inicial vazio) e um com filtro (do URL). Corrigido com lazy initializers no `useState` que leem `?search=` do `window.location.search` diretamente na primeira renderização.
    * **Limpeza de Busca (Library):** O `useEffect` de `location.search` agora sempre sincroniza (inclusive limpando), usando `params.get('search') || ''`. Clicar no link Library na sidebar limpa a busca.
    * **Double-Fetch (Playlists):** Dois `useEffect`s disparavam `fetchPlaylistsPage(true)` na montagem. Corrigido com `useRef(true)` como flag `isInitialMount` no effect de sincronização com o context.
51. **Exibição da Tonalidade (Key) Antes do Título em Playlists e Biblioteca**:
    * **Visibilidade Imediata da Nota/Tom:** A nota musical base de cada música (propriedade `Key` calculada e persistida na entidade `Track`) agora é renderizada estaticamente e de forma proativa antes do nome da música em [PlaylistDetail.tsx](file:///g:/DEV/mixer8/mixer8-app/src/pages/PlaylistDetail.tsx) e [TrackListing.tsx](file:///g:/DEV/mixer8/mixer8-app/src/components/TrackListing.tsx), sem exigir que a música seja reproduzida.
    * **Design System Refinado:** Badge construído sob os padrões do `frontend-design` com fundo translúcido `bg-brand-green/10`, texto em verde neon `text-brand-green`, borda suave de 1px `border-brand-green/30`, tipografia monoespaçada (`font-mono`) e cantos arredondados, mantendo perfeito alinhamento visual com os badges inline existentes.
    * **Suporte Multi-Layout:** O badge é exibido tanto no Desktop (tabela de playlists e lista da biblioteca) quanto no Mobile (lista vertical de faixas e cards em grade).
    * **Consistência de Enfileiramento Mobile:** Incluídas as propriedades `Bpm` e `Key` nos payloads de `trackToPlay` e `tracksQueue` ao acionar a reprodução de faixas pela visão mobile de playlists.
52. **Padronização de Docker Build Cache, Playwright Oficial, FFmpeg Estático, Espelho UFSCar e Pip Resiliente**:
    * **Eliminação de Rebuilds Desnecessários de S.O.:** Reestruturados todos os `Dockerfile`s do ecossistema seguindo a arquitetura de cache imutável em 4 camadas. Dependências do sistema operacional foram isoladas no estágio de runtime antes de qualquer injeção de binários compilados (`/app/out`).
    * **Migração do Extrator para Imagem Oficial da Microsoft + .NET 10 + Google Chrome Oficial:** No [mixer8-extractor/Dockerfile](file:///g:/DEV/mixer8/mixer8-extractor/Dockerfile), o runtime foi migrado para `mcr.microsoft.com/playwright/dotnet:v1.49.0-noble` com injeção do .NET 10.0 runtime (`/usr/share/dotnet`) e instalação do pacote oficial do Google Chrome (`google-chrome-stable` em `/opt/google/chrome/chrome`) com codecs de áudio proprietários (MP3/AAC) exigidos pela DAW, utilizando o espelho de alta velocidade da UFSCar.
    * **Adoção Universal de FFmpeg Estático (`mwader/static-ffmpeg:latest`):** Em `api`, `waveformer` e `downloader`, o FFmpeg e o FFprobe são injetados diretamente via multi-stage build estático. Isso removeu mais de 450MB e 217 pacotes gráficos/LLVM desnecessários do Ubuntu, zerando o `apt-get` na API e no Waveformer (build em 0.4s).
    * **Downloader Resiliente com Espelho UFSCar:** O [mixer8-downloader/Dockerfile](file:///g:/DEV/mixer8/mixer8-downloader/Dockerfile) utiliza o espelho brasileiro de alta velocidade da UFSCar (`mirror.ufscar.br`) para baixar o Python3 mínimo (~15MB) em menos de 2s, e o `pip` opera com `--timeout 120 --retries 10 --no-cache-dir`, eliminando timeouts de rede (build em 18.4s).
    * **Proteção Global com `.dockerignore`:** Criados e expandidos arquivos `.dockerignore` em todos os 5 serviços (`api`, `app`, `downloader`, `waveformer`, `extractor`) bloqueando `bin/`, `obj/`, `node_modules/`, `dist/`, `.vite/`, `downloads/`, `config/`, `.git/` e logs, reduzindo o contexto para < 100KB.
    * **Validação em Tempo Real:** Todos os 5 containers (`mixer8_api`, `mixer8_app`, `mixer8_downloader`, `mixer8_extractor`, `mixer8_waveformer`) compilados e validados localmente em execução simultânea via Docker Compose.
53. **Extrator: Download Resiliente de Stems com Fallback HTTP e Memória Compartilhada (`shm_size: 2gb` / `ipc: host`)**:
    * **Prevenção de TargetClosedException e Queda de Contexto:** O método de gravação de arquivos ZIP de stems no worker (`mixer8-extractor/Worker.cs`) foi encapsulado com tratamento defensivo. Caso o download via Playwright `SaveAsAsync` falhe ou gere arquivos incompletos/zerados, o worker aciona imediatamente um fallback nativo via `HttpClient` (com streaming `HttpCompletionOption.ResponseHeadersRead` direto para disco, headers de autorização e descompressão automática).
    * **Estabilidade do Chromium Headless em Docker Linux:** Configurado `shm_size: '2gb'` e `ipc: host` no `docker-compose.yml` para o serviço `mixer8-extractor`, eliminando o limite padrão de 64MB em `/dev/shm` e prevenindo crashes ou fechamentos prematuros de abas sob processamento multicanal de áudio na DAW.
    * **Validações Defensivas de Disco:** Adicionadas checagens de existência física e tamanho em bytes antes de iniciar a injeção dos metadados de cifras (`chords.json`) e letras (`lyrics.json`) no arquivo compactado.

---

## 🎯 Próximo Milestone: Ajustes de Fluxo e Segurança de Rede
* Implementar autenticação via Refresh Token e renovação automática na SPA.
* Refinamento do worker de extração para suportar filas de prioridade (Premium vs Standard).
* Implementação de cache distribuído (Redis) para reduzir I/O de banco e otimizar listagens de exploradores.

---

## ❓ Perguntas Abertas / Notas
* O banco de dados PostgreSQL continua rodando de forma externa no homelab (`192.168.18.110`), mantendo-se comentado no compose para preservar a consistência relacional prévia.

