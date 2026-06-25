# 046 - [UI/UX & Frontend]: Estudo de Sincronização em Tempo Real de Cifras e Letras (Padrão CifraClub/Moises)

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 25/06/2026

---

## 🚀 Desafio de Engenharia

O ecossistema Mixer8 agora extrai com sucesso os arquivos de cifra (`chords.json`), letra clássica (`lyrics.json`) e o novo formato de letras com marcação temporal por palavra (`lyrics_new_format.json`) da plataforma Moises.ai.

O grande desafio consiste em projetar e implementar uma experiência de usuário (UI/UX) premium que cruze esses metadados temporais e os exiba em tempo real de forma síncrona com a reprodução de áudio, no estilo Karaokê + Cifras (padrão Cifra Club / Moises). 

Os principais obstáculos de engenharia frontend incluem:
1. **Quebra de Linha Responsiva (Word Wrapping)**: Em telas menores ou com zoom ajustado, a quebra de texto convencional que utiliza espaçamento em texto pré-formatado (`<pre>`) desalinha os acordes colocados acima das palavras.
2. **Alinhamento Temporal Preciso (Chord-to-Word Mapping)**: Sincronizar o relógio de batidas de acordes com o tempo de fala de cada palavra individual, evitando a repetição exaustiva do mesmo acorde e exibindo-o apenas no momento exato de sua transição (mudança harmônica).
3. **Desempenho de Renderização**: Controlar re-renders a cada milissegundo de atualização da propriedade `currentTime` do player de áudio para evitar travamento da interface.
4. **Isolamento de Interface**: Permitir essa visualização rica sem poluir a tela principal de mixagem e controle de stems do Mixer8.

---

## 🧠 Estratégia da Solução

### 1. Arquitetura UI/UX (Modal View Glassmorphic)
Como proposto, a visualização será isolada em uma janela própria/modal em tela cheia com efeito translúcido (*Glassmorphism* com `backdrop-filter: blur(20px)`), acionada a partir da capa do álbum no player inferior.
Esta abordagem garante foco absoluto do usuário (modo imersivo para ensaio/estudo de música), mantendo a interface principal limpa.

### 2. Disposição Responsiva Baseada em Tokenização de Palavras (Flexbox-Layout)
Para mitigar a quebra de alinhamento das cifras, eliminamos o uso de blocos `<pre>` monolíticos. Em vez disso, estruturamos a letra utilizando componentes React baseados em **grupos verticais de palavras**:
* Cada palavra da letra é renderizada dentro de um contêiner inline (`inline-flex flex-col items-start`).
* O contêiner renderiza a cifra (`chord`) acima e a palavra (`word`) abaixo.
* Se a palavra não exigir uma mudança de acorde, exibe-se uma cifra em branco ou invisível de mesma altura, mantendo o alinhamento da linha de base vertical de leitura.
* Desta forma, o navegador executa o wrapping natural do texto mantendo cada acorde fisicamente atado à sua palavra respectiva.

### 3. Algoritmo de Cruzamento Harmônico (Time-Alignment)
Para mapear os acordes às palavras:
1. **Identificação de Transições Harmônicas**: Analisa-se a coleção de batidas em `chords.json`. Uma transição harmônica ocorre no tempo `t_chord` quando o acorde atual `chord_simple_pop` difere do acorde da batida imediatamente anterior.
2. **Associação por Palavra**: Para cada palavra com tempo inicial `w_start` em `lyrics_new_format.json`, localiza-se o acorde que estava ativo no momento `w_start` em `chords.json`.
3. **Filtragem de Repetição**: Um acorde é renderizado acima da palavra apenas se ele for diferente do acorde associado à palavra anterior do fluxo. Isso replica perfeitamente a convenção musical humana.

---

## 🛠️ Implementação Técnica

### 1. Contratos de Dados (TypeScript)
Declaramos as interfaces respeitando a fidelidade dos arquivos JSON extraídos:

```typescript
export interface IChordBeat {
  curr_beat_time: number;
  curr_beat: number;
  bar_num: number;
  beat_num: number;
  prev_chord: string;
  chord_simple_pop: string;
  chord_complex_pop: string;
}

export interface ILyricsWord {
  word: string;
  start: number;
  end: number;
  score: number;
}

export interface ILyricsLine {
  text: string;
  language: string;
  start: number;
  end: number;
  words: ILyricsWord[];
}
```

### 2. Gancho Customizado de Sincronização (`useLyricsChords`)
Um Hook React centralizará a lógica de cruzamento e transposição para garantir estabilidade referencial e cálculo baseado em estado derivado:

```typescript
import { useMemo } from "react";

export function useLyricsChords(
  lyrics: ILyricsLine[],
  chords: IChordBeat[],
  transposeSemitones: number
) {
  // Transposição de acordes em tempo de execução
  const transposeChord = (chordName: string, semitones: number): string => {
    if (!chordName || chordName === "N") return "";
    const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    // Extrai o tom principal e o modificador (ex: Fm -> F e m)
    const match = chordName.match(/^([A-G]#?)(.*)$/);
    if (!match) return chordName;
    const [_, root, suffix] = match;
    const index = notes.indexOf(root);
    if (index === -1) return chordName;
    const newIndex = (index + semitones + 12 * 10) % 12;
    return `${notes[newIndex]}${suffix}`;
  };

  const processedLines = useMemo(() => {
    if (!lyrics || !chords) return [];

    let lastChord: string | null = null;

    return lyrics.map((line) => {
      const wordsWithChords = line.words.map((word) => {
        // Encontra o acorde ativo no início da palavra
        const activeBeat = chords.reduce((prev, curr) => {
          if (curr.curr_beat_time <= word.start && curr.curr_beat_time > prev.curr_beat_time) {
            return curr;
          }
          return prev;
        }, chords[0] || { curr_beat_time: 0, chord_simple_pop: "N" });

        const rawChord = activeBeat.chord_simple_pop !== "N" ? activeBeat.chord_simple_pop : "";
        const transposed = transposeChord(rawChord, transposeSemitones);

        // Só mostra se for alterado em relação à palavra anterior
        const shouldShow = transposed && transposed !== lastChord;
        if (transposed) {
          lastChord = transposed;
        }

        return {
          ...word,
          Chord: shouldShow ? transposed : null,
        };
      });

      return {
        ...line,
        Words: wordsWithChords,
      };
    });
  }, [lyrics, chords, transposeSemitones]);

  return processedLines;
}
```

### 3. Renderização Otimizada e Controle de Auto-Scroll
Para evitar atualizações excessivas de DOM, o tempo `currentTime` é injetado em um estado local controlado e apenas os componentes de linha ativa são atualizados:
* Um elemento ativo é comparado (`currentTime >= line.start && currentTime <= line.end`).
* Através de um `useEffect` monitorando o índice da linha ativa, aciona-se um scroll animado suave:
  `activeLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });`

---

## 🎯 Impacto e Resultado

* **[Sincronização Absoluta]**: Acordes são exibidos exatamente no tempo rítmico correto de execução sobre a sílaba/palavra cantada.
* **[Layout Responsivo Indestrutível]**: A visualização de acordes adapta-se a qualquer tamanho de dispositivo móvel, tablet ou desktop sem quebras de layout ou desalinhamento.
* **[Estudo Musical Facilitado]**: A transposição de tom em tempo real no frontend elimina a necessidade de reprocessamento no Moises.
* **[Aparência Premium]**: A interface de estúdio imersiva baseada em blur e animações de entrada de texto e acordes oferece valor agregado massivo ao usuário do Mixer8.

---
**Nota do Desenvolvedor:** *A estruturação do alinhamento a nível de palavra (word-level tokenization) utilizando CSS Flexbox é a única abordagem de fato resiliente para dispositivos móveis moderna, superando totalmente a renderização estática baseada em texto plano com espaços.*
