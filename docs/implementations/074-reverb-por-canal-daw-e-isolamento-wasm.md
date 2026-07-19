# 074 - Audio & UI: Reverb por Canal na DAW e Isolamento de Memória WASM do Shifter

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 19/07/2026

---

## 🚀 Desafio de Engenharia
Ao aplicar efeitos e ajustar a afinação (transpose/pitch shift) simultaneamente no Mixer8, ocorria um grave ruído e craquelamento de áudio (estouros e descontinuidade PCM). Esse problema persistia mesmo quando o volume do Reverb era zerado. Além disso, a interface de controle do Reverb (FX) estava erroneamente alocada no Mixer de Som (MesaPlayer), em vez de na própria tela do Estúdio DAW, e a rolagem vertical de canais ficava obstruída por baixo do player fixado de rodapé, ocultando as faixas inferiores.

## 🧠 Estratégia da Solução
1. **Isolamento de Memória WASM (AudioWorklet)**: O Signalsmith Stretch (WASM compilado via Emscripten) utilizava variáveis globais na thread do AudioWorklet. Quando múltiplos canais (stems) rodavam o pitch shift concorrentemente, eles colidiam na escrita da mesma heap de memória WASM. Enclausurando o runtime em uma fábrica de closures (`createSignalsmithShifter`), cada nó de áudio passa a ter um escopo léxico isolado e memória Float32 dedicada.
2. **Roteamento Condicional e Desconexão Física**: Introduzir um toggle de ativação real (ON/OFF). Quando OFF, o Web Audio desconecta fisicamente os nós de convolução e ganho de Reverb do grafo, impedindo o processamento de background e vazamento de frequências no processador de Tom.
3. **Migração de UX para DAW**: Retirar a área de FX do MesaPlayer e integrá-la no painel esquerdo de cada faixa na DAW (`DawView.tsx`), expandindo a trilha verticalmente de 88px para 160px com animações fluidas e redesenho dinâmico do canvas da waveform.
4. **Offsets de Layout**: Restringir a altura dos overlays absolutos com bottom offset correspondente à altura do player persistente de rodapé (16h mobile / 24h desktop) para evitar que o conteúdo passe por baixo dele.

## 🛠️ Implementação Técnica

### Frontend / Áudio
* **`pitch-shift-processor.js`**: Reestruturado com a função de fábrica `createSignalsmithShifter` isolando o WebAssembly e o heap do Emscripten por instância.
* **`PlayerContext.tsx`**:
  * Adicionado estado `stemsReverbEnabled` e setter correspondente salvos localmente.
  * Simplificada a conexão de áudio no `loadTrack` em cadeia linear (`gainNode -> pannerNode -> pitchNode -> reverb/bypass`).
  * Criada a função `updateStemReverbRouting(type, enabled)` para conectar/desconectar os nós de convolução dinamicamente conforme o toggle ON/OFF.
* **`DawView.tsx`**:
  * Adicionado o botão **FX** nos controles laterais de cada faixa da DAW (exceto metrônomo).
  * Adicionado painel expansível vertical contendo o toggle ON/OFF de Reverb, fader de wet mix e botões de preset (Sala, Salão, Catedral).
  * O botão FX agora possui cores semânticas: amarelo se o reverb estiver ligado (ON), verde se o painel estiver aberto mas reverb desligado (OFF) e cinza caso fechado.
  * Waveforms redesenhadas via `setTimeout` de 250ms logo após a conclusão da animação de altura.
* **`PersistentLayout.tsx`**:
  * Alterados os contêineres de overlay `daw`, `lyrics` e `mixer` de `absolute inset-0` para `absolute top-0 left-0 right-0 bottom-16 md:bottom-24`.
* **`MesaPlayer.tsx`**:
  * Removidos os botões de FX, painéis expansíveis de reverb e estados locais duplicados.
* **`mixExporter.ts`**:
  * Integrada verificação de `stemsReverbEnabled` para processamento do convolver offline apenas se ativado.

## 🎯 Impacto e Resultado
* **Qualidade de Áudio Impecável**: O processamento de transposição de tom (pitch shift) agora funciona de forma 100% limpa, simultaneamente em múltiplos canais com ou sem Reverb.
* **UX Contextualizada**: O gerenciamento de efeitos está localizado na DAW de forma não-obstrutiva e expansível sob demanda.
* **Rolagem Completa**: Nenhum canal fica mais oculto atrás do player, e a rolagem vertical funciona perfeitamente até a última faixa.
* **Feedback Visual Semântico**: Cores diferenciadas (amarelo do Solo para FX ativo) guiam o usuário de forma intuitiva.

---
**Nota do Desenvolvedor:** *O uso de AudioWorklets que carregam WASM requer atenção redobrada ao escopo de memória do Emscripten. Variáveis em escopo global na thread do worklet são compartilhadas se não forem instanciadas dentro de uma fábrica local (closure), gerando race conditions graves em tempo de renderização de áudio Float32. O isolamento de contexto do WASM resolveu o problema de fidelidade acústica de forma elegante e definitiva.*
