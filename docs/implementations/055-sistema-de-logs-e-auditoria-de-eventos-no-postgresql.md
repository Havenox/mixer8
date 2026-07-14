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

### 3. Como Consumir os Logs
Os logs residem na tabela `"SystemEvents"` e podem ser consultados via SQL direto ou expostos futuramente em endpoints OData/REST da API para alimentação de um CRM administrativo no frontend.

*Exemplo de consulta SQL para auditoria de uma música:*
```sql
SELECT "Timestamp", "Category", "Level", "Message", "Details"
FROM "SystemEvents"
WHERE "TrackId" = 'ID-DA-MUSICA'
ORDER BY "Timestamp" ASC;
```

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

## 🎯 Impacto e Resultado
* **Centralização de Observabilidade**: logs de todos os componentes do ecossistema agora residem no mesmo banco de dados relacional.
* **Depuração Ágil**: Erros de rede (como falhas de comunicação com a API) são registrados com detalhes completos e stack traces.
* **Pronto para CRM/Painel**: A base de dados está totalmente pavimentada para a criação de um CRM administrativo no frontend do Mixer8.

---
**Nota do Desenvolvedor:** *Utilizar `ON DELETE SET NULL` foi a chave para manter o histórico de auditoria. Do contrário, ao deletar uma track por moderação, perderíamos os registros de logs de auditoria mostrando que aquela track causou erros ou quando ela foi carregada.*
