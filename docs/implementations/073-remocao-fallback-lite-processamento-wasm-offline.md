# 073 - [Player/Export]: Remoção do Fallback Lite e Processamento WASM Offline Direto nos Buffers

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 17/07/2026

---

## 🚀 Desafio de Engenharia
O Mixer8 possui suporte à transposição de tom (Pitch Shift) e alteração de tempo (BPM) em tempo real. No entanto, tínhamos dois problemas críticos:
1. **Fallback Lite Inadequado:** O "Modo Lite" de processamento (baseado inteiramente na Web Audio API pura) gerava resultados acústicos insatisfatórios, com distorções na reprodução e comportamento instável.
2. **Falta de Fidelidade Acústica na Exportação MP3:** Durante a exportação da mixagem (`mixExporter`), o navegador usava `AudioBufferSourceNode`, que não suporta a propriedade nativa `preservesPitch` (exclusiva de elementos `<audio>`). Ao alterar o BPM para exportar, ocorria uma variação física do tom (efeito de disco acelerado), obrigando o processador WASM a aplicar transposições gigantescas e indesejadas de compensação, o que arruinava a fidelidade do áudio com artefatos metálicos e ecos.

## 🧠 Estratégia da Solução
Decidimos elevar o padrão de engenharia da aplicação ao adotar a engine "Power" (baseada no motor Signalsmith Stretch compilado em WebAssembly SIMD 128-bit) como a única e definitiva engine da plataforma:
1. **Descontinuação do Modo Lite:** Removemos por completo todas as opções, preferências locais (localStorage) e lógicas condicionais do "Modo Lite", simplificando a base de código e garantindo que todos os usuários desfrutem da melhor fidelidade acústica.
2. **Processamento WASM Offline Direto na Thread Principal:**
   - Em vez de realizar o pitch shifting no fluxo de gravação da `OfflineAudioContext`, o exportador agora carrega o arquivo `.wasm` do Signalsmith Stretch diretamente na thread principal do JavaScript.
   - Antes de iniciar a mixagem offline, processamos os canais de áudio (`AudioBuffer` decodificados) de cada stem individualmente em memória.
   - Para faixas musicais, aplicamos o time-stretch (`tempoRatio`) e o pitch-shift (`transpose`) desejado.
   - Para o metrônomo, aplicamos apenas o time-stretch (`tempoRatio`) e mantemos o pitch em `0`.
   - A `OfflineAudioContext` apenas recebe as faixas pré-processadas no tempo e tom perfeitos, executando-as em velocidade nativa `1.0`. Isso anula qualquer desvio de sincronia, latência ou alteração espectral.

## 🛠️ Implementação Técnico

### Frontend
- **`Settings.tsx`**: Removido o seletor visual do Motor de Áudio ("Bloco 4") e fixado o valor de payload `AudioEngineMode: 'Power'` para preservar a compatibilidade de contrato do backend.
- **`PlayerContext.tsx`**: Removido o estado `audioEngineMode` e o método `setAudioEngineMode` da interface de contexto. Simplificada a rotina de aplicação de tom e velocidade `applyPitchAndTempoSettings()` e a conexão das stems no `loadTrack()` para utilizar exclusivamente o fluxo com AudioWorklet WASM.
- **`mixExporter.ts`**:
  - Adicionada a função auxiliar `processAudioBufferOffline()` que aloca buffers no heap WASM, copia os dados float da trilha para a memória e chama a função C++ `stretch_process` de forma síncrona sobre o buffer completo.
  - Atualizada a rotina de exportação para carregar o módulo WASM, criar a instância com as dependências do Emscripten, pré-processar cada stem e injetar os resultados na `OfflineAudioContext` executados na taxa natural `1.0`.

## 🎯 Impacto e Resultado
* **Qualidade de Exportação de Estúdio**: O arquivo MP3 gerado na exportação agora possui sonoridade e afinação idênticas ao áudio que o usuário ouve no player da aplicação, livre de distorções metálicas por compensações excessivas.
* **Sincronia Matemática do Metrônomo**: Como todas as stems e o click do metrônomo passam pela mesma engine e começam na amostra `0` na OfflineCtx, a sincronia temporal é 100% precisa.
* **Simplificação de Arquitetura**: A remoção da engine Lite reduziu a complexidade de conexões dinâmicas do grafo de áudio Web Audio API no frontend.

---
**Nota do Desenvolvedor:** *Ao forçar o uso da engine WebAssembly SIMD tanto no player quanto na exportação direta em memória, garantimos consistência de áudio profissional e robustez sem depender de recursos mal documentados de navegadores individuais.*
