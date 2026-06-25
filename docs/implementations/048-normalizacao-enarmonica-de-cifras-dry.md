# 048 - [Frontend]: Normalização Enarmônica de Cifras (Escala Diatônica DRY)

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 24/06/2026

---

## 🚀 Desafio de Engenharia
As cifras capturadas da plataforma original ou importadas para o banco de dados frequentemente possuem redundâncias ou inconsistências de notação de acidentes enarmônicos (como chamar `Eb` de `D#`, ou `C#` de `Db`). Na prática musical cotidiana, há convenções implícitas bem consolidadas para facilitar a leitura rápida de cifras:
1. **Sustenidos Restritos:** Sustenidos (`#`) são comumente restritos apenas a **Dó Sustenido (C#)** e **Fá Sustenido (F#)**.
2. **Bemóis Preferenciais:** Todas as outras notas pretas do piano são idealmente chamadas de bemóis (`b`), ou seja, **Mi Bemol (Eb)**, **Lá Bemol (Ab)** e **Si Bemol (Bb)**.

O desafio residia em implementar uma rotina centralizada de mapeamento, normalização e transposição que:
* Traduzisse instantaneamente qualquer acorde (incluindo variantes complexas e slash chords, como `F#m/A#` ou `Dbm/Gb`) para esse padrão.
* Evitasse redundância de código de formatação espalhado pelos componentes de interface (princípio DRY - Don't Repeat Yourself).

## 🧠 Estratégia da Solução
1. **Mapeamento de 17 Tons Fundamentais:**
   Criamos um dicionário mapeando os 17 possíveis nomes fundamentais de notas de entrada (Naturais, Sustenidos e Bemóis) para seus correspondentes 12 semitons da escala temperada (índices de 0 a 11).
2. **Escala Padronizada do Músico:**
   Estruturamos um vetor de 12 elementos onde a escala diatônica circular é normalizada exatamente de acordo com as preferências informadas:
   `['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']`.
3. **Tratamento de Slash Chords (Baixo Alterado):**
   Muitas cifras possuem baixo alterado dividido por barra (ex: `F#m/A#`). Se apenas a raiz do acorde fosse tratada, o baixo ficaria com notação inconsistente. O algoritmo foi projetado para:
   * Identificar o caractere `/`.
   * Realizar o `split` das duas strings (o acorde superior e o baixo).
   * Processar a transposição e a normalização de forma individual em ambas as partes (preservando o sufixo no acorde e traduzindo o baixo isoladamente).
   * Reunir as duas partes formatadas de volta usando `/`.
4. **Acoplamento DRY no Hook de Letras:**
   A lógica de transposição/normalização foi inserida diretamente na função `transposeChord` exportada pelo hook [useLyricsChords.ts](file:///g:/DEV/mixer8/mixer8-app/src/hooks/useLyricsChords.ts). Como o visualizador [LyricsChordsViewer.tsx](file:///g:/DEV/mixer8/mixer8-app/src/components/LyricsChordsViewer.tsx) utiliza essa mesma função tanto para computar os acordes sobrepostos às palavras quanto para exibir o "Acorde Atual" do cabeçalho da música, a atualização da regra de enarmonia refletiu-se globalmente em toda a UI a partir de uma única alteração.

## 🛠️ Implementação Técnica

### Frontend
* **[useLyricsChords.ts](file:///g:/DEV/mixer8/mixer8-app/src/hooks/useLyricsChords.ts):**
  * Declarou-se o mapa `rootNotesMapping` e a lista `standardNotes`.
  * Adicionou-se a função auxiliar `processSingleChordPart` contendo a Regex `/^([A-G][#b]?)(.*)$/` para separar a nota raiz de quaisquer sufixos e realizar o cálculo de transposição.
  * Atualizou-se a função `transposeChord` para splitar slash chords e processar as divisões independentemente.

## 🎯 Impacto e Resultado
* **Leitura Musical Simplificada:** Todas as cifras exibidas no estúdio de ensaios seguem a convenção correta e amigável (C#, F#, Eb, Ab, Bb).
* **Tratamento Perfeito de Slash Chords:** Um acorde como `F#m/A#` transposto +0 semitons é automaticamente reescrito e exibido de forma limpa como `F#m/Bb`.
* **Zero Código Redundante:** O componente visual apenas renderiza a string limpa provida pelo hook, mantendo a regra de negócio centralizada na camada de dados.

---
**Nota do Desenvolvedor:** *Tabelas de equivalência enarmônica em software evitam a "cacofonia visual" nas cifras musicais. Implementar esse tratamento via recursão/mapeamento de strings no estágio mais baixo do hook de dados garante que a consistência visual se propague de forma nativa e sem esforço por toda a árvore de renderização do React.*
