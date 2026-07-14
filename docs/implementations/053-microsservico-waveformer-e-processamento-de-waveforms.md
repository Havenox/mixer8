# 053 - [Waveformer]: Microsserviço mixer8-waveformer e Processamento de Waveforms

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 14/07/2026

---

## 🚀 Desafio de Engenharia
Para oferecer uma visualização interativa do áudio no estilo DAW no frontend, o sistema necessita gerar um mapa de picos de amplitude (waveforms) para cada uma das stems extraídas. O processamento direto desses dados na API principal consome alta CPU (devido ao FFmpeg) e afeta a latência das demais requisições. 

Adicionalmente, surgiram dois desafios técnicos complexos durante a implementação inicial:
1. **Erro de Planejamento do Postgres (`make_outerjoininfo`)**: O uso de `LEFT JOIN` com locks de concorrência (`FOR UPDATE SKIP LOCKED`) provocou uma falha interna crítica no planejador do PostgreSQL (`initsplan.c:1403`), bloqueando o consumo assíncrono da fila.
2. **Estouro de Complemento de Dois (`System.OverflowException`)**: Amostras de áudio no limite negativo absoluto (`-32768`) de arquivos PCM 16-bit estouraram a capacidade máxima positiva do tipo `short` (`32767`) ao aplicar o método `Math.Abs(sample)`.

## 🧠 Estratégia da Solução
Foi criado um microsserviço dedicado e agnóstico chamado `mixer8-waveformer` rodando como worker em background. O processamento foi arquitetado usando um pipeline de áudio em streaming (Zero-Disk): o áudio é consumido diretamente via requisição HTTP de stream da API e injetado na entrada padrão (`pipe:0`) do FFmpeg na memória, eliminando a escrita e o desgaste físico de SSDs no disco local.

Para resolver os problemas técnicos:
1. **Query NOT EXISTS**: Substituímos a junção externa `LEFT JOIN` por uma subquery `WHERE NOT EXISTS`, permitindo que o PostgreSQL aplique `FOR UPDATE SKIP LOCKED` com isolamento absoluto e sem falhar o planejador.
2. **Cast de Tipo**: Aplicamos um cast de `short` para `int` antes de computar o valor absoluto (`Math.Abs((int)sample)`), neutralizando o estouro de complemento de dois para a amostra `-32768`.

## 🛠️ Implementação Técnica

### Backend
*   **[mixer8-waveformer](file:///g:/DEV/mixer8/mixer8-waveformer)**: Novo projeto .NET 10 rodando em background.
    *   **[Worker.cs](file:///g:/DEV/mixer8/mixer8-waveformer/Worker.cs)**: Loop concorrente transacional que captura uma stem pendente, baixa o stream e alimenta o stdin do FFmpeg s16le 8000Hz mono.
    *   **[Mixer8DbContext.cs](file:///g:/DEV/mixer8/mixer8-waveformer/Infrastructure/Mixer8DbContext.cs)**: Mapeamento da tabela `StemWaveforms`.
*   **[mixer8-api](file:///g:/DEV/mixer8/mixer8-api)**:
    *   **[TracksController.cs](file:///g:/DEV/mixer8/mixer8-api/Controllers/TracksController.cs)**: Exposto o endpoint `GET /api/Tracks/{id}/waveforms` retornando o array de picos estruturado de cada stem da música.

### Docker & Ambiente
*   **[docker-compose.yml](file:///g:/DEV/mixer8/docker-compose.yml)**: Declarado o serviço `mixer8-waveformer` herdando o `.env` e mapeando o arquivo de áudio.
*   **[Dockerfile](file:///g:/DEV/mixer8/mixer8-waveformer/Dockerfile)**: Imagem baseada no runtime .NET 10 contendo o pacote `ffmpeg` nativo.

## 🎯 Impacto e Resultado
* **Escalabilidade Horizontal**: O processamento pesado de CPU foi isolado da API principal, garantindo que a geração de waveforms não degrade a performance do app.
* **Consumo Eficiente em Memória**: O pipeline Zero-Disk evita vazamentos de memória e armazenamento local temporário.
* **Segurança e Estabilidade**: Locks transacionais SKIP LOCKED agora operam de forma 100% segura e livre de deadlocks ou estouros de amplitude.

---
**Nota do Desenvolvedor:** *Isolar o FFmpeg em um worker leve rodando em streaming foi a melhor decisão arquitetural para este escopo. A falha com o número negativo limite de bits (-32768) serve como lembrete sobre o cuidado necessário ao lidar com representação binária de sinais de áudio diretamente na memória no .NET.*
