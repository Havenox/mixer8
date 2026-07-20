# 080 - Player UX: Unificação do Comportamento de Clique no Título da Música

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 20/07/2026

---

## 🚀 Desafio de Engenharia

O clique no título da música em diferentes contextos da aplicação (PlaylistDetail, TrackListing e MesaPlayer) navegava o usuário para a rota `/daw` (estúdio DAW), interrompendo o fluxo natural de consumo de música. O usuário esperava que o clique no título simplesmente iniciasse a reprodução — o mesmo comportamento já existente ao clicar no botão play ou na caixa da música. Essa inconsistência gerava frustração, pois o usuário era arrancado da página de listagem toda vez que tocava num título.

## 🧠 Estratégia da Solução

A decisão arquitetural foi **unificar o comportamento de interação do título com o do botão play existente**, removendo todas as chamadas `navigate('/daw')` dos handlers de clique em títulos e substituindo-as por chamadas ao `togglePlay()` ou `handlePlayClick()` — funções já consolidadas no ecossistema do `PlayerContext`. Essa abordagem preserva a semântica visual (sublinhado, cursor pointer) enquanto elimina a navegação indesejada.

## 🛠️ Implementação Técnica

### Frontend

**PlaylistDetail.tsx** (Desktop + Mobile):
- Handlers de clique no título da faixa na view desktop (tabela) e mobile (lista) agora chamam `togglePlay()` quando a faixa já está carregada, ou executam `loadTrack()` seguido de `togglePlay()` quando a faixa é nova.
- Corrigido o botão "Voltar para Playlists" que havia sido acidentalmente alterado para `togglePlay()` — restaurado para `navigate('/playlists')`.

**TrackListing.tsx** (Lista, Mobile, Grade):
- Três handlers de clique no título (layout de lista, layout mobile e layout de grade/cards) foram simplificados para chamar `handlePlayClick(track)` — a função existente que já encapsula a lógica de "se carregado → toggle, se não → load".
- Eliminada duplicação de lógica onde o handler carregava a faixa E depois chamava `handlePlayClick` novamente (o que causaria um segundo `loadTrack` ou um toggle imediato indesejado).

**MesaPlayer.tsx** (Player Global):
- O título da faixa no player de rodapé agora chama `togglePlay()` em vez de `navigate('/daw')`.
- Removido o import não utilizado de `useNavigate` do `react-router-dom`.

## 🎯 Impacto e Resultado
* **Consistência de UX**: O comportamento de clique no título é agora idêntico ao clique no botão play em toda a aplicação — zero navegações inesperadas.
* **Eliminação de Dead Code**: Zero instâncias de `navigate('/daw')` restantes no codebase; import morto de `useNavigate` removido do MesaPlayer.
* **Correção de Bug Colateral**: O botão "Voltar para Playlists" foi restaurado ao comportamento correto após ter sido acidentalmente corrompido.

---
**Nota do Desenvolvedor:** *Essa refatoração exemplifica a importância de auditar o impacto colateral de buscas e substituições em massa. A alteração inicial substituiu corretamente os handlers de título, mas também capturou acidentalmente o botão de navegação "Voltar para Playlists" — que continha a string `navigate('/playlists')`, não `navigate('/daw')`. A revisão cirúrgica do diff completo antes do commit é indispensável para evitar regressões silenciosas.*
