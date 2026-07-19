// PitchShiftProcessor AudioWorklet usando Signalsmith Stretch WASM (SIMD 128-bit)
// Processa o áudio na thread dedicada de tempo real sem latência nem travamento de UI
// Cada processador possui sua própria instância isolada do WASM e heap de memória local.

function createSignalsmithShifter(wasmModule, sampleRateVal, initialPitch, bufferSize) {
  var Module = {};
  var ENVIRONMENT_IS_WEB = false;
  var ENVIRONMENT_IS_WORKER = true;
  var ENVIRONMENT_IS_NODE = false;
  var quit_ = (status, toThrow) => { throw toThrow; };
  
  var ABORT = false;
  var runtimeInitialized = false;

  var HEAP16, HEAP32, HEAP64, HEAP8, HEAPF32, HEAPF64, HEAPU16, HEAPU32, HEAPU64, HEAPU8;
  var wasmMemory;
  var wasmExports;

  function getMemoryBuffer() { return wasmMemory.buffer; }
  
  function updateMemoryViews() {
    if (HEAP8?.buffer?.resizable) return;
    var b = getMemoryBuffer();
    HEAP8 = new Int8Array(b);
    HEAP16 = new Int16Array(b);
    HEAPU8 = new Uint8Array(b);
    HEAPU16 = new Uint16Array(b);
    HEAP32 = new Int32Array(b);
    HEAPU32 = new Uint32Array(b);
    HEAPF32 = new Float32Array(b);
    HEAPF64 = new Float64Array(b);
    HEAP64 = new BigInt64Array(b);
    HEAPU64 = new BigUint64Array(b);
  }

  var onPostRuns = [];
  var onPreRuns = [];

  function preRun() {
    var preRun = Module["preRun"];
    if (preRun) {
      if (typeof preRun == "function") preRun = [preRun];
      onPreRuns.push(...preRun);
    }
    callRuntimeCallbacks(onPreRuns);
  }

  function initRuntime() {
    runtimeInitialized = true;
    if (wasmExports["f"]) wasmExports["f"]();
  }

  function postRun() {
    var postRun = Module["postRun"];
    if (postRun) {
      if (typeof postRun == "function") postRun = [postRun];
      onPostRuns.push(...postRun);
    }
    callRuntimeCallbacks(onPostRuns);
  }

  function abort(what) {
    Module["onAbort"]?.(what);
    what = `Aborted(${what})`;
    console.error(what);
    ABORT = true;
    var e = new WebAssembly.RuntimeError(what);
    throw e;
  }

  class ExitStatus {
    name = "ExitStatus";
    constructor(status) {
      this.message = `Program terminated with exit(${status})`;
      this.status = status;
    }
  }

  var callRuntimeCallbacks = callbacks => {
    while (callbacks.length > 0) {
      callbacks.shift()(Module);
    }
  };

  class ExceptionInfo {
    constructor(excPtr) {
      this.excPtr = excPtr;
      this.ptr = excPtr - 24;
    }
    set_type(type) { HEAPU32[this.ptr + 4 >> 2] = type; }
    get_type() { return HEAPU32[this.ptr + 4 >> 2]; }
    set_destructor(destructor) { HEAPU32[this.ptr + 8 >> 2] = destructor; }
    get_destructor() { return HEAPU32[this.ptr + 8 >> 2]; }
    set_caught(caught) { HEAP8[this.ptr + 12] = caught ? 1 : 0; }
    get_caught() { return HEAP8[this.ptr + 12] != 0; }
    set_rethrown(rethrown) { HEAP8[this.ptr + 13] = rethrown ? 1 : 0; }
    get_rethrown() { return HEAP8[this.ptr + 13] != 0; }
    init(type, destructor) {
      this.set_adjusted_ptr(0);
      this.set_type(type);
      this.set_destructor(destructor);
    }
    set_adjusted_ptr(adjustedPtr) { HEAPU32[this.ptr + 16 >> 2] = adjustedPtr; }
    get_adjusted_ptr() { return HEAPU32[this.ptr + 16 >> 2]; }
  }

  var uncaughtExceptionCount = 0;
  var ___cxa_throw = (ptr, type, destructor) => {
    var info = new ExceptionInfo(ptr);
    info.init(type, destructor);
    uncaughtExceptionCount++;
    abort();
  };

  var __abort_js = () => abort("");
  var getHeapMax = () => 2147483648;
  var alignMemory = (size, alignment) => Math.ceil(size / alignment) * alignment;
  var growMemory = size => {
    var oldHeapSize = wasmMemory.buffer.byteLength;
    var pages = (size - oldHeapSize + 65535) / 65536 | 0;
    try {
      wasmMemory.grow(pages);
      updateMemoryViews();
      return 1;
    } catch (e) {}
  };

  var _emscripten_resize_heap = requestedSize => {
    var oldSize = HEAPU8.length;
    requestedSize >>>= 0;
    var maxHeapSize = getHeapMax();
    if (requestedSize > maxHeapSize) return false;
    for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
      var overGrownHeapSize = oldSize * (1 + .2 / cutDown);
      overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
      var newSize = Math.min(maxHeapSize, alignMemory(Math.max(requestedSize, overGrownHeapSize), 65536));
      var replacement = growMemory(newSize);
      if (replacement) return true;
    }
    return false;
  };

  var randomFill = view => {
    for (let i = 0; i < view.length; i++) view[i] = (Math.random() * 256) | 0;
    return 0;
  };
  var _random_get = (buffer, size) => randomFill(HEAPU8.subarray(buffer, buffer + size));

  var _stretch_create, _stretch_set_transpose_semitones, _stretch_process, _stretch_destroy, _malloc, _free, __emscripten_stack_restore, __emscripten_stack_alloc, _emscripten_stack_get_current, memory, __indirect_function_table;

  function assignWasmExports(wasmExports) {
    _stretch_create = Module["_stretch_create"] = wasmExports["g"];
    _stretch_set_transpose_semitones = Module["_stretch_set_transpose_semitones"] = PageExports_h(wasmExports);
    _stretch_process = Module["_stretch_process"] = wasmExports["i"];
    _stretch_destroy = Module["_stretch_destroy"] = wasmExports["j"];
    _malloc = Module["_malloc"] = wasmExports["k"];
    _free = Module["_free"] = wasmExports["l"];
    __emscripten_stack_restore = wasmExports["m"];
    __emscripten_stack_alloc = wasmExports["n"];
    _emscripten_stack_get_current = wasmExports["o"];
    memory = wasmMemory = wasmExports["e"];
    __indirect_function_table = wasmExports["__indirect_function_table"];
  }

  function PageExports_h(wasmExports) { return wasmExports["h"]; }

  var wasmImports = { a: ___cxa_throw, c: __abort_js, d: _emscripten_resize_heap, b: _random_get };

  function run() {
    preRun();
    if (ABORT) return;
    initRuntime();
    postRun();
  }

  // Inicializa o WASM localmente nesta closure
  try {
    var info = { a: wasmImports };
    var instance = new WebAssembly.Instance(wasmModule, info);
    wasmExports = instance.exports;
    assignWasmExports(wasmExports);
    updateMemoryViews();
    run();

    // Cria a instância do C++ Signalsmith Stretch
    var stretchHandle = _stretch_create(sampleRateVal, 2);
    _stretch_set_transpose_semitones(stretchHandle, initialPitch);

    // Aloca buffers de memória Float32 no heap local do WASM
    const bytesPerBlock = bufferSize * 4;
    var inPtr0 = _malloc(bytesPerBlock);
    var inPtr1 = _malloc(bytesPerBlock);
    var outPtr0 = _malloc(bytesPerBlock);
    var outPtr1 = _malloc(bytesPerBlock);

    return {
      isInitialized: true,
      setTranspose: function(semitones) {
        _stretch_set_transpose_semitones(stretchHandle, semitones);
      },
      process: function(inL, inR, outL, outR, numSamples) {
        if (ABORT || !HEAPF32) return false;
        HEAPF32.set(inL, inPtr0 >> 2);
        HEAPF32.set(inR, inPtr1 >> 2);

        _stretch_process(
          stretchHandle,
          inPtr0,
          inPtr1,
          numSamples,
          outPtr0,
          outPtr1,
          numSamples
        );

        const startL = outPtr0 >> 2;
        const startR = outPtr1 >> 2;
        outL.set(HEAPF32.subarray(startL, startL + numSamples));
        outR.set(HEAPF32.subarray(startR, startR + numSamples));
        return true;
      },
      destroy: function() {
        try {
          _free(inPtr0);
          _free(inPtr1);
          _free(outPtr0);
          _free(outPtr1);
          _stretch_destroy(stretchHandle);
        } catch (e) {
          console.error('[AudioWorklet] Erro ao liberar recursos do Signalsmith Stretch:', e);
        }
      }
    };
  } catch (err) {
    console.error('[AudioWorklet] Erro ao instanciar runtime local do Signalsmith:', err);
    return {
      isInitialized: false,
      setTranspose: function() {},
      process: function() { return false; },
      destroy: function() {}
    };
  }
}

class PitchShiftProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.shifter = null;
    this.pitchSemitones = 0;
    this.sampleRateVal = sampleRate || 44100;
    this.bufferSize = 128; // tamanho do bloco padrão do Web Audio

    this.port.onmessage = (event) => {
      const data = event.data;
      if (data && data.type === 'SET_PITCH') {
        this.pitchSemitones = typeof data.semitones === 'number' ? data.semitones : 0;
        if (this.shifter && this.shifter.isInitialized) {
          this.shifter.setTranspose(this.pitchSemitones);
        }
      }
    };

    const wasmModule = options?.processorOptions?.wasmModule;
    const transposeVal = options?.processorOptions?.transpose;
    this.pitchSemitones = typeof transposeVal === 'number' ? transposeVal : 0;
    this.forceProcess = !!options?.processorOptions?.forceProcess;

    if (wasmModule) {
      this.shifter = createSignalsmithShifter(wasmModule, this.sampleRateVal, this.pitchSemitones, this.bufferSize);
      if (this.shifter && this.shifter.isInitialized) {
        this.port.postMessage({ type: 'STATUS', status: 'READY' });
      }
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

    // Se o Shifter não inicializou ou falhou, realiza o bypass direto sem processamento
    if (!this.shifter || !this.shifter.isInitialized) {
      for (let i = 0; i < numSamples; i++) {
        outL[i] = inL[i];
        if (output[1]) output[1][i] = inR[i];
      }
      return true;
    }

    // Se a afinação for 0 sem semitones adicionais e não forçados, faz passthrough direto para economizar CPU
    if (this.pitchSemitones === 0 && !this.forceProcess) {
      for (let i = 0; i < numSamples; i++) {
        outL[i] = inL[i];
        if (output[1]) output[1][i] = inR[i];
      }
      return true;
    }

    const processed = this.shifter.process(inL, inR, outL, outR, numSamples);
    if (!processed) {
      // Fallback em caso de falha de processamento pontual
      for (let i = 0; i < numSamples; i++) {
        outL[i] = inL[i];
        if (output[1]) output[1][i] = inR[i];
      }
    }

    return true;
  }
}

registerProcessor('pitch-shift-processor', PitchShiftProcessor);
