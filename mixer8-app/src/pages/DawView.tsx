import React, { useState, useEffect, useRef } from 'react';

import { usePlayer } from '../context/PlayerContext';
import { RotaryKnob } from '../components/RotaryKnob';
import { 
  Loader2, 
  ShieldAlert, Volume2, 
  Disc, PanelLeftClose, PanelLeftOpen,
  Activity, X, Wand2
} from 'lucide-react';
import { API_URL } from '../config';

const ZOOM_STEPS = [1.0, 1.5, 2.0, 3.0, 4.0, 6.0, 8.0, 12.0, 16.0, 20.0, 30.0, 40.0, 50.0];

const getZoomCacheKey = () => window.innerWidth < 768 ? 'mixer8:daw-zoom-level:mobile' : 'mixer8:daw-zoom-level:desktop';

const getInitialZoom = () => {
  const key = getZoomCacheKey();
  const cached = localStorage.getItem(key);
  return cached ? parseFloat(cached) : 1.0;
};

export const DawView: React.FC = () => {

  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    stemsVolume,
    stemsMute,
    stemsSolo,
    stemsPan,
    stemsReverbWet,
    stemsReverbRoom,
    stemsReverbEnabled,
    seek,
    setStemVolume,
    toggleStemMute,
    toggleStemSolo,
    setStemPan,
    setStemReverbWet,
    setStemReverbRoom,
    setStemReverbEnabled,
    setActiveOverlay
  } = usePlayer();

  const [waveforms, setWaveforms] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => window.innerWidth < 768);
  const [expandedStems, setExpandedStems] = useState<Record<string, boolean>>({});

  const toggleStemExpanded = (stemName: string) => {
    setExpandedStems(prev => ({
      ...prev,
      [stemName]: !prev[stemName]
    }));
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const tracksTimelineRef = useRef<HTMLDivElement>(null);
  const isDraggingPlayhead = useRef(false);

  const rulerScrollRef = useRef<HTMLDivElement>(null);
  const trackScrollRefs = useRef<(HTMLDivElement | null)[]>([]);
  const playheadScrollRef = useRef<HTMLDivElement>(null);
  const playheadLineRef = useRef<HTMLDivElement>(null);
  const [zoomLevel, setZoomLevel] = useState(getInitialZoom);

  // Re-avalia o Zoom e estado da sidebar ao alterar o tamanho da janela (ex: alternar modo mobile/desktop)
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      setIsSidebarCollapsed(isMobile);

      const key = isMobile ? 'mixer8:daw-zoom-level:mobile' : 'mixer8:daw-zoom-level:desktop';
      const cached = localStorage.getItem(key);
      setZoomLevel(cached ? parseFloat(cached) : 1.0);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Limpa refs quando mudar track ou stems
  useEffect(() => {
    trackScrollRefs.current = [];
  }, [currentTrack]);

  const handleZoomIn = () => {
    setZoomLevel(prev => {
      const idx = ZOOM_STEPS.indexOf(prev);
      if (idx !== -1 && idx < ZOOM_STEPS.length - 1) {
        return ZOOM_STEPS[idx + 1];
      }
      return prev;
    });
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => {
      const idx = ZOOM_STEPS.indexOf(prev);
      if (idx > 0) {
        return ZOOM_STEPS[idx - 1];
      }
      return prev;
    });
  };

  const handleZoomReset = () => {
    setZoomLevel(1.0);
  };

  // Emite o nível de zoom para o GlobalTopHeader e salva no localStorage do dispositivo atual (mobile ou desktop)
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('mixer8:zoom-change', { detail: { zoomLevel } }));
    const key = getZoomCacheKey();
    localStorage.setItem(key, String(zoomLevel));
  }, [zoomLevel]);

  // Escuta os comandos de zoom disparados pelo GlobalTopHeader
  useEffect(() => {
    const handleZoomInEvent = () => handleZoomIn();
    const handleZoomOutEvent = () => handleZoomOut();
    const handleZoomResetEvent = () => handleZoomReset();

    window.addEventListener('mixer8:zoom-in', handleZoomInEvent);
    window.addEventListener('mixer8:zoom-out', handleZoomOutEvent);
    window.addEventListener('mixer8:zoom-reset', handleZoomResetEvent);

    return () => {
      window.removeEventListener('mixer8:zoom-in', handleZoomInEvent);
      window.removeEventListener('mixer8:zoom-out', handleZoomOutEvent);
      window.removeEventListener('mixer8:zoom-reset', handleZoomResetEvent);
    };
  }, []);

  // Gera os marcadores de segundos com base no nível de zoom
  const getTicks = () => {
    if (!duration) return [];
    const numTicks = Math.max(5, Math.floor(5 * zoomLevel));
    const ticks = [];
    for (let i = 0; i <= numTicks; i++) {
      ticks.push((i / numTicks) * duration);
    }
    return ticks;
  };

  const ticks = getTicks();

  const isSyncingScroll = useRef(false);

  const handleHorizontalScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    const scrollLeft = e.currentTarget.scrollLeft;

    if (rulerScrollRef.current && rulerScrollRef.current !== e.currentTarget) {
      rulerScrollRef.current.scrollLeft = scrollLeft;
    }

    if (playheadScrollRef.current && playheadScrollRef.current !== e.currentTarget) {
      playheadScrollRef.current.scrollLeft = scrollLeft;
    }

    trackScrollRefs.current.forEach((ref) => {
      if (ref && ref !== e.currentTarget) {
        ref.scrollLeft = scrollLeft;
      }
    });

    // Reset lock in the next frame
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  // Função auxiliar para rolar a timeline e faixas para a posição atual da agulha
  const scrollToPlayhead = (force = false) => {
    if (!rulerScrollRef.current || !duration || duration <= 0 || zoomLevel <= 1.0) return;

    const container = rulerScrollRef.current;
    const viewportWidth = container.clientWidth;
    const totalWidth = container.scrollWidth;

    if (viewportWidth <= 0 || totalWidth <= 0) return;

    // Posição da agulha em pixels
    const playheadX = (currentTime / duration) * totalWidth;
    const currentScroll = container.scrollLeft;

    // Se for 'force' (ao abrir a DAW, trocar de faixa ou zoom)
    // ou se a agulha estiver fora do viewport visível (página anterior ou posterior)
    if (force || playheadX >= currentScroll + viewportWidth || playheadX < currentScroll) {
      const pageIndex = Math.floor(playheadX / viewportWidth);
      const targetScroll = Math.max(0, pageIndex * viewportWidth);

      isSyncingScroll.current = true;

      container.scrollLeft = targetScroll;

      if (playheadScrollRef.current) {
        playheadScrollRef.current.scrollLeft = targetScroll;
      }

      trackScrollRefs.current.forEach((ref) => {
        if (ref) ref.scrollLeft = targetScroll;
      });

      requestAnimationFrame(() => {
        isSyncingScroll.current = false;
      });
    }
  };

  // 1. Ao carregar/abrir a DAW ou alterar faixa/zoom, força o scroll para a posição atual da agulha
  useEffect(() => {
    scrollToPlayhead(true);

    const rafId = requestAnimationFrame(() => {
      scrollToPlayhead(true);
    });

    const timerId = setTimeout(() => {
      scrollToPlayhead(true);
    }, 80);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, [currentTrack?.TrackId, zoomLevel, isSidebarCollapsed]);

  // 2. Acompanhamento automático de página durante a reprodução com Zoom
  useEffect(() => {
    scrollToPlayhead(false);
  }, [currentTime, isPlaying, zoomLevel, duration]);

  const lastTimeRef = useRef(currentTime);
  const interpolatedTimeRef = useRef(currentTime);
  const lastFrameTimeRef = useRef(0);

  // Sincroniza o tempo interpolado com o tempo real toda vez que o estado currentTime muda
  useEffect(() => {
    interpolatedTimeRef.current = currentTime;
    lastTimeRef.current = currentTime;
    lastFrameTimeRef.current = performance.now();
  }, [currentTime]);

  // Loop de Animação a 60fps da Agulha (DOM Direta)
  useEffect(() => {
    if (!isPlaying || duration <= 0) {
      // Se pausado, garante que a agulha esteja no local exato do currentTime
      if (playheadLineRef.current) {
        const pct = (currentTime / duration) * 100;
        playheadLineRef.current.style.left = `${pct}%`;
      }
      return;
    }

    let animId: number;
    lastFrameTimeRef.current = performance.now();

    const updatePlayheadPosition = () => {
      if (isDraggingPlayhead.current) {
        animId = requestAnimationFrame(updatePlayheadPosition);
        return;
      }

      const now = performance.now();
      const delta = (now - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = now;

      // Incrementa o tempo de forma contínua
      interpolatedTimeRef.current = Math.min(duration, interpolatedTimeRef.current + delta);

      // Atualiza a posição da agulha diretamente na DOM (0% a 100%)
      if (playheadLineRef.current) {
        const pct = (interpolatedTimeRef.current / duration) * 100;
        playheadLineRef.current.style.left = `${pct}%`;
      }

      animId = requestAnimationFrame(updatePlayheadPosition);
    };

    animId = requestAnimationFrame(updatePlayheadPosition);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isPlaying, duration]);

  // Busca as waveforms da faixa atual
  useEffect(() => {
    if (!currentTrack) return;
    
    const fetchWaveforms = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`${API_URL}/Tracks/${currentTrack.TrackId}/waveforms`);
        if (res.ok) {
          const data = await res.json();
          setWaveforms(data.Waveforms || {});
        } else {
          setError('Não foi possível carregar as formas de onda para esta faixa.');
        }
      } catch (err) {
        console.error('Erro ao buscar waveforms:', err);
        setError('Erro de conexão ao carregar waveforms.');
      } finally {
        setLoading(false);
      }
    };

    fetchWaveforms();
  }, [currentTrack?.TrackId]);

  // Função utilitária para saber se a stem deve ocultar o knob de Pan (regrada como Mono)
  const isMonoStem = (stemType: string) => {
    if (!currentTrack?.Stems || currentTrack.Stems.length <= 1) {
      return false; // Faixa única / Completo é estéreo
    }
    const type = stemType.toLowerCase();
    return type === 'voz' || type === 'vocal' || type === 'vocais' || type === 'baixo' || type === 'metrônomo';
  };

  // Abreviação do nome do canal para sidebar colapsada
  const getStemAbbreviation = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('voz') || n.includes('vocal')) return 'VOZ';
    if (n.includes('bateria')) return 'BAT';
    if (n.includes('baixo')) return 'BAI';
    if (n.includes('guitarra')) return 'GUI';
    if (n.includes('teclado') || n.includes('piano')) return 'TEC';
    if (n.includes('metrônomo') || n.includes('metronomo')) return 'MET';
    if (n.includes('sopro')) return 'SOP';
    if (n.includes('cordas')) return 'COR';
    return name.slice(0, 3).toUpperCase();
  };

  // Lógica de Renderização das Waveforms nos Canvas (Estática e Responsiva)
  useEffect(() => {
    if (loading || Object.keys(waveforms).length === 0 || !currentTrack) return;

    let frameId: number;

    const renderAllCanvas = () => {
      // Cancela frames pendentes para evitar multiplas chamadas
      cancelAnimationFrame(frameId);
      
      frameId = requestAnimationFrame(() => {
        const activeStemsList = currentTrack.Stems || [];
        activeStemsList.forEach(stem => {
          const canvas = document.getElementById(`canvas-${stem.StemType}`) as HTMLCanvasElement;
          if (!canvas) return;

          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          const dpr = window.devicePixelRatio || 1;
          const rect = canvas.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return;

          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;
          ctx.scale(dpr, dpr);

          const width = rect.width;
          const height = rect.height;

          ctx.clearRect(0, 0, width, height);

          const points = waveforms[stem.StemType] || [];
          if (points.length === 0) {
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, height / 2);
            ctx.lineTo(width, height / 2);
            ctx.stroke();
            return;
          }

          // Desenha a forma de onda contínua sólida usando todos os pontos do banco
          ctx.beginPath();
          
          // Caminho do envelope superior (da esquerda para a direita)
          for (let i = 0; i < points.length; i++) {
            const x = (i / (points.length - 1 || 1)) * width;
            const rawVal = points[i] || 0;
            const absVal = Math.min(100, Math.abs(rawVal));
            const amplitude = (absVal / 100.0) * (height * 0.42); // Normalizado (máximo 42% da altura)
            const y = height / 2 - amplitude;
            
            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }

          // Caminho do envelope inferior (da direita para a esquerda)
          for (let i = points.length - 1; i >= 0; i--) {
            const x = (i / (points.length - 1 || 1)) * width;
            const rawVal = points[i] || 0;
            const absVal = Math.min(100, Math.abs(rawVal));
            const amplitude = (absVal / 100.0) * (height * 0.42);
            const y = height / 2 + amplitude;
            ctx.lineTo(x, y);
          }

          ctx.closePath();
          ctx.fillStyle = '#000000';
          ctx.fill();

          // Linha central preta fina cortando o meio da waveform
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, height / 2);
          ctx.lineTo(width, height / 2);
          ctx.stroke();
        });
      });
    };

    renderAllCanvas();

    const timeoutId = setTimeout(renderAllCanvas, 250);

    window.addEventListener('resize', renderAllCanvas);
    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timeoutId);
      window.removeEventListener('resize', renderAllCanvas);
    };
  }, [waveforms, loading, currentTrack, zoomLevel, isSidebarCollapsed, expandedStems]);

  // Lógica de Seek ao clicar/arrastar na timeline
  const handleTimelineInteraction = (clientX: number) => {
    if (!tracksTimelineRef.current || !duration) return;
    const rect = tracksTimelineRef.current.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const percent = Math.max(0, Math.min(1.0, offsetX / rect.width));
    seek(percent * duration);
  };

  const handleMouseDownTimeline = (e: React.MouseEvent) => {
    isDraggingPlayhead.current = true;
    handleTimelineInteraction(e.clientX);
    window.addEventListener('mousemove', handleMouseMoveTimeline);
    window.addEventListener('mouseup', handleMouseUpTimeline);
  };

  const handleMouseMoveTimeline = (e: MouseEvent) => {
    if (!isDraggingPlayhead.current) return;
    handleTimelineInteraction(e.clientX);
  };

  const handleMouseUpTimeline = () => {
    isDraggingPlayhead.current = false;
    window.removeEventListener('mousemove', handleMouseMoveTimeline);
    window.removeEventListener('mouseup', handleMouseUpTimeline);
  };

  // Suporte a Toque na Timeline
  const handleTouchStartTimeline = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    isDraggingPlayhead.current = true;
    handleTimelineInteraction(e.touches[0].clientX);
    window.addEventListener('touchmove', handleTouchMoveTimeline, { passive: false });
    window.addEventListener('touchend', handleTouchEndTimeline);
  };

  const handleTouchMoveTimeline = (e: TouchEvent) => {
    if (!isDraggingPlayhead.current || e.touches.length !== 1) return;
    if (e.cancelable) e.preventDefault();
    handleTimelineInteraction(e.touches[0].clientX);
  };

  const handleTouchEndTimeline = () => {
    isDraggingPlayhead.current = false;
    window.removeEventListener('touchmove', handleTouchMoveTimeline);
    window.removeEventListener('touchend', handleTouchEndTimeline);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleMouseMoveTimeline);
      window.removeEventListener('mouseup', handleMouseUpTimeline);
      window.removeEventListener('touchmove', handleTouchMoveTimeline);
      window.removeEventListener('touchend', handleTouchEndTimeline);
    };
  }, [duration]);

  // Formatação de Tempo Auxiliar
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs === Infinity) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // 2. Estado Sem Música Carregada
  if (!currentTrack) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 min-h-[75vh] gap-5 bg-brand-dark rounded-xl border border-brand-hover select-none animate-in fade-in duration-300">
        <Disc className="w-16 h-16 text-brand-gray/30 animate-spin" style={{ animationDuration: '8s' }} />
        <div className="flex flex-col gap-2 max-w-[360px]">
          <h2 className="text-lg font-black text-white uppercase tracking-wider">Estúdio DAW Vazio</h2>
          <p className="text-xs text-brand-gray leading-relaxed">
            Nenhuma música está sendo reproduzida no momento. Volte para a biblioteca e inicie uma faixa com stems para explorar a mixagem avançada.
          </p>
        </div>
        <button 
          onClick={() => setActiveOverlay('none')}
          className="py-2 px-5 bg-brand-green text-black rounded font-black text-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          Escolher uma Música
        </button>
      </div>
    );
  }

  // Ordenação padronizada das stems para layout
  const sortedStems = [...(currentTrack.Stems || [])].sort((a, b) => {
    const order = [
      'Voz', 'Vocal', 'Vocais', 'Bateria', 'Baixo', 'Guitarra', 
      'Guitarra Solo', 'Guitarra Base', 'Sopro', 'Teclado', 'Piano', 
      'Cordas', 'Outros', 'Completo', 'Metrônomo'
    ];
    return order.indexOf(a.StemType) - order.indexOf(b.StemType);
  });

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] text-white select-none animate-in fade-in duration-300" ref={containerRef}>
      
      {/* Sub-Barra Ultra-Fina da DAW */}
      <div className="h-8 border-b border-brand-hover/80 bg-[#141414] px-3.5 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-brand-green" />
          <span className="text-[11px] font-bold tracking-wider text-white">Estúdio DAW</span>
        </div>
        <button
          onClick={() => setActiveOverlay('none')}
          className="p-1 rounded text-brand-gray hover:text-white hover:bg-brand-hover/50 transition-colors cursor-pointer"
          title="Fechar DAW"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* AREA CENTRAL: DAW Workstation */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#0d0d0d] relative overflow-hidden">
        
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0d0d0d] z-20">
            <Loader2 className="w-10 h-10 text-brand-green animate-spin" />
            <span className="text-xs text-brand-gray font-semibold">Carregando waveforms do Estúdio...</span>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0d0d0d] z-20 p-6 text-center">
            <ShieldAlert className="w-10 h-10 text-red-500" />
            <span className="text-xs text-red-400 font-semibold">{error}</span>
          </div>
        ) : null}

        {/* Agulha de Playhead Vertical (Linha contínua cruzando a DAW - Por cima da régua e faixas) */}
        {duration > 0 && !loading && (
          <div 
            ref={playheadScrollRef}
            onScroll={handleHorizontalScroll}
            className={`absolute ${isSidebarCollapsed ? 'left-[72px]' : 'left-[264px]'} right-4 md:right-6 top-0 bottom-0 pointer-events-none z-30 overflow-x-auto overflow-y-hidden scrollbar-none transition-all duration-200`}
          >
            <div 
              style={{ width: `${zoomLevel * 100}%` }}
              className="h-full relative pointer-events-none"
            >
              <div 
                ref={playheadLineRef}
                className="absolute top-0 bottom-0 w-[1.5px] bg-white/45 pointer-events-none"
                style={{ 
                  left: `${(currentTime / duration) * 100}%`
                }}
              >
                {/* Cabeça grossa da agulha apontando para baixo (Estilo Moises/Audacity) posicionada na régua */}
                <div 
                  className="absolute bg-white border border-brand-gray/40 rounded-sm shadow-md"
                  style={{ 
                    width: '14px', 
                    height: '16px', 
                    top: '10px',
                    left: '-6.25px',
                    clipPath: 'polygon(0% 0%, 100% 0%, 100% 60%, 50% 100%, 0% 60%)' 
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Linha do Tempo (Ruler de Compasso superior) */}
        <div className="h-9 border-b border-brand-hover flex relative select-none shrink-0 px-4 md:px-6" style={{ background: '#141414' }}>
          {/* Header de Canto (Alinhado com a largura do painel esquerdo) */}
          <div className={`${isSidebarCollapsed ? 'w-12 justify-center' : 'w-[240px] px-3 justify-between'} border-r border-brand-hover shrink-0 flex items-center transition-all duration-200 gap-1 text-[9px] font-black text-brand-gray tracking-wider uppercase`}>
            {!isSidebarCollapsed && (
              <span className="truncate">Canais / Pistas</span>
            )}

            <button
              onClick={() => setIsSidebarCollapsed(prev => !prev)}
              className="p-1 rounded bg-brand-hover/60 hover:bg-brand-hover text-brand-gray hover:text-white transition-all cursor-pointer shrink-0"
              title={isSidebarCollapsed ? 'Expandir Controles' : 'Colapsar Controles (Modo Waveform)'}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="w-3.5 h-3.5 text-brand-green" />
              ) : (
                <PanelLeftClose className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
          
          {/* Régua de Tempo (Scrollable Wrapper) */}
          <div 
            ref={rulerScrollRef}
            onScroll={handleHorizontalScroll}
            className="flex-1 overflow-x-auto overflow-y-hidden ruler-scroll"
          >
            <div 
              ref={tracksTimelineRef}
              onMouseDown={handleMouseDownTimeline}
              onTouchStart={handleTouchStartTimeline}
              style={{ width: `${zoomLevel * 100}%` }}
              className="h-full relative cursor-ew-resize select-none"
            >
              {/* Ticks estéticos de segundos na régua */}
              <div className="absolute inset-0 select-none">
                {ticks.map((tickTime, idx) => (
                  <div 
                    key={idx} 
                    className="absolute top-0 bottom-0 flex flex-col justify-between items-center py-1 text-[9px] font-mono font-bold text-brand-gray/60"
                    style={{ left: `${(tickTime / duration) * 100}%`, transform: 'translateX(-50%)' }}
                  >
                    <span>{formatTime(tickTime)}</span>
                    <div className="w-[1px] h-1.5 bg-brand-gray/30" />
                  </div>
                ))}
              </div>

              {/* Linhas de Grid verticais em segundo plano para o restante da DAW */}
              <div className="absolute inset-0 pointer-events-none opacity-[0.03]">
                {ticks.map((tickTime, idx) => (
                  <div 
                    key={idx}
                    className="absolute top-0 bottom-0 border-l border-white"
                    style={{ left: `${(tickTime / duration) * 100}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Corpo Principal das Faixas (Scrollable) */}
        <div className="flex-1 overflow-y-auto relative px-4 md:px-6">

          {/* Renderização de Linhas (Tracks) */}
          <div className="flex flex-col gap-2 py-3">
            {sortedStems.map((stem, idx) => {
              const stemName = stem.StemType;
              const volume = stemsVolume[stemName] ?? (stemName === 'Metrônomo' ? 0.0 : 1.0);
              const isMuted = stemsMute[stemName] ?? false;
              const isSoloed = stemsSolo[stemName] ?? false;
              const pan = stemsPan[stemName] ?? 0.0;
              const mono = isMonoStem(stemName);

              // Regra de Solo: Se houver qualquer canal em Solo, os demais silenciam (ficam opacos)
              const hasAnySolo = Object.values(stemsSolo).some(v => v);
              const isSilenced = hasAnySolo ? !isSoloed : isMuted;

              return (
                <div 
                  key={stem.StemId} 
                  className={`flex items-stretch transition-all duration-200 ${
                    !isSidebarCollapsed && expandedStems[stemName] ? 'h-40' : 'h-22'
                  } ${
                    isSilenced ? 'opacity-40' : ''
                  }`}
                >
                  
                  {/* PISTA ESQUERDA: Console de Controles (Faders e Panning) */}
                  {isSidebarCollapsed ? (
                    <div className="w-12 pr-2 border-r border-brand-hover/40 h-full flex flex-col items-center justify-center gap-1.5 shrink-0 select-none transition-all duration-200">
                      <span className="text-[9px] font-black text-brand-green uppercase tracking-tighter text-center truncate w-full">
                        {getStemAbbreviation(stemName)}
                      </span>
                      <div className="flex flex-col items-center gap-1">
                        <button
                          onClick={() => toggleStemMute(stemName)}
                          className={`w-4 h-4 rounded-[2px] flex items-center justify-center text-[8px] font-black transition-all border cursor-pointer ${
                            isMuted
                              ? 'bg-red-600 text-white border-red-600'
                              : 'bg-[#222] hover:bg-red-600/70 hover:text-white text-brand-gray border-transparent'
                          }`}
                          title="Mute"
                        >
                          M
                        </button>
                        <button
                          onClick={() => toggleStemSolo(stemName)}
                          className={`w-4 h-4 rounded-[2px] flex items-center justify-center text-[8px] font-black transition-all border cursor-pointer ${
                            isSoloed
                              ? 'bg-amber-400 text-black border-amber-400'
                              : 'bg-[#222] hover:bg-amber-400/80 hover:text-black text-brand-gray border-transparent'
                          }`}
                          title="Solo"
                        >
                          S
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-[240px] pr-4 flex flex-col justify-between py-2 shrink-0 select-none transition-all duration-200 h-full border-r border-brand-hover/40 bg-[#121212]/30">
                      {/* Linha Superior: Botões M/S/FX + Nome e Panning */}
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        {/* M/S/FX + Nome */}
                        <div className="flex items-center gap-1 select-none min-w-0 flex-1">
                          <button
                            onClick={() => toggleStemMute(stemName)}
                            className={`w-5 h-5 rounded-[3px] flex items-center justify-center text-[9px] font-black transition-all border cursor-pointer shrink-0 ${
                              isMuted
                                ? 'bg-red-600 text-white border-red-600'
                                : 'bg-[#222] hover:bg-red-600/70 hover:text-white hover:border-red-600/70 text-brand-gray border-transparent'
                            }`}
                            title="Mute"
                          >
                            M
                          </button>
                          <button
                            onClick={() => toggleStemSolo(stemName)}
                            className={`w-5 h-5 rounded-[3px] flex items-center justify-center text-[9px] font-black transition-all border cursor-pointer shrink-0 ${
                              isSoloed
                                ? 'bg-amber-400 text-black border-amber-400'
                                : 'bg-[#222] hover:bg-amber-400/80 hover:text-black hover:border-amber-400/80 text-brand-gray border-transparent'
                            }`}
                            title="Solo"
                          >
                            S
                          </button>
                          {stemName !== 'Metrônomo' && (
                            <button
                              onClick={() => toggleStemExpanded(stemName)}
                              className={`w-5 h-5 rounded-[3px] flex items-center justify-center text-[9px] font-black transition-all border cursor-pointer shrink-0 ${
                                stemsReverbEnabled[stemName]
                                  ? 'bg-amber-400 text-black border-amber-400 hover:bg-amber-400/80 hover:border-amber-400/80'
                                  : expandedStems[stemName]
                                  ? 'bg-brand-green text-black border-brand-green hover:bg-brand-green'
                                  : 'bg-[#222] hover:bg-brand-hover text-brand-gray border-transparent'
                              }`}
                              title="Efeitos (FX)"
                            >
                              FX
                            </button>
                          )}
                          <span className="text-[11px] font-black tracking-wide text-white uppercase truncate ml-1">{stemName}</span>
                        </div>

                        {/* Panning/Mono */}
                        <div className="shrink-0 flex items-center justify-center min-w-[48px]">
                          {!mono ? (
                            <div className="flex flex-col items-center select-none shrink-0 relative">
                              <RotaryKnob 
                                value={pan}
                                onChange={(val) => setStemPan(stemName, val)}
                                size={32}
                                hideLabels={true}
                              />
                            </div>
                          ) : (
                            <div className="flex flex-col items-center select-none" style={{ width: 48 }}>
                              <span className="text-[8px] font-bold text-brand-gray/25 uppercase tracking-widest leading-none border border-dashed border-[#222] rounded p-1 text-center">MONO</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Linha do Meio: Volume Fader */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Volume2 className="w-3.5 h-3.5 text-brand-gray shrink-0" />
                        <input
                          type="range"
                          min="0"
                          max="1.5"
                          step="0.05"
                          value={volume}
                          onChange={(e) => setStemVolume(stemName, parseFloat(e.target.value))}
                          className="w-full fader-input appearance-none bg-transparent cursor-pointer"
                          style={{ '--slider-progress': `${(volume / 1.5) * 100}%` } as React.CSSProperties}
                        />
                      </div>

                      {/* Painel FX Reverb Expandidor */}
                      {expandedStems[stemName] && (
                        <div className="mt-1 pt-1.5 border-t border-brand-hover/30 flex flex-col gap-1 text-[9px] text-brand-gray select-none animate-in fade-in duration-200">
                          {/* Reverb Toggle */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 font-bold text-white">
                              <Wand2 className="w-3 h-3 text-brand-green" />
                              <span>Reverb</span>
                            </div>
                            <button
                              onClick={() => setStemReverbEnabled(stemName, !(stemsReverbEnabled[stemName] ?? false))}
                              className={`px-1.5 py-0.5 rounded text-[7px] font-extrabold tracking-wider uppercase transition-all border cursor-pointer ${
                                stemsReverbEnabled[stemName]
                                  ? 'bg-brand-green text-black border-brand-green hover:bg-brand-green'
                                  : 'bg-[#222] text-brand-gray border-brand-hover hover:text-white'
                              }`}
                            >
                              {stemsReverbEnabled[stemName] ? 'ON' : 'OFF'}
                            </button>
                          </div>

                          {/* Reverb Parametros (Wet e Ambientes) */}
                          {stemsReverbEnabled[stemName] && (
                            <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-1 duration-150">
                              <div className="flex flex-col gap-0.5">
                                <div className="flex justify-between items-center text-[8px] text-brand-gray/80">
                                  <span>Intensidade (Mix)</span>
                                  <span className="font-mono">{Math.round((stemsReverbWet[stemName] ?? 0.0) * 100)}%</span>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="1.0"
                                  step="0.05"
                                  value={stemsReverbWet[stemName] ?? 0.0}
                                  onChange={(e) => setStemReverbWet(stemName, parseFloat(e.target.value))}
                                  className="w-full accent-brand-green dynamic-progress h-0.5 rounded appearance-none cursor-pointer"
                                  style={{ '--slider-progress': `${(stemsReverbWet[stemName] ?? 0.0) * 100}%` } as React.CSSProperties}
                                />
                              </div>

                              <div className="flex gap-0.5">
                                {(['room', 'hall', 'cathedral'] as const).map(p => (
                                  <button
                                    key={p}
                                    onClick={() => setStemReverbRoom(stemName, p)}
                                    className={`flex-1 py-0.5 rounded text-[7px] font-bold border transition-all cursor-pointer capitalize text-center ${
                                      (stemsReverbRoom[stemName] ?? 'hall') === p
                                        ? 'bg-brand-green/20 text-brand-green border-brand-green'
                                        : 'bg-[#222] text-brand-gray border-transparent hover:bg-brand-hover hover:text-white'
                                    }`}
                                  >
                                    {p === 'room' ? 'Sala' : p === 'hall' ? 'Salão' : 'Catedral'}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* PISTA DIREITA: Canvas de Waveform com fundo fosco sólido em pílulas individuais (Scrollable) */}
                  <div 
                    ref={(el) => { trackScrollRefs.current[idx] = el; }}
                    onScroll={handleHorizontalScroll}
                    className="flex-1 h-full overflow-x-auto overflow-y-hidden scrollbar-none rounded-[8px] bg-[#1db954] select-none shadow-[0_1px_3px_rgba(0,0,0,0.3)] border border-[#1aa34a]/10 relative ml-2"
                  >
                    <div 
                      onClick={(e) => {
                        if (!tracksTimelineRef.current || !duration) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const offsetX = e.clientX - rect.left;
                        const percent = Math.max(0, Math.min(1.0, offsetX / rect.width));
                        seek(percent * duration);
                      }}
                      style={{ width: `${zoomLevel * 100}%` }}
                      className="h-full relative cursor-pointer"
                    >
                      {/* Linha Central sutil do track de fundo */}
                      <div className="absolute left-0 right-0 h-[1px] bg-brand-hover/10 top-1/2 z-10 pointer-events-none" />

                      {/* Linhas de Grade verticais em segundo plano para cada trilha */}
                      <div className="absolute inset-0 pointer-events-none opacity-[0.05] z-10">
                        {ticks.map((tickTime, tIdx) => (
                          <div 
                            key={tIdx}
                            className="absolute top-0 bottom-0 border-l border-black"
                            style={{ left: `${(tickTime / duration) * 100}%` }}
                          />
                        ))}
                      </div>

                      {/* Canvas com a waveform desenhada */}
                      <canvas 
                        id={`canvas-${stemName}`}
                        className="w-full h-full block relative z-20 bg-transparent"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* Adições estéticas globais de estilo do console analógico */}
      <style>{`
        /* Estilização Premium do Slider Fader Estilo Console Analógico */
        input[type="range"].fader-input {
          -webkit-appearance: none;
          background: transparent;
          width: 100%;
        }
        input[type="range"].fader-input:focus {
          outline: none;
        }
        /* Trilha */
        input[type="range"].fader-input::-webkit-slider-runnable-track {
          height: 3px;
          background: linear-gradient(to right, #1db954 0%, #1db954 var(--slider-progress, 0%), #1e1e1e var(--slider-progress, 0%), #1e1e1e 100%);
          border: 1px solid #282828;
          border-radius: 1px;
        }
        input[type="range"].fader-input::-moz-range-track {
          height: 3px;
          background: linear-gradient(to right, #1db954 0%, #1db954 var(--slider-progress, 0%), #1e1e1e var(--slider-progress, 0%), #1e1e1e 100%);
          border: 1px solid #282828;
          border-radius: 1px;
        }
        /* Botão Fader Retangular (Thumb) */
        input[type="range"].fader-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 18px;
          width: 11px;
          background: #3e3e3e;
          border: 1.5px solid #5a5a5a;
          border-radius: 2px;
          cursor: pointer;
          margin-top: -8px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.6);
          /* Linha de centro indicadora do fader */
          background-image: linear-gradient(to right, transparent 4px, #1db954 4px, #1db954 5.5px, transparent 5.5px);
        }
        input[type="range"].fader-input::-moz-range-thumb {
          height: 16px;
          width: 10px;
          background: #3e3e3e;
          border: 1.5px solid #5a5a5a;
          border-radius: 2px;
          cursor: pointer;
          box-shadow: 0 1px 3px rgba(0,0,0,0.6);
          background-image: linear-gradient(to right, transparent 3.5px, #1db954 3.5px, #1db954 5px, transparent 5px);
        }

        /* Custom scrollbar para a régua */
        .ruler-scroll::-webkit-scrollbar {
          height: 4px;
        }
        .ruler-scroll::-webkit-scrollbar-track {
          background: #141414;
        }
        .ruler-scroll::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 2px;
        }
        .ruler-scroll::-webkit-scrollbar-thumb:hover {
          background: #1db954;
        }
        
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

    </div>
  );
};
