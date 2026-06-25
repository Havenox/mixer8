# 049 - [Frontend]: Seek Interativo por Clique em Palavras (Estúdio de Ensaios)

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 24/06/2026

---

## 🚀 Desafio de Engenharia
O visualizador síncrono de letras e cifras (`LyricsChordsViewer.tsx`) permitia acompanhar a execução da música por meio de destaque de karaokê linha a linha e palavra por palavra. Contudo, para praticar ou ensaiar uma frase específica da canção, o usuário enfrentava atrito de usabilidade: ele precisava fechar o modal ou usar a barra de progresso no player inferior tentando adivinhar visualmente o ponto do tempo correspondente.

Como cada palavra no arquivo estruturado `/lyrics_new_format.json` já carrega as metatags exatas de tempo de início (`start`) e fim (`end`) em segundos, era possível tornar o texto totalmente interativo, permitindo saltar na linha do tempo com precisão cirúrgica de áudio a partir de interações diretas com as palavras.

## 🧠 Estratégia da Solução
1. **Conexão Direta de Contexto (Seek Trigger):**
   * Importou-se o context hook `usePlayer` no componente de letras e cifras.
   * Vinculou-se a função de reposicionamento de áudio (`seek`) exposta pelo contexto global de reprodução.
2. **Micro-interações de Clique e Hover:**
   * Adicionou-se o evento de clique no `span` que exibe a palavra individual, chamando a função `seek(word.start)`.
   * Para dar feedback visual imediato de que as palavras são links interativos, estilizou-se o cursor do mouse (`cursor-pointer`), uma transição suave de cor ao passar o mouse (`hover:text-brand-green`) e um efeito físico de compressão no momento do toque (`active:scale-95`).
   * A palavra ativa mantém seu destaque verde fixo (`text-brand-green`), enquanto as palavras inativas ganham brilho verde apenas sob o foco (hover).

## 🛠️ Implementação Técnica

### Frontend
* **[LyricsChordsViewer.tsx](file:///g:/DEV/mixer8/mixer8-app/src/components/LyricsChordsViewer.tsx):**
  * Importou-se `usePlayer` de `../context/PlayerContext`.
  * Extraiu-se a função `seek` dentro do escopo do componente.
  * Vinculou-se o clique na palavra no laço de renderização das palavras:
    `onClick={() => seek(word.start)}`
  * Adicionaram-se as classes dinâmicas de estilo interativo do Tailwind CSS.

## 🎯 Impacto e Resultado
* **Navegação Síncrona e Dinâmica:** Ensaiar seções complexas ficou instantâneo. O músico pode clicar em qualquer sílaba ou palavra do visualizador para saltar a reprodução do player e das cifras exatamente para aquele segundo da música.
* **Experiência de Uso Imersiva:** O fluxo de uso é idêntico ao de aplicativos líderes de mercado de separação de stems (como o Moises), eliminando a fricção de navegação no desktop e mobile.

---
**Nota do Desenvolvedor:** *Aproveitar a densidade de metadados temporais estruturados para enriquecer as propriedades interativas do DOM transforma textos estáticos em pontos físicos de navegação. A simplicidade de ler o tempo do array de palavras e acionar o seek global encapsula toda a complexidade em um fluxo elegante e reativo.*
