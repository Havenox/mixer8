# 044 - [API]: Alinhamento da Lógica de Capa Fallback de Playlists

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 23/06/2026

---

## 🚀 Desafio de Engenharia

Quando uma playlist do Mixer8 não possui uma imagem de capa customizada enviada pelo usuário, a plataforma adota o comportamento de exibir como capa da playlist a capa da primeira faixa associada à mesma. 

No entanto, o backend realizava essa resolução ordenando as músicas por `AddedAt` (ordem de inserção no banco) nas consultas de listagem e detalhe de playlists, enquanto o frontend e a fila de execução real do player ordenam as faixas com base na coluna `Order` (modificada pelo usuário via ações de drag-and-drop). Isso criava uma inconsistência visual: ao reordenar uma música para o topo da lista na SPA, a capa da playlist permanecia inalterada, exibindo a capa da música antiga que possuía a menor data de inserção.

---

## 🧠 Estratégia da Solução

Alinhou-se a regra de ordenação de recuperação da capa de fallback (`firstTrackCover`) no backend para coincidir com a ordenação da listagem visual (`Order`). Com essa modificação, a capa padrão da playlist é recalculada dinamicamente baseando-se na música que está fisicamente no topo da lista no momento da consulta, refletindo qualquer modificação por drag-and-drop de forma instantânea.

---

## 🛠️ Implementação Técnica

### Backend (`mixer8-api`)
* **[PlaylistsController.cs](file:///g:/DEV/mixer8/mixer8-api/Controllers/PlaylistsController.cs):**
  * Atualizada a ordenação da propriedade `firstTrackCover` de `.OrderBy(pt => pt.AddedAt)` para `.OrderBy(pt => pt.Order)` nos seguintes endpoints:
    * `GetPlaylists` (linha 133)
    * `GetPlaylistById` (linha 213)
    * `GetPopularPlaylists` (linha 689)
* **[SeoController.cs](file:///g:/DEV/mixer8/mixer8-api/Controllers/SeoController.cs):**
  * Atualizada a ordenação da imagem de capa resolvida dinamicamente para crawlers de `.OrderBy(pt => pt.AddedAt)` para `.OrderBy(pt => pt.Order)` (linha 144) para manter total paridade com as rotas principais.

---

## 🎯 Impacto e Resultado

* **[Consistência Visual]**: A capa padrão da playlist reflete fielmente a música que ocupa a primeira posição na tela, respeitando as ações de reordenação do usuário.
* **[Unificação de Lógica]**: O indexador de SEO (`SeoController`) e as consultas principais da API agora utilizam o mesmo critério de resolução de metadados de imagem.

---
**Nota do Desenvolvedor:** *Manter a integridade de dados derivados como a imagem de capa de fallback exige que os critérios de ordenação sejam idênticos em todas as camadas. Mudar a ordenação para 'Order' no backend removeu a necessidade de implementar sincronizações ou caches client-side desnecessários.*
