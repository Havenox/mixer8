# 016 - Autenticação & Perfis: UserName Único, Configurações de Perfil, Paginação de Faixas e Playlists Salvas

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 31/05/2026

---

## 🚀 Desafio de Engenharia
Até então, o Mixer8 não possuía nenhum mecanismo para gerenciamento de perfil detalhado (Nome, Sobrenome, Biografia, Telefone, Avatar) ou alteração de dados sensíveis (e-mail, senha). Além disso:
1. O campo `Name` legado dos perfis de usuário não era estruturado e nem único no sistema, impossibilitando a criação de links públicos amigáveis como `mixer8.com.br/@UserName` no futuro.
2. A listagem de faixas na biblioteca trazia todas as faixas de uma vez do banco de dados, o que prejudicaria a performance de carregamento conforme a biblioteca do usuário crescesse.
3. Não havia uma forma prática de um usuário salvar playlists públicas criadas por terceiros em sua biblioteca pessoal sem misturar com suas próprias criações.

## 🧠 Estratégia da Solução
1. **UserName Único como Identificador**: Refatoramos o domínio substituindo a coluna legacy `Name` por `UserName` (não nulo e único com índice único no banco de dados) e adicionamos campos separados para `FirstName` e `LastName`. Para migrar usuários legados de maneira segura, criamos um script SQL customizado na migração EF Core que extrai a primeira parte do e-mail (antes do `@`) e a utiliza como `UserName` provisório, prevenindo erros de restrição de unicidade.
2. **Debounce de Validação no Frontend**: Implementamos um endpoint público `GET /api/Auth/CheckUsername` para que, durante o cadastro ou edição de dados do perfil, o sistema consulte a disponibilidade do nickname em tempo real (aguardando 500ms de inatividade de digitação do usuário) antes de submeter o formulário.
3. **Biblioteca Paginada com Scroll Infinito**: Adaptamos o endpoint `GET /api/Tracks` para aceitar opcionalmente paginação retrocompatível (`page` e `limit`). No frontend, adicionamos um listener de scroll no contêiner da página principal para buscar de 10 em 10 tracks dinamicamente.
4. **Mapeamento de Playlists Salvas (Bookmarks)**: Criamos a entidade `SavedPlaylist` no domínio do backend com relacionamento cascade associando um usuário a uma playlist de terceiros. Ajustamos a lógica de listagem da biblioteca de playlists para mesclar as de autoria do usuário com as marcadas como salvas.

## 🛠️ Implementação Técnica

### Backend (.NET 10 & EF Core)
* **Entidades e DB Context**:
  * Atualização da entidade `UserProfile` substituindo `Name` por `UserName`, `FirstName` e `LastName`.
  * Criação da entidade `SavedPlaylist` mapeada na tabela `SavedPlaylists` com chaves estrangeiras e índices correspondentes no `Mixer8DbContext`.
  * Geração e aplicação da migração física EF Core com script SQL interno para reparação automática de dados sementes.
* **Controladores e DTOs**:
  * `AuthController`: Criação do endpoint `GET /api/Auth/CheckUsername` para validação em tempo real e `PUT /api/Auth/Profile` para atualizar dados de perfil e segurança. Mapeamento de `UserResponse` com novos campos de perfil no endpoint `Me`.
  * `TracksController`: Ajuste no método `GetAll` aceitando query parameters para aplicar `Skip` e `Take`.
  * `PlaylistsController`: Inclusão dos endpoints de salvamento (`POST/DELETE /api/Playlists/{id}/Save`) e de playlists públicas populares (`GET /api/Playlists/Popular`). Mapeamento detalhado de criadores (`OwnerUserName`, `OwnerFirstName`, `OwnerLastName`, `OwnerAvatarUrl`) acoplado no `PlaylistResponseDto` e remoção da distinção visual de Admin, unificando a listagem.

### Frontend (React SPA & TypeScript)
* **Contratos do TypeScript**:
  * Sincronização em PascalCase na interface `IUser` (ex: `UserName`, `FirstName`, `LastName`, `AvatarUrl`) para compatibilidade nativa com o backend.
  * Extensão da interface `IPlaylist` no `PlaylistContext.tsx` para comportar dados de perfil do criador mapeados no frontend.
* **Telas e Componentes**:
  * `Register.tsx`: Acréscimo do campo de Nome de Usuário com máscara de link dinâmico, verificação com debounce de 500ms contra a API e bloqueio de cliques.
  * `Settings.tsx`: Desenvolvimento do painel de controle de conta com preview circular de avatar em tempo real e validações de senha.
  * `PersistentLayout.tsx`: Substituição do botão simples de Sair por um menu de contexto absolute direcionando o usuário para `/settings` e remoção total do indicador piscante do extrator.
  * `Dashboard.tsx`: Acréscimo do estado de paginação e listener do evento de rolagem do contêiner da página para aplicação de scroll infinito.
  * `App.tsx` & `Playlists.tsx`: Exibição de playlists populares no Explorar mostrando foto de perfil circular do criador (com fallback), nome completo/nickname (com fallback), duração simulada via helper com ícone de `Clock`, badge de playlists salvas e modal de confirmação premium de saída de colaborações.

### Infraestrutura
* **Persistência física no Docker Compose**:
  * Atualização de `docker-compose.yml` mapeando o volume `./mixer8-api/wwwroot/playlists:/app/wwwroot/playlists` para garantir que as capas de playlists criadas em tempo de execução pelos usuários permaneçam salvas em disco no host local.

## 🎯 Impacto e Resultado
* **Identidade Digital Única**: Cada usuário do Mixer8 agora tem um `UserName` único garantido no banco de dados, pavimentando a futura feature de perfis públicos no formato `mixer8.com.br/@UserName`.
* **Experiência de Usuário (UX) Fluida**: Checagem de UserName instantânea previne frustração na hora do cadastro e a paginação da biblioteca garante carregamento rápido e otimização de banda da rede.
* **Engajamento Social**: Ação de salvar playlists de terceiros incentiva o compartilhamento de Stems criadas por usuários PRO na plataforma.

---
**Nota do Desenvolvedor:** *A arquitetura de separação de concerns entre dados sensíveis da conta (`Users`) e metadados visuais do perfil (`UserProfiles`) facilitou imensamente a extensão dos novos campos. Além disso, a aplicação da restrição única de banco de dados acompanhada de checagem client-side previne concorrência e garante a integridade de nicknames sem degradar a performance.*
