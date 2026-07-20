# 082 - Correção de Race Condition na Library e Double-Fetch na Playlists

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 20/07/2026

---

## 🚀 Desafio de Engenharia

Após a implementação da busca por artista via query parameter (`?search=`), foram identificados três bugs de concorrência e ciclo de vida no frontend:

1. **Race Condition na Library**: Ao navegar de outra página para `/library?search=ArtistName`, dois fetches eram disparados simultaneamente — um sem filtro (estado inicial vazio) e um com filtro (do URL). O fetch sem filtro podia resolver depois e sobrescrever os resultados filtrados.
2. **Busca não limpava ao clicar no link Library**: O `useEffect` que lia `?search=` da URL só atualizava quando o parâmetro estava presente, mas não limpava quando ausente.
3. **Double-Fetch na Playlists**: A página `/playlists` disparava dois requests idênticos na montagem, causados por dois `useEffect`s independentes que ambos chamavam `fetchPlaylistsPage(true)`.

## 🧠 Estratégia da Solução

### Bug 1: Lazy Initializer no useState
Em vez de inicializar `searchInput` e `debouncedSearch` como strings vazias e depois atualizá-los via `useEffect`, ambos agora usam **lazy initializers** (`useState(() => ...)`) que leem o `?search=` diretamente do `window.location.search` durante a primeira renderização. Isso elimina o estado intermediário vazio que causava o fetch sem filtro.

### Bug 2: Sincronização bidirecional do useEffect
O `useEffect` que observa `location.search` agora sempre sincroniza, usando `params.get('search') || ''` em vez de um `if (searchParam)`. Quando o usuário clica no link Library (sem `?search=`), o campo de busca é limpo automaticamente.

### Bug 3: useRef para pular montagem inicial
Adicionado `useRef(true)` como flag `isInitialMount`. O `useEffect` de sincronização com o context de playlists verifica essa flag e pula a primeira execução, deixando apenas o `useEffect` de debounce responsável pelo fetch inicial.

## 🛠️ Implementação Técnica

### Frontend

**Library.tsx**:
- `useState('')` → `useState(() => new URLSearchParams(window.location.search).get('search') || '')` para `searchInput` e `debouncedSearch`
- `useEffect` de `location.search`: `params.get('search') || ''` (sempre sincroniza, incluindo limpeza)

**Playlists.tsx**:
- Adicionado `import { useRef }` ao React
- `const isInitialMount = useRef(true)` + guard no `useEffect` de sincronização com `playlists`

## 🎯 Impacto e Resultado
* **Library**: Apenas 1 fetch na montagem — já com o filtro correto do URL
* **Playlists**: Apenas 1 fetch na montagem — eliminada requisição duplicada
* **UX**: Clicar no link Library na sidebar agora limpa a busca corretamente

---
**Nota do Desenvolvedor:** *Esse bug é um padrão clássico de race condition em React: um `useState('')` seguido de um `useEffect` que altera o estado gera dois renders com valores diferentes, e o `useEffect` que depende desse estado dispara duas vezes. A solução idiomática é o lazy initializer, que garante o valor correto desde o primeiro render — zero race conditions, zero fetches desnecessários.*
