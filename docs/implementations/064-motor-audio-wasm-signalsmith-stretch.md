# Estudo de Caso 064: Motor de Áudio WebAssembly SIMD (Signalsmith Stretch) para Transposição de Tom em Tempo Real

## 📋 Resumo Executivo
Implementação de um motor de áudio DSP avançado de alta fidelidade em **WebAssembly (WASM SIMD 128-bit)** no frontend do Mixer8, utilizando a biblioteca C++ open-source **Signalsmith Stretch** (Licença MIT). O motor executa em uma thread dedicada em tempo real via **AudioWorklet**, garantindo transposição de Tom ($\pm 6$ semitons) e variação de BPM com alta transparência, preservação de transientes e zero artefatos metálicos. Inclui suporte ao **Modo Power** (WASM SIMD por padrão) e **Modo Lite** (Web Audio API nativo configurável no perfil do usuário).

---

## 🏗️ Arquitetura Técnica

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MIXER8 POWER AUDIO ENGINE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [ MODO POWER - Padrão ]                                                    │
│  ├── Engine: WebAssembly SIMD (Signalsmith Stretch - Licença MIT)           │
│  ├── Thread: AudioWorklet Dedicated Thread (Thread de Áudio de Tempo Real)  │
│  ├── Master Bus: Sum das Stems Harmônicas (Vocals, Keys, Guitar, Bass)      │
│  ├── Metrônomo Bypass: O Metrônomo ignora a transposição de tom             │
│  └── Resultado: Som limpo, transparência total e zero artefatos             │
│                                                                             │
│  [ MODO LITE - Configuração do Usuário ]                                    │
│  ├── Engine: Web Audio API Nativa (AudioBufferSourceNode.playbackRate)       │
│  └── Desempenho: Ultra-leve para celulares antigos com processador fraco     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Modificações Realizadas

### 1. Compilador & Wrapper WASM C++ (`signalsmith-stretch.wasm`)
* **`mixer8-app/wasm-build/wrapper.cpp`**: Wrapper em C++ que expõe funções nativas `stretch_create`, `stretch_set_transpose_semitones`, `stretch_process` e `stretch_destroy`.
* **`mixer8-app/wasm-build/build.sh`**: Script de automação que baixa as dependências (`signalsmith-stretch.h`, `stft.h`, `fft.h`) e compila o código C++ via Emscripten em Docker com otimizações **WASM SIMD 128-bit (`-O3 -msimd128`)**.
* **Artefatos Gerados**: `signalsmith-stretch.wasm` (78.5 KB) e `signalsmith-stretch.js` (13.4 KB) na pasta `public/wasm/`.

### 2. AudioWorklet Processor em Tempo Real (`pitch-shift-processor.js`)
* **`public/wasm/pitch-shift-processor.js`**: Processor estendendo `AudioWorkletProcessor` que roda na thread dedicada de áudio do navegador.
* **Compatibilidade com AudioWorkletGlobalScope**: Embutido o cabeçalho de inicialização da Emscripten ajustando a detecção de ambiente (`ENVIRONMENT_IS_WORKER = true`, `ENVIRONMENT_IS_WEB = false`) e removendo dependências incompatíveis como `importScripts()`, `self.location` (que é `undefined` no AudioWorklet) e `XMLHttpRequest`.
* **Inicialização WASM Deferida & Registrador Seguro**: Ajustada a função `initWasmEngine()` para postergar a chamada `createWasm()` para o momento da instanciação do nó, garantindo que `registerProcessor('pitch-shift-processor', PitchShiftProcessor)` seja executado imediatamente na avaliação inicial do script sem falhas.
* **Acesso Direto ao Heap float32**: Implementado o helper `getHeapF32()` para ler e manipular o buffer de memória float32 do WASM sem exceções de `undefined`.
* **Bypass do Metrônomo**: Roteia a stem do metrônomo diretamente para o `masterGainNode`, impedindo que o clique sofra transposição de tom.

### 3. Persistência de Perfil & Backend (`UserProfile.cs` & API)
* **EF Core Migration**: Criada a migração `20260717002257_AddAudioEngineModeToUserProfile` que adiciona a coluna `AudioEngineMode` no PostgreSQL (Padrão: `"Power"`).
* **Endpoints de Perfil**: Atualizado `AuthController.cs` para retornar e atualizar o campo `AudioEngineMode` nos endpoints `/Auth/Me` e `PUT /Auth/Profile`.

### 4. Interface do Player e Configurações (`PlayerContext.tsx`, `GlobalTopHeader.tsx` & `Settings.tsx`)
* **`PlayerContext.tsx`**: Inicialização assíncrona da Web Audio API com `addModule('/wasm/pitch-shift-processor.js')` e sincronização do estado de transposição de Tom (`transpose`) e variação de velocidade (`bpmDelta`). O cálculo do `speedRatio = (baseBpm + bpmDelta) / baseBpm` é aplicado ao `playbackRate` dos elementos de áudio enquanto a thread dedicada de AudioWorklet WASM cuida da alteração de afinação em alta fidelidade.
* **`GlobalTopHeader.tsx`**: Conectados os botões de incremento e decremento (`-` e `+`) de **TOM** ($\pm 12$ semitons) e **BPM** ($\pm 50\text{ BPM}$) com suporte a clique de redefinição (*reset*).
* **`Settings.tsx`**: Adicionada a seção **Motor de Áudio do Player (DSP Transposição)** permitindo ao usuário escolher entre **Modo Power (WASM SIMD)** e **Modo Lite (Aceleração Nativa)**.

---

## 🧪 Validação e Testes
* **Compilação C++/WASM**: Build efetuado com sucesso via Docker Emscripten.
* **Compilação Frontend**: `npm run build` executado sem avisos ou erros TypeScript.
* **Compilação Backend**: `dotnet build` executado com 0 erros.
* **Containers Docker**: Imagens recompiladas e iniciadas (`docker compose up -d --build`).

---

## 📌 Commits Relacionados
* `4986604`: `feat(wasm): adiciona wrapper C++ e artefatos de compilacao WASM SIMD Signalsmith Stretch`
* `9c86bf7`: `feat(api): adiciona propriedade AudioEngineMode no UserProfile e atualiza endpoints do perfil`
* `a88ab91`: `feat(audio): integra AudioWorklet WASM Signalsmith Stretch no player e seletor Power/Lite nas configuracoes`
