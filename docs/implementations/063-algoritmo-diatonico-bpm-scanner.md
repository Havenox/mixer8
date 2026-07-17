# Estudo de Caso 063: Algoritmo C# Diatônico com Análise de Cadências V -> I, BPM e Scanner de Backfill 1x

## Contexto e Desafio

Com a evolução das funcionalidades do player do Mixer8 para transposição dinâmica e controle de velocidade, fazia-se necessário registrar de forma persistente no PostgreSQL a **Tonalidade Base (`Key`)** e o **BPM Base (`Bpm`)** de cada faixa da biblioteca.

Em testes empíricos iniciais, algoritmos simples de contagem de nota raiz sem peso harmônico frequentemente confundiam a Tonalidade Base com a **5ª Dominante ($V$)** ou com a **4ª Subdominante ($IV$)** (por exemplo, confundindo $Dm$ com $A$, $Gm$ com $D$, ou $A$ com $D$). Isso acontecia porque os campos harmônicos de uma tônica e de sua dominante compartilham quase todas as mesmas notas diatônicas.

## Arquitetura da Solução Aprimorada

### 1. Modelo de Dados (EF Core & PostgreSQL)
Adicionados os campos `Bpm` (`int?`) e `Key` (`string?`) na entidade `Track` (`Track.cs` e migração EF Core `AddTrackBpmAndKey`).

### 2. Algoritmo C# Diatônico Ponderado com Cadências ($V \to I$) (`MusicAnalysisHelper.cs`)
Para resolver definitivamente as sobreposições de 4ª e 5ª, reestruturamos a engine C# com 4 regras essenciais de teoria musical:
* **Detecção de Cadências Autênticas ($V \to I$ / $V \to i$)**:
  * O algoritmo monitora as transições entre acordes em `chords.json`.
  * Quando identifica a resolução da Dominante para a Tônica (ex: $A7 \to Dm$, $D7 \to Gm$, $E \to A$), a tonalidade candidata ganha um **bônus massivo de cadência (+25 pontos)**. Como a transição $A \to Dm$ é um movimento $V \to i$ em $Dm$, mas **não** em $A$, a confusão é completamente eliminada.
* **Ponderação por Duração/Tempo de Permanência da Tônica**:
  * Pondera cada acorde pelo número de batidas ativas na música.
  * A tônica ($I$/$i$) de uma escala válida ganha peso proporcional ao tempo que permanece ativa. Se a tônica nem sequer aparece na música, a escala candidata sofre severa penalização (-50 pts).
* **Resolução Plagal ($IV \to I$ / $iv \to i$)**:
  * Resoluções subdominantes recebem bônus adicional de +10 pontos.
* **Cálculo de BPM Base**:
  * Analisa os carimbos de tempo (`curr_beat_time`) das batidas em `chords.json`.
  * Filtra deltas atípicos (pausas/silêncios $> 2.5s$ ou marcas $< 0.2s$) para isolar o andamento musical.
  * Deriva o BPM inteiro: $\text{BPM} = \text{Math.Round}(60 / \overline{\Delta t})$.

### 3. Automação no Extrator e Consolidação
Sempre que uma nova música conclui a extração de stems e tem o arquivo `chords.json` gerado, o backend/extrator invoca o `MusicAnalysisHelper`, grava `track.Key` e `track.Bpm` no PostgreSQL e registra uma entrada nos logs de auditoria (`SystemEvents`).

### 4. Endpoint de Backfill 1x e Painel Admin
* **Endpoint (`POST /api/System/BackfillMusicMetadata`)**: Restrito a administradores, busca todas as músicas em status `Pronto` que estejam com `Bpm == null` ou `Key == null`, faz a leitura do `chords.json` em disco, salva os resultados no banco e gera os logs individuais de auditoria.
* **Interface Admin (`Admin.tsx`)**: Adicionado o botão **"Sincronizar Tons e BPMs das Músicas Existentes"** na aba de Configurações, com exibição em tempo real de mensagens de progresso e resultado.

## Arquivos Modificados/Criados

- **`mixer8-api/Domain/Track.cs`** & **`mixer8-extractor/Domain/Track.cs`**: Inclusão de `Bpm` e `Key`.
- **`mixer8-api/Helpers/MusicAnalysisHelper.cs`** & **`mixer8-extractor/Helpers/MusicAnalysisHelper.cs`**: Engine C# de teoria musical, cadências $V \to I$ e cálculo de BPM.
- **`mixer8-api/Infrastructure/Migrations/20260716234138_AddTrackBpmAndKey.cs`**: Migration EF Core.
- **`mixer8-api/Controllers/SystemController.cs`**: Endpoint `POST /api/System/BackfillMusicMetadata`.
- **`mixer8-api/Controllers/TracksController.cs`**: Análise automática ao consolidar novas stems.
- **`mixer8-app/src/pages/Admin.tsx`**: Botão e estado de acionamento do Backfill de metadados.

## Verificação e Resultados

1. **Compilação C#**: Os projetos `mixer8-api` e `mixer8-extractor` compilaram sem erros (`0 Erro(s)`).
2. **Build React**: O frontend compilou com sucesso (`tsc -b`).
3. **Deploy Docker**: Contêineres reconstruídos e iniciados com sucesso (`docker compose up -d --build`).
