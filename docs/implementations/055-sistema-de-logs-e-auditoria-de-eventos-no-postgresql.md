# 055 - [Logging]: Sistema de Logs e Auditoria de Eventos no PostgreSQL

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 14/07/2026

---

## 🚀 Desafio de Engenharia
A complexidade de monitorar fluxos assíncronos que transitam entre múltiplos microsserviços (API, Extrator, Downloader, Waveformer) dificulta a depuração de falhas de rede, erros de download e problemas de concorrência. Não havia um rastreamento unificado para auditar o ciclo de vida das faixas (quem enviou o arquivo original, quem importou via URL, quando a mídia foi baixada e quando as stems foram extraídas).

A solução precisava ser leve, de fácil implantação e centralizada, sem introduzir ferramentas pesadas de mensageria ou brokers de eventos adicionais (como RabbitMQ ou Kafka).

## 🧠 Estratégia da Solução
Aproveitamos que todos os microsserviços compartilham a mesma base de dados PostgreSQL para implementar um **Audit Log relacional centralizado**.
1. **Entidade Unificada (`SystemEvents`)**: Criamos uma tabela única onde cada evento registra carimbo de data/hora (UTC), categoria da aplicação, nível do evento, mensagem resumida e detalhes ricos (como stack traces de exceções ou respostas HTTP).
2. **Preservação Histórica (SetNull)**: Configuramos os relacionamentos de `SystemEvents` com `Tracks` e `Users` usando **`ON DELETE SET NULL`**. Isso garante que a exclusão física de um usuário ou de uma música não apague o log de auditoria correspondente, apenas limpe as chaves estrangeiras, mantendo a integridade histórica.
3. **Método de Inserção Simplificado**: Introduzimos o helper assíncrono `LogEventAsync` em todos os DbContexts. Isso permite instrumentar logs em qualquer parte dos microsserviços com uma única linha de código.

---

## 🛠️ Implementação Técnica

### 1. Estrutura do Evento (`SystemEvent`)
O modelo conta com os seguintes campos no PostgreSQL:
*   `EventId` (Guid, PK)
*   `Timestamp` (DateTime UTC, padrão do banco)
*   `Category` (string: "API", "Extractor", "Downloader", "Waveformer", "System", "Play", "Auth")
*   `Level` (string: "Info", "Warning", "Error", "Success")
*   `Message` (string: Texto legível e sucinto do que ocorreu)
*   `Details` (string?, opcional: Stack traces de erros, JSONs de metadados)
*   `TrackId` (Guid?, opcional)
*   `UserId` (Guid?, opcional)

### 2. Como Gravar Eventos no Código (C#)
Todos os DbContexts implementam a assinatura abaixo:
```csharp
await dbContext.LogEventAsync(
    category: "Waveformer", 
    level: "Success", 
    message: "Waveform gerada para a stem 'Bateria' (3046 pontos).", 
    details: "AudioUrl: /stems/id/Bateria.opus", 
    trackId: trackId,
    userId: userId
);
```

### 3. Visualização e UX do CRM Administrativo
*   **Design Ultra Compacto**: As linhas de log são finas por padrão (altura mínima de 36px), exibindo apenas o Nível (badge pequeno), Categoria (badge), Data/Hora e a Mensagem truncada. Detalhes do log e metadados de relacionamentos de IDs de usuário/faixa são exibidos apenas ao clicar na linha para expandi-la.
*   **Badges de Categoria Coloridos**: Definimos cores de badges exclusivas por categoria (`Play` = Verde, `Auth` = Roxo, `API` = Azul, `System` = Laranja/Amber) para melhorar a legibilidade visual.
*   **Scroll Infinito (Auto-Fetch)**: A navegação por páginas foi substituída por um fluxo contínuo de rolagem utilizando `IntersectionObserver` no frontend React.
*   **Polling Contínuo Inteligente**: O polling de novos logs funciona de forma ininterrupta na aba. Caso novos logs ocorram enquanto o usuário estiver rolando logs antigos, um badge flutuante `✨ {N} novos logs (atualizar)` é exibido no topo. Ao clicar ou rolar de volta, os logs são acoplados e o offset de paginação do scroll infinito é reiniciado para a Página 1 (`setPage(1)`).
*   **Auditoria de Edições de Músicas**: A rota `PUT /api/Tracks/{id}` foi instrumentada para auditar modificações. Ela compara os valores de metadados (Título, Artista, Visibilidade, Capa) e stems (adições, deleções, substituições) de antes e depois da operação, gravando um resumo detalhado como `Warning`.

---

## 🎯 Impacto e Resultado
* **Centralização de Observabilidade**: Logs de todos os componentes do ecossistema agora residem no mesmo banco de dados relacional.
* **Depuração Ágil**: Erros de rede e processamentos são registrados com detalhes completos e stack traces.
* **UX de Auditoria Premium**: Linhas compactas expansíveis com badges categorizados por cor e polling contínuo sem quebra de scroll.
* **Rastreabilidade Fina de Modificações**: Modificações em músicas por administradores são auditadas com histórico de metadados e arquivos alterados.

---
**Nota do Desenvolvedor:** *Utilizar `ON DELETE SET NULL` foi a chave para manter o histórico de auditoria. Do contrário, ao deletar uma track por moderação, perderíamos os registros de logs de auditoria mostrando que aquela track causou erros ou quando ela foi carregada.*
