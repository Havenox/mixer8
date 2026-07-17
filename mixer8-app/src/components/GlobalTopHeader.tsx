import React, { useState, useEffect, useMemo } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { transposeChord } from '../hooks/useLyricsChords';
import type { IChordBeat } from '../hooks/useLyricsChords';
import { SERVER_URL } from '../config';
import { ZoomIn, ZoomOut, Music4, RotateCcw, Plus, Minus, X } from 'lucide-react';

export const GlobalTopHeader: React.FC = () => {
  const {
    currentTrack,
    currentTime,
    transpose,
    setTranspose,
    bpmDelta,
    setBpmDelta,
    activeOverlay,
    setActiveOverlay,
    showChords,
    setShowChords
  } = usePlayer();

  const [chords, setChords] = useState<IChordBeat[] | null>(null);
  const [activeZoom, setActiveZoom] = useState(() => {
    const cached = localStorage.getItem('mixer8:daw-zoom-level');
    return cached ? parseFloat(cached) : 1.0;
  });

  // Escuta atualizações do nível de Zoom enviadas pela DAW
  useEffect(() => {
    const handleZoomChange = (e: Event) => {
      const customEvt = e as CustomEvent;
      if (customEvt.detail?.zoomLevel) {
        setActiveZoom(customEvt.detail.zoomLevel);
      }
    };
    window.addEventListener('mixer8:zoom-change', handleZoomChange);
    return () => window.removeEventListener('mixer8:zoom-change', handleZoomChange);
  }, []);

  const triggerZoomIn = () => window.dispatchEvent(new CustomEvent('mixer8:zoom-in'));
  const triggerZoomOut = () => window.dispatchEvent(new CustomEvent('mixer8:zoom-out'));
  const triggerZoomReset = () => window.dispatchEvent(new CustomEvent('mixer8:zoom-reset'));

  // Carrega as cifras (chords.json) quando a faixa atual muda
  useEffect(() => {
    setChords(null);
    if (!currentTrack?.TrackId) return;

    let isMounted = true;
    const fetchChords = async () => {
      try {
        const response = await fetch(`${SERVER_URL}/stems/${currentTrack.TrackId}/chords.json`);
        if (response.ok) {
          const data = await response.json();
          if (isMounted) setChords(data);
        }
      } catch (e) {
        console.warn('Erro ao carregar chords.json:', e);
      }
    };

    fetchChords();
    return () => {
      isMounted = false;
    };
  }, [currentTrack?.TrackId]);

  // Calcula o acorde atual baseado no currentTime e na transposição
  const currentChord = useMemo(() => {
    if (!chords || chords.length === 0) return '';

    // Encontra o batimento ativo correspondente ao tempo atual
    let activeBeat: IChordBeat | null = null;
    for (let i = 0; i < chords.length; i++) {
      if (currentTime >= chords[i].curr_beat_time) {
        activeBeat = chords[i];
      } else {
        break;
      }
    }

    if (!activeBeat) return '';

    const rawChord = activeBeat.chord_simple_pop && activeBeat.chord_simple_pop !== 'N'
      ? activeBeat.chord_simple_pop
      : activeBeat.prev_chord;

    return rawChord ? transposeChord(rawChord, transpose) : '';
  }, [chords, currentTime, transpose]);

  // Calcula o Tom Base transposto para exibição
  const displayKey = useMemo(() => {
    if (!currentTrack?.Key) return null;
    return transposeChord(currentTrack.Key, transpose);
  }, [currentTrack?.Key, transpose]);

  // Calcula o BPM atual ajustado com a variação (delta)
  const calculatedBpm = useMemo(() => {
    const base = currentTrack?.Bpm || 120;
    return Math.max(30, Math.min(300, base + bpmDelta));
  }, [currentTrack?.Bpm, bpmDelta]);

  if (!currentTrack) return null;

  return (
    <header className="w-full bg-[#0d0d0d]/95 backdrop-blur-md border-b border-brand-hover/80 px-2 md:px-6 h-[56px] md:h-[72px] flex items-center justify-between gap-2 md:gap-4 shrink-0 select-none z-30 transition-all">
      
      {/* Grupo da Esquerda: Info da Faixa (oculto no mobile para liberar espaço) */}
      <div className="hidden md:flex items-center gap-6 min-w-0 shrink-0">
        {/* Capa, Título e Artista */}
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          {currentTrack.CoverUrl ? (
            <img
              src={currentTrack.CoverUrl.startsWith('http') ? currentTrack.CoverUrl : `${SERVER_URL}${currentTrack.CoverUrl}`}
              className="w-10 h-10 rounded object-cover border border-brand-hover shadow-md shrink-0"
              alt="Capa da música"
            />
          ) : (
            <div className="w-10 h-10 rounded bg-brand-hover border border-brand-hover flex items-center justify-center text-brand-green shrink-0">
              <Music4 className="w-5 h-5" />
            </div>
          )}
          <div className="flex flex-col truncate max-w-[160px] sm:max-w-[220px] lg:max-w-[300px]">
            <span className="text-xs md:text-sm font-black text-white tracking-wider truncate">
              {currentTrack.TrackTitle}
            </span>
            <span className="text-[11px] text-brand-gray font-medium truncate">
              {currentTrack.ArtistName}
            </span>
          </div>
        </div>
      </div>

      {/* Grupo da Direita: Controles (no mobile alinhados à direita com excelente legibilidade) */}
      <div className="flex items-center justify-end md:justify-end gap-1.5 md:gap-3 w-full md:w-auto py-0.5">
        
        {/* Controles de Zoom (Apenas se a DAW estiver aberta) */}
        {activeOverlay === 'daw' && (
          <div className="h-[36px] md:h-[46px] w-[105px] sm:w-[130px] md:w-[150px] bg-[#181818] border border-white/10 rounded-lg flex items-center overflow-hidden shrink-0 select-none shadow-md transition-all duration-200 hover:bg-[#222222] animate-in fade-in duration-200">
            <button
              onClick={triggerZoomOut}
              disabled={activeZoom === 1.0}
              className="h-full w-7 md:w-9 flex items-center justify-center text-brand-gray hover:text-white hover:bg-white/5 border-r border-white/10 transition-colors cursor-pointer disabled:text-white/10 disabled:pointer-events-none active:scale-95 shrink-0"
              title="Afastar Zoom (Zoom Out)"
            >
              <ZoomOut className="w-3 md:w-3.5 h-3 md:h-3.5" />
            </button>
            <div 
              onClick={triggerZoomReset}
              className="flex flex-col items-center justify-center leading-none flex-1 min-w-0 px-1 cursor-pointer select-none active:opacity-70 transition-opacity"
              title="Redefinir Zoom"
            >
              <span className="text-[7.5px] md:text-[8px] font-extrabold text-brand-gray/50 uppercase tracking-widest leading-none mb-0.5 md:mb-1 truncate w-full text-center">Zoom</span>
              <span className="text-[10px] md:text-xs font-black text-white font-mono leading-none">{activeZoom.toFixed(1)}x</span>
            </div>
            <button
              onClick={triggerZoomIn}
              disabled={activeZoom === 16.0}
              className="h-full w-7 md:w-9 flex items-center justify-center text-brand-gray hover:text-white hover:bg-white/5 border-l border-white/10 transition-colors cursor-pointer disabled:text-white/10 disabled:pointer-events-none active:scale-95 shrink-0"
              title="Aproximar Zoom (Zoom In)"
            >
              <ZoomIn className="w-3 md:w-3.5 h-3 md:h-3.5" />
            </button>
            <button
              onClick={triggerZoomReset}
              disabled={activeZoom === 1.0}
              className={`hidden md:flex h-full w-9 items-center justify-center border-l border-white/10 transition-colors shrink-0 ${
                activeZoom === 1.0
                  ? 'text-white/20 cursor-not-allowed pointer-events-none'
                  : 'text-brand-green hover:text-brand-green/85 hover:bg-brand-green/5 cursor-pointer active:scale-95'
              }`}
              title="Redefinir Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Controle de Cifra ON/OFF (Apenas se Letras estiver ativa) */}
        {activeOverlay === 'lyrics' && (
          <button
            onClick={() => setShowChords(prev => !prev)}
            className="h-[36px] md:h-[46px] w-[54px] sm:w-[70px] md:w-[90px] bg-[#181818] border border-white/10 rounded-lg flex flex-col items-center justify-center shrink-0 shadow-md cursor-pointer select-none transition-all duration-200 hover:bg-[#222222] active:scale-95 animate-in fade-in duration-200"
            title="Alternar Exibição de Cifras"
          >
            <span className="text-[7.5px] md:text-[8px] font-extrabold text-brand-gray/50 uppercase tracking-widest leading-none mb-0.5 md:mb-1">
              Cifra
            </span>
            {showChords ? (
              <span className="text-[10px] md:text-xs font-black text-brand-green uppercase tracking-widest leading-none drop-shadow-[0_0_6px_rgba(34,197,94,0.35)]">
                ON
              </span>
            ) : (
              <span className="text-[10px] md:text-xs font-black text-brand-gray/40 uppercase tracking-widest leading-none">
                OFF
              </span>
            )}
          </button>
        )}

        {/* Acorde Atual (Spotify style) */}
        <div className="h-[36px] md:h-[46px] w-[58px] sm:w-[76px] md:w-24 bg-[#181818] border border-white/10 rounded-lg flex flex-col items-center justify-center shrink-0 shadow-md transition-all duration-200 hover:bg-[#222222]">
          <span className="text-[7.5px] md:text-[8px] font-extrabold text-brand-gray/50 uppercase tracking-widest leading-none mb-0.5 md:mb-1">
            Acorde
          </span>
          <span className="text-[10px] md:text-xs lg:text-sm font-black text-brand-green tracking-wider font-mono leading-none text-center drop-shadow-[0_0_6px_rgba(34,197,94,0.35)]">
            {currentChord || '--'}
          </span>
        </div>

        {/* Controle de Tom (Transpose) */}
        <div className="h-[36px] md:h-[46px] w-[108px] sm:w-[135px] md:w-[160px] bg-[#181818] border border-white/10 rounded-lg flex items-center overflow-hidden shrink-0 shadow-md transition-all duration-200 hover:bg-[#222222]">
          <button
            onClick={() => setTranspose(t => Math.max(-6, t - 1))}
            className="h-full w-7 md:w-9 flex items-center justify-center text-brand-gray hover:text-white hover:bg-white/5 border-r border-white/10 transition-colors cursor-pointer active:scale-95 shrink-0"
            title="Diminuir Meio Tom"
          >
            <Minus className="w-3 md:w-3.5 h-3 md:h-3.5" />
          </button>
          
          <div 
            onClick={() => setTranspose(0)}
            className="flex flex-col items-center justify-center leading-none flex-1 min-w-0 px-1 cursor-pointer select-none active:opacity-70 transition-opacity"
            title="Redefinir Tom Original (Toque para zerar)"
          >
            <span className="text-[7.5px] md:text-[8px] font-extrabold text-brand-gray/50 uppercase tracking-widest leading-none mb-0.5 md:mb-1 truncate w-full text-center">
              Tom
            </span>
            <span className="text-[10px] md:text-xs font-black text-white whitespace-nowrap leading-none flex items-center justify-center gap-0.5">
              <span>{displayKey || '--'}</span>
              <span className="text-brand-gray/40 font-semibold text-[8px] md:text-[10px]">
                ({transpose >= 0 ? `+${transpose}` : transpose})
              </span>
            </span>
          </div>

          <button
            onClick={() => setTranspose(t => Math.min(6, t + 1))}
            className="h-full w-7 md:w-9 flex items-center justify-center text-brand-gray hover:text-white hover:bg-white/5 border-l border-white/10 transition-colors cursor-pointer active:scale-95 shrink-0"
            title="Aumentar Meio Tom"
          >
            <Plus className="w-3 md:w-3.5 h-3 md:h-3.5" />
          </button>

          <button
            onClick={() => setTranspose(0)}
            disabled={transpose === 0}
            className={`hidden md:flex h-full w-9 items-center justify-center border-l border-white/10 transition-colors shrink-0 ${
              transpose === 0
                ? 'text-white/20 cursor-not-allowed pointer-events-none'
                : 'text-brand-green hover:text-brand-green/85 hover:bg-brand-green/5 cursor-pointer active:scale-95'
            }`}
            title="Redefinir Tom Original"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Controle de BPM */}
        <div className="h-[36px] md:h-[46px] w-[114px] sm:w-[140px] md:w-[170px] bg-[#181818] border border-white/10 rounded-lg flex items-center overflow-hidden shrink-0 shadow-md transition-all duration-200 hover:bg-[#222222]">
          <button
            onClick={() => setBpmDelta(b => b - 1)}
            className="h-full w-7 md:w-9 flex items-center justify-center text-brand-gray hover:text-white hover:bg-white/5 border-r border-white/10 transition-colors cursor-pointer active:scale-95 shrink-0"
            title="Diminuir 1 BPM"
          >
            <Minus className="w-3 md:w-3.5 h-3 md:h-3.5" />
          </button>
          
          <div 
            onClick={() => setBpmDelta(0)}
            className="flex flex-col items-center justify-center leading-none flex-1 min-w-0 px-1 cursor-pointer select-none active:opacity-70 transition-opacity"
            title="Redefinir BPM Original (Toque para zerar)"
          >
            <span className="text-[7.5px] md:text-[8px] font-extrabold text-brand-gray/50 uppercase tracking-widest leading-none mb-0.5 md:mb-1 truncate w-full text-center">
              BPM
            </span>
            <span className="text-[10px] md:text-xs font-black text-white whitespace-nowrap leading-none flex items-center justify-center gap-0.5">
              <span>{calculatedBpm}</span>
              <span className="text-brand-gray/40 font-semibold text-[8px] md:text-[10px]">
                ({bpmDelta >= 0 ? `+${bpmDelta}` : bpmDelta})
              </span>
            </span>
          </div>

          <button
            onClick={() => setBpmDelta(b => b + 1)}
            className="h-full w-7 md:w-9 flex items-center justify-center text-brand-gray hover:text-white hover:bg-white/5 border-l border-white/10 transition-colors cursor-pointer active:scale-95 shrink-0"
            title="Aumentar 1 BPM"
          >
            <Plus className="w-3 md:w-3.5 h-3 md:h-3.5" />
          </button>

          <button
            onClick={() => setBpmDelta(0)}
            disabled={bpmDelta === 0}
            className={`hidden md:flex h-full w-9 items-center justify-center border-l border-white/10 transition-colors shrink-0 ${
              bpmDelta === 0
                ? 'text-white/20 cursor-not-allowed pointer-events-none'
                : 'text-brand-green hover:text-brand-green/85 hover:bg-brand-green/5 cursor-pointer active:scale-95'
            }`}
            title="Redefinir BPM Original"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Botão de Fechar X */}
        {activeOverlay !== 'none' && (
          <div className="h-[36px] md:h-[46px] flex items-center justify-center shrink-0 w-8 md:w-10">
            <button
              onClick={() => setActiveOverlay('none')}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#181818] border border-white/10 text-brand-gray hover:text-white hover:border-brand-green/30 hover:bg-[#282828] transition-all flex items-center justify-center shadow-md cursor-pointer hover:scale-105 active:scale-95 animate-in fade-in duration-200"
              title="Fechar Painel"
            >
              <X className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
        )}

      </div>

    </header>
  );
};
