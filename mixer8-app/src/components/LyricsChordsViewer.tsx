import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useLyricsChords } from '../hooks/useLyricsChords';
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
  const { seek, isPlaying, togglePlay, transpose } = usePlayer();
  const [lyrics, setLyrics] = useState<ILyricsLine[] | null>(null);
  const [chords, setChords] = useState<IChordBeat[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const lineRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const containerRef = useRef<HTMLDivElement>(null);

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

  // 4. Auto-Scroll suave localizado para manter a linha ativa centralizada na tela
  useEffect(() => {
    const activeEl = lineRefs.current[activeLineIndex];
    const containerEl = containerRef.current;
    
    if (activeEl && containerEl) {
      const containerHeight = containerEl.clientHeight;
      const elementTop = activeEl.offsetTop;
      const elementHeight = activeEl.clientHeight;
      
      const targetScrollTop = elementTop - (containerHeight / 2) + (elementHeight / 2);
      
      containerEl.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth'
      });
    }
  }, [activeLineIndex]);

  return (
    <div className="w-full h-full flex flex-col font-sans select-none bg-brand-dark overflow-hidden relative animate-in fade-in duration-200">
      
      {/* Barra superior dedicada para o botão de voltar, eliminando sobreposições com a letra */}
      <div className="h-14 flex items-center px-6 md:px-12 shrink-0 border-b border-brand-hover/20">
        <button 
          onClick={OnClose}
          className="w-10 h-10 rounded-full bg-[#181818] border border-white/10 text-white hover:text-brand-green hover:border-brand-green/30 transition-all flex items-center justify-center shadow-lg cursor-pointer hover:scale-105 active:scale-95"
          title="Voltar"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Área Central: Exibição */}
      <div 
        ref={containerRef}
        className="relative flex-1 overflow-y-auto px-6 md:px-12 pt-6 pb-24 flex flex-col gap-8 scroll-smooth"
      >
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
                <div className="flex flex-wrap gap-x-2 gap-y-3">
                  {line.Words.map((word, wIdx) => {
                    const isWordActive = CurrentTime >= word.start && CurrentTime <= word.end;

                    return (
                      <span 
                        key={wIdx}
                        onClick={() => {
                          seek(word.start);
                          if (!isPlaying) togglePlay();
                        }}
                        className={`text-lg md:text-2xl font-semibold cursor-pointer transition-all hover:text-brand-green active:scale-95 duration-150 select-none ${
                          isWordActive ? 'text-brand-green' : 'text-neutral-100'
                        }`}
                      >
                        {word.word}
                      </span>
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
