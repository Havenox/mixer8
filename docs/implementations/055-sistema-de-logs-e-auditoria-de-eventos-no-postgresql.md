# 055 - [Logging]: Sistema de Logs e Auditoria de Eventos no PostgreSQL

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 14/07/2026

---

## 🚀 Desafio de Engenharia
A complexidade de monitorar fluxos assíncronos que transitam entre múltiplos microsserviços (API, Extrator, Downloader, Waveformer) dificulta a depuração de falhas de rede, erros de download e problemas de concorrência. Não havia um rastreamento unificado para auditar o ciclo de vida das faixas (quem enviou o arquivo original, quem importou via URL, quando a mídia foi baixada e quando as stems foram extraídas). 

Além disso, ações críticas do usuário (novos cadastros, atualizações de dados de perfil/senha, alteração de avatar, criação de playlists e adição/remoção de faixas delas) ocorriam de forma invisível, impossibilitando qualquer auditoria por parte dos administradores.

A solução precisava ser leve, de fácil implantação e centralizada, sem introduzir ferramentas pesadas de mensageria ou brokers de eventos adicionais (como RabbitMQ ou Kafka).

## 🧠 Estratégia da Solução
Aproveitamos que todos os microsserviços compartilham a mesma base de dados PostgreSQL para implementar um **Audit Log relacional centralizado**.
1. **Entidade Unificada (`SystemEvents`)**: Criamos uma tabela única onde cada evento registra carimbo de data/hora (UTC), categoria da aplicação, nível do evento, mensagem resumida e detalhes ricos (como stack traces de exceções ou respostas HTTP).
2. **Preservação Histórica (SetNull)**: Configuramos os relacionamentos de `SystemEvents` com `Tracks` e `Users` usando **`ON DELETE SET NULL`**. Isso garante que a exclusão física de um usuário ou de uma música não apague o log de auditoria correspondente, apenas limpe as chaves estrangeiras, mantendo a integridade histórica.
3. **Método de Inserção Simplificado**: Introduzimos o helper assíncrono `LogEventAsync` em todos os DbContexts. Isso permite instrumentar logs em qualquer parte dos microsserviços com uma única linha de código.

---

## 🛠️ Guia do Desenvolvedor: Como Logar e Consumir

### 1. Estrutura do Evento (`SystemEvent`)
O modelo conta com os seguintes campos:
*   `EventId` (Guid, PK)
*   `Timestamp` (DateTime UTC, padrão do banco)
*   `Category` (string: "API", "Extractor", "Downloader", "Waveformer", "System")
*   `Level` (string: "Info", "Warning", "Error", "Success")
*   `Message` (string: Texto legível e sucinto do que ocorreu)
*   `Details` (string?, opcional: Stack traces de erros, JSONs de metadados)
*   `TrackId` (Guid?, opcional: ID da música associada)
*   `UserId` (Guid?, opcional: ID do usuário autor da ação)

### 2. Como Gravar Eventos no Código (C#)
Todos os DbContexts implementam a assinatura abaixo:
```csharp
await dbContext.LogEventAsync(
    category: "Waveformer", 
    level: "Success", 
    message: "Waveform gerada para a stem 'Bateria' (3046 pontos).", 
    details: "AudioUrl: /stems/id/Bateria.opus", 
    trackId: trackId,
    userId: userId // se disponível
);
```

#### Regras Práticas para os Níveis:
*   `Info`: Processamentos comuns da fila (ex: "Música capturada para extração").
*   `Success`: Finalizações bem-sucedidas (ex: "Download concluído com sucesso").
*   `Warning`: Comportamentos fora do comum mas esperados (ex: "Stem removida por ser silenciosa").
*   `Error`: Exceções lançadas ou interrupções de fluxo (ex: salvar o `ex.ToString()` nos detalhes).

### 3. Como Consumir os Logs (API & Frontend)
Os logs residem na tabela `"SystemEvents"`. Para alimentar o CRM Administrativo no frontend, expusemos um endpoint robusto de paginação e filtragem:

*   **Endpoint**: `GET /api/SystemEvents` (Acesso restrito: `Admin, Moderator`)
*   **Parâmetros de Query**:
    *   `page` e `pageSize`: Paginação controlada (padrão: 20 registros por página).
    *   `search`: Filtro de busca inteligente (case/accent-insensitive).
    *   `category` e `level`: Filtros por categoria e severidade.
    *   `sortBy` e `sortDescending`: Ordenação de tempo.

#### Busca Inteligente Imune a Acentos (`unaccent` do PostgreSQL)
Para garantir que buscas como "bateria" encontrem "BATERIA" ou "batería", ativamos a extensão **`unaccent`** no PostgreSQL via migração EF Core. Na consulta LINQ da API, realizamos a tradução da busca utilizando `EF.Functions.Unaccent` e `EF.Functions.ILike`.

#### Interface Visual e Privacidade de Dados
Para manter a confidencialidade e a densidade de informação ideal no painel:
1.  A API projeta um DTO realizando `LEFT JOIN` com `Tracks`, `Users` e `UserProfiles`. Em vez de exibir UUIDs crus, o CRM renderiza links amigáveis como **🎵 Música: {TrackTitle}** e **👤 Usuário: {UserName || UserEmail}** apenas quando expandido.
2.  **Design Ultra Compacto**: Para garantir que caibam o máximo de registros na área visível da tela, as linhas de log são finas por padrão (altura mínima de 36px), exibindo apenas o Nível (badge pequeno), Categoria (badge), Data/Hora (fonte mono-espaçada) e a Mensagem truncada. Metadados extras de relacionamentos e o bloco de código formatado do campo `Details` (para stack traces) são revelados apenas após clique expansivo.
3.  **Scroll Infinito (Auto-Fetch)**: A navegação por páginas foi substituída por um fluxo contínuo de rolagem (infinite scroll) utilizando a API nativa `IntersectionObserver` do navegador. À medida que o operador rola a página de logs, lotes subsequentes de 20 registros são carregados e adicionados de forma reativa e assíncrona.


### 4. Gerenciamento e Auditoria de Usuários (CRM)
Para permitir que administradores controlem o acesso do sistema Mixer8 diretamente do painel CRM, refatoramos a aba **Usuários Ativos** para seguir os mesmos padrões de design e otimização dos logs de auditoria:

*   **Padrão Consistente**: Adicionamos busca imune a acentos (via `unaccent`), filtragem por função (Admin, Moderator, Paid PRO, Free Tier) e rolagem contínua (Scroll Infinito com `IntersectionObserver` em lotes de 20).
*   **Ações Administrativas**: Administradores podem visualizar detalhes completos do perfil (Nome Completo, UserName, Bio, Telefone, Avatar) expandindo a linha com um clique, bem como alterar a função do usuário (Role) por meio de um seletor e botão de salvar.
*   **Prevenção de Auto-Rebaixamento**: O sistema previne que o último administrador ativo altere sua própria função para evitar que o sistema fique sem um administrador responsável.
*   **Instrumentação de Auditoria**: Toda alteração de papel é registrada automaticamente na tabela `"SystemEvents"` com nível `Warning`, detalhando quem realizou a alteração e o usuário afetado.

#### Solução de Renovação Silenciosa de Claims (JWT)
Quando o administrador altera o nível de acesso de um usuário (por exemplo, elevando-o de Free Tier para Paid PRO), o token JWT atual desse usuário contém claims antigas assinadas. Para evitar que o usuário precise efetuar logoff e login manualmente:
1.  Expusemos o endpoint `POST /api/Auth/RefreshToken` (autenticado), que consulta a função atualizada do usuário diretamente no banco de dados e gera um novo token assinado com as claims atualizadas.
2.  No frontend, o método `RefreshTokenClaims` no `AuthContext` faz essa requisição silenciosamente. Se o próprio administrador alterar sua função, a atualização ocorre no mesmo instante no estado global e no `localStorage`.
3.  Quando outros usuários têm suas funções atualizadas, a renovação pode ser disparada automaticamente ao detectar erros `403` ou durante a verificação de sessão inicial do aplicativo.

---

## 🛠️ Implementação Técnica

### Mapeamento do Contexto
*   **[Mixer8DbContext.cs (API)](file:///g:/DEV/mixer8/mixer8-api/Infrastructure/Mixer8DbContext.cs)**: Mapeou a tabela e definiu chaves estrangeiras com `DeleteBehavior.SetNull`.
*   **Contextos dos Workers**: Mapeados como tabelas locais espelhadas compartilhando o mesmo nome físico no PostgreSQL.

### Instrumentação
*   **API / Endpoints**:
    *   **Faixas (`TracksController`)**: Registro de reprodução de faixas (`RecordPlay`), uploads locais (`Upload`), chunked uploads (`UploadDirect`), importações por link externo (`ImportUrl`), downloads/conversões de mídias concluídos (`ImportCompleted`), finalização do processamento do ZIP com a relação de quais stems foram criadas (`ProcessStemsZip`) e exclusão física de faixas por administradores.
    *   **Contas (`AuthController`)**: Registro de novas contas (`Register`), atualizações de biografia/senha (`UpdateProfile`) e upload de imagem de avatar (`UploadAvatar`).
    *   **Playlists (`PlaylistsController`)**: Registro de criação de playlists (`CreatePlaylist`), atualizações de metadados/capa (`UpdatePlaylist`), exclusões físicas (`DeletePlaylist`), adições de faixas (`AddTrackToPlaylist`) e remoções de faixas (`RemoveTrackFromPlaylist`).
*   **Extractor**: Registra capturas de fila, progresso do bot no Moises e sucessos/erros catastróficos.
*   **Downloader**: Registra capturas de fila, progresso do yt-dlp e status de upload da mídia original.
*   **Waveformer**: Registra geração de waveforms, exclusão de faixas vazias e falhas de conexão/FFmpeg (em transações isoladas de erro).

---

### 5. Polling Contínuo e Categoria "Play" Dedicada
*   **Polling Contínuo**: Removemos a restrição de página na aba de logs do CRM. O polling agora roda continuamente em qualquer nível de rolagem infinita. Ao clicar no badge flutuante de novos logs ou rolar de volta ao topo, a lista mescla as novas entradas e reseta a paginação para a Página 1 (`setPage(1)`) de forma transparente.
*   **Categoria "Play" e Badges Coloridos**: Isolamos os eventos de reprodução de faixas, playlists e álbuns em uma categoria dedicada `"Play"`. No frontend, demos badges coloridos a cada tipo de categoria (ex: verde para `Play`, roxo para `Auth`, azul para `API` e âmbar para `System`) para tornar a auditoria visualmente premium e rápida.
*   **Busca Global Imune a Acentos**: Expandimos a busca case/accent-insensitive para toda a aplicação. Na biblioteca de músicas, implementamos via `EF.Functions.Unaccent` e `EF.Functions.ILike` no PostgreSQL. Na listagem de playlists, implementamos de forma client-side no React com uma rotina JavaScript usando `normalize("NFD").replace(/[\u0300-\u036f]/g, "")`.
*   **Auditoria de Edições de Músicas**: Instrumentamos a rota `PUT /api/Tracks/{id}` para auditar modificações. A rota agora compara os valores originais com os atualizados (título, artista, visibilidade, nova imagem de capa, quantidade de stems excluídas, substituídas ou adicionadas) e gera um log detalhado de auditoria classificado como `Warning`.
*   **Proteção contra Importações Duplicadas do YouTube**: O endpoint `ImportUrl` agora verifica se o ID de vídeo extraído já existe no banco (`DownloadUrl`). Em caso positivo, retorna um erro `409 Conflict`. O frontend exibe um toast na cor âmbar alertando o usuário, fecha o modal e preenche a busca global para filtrar a música existente na biblioteca.

---

## 🎯 Impacto e Resultado
* **Centralização de Observabilidade**: logs de todos os componentes do ecossistema agora residem no mesmo banco de dados relacional.
* **Depuração Ágil**: Erros de rede (como falhas de comunicação com a API) são registrados com detalhes completos e stack traces.
* **Interface CRM Administrativa Dinâmica**: Refatoramos o Painel de Controle para usar abas (*Configurações*, *Usuários*, *Logs do Sistema*). O operador conta com visualização ultra compacta das linhas de log (máxima densidade), expansão sob demanda, rolagem contínua via scroll infinito (`IntersectionObserver`), busca inteligente baseada em `unaccent` e filtros de severidade.
* **Prevenção contra Exposição de IDs**: Nomes amigáveis e emails de usuários são expostos no CRM em vez de UUIDs incompreensíveis.
* **Rastreabilidade Fina de Modificações**: Qualquer edição em músicas e arquivos associados é devidamente logada com os detalhes de "antes" e "depois".

---
**Nota do Desenvolvedor:** *Utilizar `ON DELETE SET NULL` foi a chave para manter o histórico de auditoria. Do contrário, ao deletar uma track por moderação, perderíamos os registros de logs de auditoria mostrando que aquela track causou erros ou quando ela foi carregada.*
