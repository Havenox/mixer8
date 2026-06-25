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

/**
 * Transpõe um acorde com base no número de semitons fornecido.
 * Suporta tons maiores, menores e sufixos simples (ex: Fm, C#, G).
 */
export function transposeChord(chordName: string, semitones: number): string {
  if (!chordName || chordName === 'N') return '';
  
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  // Expressão regular para isolar a nota fundamental e os sufixos (ex: Fm -> F e m, C#m7 -> C# e m7)
  const match = chordName.match(/^([A-G]#?)(.*)$/);
  if (!match) return chordName;
  
  const [_, root, suffix] = match;
  const index = notes.indexOf(root);
  if (index === -1) return chordName;
  
  const newIndex = (index + semitones + 12 * 10) % 12;
  return `${notes[newIndex]}${suffix}`;
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
