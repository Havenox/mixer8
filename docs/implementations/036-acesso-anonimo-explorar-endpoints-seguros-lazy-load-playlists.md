# 036 - [Acesso Público/Segurança]: Acesso Anônimo no Explorar, Endpoints Seguros, Lazy Loading de Playlists e Blindagem do SystemSettings

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 04/06/2026

---

## 🚀 Desafio de Engenharia
1. **Acesso Público**: A rota raiz (`/`) do Explorar requeria autenticação obrigatória. A intenção era permitir que usuários deslogados pudessem carregar a página e reproduzir músicas/playlists livremente, mas qualquer interação protegida (curtir, adicionar a playlists, abrir menus de contexto, "ver todas") devesse convidá-los a logar ou cadastrar-se.
2. **Prevenção contra Scraping**: O frontend consultava as tendências e playlists populares passando parâmetros dinâmicos de limite (ex: `/api/Tracks/WeeklyTrends?limit=6`). Isso abria brecha para que robôs ou usuários mal-intencionados fizessem varreduras no banco de dados incrementando os limites.
3. **Vazamento de Credenciais**: O endpoint público `/api/SystemSettings` retornava todas as chaves de configuração do banco, incluindo credenciais sensíveis (como `MoisesSession_AuthJson`), que continham cookies de integração da API do Moises.ai.
4. **Chamadas Redundantes de Playlists**: A API `/api/Playlists` era chamada na montagem global do aplicativo, gerando um payload desnecessário mesmo em páginas onde as playlists do usuário não eram exibidas.

## 🧠 Estratégia da Solução
1. **ExploreController Público e Seguro (Backend)**: Desenvolvemos o controlador `ExploreController` com acesso anônimo (`[AllowAnonymous]`) e dois endpoints especializados (`/api/Explore/WeeklyTrends` e `/api/Explore/PopularPlaylists`) que retornam exatamente 6 itens fixos ordenados por relevância e playcount, impedindo a injeção de parâmetros de limite e blindando o banco.
2. **Blindagem do SystemSettings (Backend)**: Restringimos o retorno de `/api/SystemSettings` para expor apenas chaves cujos nomes iniciem com `PremiumFeature_`, mantendo as configurações administrativas protegidas no banco.
3. **Modal Global de Autenticação (`LoginModal`)**: Implementamos um modal elegante e dinâmico integrado ao `AuthContext` do frontend que suporta troca rápida de abas entre "Entrar na Conta" e "Criar Nova Conta" com validações estritas de inputs.
4. **Interceptação de Ações Anônimas (Frontend)**: Atualizamos o `ExploreShelf` e o `PlaylistDetail` para verificar o estado de `IsAuthenticated` nas ações protegidas, abrindo o modal de autenticação em vez de bloquear silenciosamente ou falhar por falta de token.
5. **Lazy Loading de Playlists (Frontend)**: Eliminamos a carga global ao iniciar e configuramos o `PlaylistContext` para carregar as playlists do usuário sob demanda (lazy load) no momento em que ele clica para adicionar uma música a uma playlist, além de carregar na montagem da própria tela `/playlists`.

## 🛠️ Implementação Técnica
* **ExploreController**: Criado em `mixer8-api/Controllers/ExploreController.cs` contendo endpoints públicos otimizados.
* **SystemSettingsController**: Atualizado o método público `GetSettings` aplicando o filtro `.Where(s => s.Key.StartsWith("PremiumFeature_"))`.
* **LoginModal**: Criado em `mixer8-app/src/components/LoginModal.tsx` e integrado globalmente no `AuthContext.tsx`.
* **ExploreShelf & PlaylistDetail**: Atualizados para suportar o estado deslogado, deixando os botões de curtir/salvar visíveis a anônimos, mas redirecionando o fluxo de clique para o modal de autenticação se não autenticado.
* **PlaylistContext & Playlists.tsx**: Implementado o carregamento reativo/lazy de playlists do usuário logado.

## 🎯 Impacto e Resultado
* **Segurança e Privacidade**: Eliminamos a possibilidade de vazamento de credenciais de bots/servidores e blindamos a API pública do Explorar contra raspagem massiva (scraping).
* **Experiência do Usuário Convidativa**: Usuários anônimos podem experimentar o Mixer8 ouvindo faixas diretamente, e são gentilmente convidados a se registrar ao tentarem engajar com recursos interativos.
* **Desempenho Otimizado**: A remoção do carregamento prematuro de playlists diminui consideravelmente as requisições na inicialização do app.

---
**Nota do Desenvolvedor:** *A arquitetura de DTOs e controle reativo de autenticação no frontend garante uma experiência premium onde a transição de um visitante anônimo para um usuário autenticado ocorre sem interrupções indesejadas, mantendo o estado de reprodução ativo.*
