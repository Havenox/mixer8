# Banco de Dados e Persistência (ADR-03)

Este documento detalha o modelo relacional de dados para o banco de dados **PostgreSQL** do ecossistema **Mixer8**, bem como os mecanismos de controle transacional ACID e as rotinas de segundo plano.

---

## 1. Schema do Banco de Dados PostgreSQL (Destaques)

Para garantir a soberania do backend e o mapeamento idêntico no TypeScript, todos os nomes de tabelas e colunas utilizam estritamente a grafia **PascalCase**.

```mermaid
erDiagram
    Users ||--o{ Tracks : "Uploads"
    Users ||--o{ Playlists : "Cria"
    Users ||--o{ MixingPresets : "Salva"
    Tracks ||--|{ Stems : "Contém (1 a 5)"
    Tracks ||--o{ MixingPresets : "Mapeia"
    Playlists ||--o{ PlaylistTracks : "Agrupa"
    Tracks ||--o{ PlaylistTracks : "Pertence"
    Albums ||--o{ Tracks : "Agrupa"

    Users {
        Guid UserId PK
        String Email
        String PasswordHash
        String UserRole "Admin, Moderator, PaidUser, User"
        DateTime CreatedAt
    }

    Tracks {
        Guid TrackId PK
        String TrackTitle
        String ArtistName
        Guid UploadedBy FK
        String ExtractionStatus "Aguardando, Processando, Pronto, Falhou"
        String Visibility "Public, Private, Unlisted"
        Boolean DeletionPending
        DateTime CreatedAt
        Int Duration
        Long PlayCount
        Guid AlbumId FK
        Int TrackNumber
        Int DiscNumber
    }

    Stems {
        Guid StemId PK
        Guid TrackId FK
        String StemType "Voz, Bateria, Baixo, Guitarra, Piano, Teclado, Sopro, Cordas, Metronomo, Outros"
        String AudioUrl
        DateTime CreatedAt
    }

    Playlists {
        Guid PlaylistId PK
        String Name
        String Visibility "Public, Private, Unlisted"
        String Description
        Guid OwnerId FK
        String CoverUrl
        DateTime CreatedAt
        Long PlayCount
    }

    PlaylistTracks {
        Guid PlaylistId PK-FK
        Guid TrackId PK-FK
        Guid AddedById FK
        DateTime AddedAt
        Int Order
    }

    Albums {
        Guid AlbumId PK
        String Title
        String ArtistName
        String Visibility "Public, Private, Unlisted"
        DateTime ReleaseDate
        String CoverUrl
        DateTime CreatedAt
        Long PlayCount
    }

    MixingPresets {
        Guid PresetId PK
        Guid TrackId FK
        Guid UserId FK
        String PresetName
        Float VocalsVolume "0.0 - 1.0"
        Float DrumsVolume
        Float BassVolume
        Float PianoVolume
        Float OthersVolume
        DateTime CreatedAt
    }
```

---

## 2. Resiliência ACID e Controle de Concorrência

Para evitar problemas de concorrência ou corrupção de dados ao lidar com uploads simultâneos e processamentos de bots headless, implementamos as seguintes proteções na camada de persistência:

### A. Bloqueio Transacional de Fila de Extração
Quando o microserviço `mixer8-extractor` solicita à `mixer8-api` a próxima faixa pendente para conversão, o banco de dados realiza uma transação com isolamento estrito para evitar que múltiplas instâncias do bot processem a mesma música simultaneamente:

```sql
-- Exemplo de query atômica com bloqueio de linha no PostgreSQL
BEGIN TRANSACTION;

SELECT "TrackId" 
FROM "Tracks" 
WHERE "ExtractionStatus" = 'Aguardando'
ORDER BY "CreatedAt" ASC
LIMIT 1 
FOR UPDATE SKIP LOCKED; -- Bloqueia a linha impedindo que outros workers a leiam

-- O bot marca como 'Processando' imediatamente dentro da mesma transação
UPDATE "Tracks" 
SET "ExtractionStatus" = 'Processando' 
WHERE "TrackId" = :trackId;

COMMIT;
```

* **SKIP LOCKED**: Se outro container do bot já estiver lendo e processando uma track, a query pula a linha bloqueada silenciosamente e pega o próximo registro livre da fila. Isso garante **alta disponibilidade** e **resiliência ACID** caso escalemos horizontalmente o serviço na VPS.

### B. Mutações em Lote Atômicas
Ao concluir o download e extração das faixas, o microserviço atualiza o status no banco e insere as stems em um único bloco transacional. Se a inserção de qualquer uma das 5 stems falhar, o banco executa um `Rollback` automático, revertendo o status da música de volta para `Falhou` ou `Aguardando`, garantindo que nunca existam músicas "órfãs" com dados de stems incompletos na interface do usuário.

### C. Exclusão Física Transacional (Independente de Status)
O fluxo de exclusão de faixas no backend em `DELETE /api/Tracks/{id}` realiza a purga total de forma transacional segura:
1. **Transação Relacional**: A remoção da faixa no PostgreSQL remove em cascata todas as referências associadas em `Stems`, `PlaylistTracks` e `MixingPresets`. Isso funciona mesmo se a faixa não possuir stems (status `Aguardando`, `Processando` ou `Falhou`).
2. **Limpeza do Sistema de Arquivos**: Após a confirmação da transação no banco, a API remove fisicamente os diretórios de stems (`wwwroot/stems/{id}`) e quaisquer arquivos temporários que possam estar na pasta de downloads ou buffer do extrator.
3. **Rollback Seguro**: Em caso de qualquer falha na remoção dos arquivos do disco ou no banco, a transação sofre um rollback automático, mantendo o estado íntegro.

### D. Controle de Exclusão Lógica (Soft Delete)
Para faixas deletadas por uploaders comuns, a API realiza uma exclusão lógica (`DeletionPending = true`). Esse mecanismo evita o descarte prematuro e definitivo de arquivos em disco e referências no banco, garantindo:
1. **Ocultamento Imediato**: A flag é avaliada dinamicamente em consultas SQL (`TracksController`) e relacionamentos de playlists (`PlaylistsController`), isolando a faixa sob moderação e ocultando-a para usuários não-admins.
2. **Revisão pelo Administrador**: As faixas sob moderação continuam armazenadas fisicamente no PostgreSQL e no servidor. Uma vez que o administrador confirma a deleção definitiva via `DELETE /api/Tracks/{id}`, o banco executa a limpeza física total em cascata e o servidor expurga os diretórios físicos.


---

## 3. Processamentos em Background Decoplados

A aplicação possui rotinas de background agendadas (Cron Jobs / Hosted Services) para tarefas de manutenção preventiva e diagnóstico:

1. **Limpeza de Arquivos Temporários**: Uma tarefa diária que varre a pasta `/app/downloads` temporária da API e do Extractor, removendo arquivos originais de upload e ZIPs antigos já descompactados cujos dados já foram persistidos nos storages de CDN, liberando espaço em disco na VPS.
2. **Consolidação de Estatísticas de Audiência**: Agregador que contabiliza as execuções de tracks em lote a cada hora (evitando que requisições HTTP individuais do player inflem acessos simultâneos no banco de dados principal de forma síncrona).
3. **Monitoramento de Flags de Depuração (Extractor)**: O Worker C# executa uma thread paralela em background que monitora continuamente a criação do arquivo `take_screenshot.flag` no diretório de configuração. Ao detectar a flag, ela aciona uma captura de tela do navegador headless ativo (`screenshot_live.png`) para diagnóstico e exclui o arquivo flag em seguida.

---

## 4. Persistência de Volumes e Dados de Sessão
Para que o bot mantenha seu estado de login e autenticação ativo entre reinicializações de contêineres Docker, o diretório de dados do bot é isolado e persistido:
* **Mapeamento de Volume**: O diretório de configuração do extrator (definido pela variável de ambiente `EXTRACTOR_CONFIG_DIR`, mapeado para `/app/config` no contêiner) é montado como um volume compartilhado com o host no `docker-compose.yml`.
* **Preservação de Estado**: Arquivos cruciais como o estado de autenticação do Playwright (`auth.json`), logs do navegador e capturas de tela diagnósticas em runtime são armazenados neste volume, garantindo que o bot não precise reautenticar a cada recriação do contêiner.
