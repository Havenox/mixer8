# 049 - [Frontend]: Seek Interativo e Auto-Play por Clique em Palavras (Estúdio de Letras)

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 24/06/2026

---

## 🚀 Desafio de Engenharia
O visualizador síncrono de letras e cifras (`LyricsChordsViewer.tsx`) foi otimizado para permitir a navegação por toque/clique nas palavras. No entanto, surgiu uma fricção de UX: se a música estivesse pausada e o usuário clicasse em uma palavra para ensaiar aquele ponto, o player apenas movia o cursor de reprodução para o segundo correspondente (seek), mas permanecia pausado. O usuário precisava realizar um segundo clique no botão de "Play" para escutar o trecho, o que tornava a navegação truncada.

O comportamento esperado em estúdios de ensaio modernos é que o clique para seek em um estado de pausa resulte no início automático da reprodução a partir daquele ponto (auto-play/unpause).

## 🧠 Estratégia da Solução
1. **Desvio de Reprodução Condicional (Auto-Play):**
   * Ao acionar o manipulador de clique na palavra, lemos o estado de reprodução global (`isPlaying`).
   * Caso o player esteja pausado (`isPlaying === false`), além de executar o `seek(word.start)` para posicionar a agulha de tempo, acionamos imediatamente a função `togglePlay()`. Isso inicia o motor de áudio e despausa a faixa de forma transparente e em tempo de execução.
2. **Micro-interações de Toque:**
   * Mantiveram-se as classes visuais táteis do Tailwind CSS (`cursor-pointer hover:text-brand-green active:scale-95 transition-all`) para garantir feedback visual fluido.

## 🛠️ Implementação Técnica

### Frontend
* **[LyricsChordsViewer.tsx](file:///g:/DEV/mixer8/mixer8-app/src/components/LyricsChordsViewer.tsx):**
  * Desestruturou-se as propriedades `isPlaying` e `togglePlay` do hook `usePlayer()`.
  * Atualizou-se a chamada no evento de clique da palavra:
    ```tsx
    onClick={() => {
      seek(word.start);
      if (!isPlaying) togglePlay();
    }}
    ```

## 🎯 Impacto e Resultado
* **Navegação Contínua e Responsiva:** Ao clicar em qualquer trecho da letra para ensaiar, a música salta e já começa a tocar no mesmo instante, mesmo se o player estivesse anteriormente pausado.
* **Redução de Fricção (Cliques Reduzidos):** Diminuição de 50% nas etapas de interação necessárias para buscar e reproduzir trechos da faixa.

---
**Nota do Desenvolvedor:** *Sincronizar comandos de estado imperativos (como seek e play) de forma sequencial na mesma pilha de micro-interações do React garante que a resposta do motor de áudio do navegador seja imediata e perfeitamente integrada aos estímulos visuais do usuário.*
