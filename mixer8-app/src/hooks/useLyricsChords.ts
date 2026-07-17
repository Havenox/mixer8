import { useMemo } from 'react';

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

export interface IProcessedWord {
  word: string;
  start: number;
  end: number;
  score?: number;
  Chord: string | null;
  type: 'word' | 'chord_only';
}

export interface IProcessedLine {
  text: string;
  language: string;
  start: number;
  end: number;
  Words: IProcessedWord[];
}

// Tabela de mapeamento das 17 notas fundamentais de entrada para o índice da escala temperada de 12 notas
const rootNotesMapping: Record<string, number> = {
  'C': 0,
  'C#': 1,
  'Db': 1,
  'D': 2,
  'D#': 3,
  'Eb': 3,
  'E': 4,
  'F': 5,
  'F#': 6,
  'Gb': 6,
  'G': 7,
  'G#': 8,
  'Ab': 8,
  'A': 9,
  'A#': 10,
  'Bb': 10,
  'B': 11
};

// Escala temperada normalizada com a regra do músico (sustenidos apenas em C# e F#, bemóis em Eb, Ab, Bb)
const standardNotes = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Normaliza e transpõe uma parte individual de um acorde (sem a barra de baixo).
 */
function processSingleChordPart(part: string, semitones: number): string {
  if (!part || part === 'N') return part;

  // Regex flexível para capturar a nota fundamental (letra A-G seguida opcionalmente de # ou b)
  const match = part.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return part;

  const [_, root, suffix] = match;
  
  // Obtém o índice da nota original
  const originalIndex = rootNotesMapping[root];
  if (originalIndex === undefined) return part;

  // Calcula o novo índice transposto na escala diatônica circular de 12 semitons
  const transposedIndex = (originalIndex + semitones + 12 * 10) % 12;
  const transposedRootName = standardNotes[transposedIndex];

  return `${transposedRootName}${suffix}`;
}

/**
 * Transpõe e normaliza um acorde com base no número de semitons fornecido.
 * Suporta acordes com baixo alterado (slash chords, ex: F#m/A#).
 */
export function transposeChord(chordName: string, semitones: number): string {
  if (!chordName || chordName === 'N') return '';

  // Suporte a acordes com baixo alterado (split por "/")
  if (chordName.includes('/')) {
    const parts = chordName.split('/');
    return parts.map(part => processSingleChordPart(part, semitones)).join('/');
  }

  return processSingleChordPart(chordName, semitones);
}

/**
 * Hook customizado para cruzar os tempos das palavras com os acordes.
 * Aplica transposição de tom e elimina repetições sucessivas de cifras.
 */
export function useLyricsChords(
  lyrics: ILyricsLine[] | null,
  chords: IChordBeat[] | null,
  transposeSemitones: number
): IProcessedLine[] {
  return useMemo(() => {
    if (!lyrics || !chords || lyrics.length === 0 || chords.length === 0) {
      return [];
    }

    let lastChord: string | null = null;

    return lyrics.map((line, lIdx) => {
      // Janela temporal desta linha:
      // Inicia no start da linha (ou 0 para a primeira)
      const rangeStart = lIdx === 0 ? 0 : line.start;
      // Termina no start da próxima linha (ou Infinity para a última)
      const rangeEnd = lIdx < lyrics.length - 1 ? lyrics[lIdx + 1].start : Infinity;

      // Filtra acordes que pertencem a esta janela da linha
      const lineChords = chords.filter(
        c => c.curr_beat_time >= rangeStart && c.curr_beat_time < rangeEnd
      );

      const processedUnits: IProcessedWord[] = [];
      let lastWordEnd = rangeStart;
      const wordsList = line.words || [];

      wordsList.forEach((word) => {
        // 1. Processa acordes no gap/silêncio ANTES desta palavra
        const gapChords = lineChords.filter(
          c => c.curr_beat_time >= lastWordEnd && c.curr_beat_time < word.start
        );

        gapChords.forEach((c, gIdx) => {
          const rawChord = c.chord_simple_pop !== 'N' ? c.chord_simple_pop : '';
          const transposed = transposeChord(rawChord, transposeSemitones);
          const shouldShow = transposed && transposed !== lastChord;
          if (transposed) {
            lastChord = transposed;
          }
          if (shouldShow) {
            const nextStart = gIdx < gapChords.length - 1 
              ? gapChords[gIdx + 1].curr_beat_time 
              : word.start;
            processedUnits.push({
              type: 'chord_only',
              word: '',
              start: c.curr_beat_time,
              end: nextStart,
              Chord: transposed
            });
          }
        });

        // 2. Processa acordes que coincidem com a palavra
        const wordChords = lineChords.filter(
          c => c.curr_beat_time >= word.start && c.curr_beat_time <= word.end
        );

        let wordChord: string | null = null;
        if (wordChords.length > 0) {
          const c = wordChords[0];
          const rawChord = c.chord_simple_pop !== 'N' ? c.chord_simple_pop : '';
          const transposed = transposeChord(rawChord, transposeSemitones);
          const shouldShow = transposed && transposed !== lastChord;
          if (transposed) {
            lastChord = transposed;
          }
          wordChord = shouldShow ? transposed : null;
        } else {
          // Se não há novo acorde começando dentro da palavra, mas esta é a primeira unidade
          // ou não geramos nenhuma cifra ainda nesta linha, localizamos qual acorde está atualmente ativo
          if (processedUnits.length === 0) {
            let activeBeat = chords[0];
            for (let i = 0; i < chords.length; i++) {
              if (chords[i].curr_beat_time <= word.start) {
                activeBeat = chords[i];
              } else {
                break;
              }
            }
            if (activeBeat) {
              const rawChord = activeBeat.chord_simple_pop !== 'N' ? activeBeat.chord_simple_pop : '';
              const transposed = transposeChord(rawChord, transposeSemitones);
              const shouldShow = transposed && transposed !== lastChord;
              if (transposed) {
                lastChord = transposed;
              }
              wordChord = shouldShow ? transposed : null;
            }
          }
        }

        processedUnits.push({
          type: 'word',
          word: word.word,
          start: word.start,
          end: word.end,
          score: word.score,
          Chord: wordChord
        });

        lastWordEnd = word.end;
      });

      // 3. Processa acordes no gap/silêncio APÓS a última palavra da linha
      const postChords = lineChords.filter(
        c => c.curr_beat_time >= lastWordEnd && c.curr_beat_time < rangeEnd
      );

      postChords.forEach((c, pIdx) => {
        const rawChord = c.chord_simple_pop !== 'N' ? c.chord_simple_pop : '';
        const transposed = transposeChord(rawChord, transposeSemitones);
        const shouldShow = transposed && transposed !== lastChord;
        if (transposed) {
          lastChord = transposed;
        }
        if (shouldShow) {
          const nextStart = pIdx < postChords.length - 1 
            ? postChords[pIdx + 1].curr_beat_time 
            : rangeEnd;
          processedUnits.push({
            type: 'chord_only',
            word: '',
            start: c.curr_beat_time,
            end: nextStart,
            Chord: transposed
          });
        }
      });

      return {
        text: line.text,
        language: line.language,
        start: line.start,
        end: line.end,
        Words: processedUnits
      };
    });
  }, [lyrics, chords, transposeSemitones]);
}
