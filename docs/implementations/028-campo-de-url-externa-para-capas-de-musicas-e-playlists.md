# 028 - [Música/Playlist]: Campo de URL Externa para Capas de Música e Playlist

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 03/06/2026

---

## 🚀 Desafio de Engenharia
Ao gerenciar grandes coleções de faixas e playlists no Mixer8, identificou-se a necessidade de permitir que os usuários definissem imagens de capa utilizando URLs diretas (sejam links externos da internet ou links internos de capas já presentes no próprio servidor estático).
Anteriormente, o sistema exigia obrigatoriamente o upload físico de um arquivo de imagem para cada faixa ou playlist editada. Isso trazia duas desvantagens significativas:
1. **Redundância de Armazenamento**: Múltiplas faixas que pertencem ao mesmo álbum/coleção precisavam de uploads independentes e repetidos da mesma imagem de capa, gerando arquivos duplicados no disco do homelab.
2. **Inflexibilidade**: Não era possível fazer referência a imagens hospedadas em outros sites ou CDNs sem antes baixá-las e reenviá-las pelo navegador.

## 🧠 Estratégia da Solução
1. **Modelos de Requisição Estendidos**:
   - Adicionada a propriedade opcional `CoverUrl` (do tipo `string?`) nos contratos de payload `UpdateTrackRequest` (no escopo de músicas) e `UpdatePlaylistRequest` (no escopo de playlists).
2. **Ciclo de Vida de Capas no Backend**:
   - Ajustada a lógica dos controladores `TracksController` e `PlaylistsController` para priorizar o upload físico (`CoverFile`).
   - Se o arquivo físico não for enviado, o backend avalia a `CoverUrl`. Se a URL fornecida for diferente da capa atual, o backend apaga de forma segura e transacional o arquivo físico antigo que residia no servidor (evitando arquivos órfãos) e persiste o novo valor de URL. Se for vazia ou nula, a capa é removida.
3. **Mecânica Reativa de Preview no Frontend**:
   - Integrado o estado `editCoverUrl` e um campo de input text `"Ou URL Externa da Imagem"` nos modais de edição de músicas (`Dashboard.tsx` e `App.tsx`) e de playlists (`PlaylistContext.tsx`).
   - O campo é automaticamente preenchido com a URL atual contida no banco de dados.
   - Ao digitar no campo de URL, a interface atualiza o preview da capa em tempo real e desmarca qualquer arquivo físico selecionado anteriormente. Da mesma forma, escolher um arquivo físico limpa a caixa de URL, garantindo um comportamento intuitivo e previsível para o usuário.

## 🛠️ Implementação Técnica

### Backend (.NET 10 API)
* **Controlador de Faixas**: [TracksController.cs](file:///g:/DEV/mixer8/mixer8-api/Controllers/TracksController.cs)
  - Incluída a propriedade `CoverUrl` em `UpdateTrackRequest`.
  - Tratamento transacional na action `Update` para exclusão física de arquivos de capa locais redundantes no disco caso a URL seja atualizada para um link externo ou nulo.
* **Controlador de Playlists**: [PlaylistsController.cs](file:///g:/DEV/mixer8/mixer8-api/Controllers/PlaylistsController.cs)
  - Incluída a propriedade `CoverUrl` em `UpdatePlaylistRequest`.
  - Tratamento na action `UpdatePlaylist` para deletar a capa física antiga sob `/playlists/` se a URL de capa for modificada ou removida.

### Frontend (React SPA)
* **Contexto de Playlists**: [PlaylistContext.tsx](file:///g:/DEV/mixer8/mixer8-app/src/context/PlaylistContext.tsx)
  - Inclusão do estado `editCoverUrl` e binding no novo campo de input do modal de edição de playlist.
  - Envio da propriedade `CoverUrl` via `FormData` na requisição PUT.
* **Páginas de Música**: [Dashboard.tsx](file:///g:/DEV/mixer8/mixer8-app/src/pages/Dashboard.tsx) e [App.tsx](file:///g:/DEV/mixer8/mixer8-app/src/App.tsx)
  - Inclusão do estado `editCoverUrl` e binding no novo campo de input do modal administrativo de edição de faixas.
  - Envio da propriedade `CoverUrl` via `FormData` no submit de salvar alterações.

---

## 🎯 Impacto e Resultado
* **Economia de Armazenamento**: Possibilidade de referenciar uma única capa para múltiplos itens (como músicas de um mesmo álbum), evitando o acúmulo de arquivos repetidos no servidor do homelab.
* **UX Alinhada e Intuitiva**: O fluxo de preenchimento e visualização de capa segue exatamente o mesmo padrão já implementado e aprovado na seção de avatar do usuário.
* **Limpeza Automática**: Exclusão automática de arquivos de capa antigos quando substituídos por URLs externas, mantendo o sistema de arquivos sempre limpo.

---
**Nota do Desenvolvedor:** *A flexibilização para aceitar URLs personalizadas é um passo fundamental para a futura automação de álbuns, onde todas as faixas farão referência a uma única capa comum do álbum sem requerer uploads redundantes por música.*
