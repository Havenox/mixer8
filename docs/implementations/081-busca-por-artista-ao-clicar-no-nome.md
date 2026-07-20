# 081 - Player UX: Busca por Artista ao Clicar no Nome

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 20/07/2026

---

## 🚀 Desafio de Engenharia

Os nomes de artistas exibidos em diversas telas da aplicação (TrackListing, PlaylistDetail, MesaPlayer, ExploreShelf) apresentavam estilos visuais de elementos clicáveis (`cursor-pointer`, `hover:underline`, `hover:text-white`) mas não executavam nenhuma ação ao serem clicados. Isso configurava uma quebra de expectativa do usuário e uma affordance visual enganosa. A página de artista dedicada ainda não existe no roadmap imediato, mas a interação precisa gerar valor desde já.

## 🧠 Estratégia da Solução

A decisão foi implementar uma solução intermediária e pragmática: ao clicar no nome do artista, o usuário é redirecionado para a página `/library` com o campo de busca pré-preenchido com o nome do artista via query parameter (`?search=ArtistName`). Isso reutiliza a infraestrutura de busca já existente na Library (debounce de 300ms + filtragem server-side) e será facilmente substituível por uma rota `/artists/:name` quando a página dedicada for construída.

## 🛠️ Implementação Técnica

### Frontend

**Library.tsx** (Receptor da Busca):
- Adicionado `useEffect` que lê o parâmetro `?search=` da URL via `URLSearchParams` e preenche `searchInput` e `debouncedSearch` simultaneamente, garantindo busca imediata sem delay de 300ms na primeira carga.

**TrackListing.tsx** (3 handlers):
- Layout de lista (desktop), layout mobile e layout de grade/cards: todos os `<span>` do artista agora chamam `navigate('/library?search=...')` com `encodeURIComponent` para segurança de caracteres especiais.

**PlaylistDetail.tsx** (2 handlers):
- View de tabela desktop e view de lista mobile: substituídos os comentários placeholder `// Future: navigate(...)` por navegação real para `/library?search=`.

**MesaPlayer.tsx** (3 handlers):
- Barra compacta desktop, mini player mobile e player expandido mobile: todos os elementos de artista agora navegam para a biblioteca com busca. Adicionado `hover:underline` onde não existia.

**ExploreShelf.tsx** (2 handlers):
- Grade de cards e lista mobile: spans de artista recebem `cursor-pointer`, `hover:underline` e navegação para busca. Elementos que antes eram texto puro agora são interativos.

## 🎯 Impacto e Resultado
* **Affordance Real**: Todos os nomes de artistas clicáveis na aplicação agora executam uma ação concreta, eliminando a quebra de expectativa visual.
* **Preparação para Evolução**: A rota `?search=` é facilmente substituível por `/artists/:name` quando a página dedicada for implementada.
* **Segurança de Encoding**: `encodeURIComponent` protege contra nomes com caracteres especiais (acentos, &, espaços).

---
**Nota do Desenvolvedor:** *A escolha de usar query parameters em vez de state do React Router foi deliberada — query params são bookmarkáveis, compartilháveis via URL e sobrevivem a recarregamentos de página, enquanto state se perde. Isso também facilita a migração futura: basta alterar o navigate de `/library?search=X` para `/artists/X` em todos os componentes.*
