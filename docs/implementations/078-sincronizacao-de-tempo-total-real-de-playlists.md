# 078 - Playlists: Sincronização e Persistência do Tempo Total de Duração Real de Playlists

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 20/07/2026

---

## 🚀 Desafio de Engenharia
Até então, o Mixer8 exibia durações fictícias/mockadas nos cards de playlists na tela de listagem (`/playlists`). Ao acessar a tela de detalhes, a duração acumulada era calculada dinamicamente no client-side somando os tempos das faixas carregadas.
Com a introdução da paginação infinita de faixas (20 por requisição), o cálculo dinâmico gerou uma incongruência grave: a duração exibia apenas a soma das primeiras 20 músicas, atualizando incorretamente para o tempo total apenas quando o usuário realizava a paginação completa (scroll total de faixas).

O desafio consistiu em:
1. Adicionar o armazenamento e cálculo persistente da duração no backend.
2. Migrar com sucesso os dados históricos de playlists antigas.
3. Mapear e retornar a propriedade em todas as rotas DTO de listagem e detalhes.
4. Ajustar o frontend para renderizar o tempo de forma estática, garantindo reatividade de estado local em adições e deleções em tempo real.

## 🧠 Estratégia da Solução
1. **Modelagem de Banco de Dados:** Adicionada a propriedade `Duration` (em segundos) à entidade `Playlist` e na tabela de banco correspondente.
2. **Backfill de Dados Históricos:** A migração EF Core `AddDurationToPlaylists` foi estruturada para executar um script SQL customizado durante a transição (`Up`), preenchendo retroativamente a duração acumulada real de todas as playlists cadastradas.
3. **Gerenciamento de Transição de Tempo no Backend:**
   * **Inclusão de Faixa:** Ao vincular uma música à playlist, o tempo total é acrescido do tempo da faixa correspondente de forma atômica no controller.
   * **Exclusão de Faixa:** Ao desvincular a faixa da playlist, o tempo é subtraído e limitado a zero no controller.
   * **Deleção Física Geral:** Se uma música for excluída permanentemente pelo Admin, todas as playlists que a continham têm seu tempo recalculado e atualizado no banco antes de o registro ser removido.
4. **Acoplamento no Frontend:**
   * Interfaces `IPlaylist` e `IPlaylistDetail` estendidas para expor `Duration: number`.
   * Substituição de rotinas de cálculo inline no client pelo valor estático.
   * O mutador de estado local `handleRemoveTrack` do React deduz localmente o tempo da faixa removida para manter a reatividade instantânea da interface sem obrigar o recarregamento.

## 🛠️ Detalhes da Implementação

### Backend (`mixer8-api`)
* **Migration SQL:**
  ```sql
  UPDATE "Playlists" p
  SET "Duration" = COALESCE((
      SELECT SUM(t."Duration")
      FROM "PlaylistTracks" pt
      JOIN "Tracks" t ON pt."TrackId" = t."TrackId"
      WHERE pt."PlaylistId" = p."PlaylistId"
  ), 0);
  ```
* **Mapeamento de DTOs:** Integrado `Duration` em `PlaylistResponseDto` e `PlaylistDetailResponseDto`, e injetado em:
  * `PlaylistsController.cs` (`CreatePlaylist`, `GetPlaylists`, `GetPlaylistById`, `GetSavedPlaylists`).
  * `ExploreController.cs` (`GetPopularPlaylists`).
  * `AuthController.cs` (`GetPublicProfile`).

### Frontend (`mixer8-app`)
* **Exibição Uniforme:** O utilitário `getPlaylistTotalDuration` em `PlaylistListing.tsx` e `getPlaylistTotalDurationString` em `PlaylistDetail.tsx` agora recebem e formatam diretamente segundos estáticos do banco (calculando horas e minutos de forma limpa).
* **Consistência de Mutadores:**
  ```typescript
  const removedTrack = playlist.Tracks.find(t => t.TrackId === trackId);
  const trackDuration = removedTrack ? (removedTrack.Duration || 0) : 0;
  setPlaylist(prev => ({
    ...prev,
    Tracks: prev.Tracks.filter(t => t.TrackId !== trackId),
    TracksCount: Math.max(0, prev.TracksCount - 1),
    Duration: Math.max(0, prev.Duration - trackDuration)
  }));
  ```

## 🎯 Impacto e Resultado
* **Consistência de dados:** O tempo total é sempre exibido de forma correta e real em qualquer parte do sistema, independentemente de haver paginação de faixas ou não.
* **Eliminação de mocks:** Expurgada por completo a rotina que gerava durações aleatórias nos cards de listagem de playlists.
* **Performance:** Ao centralizar o cálculo no banco e manter a sincronização pontual a cada evento atômico (inclusão/remoção), eliminamos iterações de loop e *reduces* client-side desnecessários a cada render de tela.
