import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Music, X } from 'lucide-react';
import { useLyricsChords, transposeChord } from '../hooks/useLyricsChords';
import type { ILyricsLine, IChordBeat } from '../hooks/useLyricsChords';
import { SERVER_URL } from '../config';
import { usePlayer } from '../context/PlayerContext';

interface ILyricsChordsViewerProps {
  TrackId: string;
  CurrentTime: number;
  OnClose: () => void;
}

/**
 * Converte o formato antigo de letras (flat list de palavras) para o formato estruturado
 */
function parseLegacyLyrics(legacyData: any[]): ILyricsLine[] {
  if (!Array.isArray(legacyData)) return [];
  
  const linesMap = new Map<number, { text: string; words: any[]; start: number; end: number }>();
  
  legacyData.forEach(item => {
    const lineId = item.line_id;
    const text = item.text;
    if (!lineId || text === '<SOL>' || text === '<EOL>') return;
    
    let lineObj = linesMap.get(lineId);
    if (!lineObj) {
      lineObj = { text: '', words: [], start: item.start, end: item.end };
      linesMap.set(lineId, lineObj);
    }
    
    lineObj.words.push({
      word: text,
      start: item.start,
      end: item.end,
      score: item.confidence ? parseFloat(item.confidence) : 1.0
    });
    
    if (item.start < lineObj.start) lineObj.start = item.start;
    if (item.end > lineObj.end) lineObj.end = item.end;
  });
  
  return Array.from(linesMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([_, line]) => ({
      text: line.words.map(w => w.word).join(' '),
      language: 'unknown',
      start: line.start,
      end: line.end,
      words: line.words
    }));
}

export const LyricsChordsViewer: React.FC<ILyricsChordsViewerProps> = ({
  TrackId,
  CurrentTime,
  OnClose
}) => {
  const { seek } = usePlayer();
  const [lyrics, setLyrics] = useState<ILyricsLine[] | null>(null);
  const [chords, setChords] = useState<IChordBeat[] | null>(null);
  const [transpose, setTranspose] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const lineRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  // 1. Carrega os arquivos de metadados
  useEffect(() => {
    setLoading(true);
    setError(null);

    const loadMetadata = async () => {
      try {
        // Tenta carregar acordes
        let chordsData: IChordBeat[] = [];
        try {
          const chordsResponse = await fetch(`${SERVER_URL}/stems/${TrackId}/chords.json`);
          if (chordsResponse.ok) {
            chordsData = await chordsResponse.json();
          }
        } catch (e) {
          console.warn("Acordes indisponíveis ou não encontrados para esta música.");
        }

        // Tenta carregar letras no formato novo
        let lyricsData: ILyricsLine[] = [];
        try {
          const lyricsResponse = await fetch(`${SERVER_URL}/stems/${TrackId}/lyrics_new_format.json`);
          if (lyricsResponse.ok) {
            lyricsData = await lyricsResponse.json();
          } else {
            // Se falhar o novo formato, tenta carregar o formato antigo
            const legacyResponse = await fetch(`${SERVER_URL}/stems/${TrackId}/lyrics.json`);
            if (legacyResponse.ok) {
              const legacyJson = await legacyResponse.json();
              lyricsData = parseLegacyLyrics(legacyJson);
            }
          }
        } catch (e) {
          console.warn("Letras indisponíveis ou não encontradas para esta música.");
        }

        setChords(chordsData.length > 0 ? chordsData : null);
        setLyrics(lyricsData.length > 0 ? lyricsData : null);
      } catch (err: any) {
        setError("Erro ao processar as cifras e letras.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadMetadata();
  }, [TrackId]);

  // 2. Processa o alinhamento de cifras e letras com base no tom (transposição)
  const processedLines = useLyricsChords(lyrics, chords, transpose);

  // 3. Encontra o índice da linha ativa atual
  const activeLineIndex = useMemo(() => {
    if (!processedLines || processedLines.length === 0) return -1;
    return processedLines.findIndex(
      line => CurrentTime >= line.start && CurrentTime <= line.end
    );
  }, [processedLines, CurrentTime]);

  // 4. Calcula o acorde ativo com base estrita no tempo (independente da letra)
  const currentChordName = useMemo(() => {
    if (!chords || chords.length === 0) return '';
    let activeBeat = chords[0];
    for (let i = 0; i < chords.length; i++) {
      if (chords[i].curr_beat_time <= CurrentTime) {
        activeBeat = chords[i];
      } else {
        break;
      }
    }
    const rawChord = activeBeat && activeBeat.chord_simple_pop !== 'N' 
      ? activeBeat.chord_simple_pop 
      : '';
    return rawChord ? transposeChord(rawChord, transpose) : '';
  }, [chords, CurrentTime, transpose]);

  // 4. Auto-Scroll suave para manter a linha ativa centralizada na tela
  useEffect(() => {
    if (activeLineIndex !== -1) {
      lineRefs.current[activeLineIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [activeLineIndex]);

  return (
    <div className="fixed inset-x-0 top-0 bottom-16 md:bottom-24 z-40 bg-brand-black/95 backdrop-blur-2xl flex flex-col font-sans select-none animate-in fade-in zoom-in-95 duration-200">
      
      {/* Cabeçalho do Modal */}
      <header className="h-16 px-6 border-b border-brand-hover flex items-center justify-between shrink-0 bg-brand-black/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-green/10 flex items-center justify-center border border-brand-green/20">
            <Music className="w-4 h-4 text-brand-green" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-sm md:text-base leading-tight">Estúdio de Letras & Cifras</h2>
            <p className="text-brand-gray text-[10px] uppercase tracking-wider font-bold">Modo de Ensaios</p>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          {/* Seletor de Transposição (Tom) */}
          {chords && chords.length > 0 && (
            <div className="flex items-center bg-brand-hover rounded-full p-1 border border-brand-hover">
              <button 
                onClick={() => setTranspose(t => Math.max(-6, t - 1))}
                className="w-7 h-7 rounded-full text-xs text-brand-gray hover:text-white hover:bg-white/5 active:scale-95 transition-all flex items-center justify-center font-bold"
                title="Diminuir Meio Tom"
              >
                -
              </button>
              <span className="px-3 text-[11px] font-bold text-brand-green min-w-[70px] text-center select-none uppercase">
                TOM: {transpose >= 0 ? `+${transpose}` : transpose}
              </span>
              <button 
                onClick={() => setTranspose(t => Math.min(6, t + 1))}
                className="w-7 h-7 rounded-full text-xs text-brand-gray hover:text-white hover:bg-white/5 active:scale-95 transition-all flex items-center justify-center font-bold"
                title="Aumentar Meio Tom"
              >
                +
              </button>
            </div>
          )}

          {/* Botão de Fechar */}
          <button 
            onClick={OnClose}
            className="w-8 h-8 rounded-full bg-brand-hover hover:bg-brand-hover/80 text-brand-gray hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Fechar Visualizador"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Caixa Fixa do Acorde Atual */}
      {currentChordName && (
        <div className="bg-brand-hover/30 border-b border-brand-hover py-3 px-6 flex flex-col items-center justify-center shrink-0">
          <span className="text-[10px] text-brand-gray uppercase tracking-wider font-bold mb-0.5">Acorde Atual</span>
          <span className="text-3xl md:text-4xl font-black text-brand-green tracking-wider uppercase animate-pulse-slow">
            {currentChordName}
          </span>
        </div>
      )}

      {/* Área Central: Exibição */}
      <div className="flex-1 overflow-y-auto px-6 md:px-12 py-24 flex flex-col gap-14 scroll-smooth">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-brand-gray">
            <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold uppercase tracking-wider">Carregando letras e cifras...</span>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-brand-gray text-center px-4">
            <span className="text-sm font-semibold mb-1">Cifras e Letras Indisponíveis</span>
            <span className="text-xs text-brand-gray/60">Esta faixa não possui letras ou acordes sincronizados extraídos.</span>
          </div>
        ) : (!processedLines || processedLines.length === 0) ? (
          <div className="flex-1 flex flex-col items-center justify-center text-brand-gray text-center px-4">
            <span className="text-sm font-semibold mb-1">Música Instrumental</span>
            <span className="text-xs text-brand-gray/60">Nenhuma letra ou acorde localizado para esta gravação.</span>
          </div>
        ) : (
          processedLines.map((line, lIdx) => {
            const isActive = lIdx === activeLineIndex;

            return (
              <div 
                key={lIdx}
                ref={el => { lineRefs.current[lIdx] = el; }}
                className={`transition-all duration-300 transform origin-left ${
                  isActive ? 'opacity-100 scale-[1.02]' : 'opacity-25 hover:opacity-40'
                }`}
              >
                <div className="flex flex-wrap gap-x-2 gap-y-6">
                  {line.Words.map((word, wIdx) => {
                    const isWordActive = CurrentTime >= word.start && CurrentTime <= word.end;

                    return (
                      <div key={wIdx} className="inline-flex flex-col items-start select-none">
                        {/* Acorde empilhado acima da palavra */}
                        <span className="chord text-brand-green font-bold text-xs md:text-sm h-5 select-none transition-transform duration-200">
                          {word.Chord || <span className="opacity-0 select-none">&nbsp;</span>}
                        </span>

                        {/* Palavra com destaque gradual de Karaokê */}
                        <span 
                          onClick={() => seek(word.start)}
                          className={`text-lg md:text-2xl font-semibold cursor-pointer transition-all hover:text-brand-green active:scale-95 duration-150 ${
                            isWordActive ? 'text-brand-green' : 'text-neutral-100'
                          }`}
                        >
                          {word.word}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
