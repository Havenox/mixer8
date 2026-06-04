# 033 - [Backend]: Engine de Contagem de Reproduções Semanais

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 04/06/2026

---

## 🚀 Desafio de Engenharia
Até o momento, o Mixer8 contava apenas com um acumulador simples de reproduções totais (`PlayCount`) para músicas. Para alimentar uma seção dinâmica e real de "Tendências da Semana" (músicas populares nos últimos 7 dias), precisávamos de uma solução que:
1. Registrasse de forma individual e atômica cada reprodução (`TrackPlay`) com marcação de data e hora.
2. Contornasse o custo computacional de calcular agregação de soma e agrupamento em tempo de consulta (joins custosos na requisição do usuário).
3. Mantivesse o banco de dados enxuto através de um serviço em segundo plano de expiração de dados antigos (>7 dias).
4. Recalculasse periodicamente e atualizasse o cache direto (`WeekPlayCount`) na tabela de músicas.

## 🧠 Estratégia da Solução
Para atingir máxima performance nas leituras com suporte a paginação e ordenação de tendências semanais, desenhamos o padrão **Log de Eventos com Agregação Periódica**:
* **Logs Atômicos**: Criação da tabela `TrackPlays` que armazena `TrackPlayId` (PK), `TrackId` (FK) e `PlayedAt`. Um índice em `PlayedAt` é configurado para acelerar a deleção física diária/horária.
* **Cache de Leitura Rápida**: Adição da coluna `WeekPlayCount` à tabela `Tracks`. Um índice é criado sobre essa coluna para buscas rápidas.
* **Inserção Atômica**: O endpoint de registro de reprodução (`RecordPlay`) incrementa tanto o `PlayCount` quanto o `WeekPlayCount` em tempo real e insere o registro correspondente em `TrackPlays` de forma síncrona/transacional quando o cooldown de audição do IP ou usuário é atendido.
* **Serviço de Limpeza e Sincronização (Background Worker)**: Um `BackgroundService` em segundo plano executa a cada 1 hora:
  * Exclusão em lote (deleção física via `ExecuteDeleteAsync`) de logs com mais de 7 dias.
  * Recálculo e atualização sincronizada em lote (`WeekPlayCount`) usando uma única instrução SQL nativa via `ExecuteSqlAsync` para excelente performance.

## 🛠️ Implementação Técnica

### Backend (.NET 10 / C# 13)
* **Domain Models**:
  * Criado [TrackPlay.cs](file:///g:/DEV/mixer8/mixer8-api/Domain/TrackPlay.cs) contendo metadados de logs de reprodução.
  * Modificada a classe [Track.cs](file:///g:/DEV/mixer8/mixer8-api/Domain/Track.cs) adicionando a propriedade `WeekPlayCount`.
* **Database Access**:
  * Atualizado o [Mixer8DbContext.cs](file:///g:/DEV/mixer8/mixer8-api/Infrastructure/Mixer8DbContext.cs) com o novo `DbSet<TrackPlay>`.
  * Configurados índices em `TrackPlays.PlayedAt` e `Tracks.WeekPlayCount`.
  * Gerada e aplicada a migração correspondente.
* **Controllers**:
  * Atualizado o endpoint `RecordPlay` em [TracksController.cs](file:///g:/DEV/mixer8/mixer8-api/Controllers/TracksController.cs) para incluir o incremento em tempo real de `WeekPlayCount` e o log de reprodução em `TrackPlays`.
* **Background Worker**:
  * Criado o serviço hospedado [WeeklyPlayCleanupWorker.cs](file:///g:/DEV/mixer8/mixer8-api/Infrastructure/WeeklyPlayCleanupWorker.cs).
  * Registrado o serviço hospedado em [Program.cs](file:///g:/DEV/mixer8/mixer8-api/Program.cs).

## 🎯 Impacto e Resultado
* **Performance Excepcional**: A busca de tendências é indexada em tempo constante $O(1)$ na leitura, eliminando queries agregadas pesadas no momento da navegação.
* **Sustentabilidade de Armazenamento**: Os logs de audição não crescem infinitamente, preservando apenas a janela deslizante de 7 dias úteis e deletando os registros excedentes de maneira rápida.
* **Fidelidade de Dados**: Contagem incrementada imediatamente em tempo de audição qualificada e reajustada/purificada de forma consistente pelo worker em segundo plano.

---
**Nota do Desenvolvedor:** *O recálculo usando query nativa evita carregar entidades para a memória do servidor da API, executando a computação agregada inteiramente no lado do servidor PostgreSQL, reduzindo I/O e pegada de memória significativamente.*
