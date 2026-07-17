#!/bin/bash
set -e

echo "Downloading Signalsmith Stretch and Linear STFT dependencies..."
mkdir -p /src/wasm-build/include/signalsmith-linear
mkdir -p /src/public/wasm

curl -sSL https://raw.githubusercontent.com/Signalsmith-Audio/signalsmith-stretch/main/signalsmith-stretch.h -o /src/wasm-build/include/signalsmith-stretch.h
curl -sSL https://raw.githubusercontent.com/Signalsmith-Audio/linear/main/stft.h -o /src/wasm-build/include/signalsmith-linear/stft.h
curl -sSL https://raw.githubusercontent.com/Signalsmith-Audio/linear/main/fft.h -o /src/wasm-build/include/signalsmith-linear/fft.h

echo "Compiling Signalsmith Stretch wrapper to WebAssembly (SIMD 128-bit)..."
emcc /src/wasm-build/wrapper.cpp \
    -I/src/wasm-build/include \
    -O3 \
    -msimd128 \
    -s WASM=1 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s EXPORTED_FUNCTIONS="['_stretch_create','_stretch_set_transpose_semitones','_stretch_process','_stretch_destroy','_malloc','_free']" \
    -s EXPORTED_RUNTIME_METHODS="['cwrap','getValue','setValue']" \
    -s SINGLE_FILE=0 \
    -o /src/public/wasm/signalsmith-stretch.js

echo "Build WASM completed successfully!"
