# Context Preservation (Save State) - Mixer8 Ecosystem

**Data da Última Atualização:** 05/06/2026  
Status do Projeto: Purga de Mocks Concluída, Player Multi-Stems Ativo, Uploader Direto Implementado, Conteinerização/Conversão Opus Concluída, Recursos Premium/Shuffle/Repeat Dinâmicos, Barra de Progresso Premium, Extrator Headless E2E via Playwright, Menu de Contexto Irrestrito Ativos, Acesso Anônimo com Endpoints de Segurança e Modal de Login Globais Integrados, Remoção de Cookies/Testes de Sessão Legados Concluída, e Unificação de Login/Cadastro em Modal Único (Eliminação de Rotas Dedicadas).

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

---

## 🛠️ Fundações Consolidadas (Entregas Atuais)

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

---

## 🎯 Próximo Milestone: Ajustes de Fluxo e Segurança de Rede
* Implementar mecanismos de exclusão/remoção de faixas da biblioteca pelo usuário proprietário.
* Parametrizar tempos de expiração de token JWT com renovação (refresh token).

---

## ❓ Perguntas Abertas / Notas
* O banco de dados PostgreSQL continua rodando de forma externa no homelab (`192.168.18.110`), mantendo-se comentado no compose para preservar a consistência relacional prévia.
