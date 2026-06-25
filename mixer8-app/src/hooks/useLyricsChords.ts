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

export interface IProcessedWord extends ILyricsWord {
  Chord: string | null;
}

export interface IProcessedLine extends Omit<ILyricsLine, 'words'> {
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

    return lyrics.map((line) => {
      const processedWords = line.words.map((word) => {
        // Localiza a batida de acorde ativa no início da palavra
        let activeBeat = chords[0];
        for (let i = 0; i < chords.length; i++) {
          if (chords[i].curr_beat_time <= word.start) {
            activeBeat = chords[i];
          } else {
            break;
          }
        }

        const rawChord = activeBeat && activeBeat.chord_simple_pop !== 'N' 
          ? activeBeat.chord_simple_pop 
          : '';
          
        const transposed = transposeChord(rawChord, transposeSemitones);

        // A cifra só é mostrada se for diferente da cifra ativa anterior para evitar repetição exaustiva
        const shouldShow = transposed && transposed !== lastChord;
        if (transposed) {
          lastChord = transposed;
        }

        return {
          ...word,
          Chord: shouldShow ? transposed : null
        };
      });

      return {
        text: line.text,
        language: line.language,
        start: line.start,
        end: line.end,
        Words: processedWords
      };
    });
  }, [lyrics, chords, transposeSemitones]);
}
