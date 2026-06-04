# 030 - Biblioteca: Edição por Uploaders e Fluxo de Solicitação de Exclusão

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 04/06/2026

---

## 🚀 Desafio de Engenharia
Usuários comuns com direito a upload (como `PaidUser` ou `User`) podiam enviar músicas e adicioná-las a playlists, mas não conseguiam corrigir metadados (como título, nome do artista ou imagem de capa) após o envio. Além disso, a exclusão de músicas por usuários não-administradores precisava ser restrita: a deleção física e remoção permanente de stems em disco devia ser prerrogativa de admins, enquanto a exclusão por parte do uploader deveria agir como uma solicitação de moderação, ocultando a faixa imediatamente para a plataforma e deixando-a sob análise em um painel do administrador.

## 🧠 Estratégia da Solução
A solução foi arquitetada dividindo as responsabilidades de salvamento de metadados e lógica de exclusão física versus lógica (soft delete):
1. **Banco de Dados**: Introdução do campo booleano `DeletionPending` na entidade `Track` (padrão `false`), acompanhado por uma migração do Entity Framework Core.
2. **Autorização na API (`TracksController`)**:
   - **Update (PUT)**: O endpoint foi aberto para qualquer usuário autenticado. A API verifica se o usuário é o uploader da música ou um administrador. Caso o usuário logado seja apenas o uploader, a API permite a edição exclusiva dos metadados (Título, Artista, Visibilidade e Capa) e ignora/bloqueia qualquer alteração nas stems de áudio.
   - **Delete (DELETE)**: Se o solicitante for um administrador, a remoção física permanente do registro e dos arquivos de áudio é realizada. Se for o uploader, o campo `DeletionPending` é atualizado para `true`, escondendo a faixa da plataforma.
3. **Visibilidade Contextual**:
   - Consultas gerais e playlists filtram músicas com `DeletionPending = true` para que sumam imediatamente do sistema para todos os usuários normais. Apenas administradores continuam visualizando estas músicas.
4. **Interface e UX Premium**:
   - **Visualização**: Exibição da tag cinza/esverdeada `"Minha"` para faixas que pertencem ao usuário conectado, e a tag vermelha `"Aguardando Exclusão"` para administradores visualizarem faixas sob moderação no Dashboard e nas Playlists.
   - **Formulário de Edição**: Ocultação total dos controles de Stems e alteração de textos do cabeçalho quando o modal de edição é aberto por um uploader.
   - **Fluxo de Exclusão**: Modais de exclusão no `Dashboard.tsx`, `App.tsx` e `PlaylistDetail.tsx` ajustados com textos contextuais sobre a solicitação de exclusão lógica de 3 segundos para não-admins.

## 🛠️ Implementação Técnica

### Backend (.NET 10 API)
- Adicionado campo `DeletionPending` em `Track.cs` e gerada a migração `AddDeletionPendingToTrack`.
- Ajustado o método `TracksController.Update` para extrair Claims de identificação do usuário e validar o escopo da alteração: apenas metadados se for o uploader comum; modificação livre de stems se for admin.
- Atualizado o método `TracksController.Delete` para gerenciar a exclusão lógica (`DeletionPending = true`) ou física definitiva.
- Ajustado o método `PlaylistsController.IsTrackVisible` e `TracksController.GetAll` para ocultar faixas deletadas logicamente para não-admins.

### Frontend (React SPA)
- Adicionadas propriedades opcionais de tipagem nas interfaces em `PlayerContext.tsx` e `PlaylistDetail.tsx`.
- Refatorado o grid da biblioteca no `Dashboard.tsx` para exibir as tags `"Minha"` e `"Aguardando Exclusão"`.
- Modificados os menus de contexto, modais de confirmação de exclusão e edição em `Dashboard.tsx`, `App.tsx` e `PlaylistDetail.tsx` para apresentar textos e menus de acordo com o papel do usuário logado (Admin vs Uploader).

## 🎯 Impacto e Resultado
* **Autonomia Controlada**: Uploaders conseguem editar informações de digitação ou capas de suas faixas de forma independente.
* **Segurança de Mídia e Moderação**: Prevenção contra a exclusão acidental ou maliciosa de mídias por usuários comuns, permitindo que administradores revisem exclusões antes do descarte definitivo.
* **UX Contextualizada**: Tags elegantes e avisos detalhados que diferenciam claramente as ações administrativas das ações de uploaders.
