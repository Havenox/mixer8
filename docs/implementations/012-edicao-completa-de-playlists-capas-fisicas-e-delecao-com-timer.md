# 012 - [Playlist]: Edição Completa de Playlists, Capas Físicas e Deleção com Timer de Segurança

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 30/05/2026

---

## 🚀 Desafio de Engenharia
Após a centralização da navegação de playlists em uma tela de biblioteca dedicada, identificou-se a necessidade de implementar recursos robustos de edição e exclusão de playlists. No entanto, havia desafios cruciais de design e integridade:
1. **Evitar Código Duplicado**: Modais locais de ajustes e de exclusão na tela de detalhes da playlist (`PlaylistDetail.tsx`) causavam redundância lógica e inconsistências na UI se comparados às operações globais de música.
2. **Nomenclatura Adequada**: Evitar termos puramente mercadológicos ou inapropriados como "Edição Premium", focando no comportamento padrão e completo de ajustes da playlist.
3. **Persistência e Integridade de Capas Customizadas**: Permitir upload de imagens físicas salvas no servidor (`wwwroot/playlists/{id}/`) com detecção e deleção física em disco ao substituir ou remover a capa, ou excluir a playlist inteira.
4. **Proteção contra Deleções Acidentais**: Garantir um timer regressivo de segurança de 3 segundos no botão de exclusão de playlist, impedindo cliques apressados e destrutivos.
5. **Suporte a Metadados (Descrição)**: Incluir um campo de descrição na playlist para metadados ricos e miniaturas em compartilhamentos externos (estilo Spotify/Postify).
6. **Preservação Visual Estrita**: Reverter alterações de design indesejadas no grid de músicas e restaurar a tabela tabular original clássica na visualização de detalhes, mantendo a harmonia visual.
7. **Integração de Menus e Ação Inerente**: Músicas de playlists devem possuir as mesmas interações de menu de contexto das outras telas (como adicionar a outras playlists e exclusão do sistema), além da ação nativa de remoção de faixas do escopo da playlist.
8. **Separação Exclusiva Admin**: Isolar a opção crítica de exclusão total da música (deletar da plataforma) em uma mini-sessão separada por travessão na base do menu de contexto de músicas, reduzindo o risco de equívocos operacionais.
9. **Eliminação de Diálogos Nativos do Navegador**: Substituir pop-ups feios de `window.confirm` do javascript por modais internos elegantes baseados em React para a remoção de faixas de playlists, garantindo a integridade estética da marca Mixer8.

---

## 🧠 Estratégia da Solução

### 1. Modelo de Domínio e Banco de Dados (Backend)
- Adicionada a propriedade `Description` (nullable) no modelo de domínio [Playlist.cs](file:///g:/DEV/mixer8/mixer8-api/Domain/Playlist.cs).
- Criada e executada a migração relacional do EF Core `AddDescriptionToPlaylist` para atualizar de forma robusta o esquema de tabelas do PostgreSQL no Docker.
- Atualizado o mapeamento de DTOs (`PlaylistResponseDto`, `PlaylistDetailResponseDto`, `UpdatePlaylistRequest`) para trafegar os novos metadados de descrição.

### 2. Controle de Arquivos Físicos e Endpoints (C# .NET)
- **Endpoint PUT `/api/Playlists/{id}`**:
  - Habilitada recepção via formulário multipart (`[Consumes("multipart/form-data")]` e `[FromForm]`).
  - Caso o usuário substitua ou exclua a capa, o servidor realiza a deleção física do arquivo antigo em `wwwroot/playlists/{id}/`.
  - **Proteção Estrita**: A exclusão em disco só é executada se a URL da capa iniciar com `/playlists/`, blindando as capas de músicas (`/stems/`) contra qualquer remoção indesejada.
- **Endpoint DELETE `/api/Playlists/{id}`**:
  - Realiza a remoção do registro no banco de dados e limpa a pasta inteira da playlist em `wwwroot/playlists/{id}/` de forma síncrona e definitiva.

### 3. Modais Globais e Estado Centralizado (React SPA)
- Centralizados os modais de Edição Completa e Exclusão no `PlaylistProvider` em [PlaylistContext.tsx](file:///g:/DEV/mixer8/mixer8-app/src/context/PlaylistContext.tsx), disponibilizando as rotinas `openEditPlaylist` e `openDeletePlaylist` globalmente.
- **Modal de Ajustes**: Permite alterar o Nome, Descrição, Visibilidade, efetuar upload e pré-visualização reativa da Capa, remover a imagem customizada e gerenciar colaboradores ativos com convites reativos por e-mail.
- **Modal de Exclusão**: Apresenta aviso destrutivo com botão bloqueado por um timer regressivo real de 3 segundos com contagem visual.
- **Barramento de Eventos Reativos**: Ao salvar ou deletar, são disparados eventos nativos personalizados `playlist-updated` e `playlist-deleted` para atualizar dados ou navegar de volta de forma instantânea.

### 4. Restauração Tabular e Menu de Contexto Refinado
- **Restauração de Tabela Nativa**: Revertido o design de grid e restaurada a estrutura HTML `table` com as colunas `#`, `Título / Artista` (título em negrito e artista menor), `Adicionado por`, `Adicionado em` e `Duração` (cabeçalho representado por um ícone `Clock` de Lucide).
- **Duração Estável**: Inserida rotina determinística `getMockDuration` que calcula a duração de cada faixa em minutos e segundos com base em hash estático de seu `TrackId`.
- **Menu de Contexto de Músicas com Mini-Sessão**:
  - Implementado manipulador `onContextMenu` na linha da tabela (`tr`), abrindo o menu flutuante.
  - O menu de contexto de músicas foi reestruturado de forma idêntica em `PlaylistDetail.tsx`, `App.tsx` (Explorar) e `Dashboard.tsx` (Minha Biblioteca):
    - Ações comuns (como `Adicionar à playlist` e `Remover desta playlist` com ícone de menos `-` na frente, seguindo a cor e visual padrão).
    - Uma linha divisora (travessão `div className="h-[1px] bg-brand-hover my-1"`) que isola a mini-sessão do Administrador.
    - Ação administrativa com a lixeira vermelha: `Excluir Música` (texto em tamanho e visual padrão que se torna vermelho apenas no hover, mantendo a lixeira vermelha em definitivo).

### 5. Fim do Confirm do Javascript e Novo Modal React
- **Remoção**: A função `handleRemoveTrack` teve o `window.confirm` do javascript completamente eliminado.
- **Modal Customizado**: Criado o estado `trackToRemove`. Ao acionar o menu, renderiza-se um modal React flutuante com a marca do Mixer8, contendo cabeçalho estilizado, detalhes da capa/título da música e botões "Cancelar" e "Confirmar Remoção" integrados, impedindo qualquer interrupção nativa do navegador.

---

## 🎯 Impacto e Resultado
* **Arquitetura DRY e Limpa**: Lógica de modais centralizada no context, sem duplicações, e views totalmente simplificadas.
* **Consistência Visual de Alta Fidelidade**: O design clássico de lista de músicas do Spotify/Postify foi perfeitamente preservado, garantindo uma interface profissional e familiar.
* **Segurança e Elegância Operacional**: A eliminação de diálogos nativos do navegador e o uso de modais reativos enriquecem a experiência estética da DAW, mantendo o controle total da navegação no escopo do React.
* **Homelab Otimizado**: Arquivos físicos indesejados são eliminados instantaneamente no servidor físico.

