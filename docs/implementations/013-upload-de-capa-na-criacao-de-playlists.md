# 013 - [Playlist]: Upload de Capa Física Diretamente na Criação de Playlists

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 31/05/2026

---

## 🚀 Desafio de Engenharia
Até então, o ecossistema do **Mixer8** permitia definir uma imagem de capa customizada apenas de forma reativa a partir do modal global de edição e configurações após a criação inicial da playlist. Isso criava uma fricção desnecessária na experiência de uso (UX), forçando o usuário a realizar um fluxo de duas etapas (criar a lista em branco e, em seguida, entrar nos ajustes para carregar a arte). Havia a necessidade técnica de integrar o upload físico diretamente no endpoint de criação, mantendo as premissas de sandbox, segurança e descompressão estáveis do homelab.

---

## 🧠 Estratégia da Solução
A abordagem escolhida replica o mesmo padrão robusto de uploads multipartes e manipulação de arquivos físicos no servidor ASP.NET Core:
1. **Contratos Multipartes (Backend)**: Transicionada a recepção no endpoint `POST /api/Playlists` de um corpo JSON estático para um formulário multiparte real via `[Consumes("multipart/form-data")]` e `[FromForm]`.
2. **Reutilização do Design-System (Frontend)**: Reutilizado o padrão estético anti-slop do modal de edição, acoplando um bloco compacto de upload de capa no modal de criação (`PlaylistContext.tsx`), com pré-visualização instantânea baseada em URLs de objetos em memória (`URL.createObjectURL`).

---

## 🛠️ Implementação Técnica

### Backend (.NET 10 API)
- **DTO de Criação**: Redefinida a classe `CreatePlaylistDto` para `CreatePlaylistRequest` no controlador [PlaylistsController.cs](file:///g:/DEV/mixer8/mixer8-api/Controllers/PlaylistsController.cs), incluindo a propriedade `IFormFile? CoverFile`.
- **Persistência de Capas**: Atualizado o método `CreatePlaylist` para processar a imagem customizada no momento da criação:
  - Cria síncronamente a pasta física `wwwroot/playlists/{id}/` correspondente à UUID gerada.
  - Valida a extensão do arquivo em lista branca de imagens (`.png`, `.jpg`, `.jpeg`, `.webp`).
  - Grava o arquivo físico em disco e atualiza a propriedade `CoverUrl` da entidade `Playlist` persistida no PostgreSQL.

### Frontend (React SPA)
- **Estados Reativos**: Adicionados os estados locais `newCoverFile` e `newCoverPreview` no [PlaylistContext.tsx](file:///g:/DEV/mixer8/mixer8-app/src/context/PlaylistContext.tsx).
- **Componentização do Modal**: Inserido um bloco de upload de imagem de capa idêntico ao de edição, posicionado de forma harmoniosa entre os campos de Descrição e Privacidade do formulário de criação de playlist.
- **Payload Dinâmico**: Ajustada a rotina `handleCreatePlaylistSubmit` para construir um objeto `FormData` enviando os metadados e o arquivo selecionado, limpando as prévias de imagens após o encerramento com sucesso do modal.

---

## 🎯 Impacto e Resultado
* **UX Sem Fricção**: Criação de listas personalizadas com metadados completos e capas físicas em uma única operação limpa.
* **Consistência de Interface**: O formulário de criação adota o mesmo layout visual premium da janela de edição.
* **Higiene do Servidor**: Mantida a deleção física integral do diretório `/playlists/{id}/` caso a playlist seja futuramente excluída.

---
**Nota do Desenvolvedor:** *A unificação da experiência de criação e edição sob APIs multipartes atômicas reforça as diretrizes de DRY e reduz o volume de requisições subsequentes ao backend, otimizando o consumo de rede no homelab.*
