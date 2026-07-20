# 079 - Playlists: Paginação e Scroll Infinito na Listagem de Playlists (/playlists)

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 20/07/2026

---

## 🚀 Desafio de Engenharia
Originalmente, a página `/playlists` carregava em memória todas as playlists do usuário retornadas pelo backend através do `PlaylistContext`. As buscas textuais e os filtros de visibilidade eram processados no client-side.
Com o crescimento das playlists do usuário, o consumo completo dos dados do banco sem paginação reduzia a performance geral da página e contrariava o padrão estabelecido no ecossistema Mixer8 (onde as listagens de tendências e histórico utilizam paginação uniforme de 20 em 20 com scroll infinito).

O desafio consistiu em:
1. Paginar o endpoint `GET /api/Playlists` de forma condicional para manter a compatibilidade do menu lateral (que precisa das playlists completas sem quebras de página).
2. Transferir a busca e os filtros de visibilidade para processamento no banco de dados.
3. Integrar o scroll infinito na página `/playlists` com debounce na busca e atualização em tempo real de mutações locais (bookmarks e colaborações).

## 🧠 Estratégia da Solução
1. **Filtros Condicionais no C#:** A Action `GetPlaylists` em `PlaylistsController.cs` foi estendida com os parâmetros query `page`, `limit`, `search` e `visibility`.
   * Se os parâmetros de paginação `page` e `limit` forem omitidos, a API retorna todos os registros de forma padrão, mantendo a compatibilidade do menu lateral e modais de inserção.
   * Se providos, aplica-se o skip/take da página requisitada.
2. **Busca Imune a Acesso no Banco:** Implementado o filtro usando `EF.Functions.Unaccent` e `EF.Functions.ILike` na query, trazendo resultados sem acento com velocidade nativa do PostgreSQL.
3. **Scroll Infinito Reativo:** 
   * A página `Playlists.tsx` agora mantém seus próprios estados locais de paginação (`playlistsList`, `page`, `hasMore`, `isLoading`).
   * Utilizado o hook de scroll infinito global `useInfiniteScroll` para carregar as páginas seguintes conforme o usuário desliza.
   * Adicionado debounce de `300ms` usando `setTimeout` em um `useEffect` para re-disparar buscas dinamicamente ao digitar na barra de buscas ou trocar filtros, evitando requisições concorrentes inúteis no servidor.
   * Criada a observação reativa ao array de `playlists` do `PlaylistContext`. Toda vez que uma playlist for criada, deletada ou editada globalmente, a listagem local atualiza a página 1 automaticamente.

## 🛠️ Detalhes da Implementação

### Backend (`PlaylistsController.cs`)
* **Assinatura e Filtros:**
  ```csharp
  [HttpGet]
  public async Task<IActionResult> GetPlaylists(
      [FromQuery] string? search = null,
      [FromQuery] string? visibility = null,
      [FromQuery] int? page = null,
      [FromQuery] int? limit = null)
  ```
  * Aplicados `Skip((p - 1) * l).Take(l)` somente se page/limit forem providos.

### Frontend (`Playlists.tsx`)
* **Debounce de Busca & Filtros:**
  ```typescript
  useEffect(() => {
    if (!Token) return;
    const delayDebounceFn = setTimeout(() => {
      fetchPlaylistsPage(true);
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchInput, visibilityFilter, Token]);
  ```
* **Infinite Scroll Integration:**
  ```typescript
  useInfiniteScroll(hasMore, isFetchingMore, isLoading, () => fetchPlaylistsPage(false));
  ```

## 🎯 Impacto e Resultado
* **Consistência de Padrão:** A página `/playlists` agora carrega com a mesma performance e fluidez premium das demais listagens do sistema (Trends, Músicas).
* **Compatibilidade Mantida:** A barra lateral (sidebar) e os modais continuam exibindo o catálogo completo sem sofrer interrupções.
* **Busca e Filtro Eficientes:** A normalização de strings em tempo de execução no frontend foi substituída por indexação e filtros robustos indexados no banco.
