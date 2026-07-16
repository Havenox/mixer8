# Estudo de Caso 063: Algoritmo C# Diatônico de Tom & BPM, Automação no Extrator e Scanner de Backfill 1x

## Contexto e Desafio

Com a evolução das funcionalidades do player do Mixer8 para transposição dinâmica e controle de velocidade, fazia-se necessário registrar de forma persistente no PostgreSQL a **Tonalidade Base (`Key`)** e o **BPM Base (`Bpm`)** de cada faixa da biblioteca.

No entanto, em teoria musical, o primeiro acorde de uma música não indica necessariamente sua tônica (por exemplo, a progressão $F \rightarrow G \rightarrow Am \rightarrow Dm$ começa no IV grau, mas pertence à tonalidade de **C Dó Maior**). Além disso, era preciso uma solução de varredura 1x (Backfill) para calcular e preencher os metadados de todas as faixas existentes sem a necessidade de reprocessar os áudios.

## Arquitetura da Solução

### 1. Modelo de Dados (EF Core & PostgreSQL)
Adicionados os campos `Bpm` (`int?`) e `Key` (`string?`) na entidade `Track` (`Track.cs` e migração EF Core `AddTrackBpmAndKey`).

### 2. Algoritmo C# Diatônico & Análise Temporal (`MusicAnalysisHelper.cs`)
Criamos uma engine nativa em C# de teoria musical e processamento de tempo:
* **Cálculo de BPM Base**:
  * Analisa os carimbos de tempo (`curr_beat_time`) das batidas presentes no `chords.json`.
  * Filtra deltas atípicos (pausas/silêncios $> 2.5s$ ou marcas $< 0.2s$) para isolar o andamento musical.
  * Obtém a média dos intervalos ($\overline{\Delta t}$) e calcula o BPM inteiro: $\text{BPM} = \text{Math.Round}(60 / \overline{\Delta t})$.
* **Detecção Diatônica de Tonalidade Base (Key)**:
  * Extrai os primeiros acordes únicos da música.
  * Mapeia as 12 escalas diatônicas Maiores e Menores com os 7 graus de cada campo harmônico.
  * Executa um sistema de pontuação diatônica (*Diatonic Scoring*) para identificar qual campo harmônico melhor acolhe a sequência de acordes, determinando a tônica exata mesmo quando a música não inicia no I grau.

### 3. Automação no Extrator e Consolidação
Sempre que uma nova música conclui a extração de stems e tem o arquivo `chords.json` gerado, o backend/extrator invoca o `MusicAnalysisHelper`, grava `track.Key` e `track.Bpm` no PostgreSQL e registra uma entrada nos logs de auditoria (`SystemEvents`).

### 4. Endpoint de Backfill 1x e Painel Admin
* **Endpoint (`POST /api/System/BackfillMusicMetadata`)**: Restrito a administradores, busca todas as músicas em status `Pronto` que estejam com `Bpm == null` ou `Key == null`, faz a leitura do `chords.json` em disco, salva os resultados no banco e gera os logs individuais de auditoria.
* **Interface Admin (`Admin.tsx`)**: Adicionado o botão **"Sincronizar Tons e BPMs das Músicas Existentes"** na aba de Configurações, com exibição em tempo real de mensagens de progresso e resultado.

## Arquivos Modificados/Criados

- **`mixer8-api/Domain/Track.cs`** & **`mixer8-extractor/Domain/Track.cs`**: Inclusão de `Bpm` e `Key`.
- **`mixer8-api/Helpers/MusicAnalysisHelper.cs`** & **`mixer8-extractor/Helpers/MusicAnalysisHelper.cs`**: Engine C# de teoria musical e cálculo de BPM.
- **`mixer8-api/Infrastructure/Migrations/20260716234138_AddTrackBpmAndKey.cs`**: Migration EF Core.
- **`mixer8-api/Controllers/SystemController.cs`**: Endpoint `POST /api/System/BackfillMusicMetadata`.
- **`mixer8-api/Controllers/TracksController.cs`**: Análise automática ao consolidar novas stems.
- **`mixer8-app/src/pages/Admin.tsx`**: Botão e estado de acionamento do Backfill de metadados.

## Verificação e Resultados

1. **Compilação C#**: Os projetos `mixer8-api` e `mixer8-extractor` compilaram sem erros (`0 Erro(s)`).
2. **Build React**: O frontend compilou com sucesso (`tsc -b`).
3. **Deploy Docker**: Contêineres recriados e iniciados com sucesso (`docker compose up -d --build`).
