#include <emscripten.h>
#include <vector>
#include <cmath>
#include <iostream>

#include "signalsmith-stretch.h"

extern "C" {

EMSCRIPTEN_KEEPALIVE
void* stretch_create(int sampleRate, int channels) {
    auto* stretch = new signalsmith::stretch::SignalsmithStretch<float>();
    stretch->presetDefault(channels, static_cast<float>(sampleRate));
    return static_cast<void*>(stretch);
}

EMSCRIPTEN_KEEPALIVE
void stretch_set_transpose_semitones(void* handle, float semitones) {
    if (!handle) return;
    auto* stretch = static_cast<signalsmith::stretch::SignalsmithStretch<float>*>(handle);
    stretch->setTransposeSemitones(semitones);
}

EMSCRIPTEN_KEEPALIVE
void stretch_process(void* handle, float* inputChannel0, float* inputChannel1, int inputSamples, float* outputChannel0, float* outputChannel1, int outputSamples) {
    if (!handle) return;
    auto* stretch = static_cast<signalsmith::stretch::SignalsmithStretch<float>*>(handle);
    
    float* inputs[2] = { inputChannel0, inputChannel1 };
    float* outputs[2] = { outputChannel0, outputChannel1 };
    
    stretch->process(inputs, inputSamples, outputs, outputSamples);
}

EMSCRIPTEN_KEEPALIVE
void stretch_destroy(void* handle) {
    if (!handle) return;
    auto* stretch = static_cast<signalsmith::stretch::SignalsmithStretch<float>*>(handle);
    delete stretch;
}

}
