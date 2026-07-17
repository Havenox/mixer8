// PitchShiftProcessor AudioWorklet usando Signalsmith Stretch WASM (SIMD 128-bit)
// Processa o áudio na thread dedicada de tempo real sem latência nem travamento de UI

importScripts('/wasm/signalsmith-stretch.js');

class PitchShiftProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.wasmInstance = null;
    this.stretchHandle = null;
    this.pitchSemitones = 0;
    this.sampleRateVal = sampleRate || 44100;

    // Pointers de memória WASM
    this.inPtr0 = null;
    this.inPtr1 = null;
    this.outPtr0 = null;
    this.outPtr1 = null;
    this.bufferSize = 128; // tamanho do bloco do AudioWorklet

    this.isInitialized = false;

    this.port.onmessage = (event) => {
      const data = event.data;
      if (data && data.type === 'SET_PITCH') {
        this.pitchSemitones = data.semitones || 0;
        if (this.stretchHandle && this.wasmInstance) {
          this.wasmInstance._stretch_set_transpose_semitones(this.stretchHandle, this.pitchSemitones);
        }
      }
    };

    this.initWasm();
  }

  async initWasm() {
    try {
      const waitForModule = () => new Promise((resolve) => {
        if (typeof Module !== 'undefined' && Module._stretch_create) {
          resolve(Module);
        } else if (typeof Module !== 'undefined') {
          Module.onRuntimeInitialized = () => resolve(Module);
        } else {
          setTimeout(() => waitForModule().then(resolve), 50);
        }
      });

      const moduleInstance = await waitForModule();
      this.wasmInstance = moduleInstance;
      
      // Cria instância do Signalsmith Stretch C++ (44.1/48kHz, 2 canais stereo)
      this.stretchHandle = moduleInstance._stretch_create(this.sampleRateVal, 2);
      moduleInstance._stretch_set_transpose_semitones(this.stretchHandle, this.pitchSemitones);

      // Aloca buffers de memória float32 no WASM heap
      const bytesPerBlock = this.bufferSize * 4;
      this.inPtr0 = moduleInstance._malloc(bytesPerBlock);
      this.inPtr1 = moduleInstance._malloc(bytesPerBlock);
      this.outPtr0 = moduleInstance._malloc(bytesPerBlock);
      this.outPtr1 = moduleInstance._malloc(bytesPerBlock);

      this.isInitialized = true;
      this.port.postMessage({ type: 'STATUS', status: 'READY' });
      console.log('[AudioWorklet] WASM Signalsmith Stretch inicializado com sucesso!');
    } catch (err) {
      console.error('[AudioWorklet] Falha ao inicializar WASM Signalsmith Stretch:', err);
    }
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0] || !output || !output[0]) {
      return true;
    }

    const numSamples = input[0].length;
    const isMonoInput = !input[1];

    const inL = input[0];
    const inR = isMonoInput ? input[0] : input[1];

    const outL = output[0];
    const outR = output[1] || output[0];

    // Se o WASM ainda estiver carregando ou sem transposição (pitch = 0), faz passthrough direto
    if (!this.isInitialized || !this.stretchHandle || this.pitchSemitones === 0) {
      for (let i = 0; i < numSamples; i++) {
        outL[i] = inL[i];
        if (output[1]) output[1][i] = inR[i];
      }
      return true;
    }

    try {
      const HEAPF32 = this.wasmInstance.HEAPF32;
      
      // Copia áudio da entrada para o Heap WASM
      HEAPF32.set(inL, this.inPtr0 >> 2);
      HEAPF32.set(inR, this.inPtr1 >> 2);

      // Executa processamento C++ Signalsmith Stretch SIMD
      this.wasmInstance._stretch_process(
        this.stretchHandle,
        this.inPtr0,
        this.inPtr1,
        numSamples,
        this.outPtr0,
        this.outPtr1,
        numSamples
      );

      // Copia áudio processado do Heap WASM para a saída do AudioWorklet
      outL.set(HEAPF32.subarray(this.outPtr0 >> 2, (this.outPtr0 >> 2) + numSamples));
      if (output[1]) {
        outR.set(HEAPF32.subarray(this.outPtr1 >> 2, (this.outPtr1 >> 2) + numSamples));
      }
    } catch (e) {
      // Fallback em caso de exceção pontual
      for (let i = 0; i < numSamples; i++) {
        outL[i] = inL[i];
        if (output[1]) output[1][i] = inR[i];
      }
    }

    return true;
  }
}

registerProcessor('pitch-shift-processor', PitchShiftProcessor);
