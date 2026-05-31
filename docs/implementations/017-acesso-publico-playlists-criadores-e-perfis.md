# 017 - [Acesso Público]: Acesso Público a Playlists, Dados Ricos do Criador e Perfis Públicos estilo Spotify

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 31/05/2026

---

## 🚀 Desafio de Engenharia
Permitir o compartilhamento de playlists públicas e não listadas no ecossistema Mixer8 com pessoas que não possuem login na plataforma, garantindo a reprodução de Stems no player persistente sem barreiras. Além disso, havia a necessidade de exibir dados ricos do criador (foto real de avatar e Nome Completo com fallback gracioso) em playlists detalhadas e populares, e de criar perfis públicos sofisticados no formato `/@UserName` no mais puro design Premium do Spotify sem exigir credenciais.

## 🧠 Estratégia da Solução
1. **Backend Authoritative com AllowAnonymous**: Liberou-se o acesso a detalhes da playlist via `GetPlaylistById` com o atributo `[AllowAnonymous]`. Se o token for fornecido, a autorização e validação de propriedade ocorrem normalmente. Se for anônimo, o sistema valida graciosamente se a playlist é `Public` ou `Unlisted` para liberar a leitura.
2. **Nova Rota de Perfil Público**: Implementou-se um novo endpoint `GET /api/Auth/Profile/{username}` livre de autenticação que retorna metadados completos de perfil (UserName, FirstName, LastName, Bio, AvatarUrl) e todas as suas playlists de visibilidade `Public`.
3. **Persistência de Layout Anônimo**: Ajustou-se o `PersistentLayout` do SPA para renderizar a interface de controle do Mixer8 para usuários deslogados acessando links públicos, trancando visualmente menus privados com ícone de cadeado e exibindo um rodapé com botão chamativo verde de "Entrar / Criar Conta" em vez do painel de usuário.
4. **Página de Perfil Premium `PublicProfile.tsx`**: Desenhou-se um layout sofisticado com gradiente atmosférico, grande avatar circular, contadores configurados (`X Playlists Públicas`, omitindo seguidores/seguindo se forem 0), e grade de cards das playlists do respectivo criador.
5. **Mapeamento Rico do Criador**: O DTO `PlaylistDetailResponseDto` foi enriquecido para incluir o nome real e imagem do criador, fornecendo uma excelente e coesa experiência visual.

## 🛠️ Implementação Técnica

### Backend (C# .NET 10 API)
- **[MODIFY] `PlaylistsController.cs`**:
  - Endpoint `GetPlaylistById` marcado com `[AllowAnonymous]` com verificação condicional de autenticação/visibilidade.
  - Incremento do DTO `PlaylistDetailResponseDto` e mapeamento das propriedades `OwnerUserName`, `OwnerFirstName`, `OwnerLastName` e `OwnerAvatarUrl`.
- **[MODIFY] `AuthController.cs`**:
  - Novo endpoint `Profile/{username}` marcado com `[AllowAnonymous]` filtrando case-insensitive pelo banco de dados.
  - Implementação do DTO de resposta `PublicProfileResponseDto`.

### Frontend (React SPA)
- **[MODIFY] `App.tsx`**:
  - Remoção de barreiras protetoras em `/playlists/:id` e `/playlist/:id` e registro da rota dinâmica raiz `/:username`.
- **[MODIFY] `components/PersistentLayout.tsx`**:
  - Liberação do carregamento global de layout para usuários deslogados nas rotas públicas, com tranca visual nos menus privados e botão premium verde para cadastro.
- **[MODIFY] `pages/PlaylistDetail.tsx`**:
  - Ajuste de `fetchPlaylistDetails` para efetuar chamadas públicas sem token, renderização do avatar real e nome formatado com link direcionando ao perfil público do criador, e desativação de menus contextuais.
- **[NEW] `pages/PublicProfile.tsx`**:
  - Nova página com interface Premium estilo Spotify para exibir a identidade do criador e suas playlists públicas.

## 🎯 Impacto e Resultado
* **Acesso Público Irrestrito**: Playlists públicas e não listadas podem ser ouvidas por qualquer visitante do site, melhorando a retenção e atração de novos usuários para a ferramenta.
* **Identidade Visual Sofisticada**: Perfis públicos no formato `/@UserName` entregam visual de alta fidelidade e conectam a comunidade Mixer8 com uma experiência de consumo premium similar a dos grandes players de streaming.

---
**Nota do Desenvolvedor:** *A flexibilização da segurança para rotas públicas foi implementada de maneira extremamente defensiva, assegurando que playlists privadas permaneçam totalmente isoladas, enquanto a experiência de áudio e stems flui de forma otimizada para visitantes e usuários anônimos.*
