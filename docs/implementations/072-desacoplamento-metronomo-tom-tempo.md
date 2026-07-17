# 072 - Frontend: Desacoplamento e Isolamento Independente do Metrônomo em Tom e Tempo

**Autor:** Eduardo Nascimento (Havenox)  
**Data:** 17/07/2026  

---

## 🚀 Desafio de Engenharia
Ao manipular simultaneamente o **Tom** (`transpose`) e o **Tempo** (`bpmDelta`) na DAW do Mixer8, ocorria um desvio ritmico no qual o Metrônomo perdia o compasso da música.

A causa raiz foi que, no modo nativo de áudio (Lite) e na renderização offline da exportação MP3 (`mixExporter.ts`), o cálculo de taxa de reprodução (`playbackRate`) combinava o fator de afinação (`pitchRatio = 2^(transpose/12)`) e velocidade (`speedRatio = targetBpm / baseBpm`) de forma global para todas as faixas em loop único. 

Como o Metrônomo precisa ignorar a alteração de Tom sem perder o acompanhamento do novo BPM, a velocidade do Metrônomo sofria aceleração/desaceleração colateral da afinação quando Tom e Tempo eram manipulados juntos.

## 🧠 Estratégia da Solução
1. **Detecção Resiliente do Metrônomo (`isMetronomeStem`)**:
   - Implementada a função utilitária `isMetronomeStem(stemType)` para identificar qualquer variação de nomenclatura da stem do Metrônomo (`'Metrônomo'`, `'metronomo'`, `'click'`, `'metronome'`).
2. **Desacoplamento em Tempo de Execução (`PlayerContext.tsx`)**:
   - **Modo Power (WASM SIMD):** A stem do Metrônomo bypassa a Worklet WASM de afinação, conectando-se diretamente ao ganho Master. Seu `playbackRate` é ajustado exclusivamente para `speedRatio = targetBpm / baseBpm`.
   - **Modo Lite (Web Audio Nativo):** Enquanto as stems musicais usam `combinedRate = pitchRatio * speedRatio` para simular pitch shift por resample, a stem do Metrônomo força `preservesPitch = true` e ajusta seu `playbackRate` **estritamente pelo `speedRatio` do BPM**, ignorando o `pitchRatio`.
3. **Desacoplamento na Exportação DAW (`mixExporter.ts`)**:
   - Na reconstrução offline da `OfflineAudioContext`, o motor calcula separadamente `musicalSpeedRatio` (com multiplicador de tom) e `metronomeSpeedRatio` (apenas com o fator de BPM).
   - Ao injetar as buffers nos `AudioBufferSourceNode`, a stem do Metrônomo recebe `metronomeSpeedRatio`, garantindo alinhamento temporal perfeito no áudio baixado.

## 🛠️ Implementação Técnica
* **`PlayerContext.tsx`**:
  - Exposta e aplicada a função `isMetronomeStem`.
  - Atualizado o efeito reativo de tempo/tom e a conexão de destino (`targetDest`) para isolar o Metrônomo.
* **`mixExporter.ts`**:
  - Importada `isMetronomeStem`.
  - Separadas as taxas de velocidade `musicalSpeedRatio` e `metronomeSpeedRatio` para os nós de áudio offline.

## 🎯 Impacto e Resultado
* **Sincronismo Ritmico Absoluto:** O usuário pode alterar o tom em qualquer quantidade de semitonos (ex: `+5` ou `-4`) e ajustar o BPM (ex: `+20 BPM`), e o Metrônomo permanece 100% no compasso da música com seu timbre e afinação originais.
* **Consistência Live & Export:** O comportamento da SPA no navegador é rigorosamente idêntico ao do arquivo `.mp3` final gerado na exportação.
