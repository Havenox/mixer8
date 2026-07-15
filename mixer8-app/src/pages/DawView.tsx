import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { RotaryKnob } from '../components/RotaryKnob';
import { 
  ChevronLeft, Play, Pause, Loader2, 
  ShieldAlert, Sliders, Volume2, 
  Disc, Music4
} from 'lucide-react';
import { API_URL, SERVER_URL } from '../config';

export const DawView: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    stemsVolume,
    stemsMute,
    stemsSolo,
    stemsPan,
    togglePlay,
    seek,
    setStemVolume,
    toggleStemMute,
    toggleStemSolo,
    setStemPan
  } = usePlayer();

  const [waveforms, setWaveforms] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const tracksTimelineRef = useRef<HTMLDivElement>(null);
  const isDraggingPlayhead = useRef(false);

  // Monitora largura da tela para responsividade síncrona
  const [isDesktopOrTablet, setIsDesktopOrTablet] = useState(window.innerWidth >= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktopOrTablet(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  // Lógica de Renderização das Waveforms nos Canvas (Estática)
  useEffect(() => {
    if (loading || Object.keys(waveforms).length === 0 || !currentTrack) return;

    const renderAllCanvas = () => {
      const activeStemsList = currentTrack.Stems || [];
      activeStemsList.forEach(stem => {
        const canvas = document.getElementById(`canvas-${stem.StemType}`) as HTMLCanvasElement;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const points = waveforms[stem.StemType] || [];
        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;

        // Ajusta pixel ratio do canvas para alta resolução
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        // Fundo transparente
        ctx.clearRect(0, 0, width, height);

        if (points.length === 0) {
          // Linha central preta se não houver dados
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
          const amplitude = (absVal / 100.0) * (height * 0.42); // Máximo de 84% da altura
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
    };

    renderAllCanvas();

    // Redesenha no redimensionamento da janela
    const handleResize = () => {
      renderAllCanvas();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [waveforms, loading, currentTrack]);

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

  // 1. Verificação de Tela Grande (Habilitado apenas para Desktop/Tablet)
  if (!isDesktopOrTablet) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 min-h-[70vh] gap-6 bg-brand-dark rounded-xl border border-brand-hover select-none animate-in fade-in duration-300">
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-full">
          <ShieldAlert className="w-12 h-12" />
        </div>
        <div className="flex flex-col gap-2 max-w-[420px]">
          <h2 className="text-xl font-black text-white uppercase tracking-wider">Modo DAW Indisponível</h2>
          <p className="text-xs text-brand-gray leading-relaxed">
            O Estúdio DAW exige uma resolução horizontal maior (PC ou Tablet) para renderizar todas as pistas de áudio e waveforms de forma útil.
          </p>
        </div>
        <button 
          onClick={() => navigate('/dashboard')}
          className="py-2 px-5 bg-brand-hover hover:bg-brand-hover/80 text-white rounded font-bold text-xs transition-all border border-brand-hover cursor-pointer"
        >
          Voltar para a Biblioteca
        </button>
      </div>
    );
  }

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
          onClick={() => navigate('/dashboard')}
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
      
      {/* 1. TOPO: Identificação e Ações da Faixa */}
      <div className="flex items-center justify-between px-6 py-4 bg-black/40 border-b border-brand-hover shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 rounded-full border border-brand-hover text-brand-gray hover:text-white hover:border-white transition-all cursor-pointer"
            title="Voltar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          {/* Cover e Título */}
          <div className="flex items-center gap-3">
            {currentTrack.CoverUrl ? (
              <img 
                src={currentTrack.CoverUrl.startsWith('http') ? currentTrack.CoverUrl : `${SERVER_URL}${currentTrack.CoverUrl}`}
                className="w-10 h-10 rounded object-cover border border-brand-hover shadow-md"
                alt="Capa"
              />
            ) : (
              <div className="w-10 h-10 rounded bg-brand-hover border border-brand-hover flex items-center justify-center text-brand-green">
                <Music4 className="w-5 h-5" />
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-sm font-black text-white tracking-wider max-w-[320px] truncate">{currentTrack.TrackTitle}</span>
              <span className="text-xs text-brand-gray font-semibold truncate max-w-[320px]">{currentTrack.ArtistName}</span>
            </div>
          </div>
        </div>

        {/* Informações Auxiliares (Design de DAW) */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/20 border border-brand-hover rounded-md text-[10px] font-bold text-brand-green tracking-wide">
            <Sliders className="w-3.5 h-3.5" />
            <span>SESSÃO MULTIFAIXAS ({sortedStems.length} STEMS)</span>
          </div>
          
          <button 
            onClick={togglePlay}
            className="flex items-center justify-center p-2.5 bg-brand-green text-black hover:scale-105 active:scale-95 transition-all rounded-full cursor-pointer shadow-lg"
          >
            {isPlaying ? <Pause className="w-4.5 h-4.5" fill="black" /> : <Play className="w-4.5 h-4.5" fill="black" />}
          </button>
        </div>
      </div>

      {/* 2. AREA CENTRAL: DAW Workstation */}
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
            className="absolute left-[264px] right-6 top-0 bottom-0 pointer-events-none z-30"
          >
            <div 
              className="absolute top-0 bottom-0 w-[1.5px] bg-white/45 pointer-events-none"
              style={{ 
                left: `${(currentTime / duration) * 100}%`,
                transition: isDraggingPlayhead.current ? 'none' : 'left 80ms linear'
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
        )}

        {/* Linha do Tempo (Ruler de Compasso superior) */}
        <div className="h-9 border-b border-brand-hover flex relative select-none shrink-0 px-6" style={{ background: '#141414' }}>
          {/* Header de Canto (Alinhado com a largura do painel esquerdo) */}
          <div className="w-[240px] border-r border-brand-hover shrink-0 flex items-center pr-4 text-[9px] font-black text-brand-gray tracking-wider uppercase">
            Canais / Pistas
          </div>
          
          {/* Régua de Tempo */}
          <div 
            ref={tracksTimelineRef}
            onMouseDown={handleMouseDownTimeline}
            onTouchStart={handleTouchStartTimeline}
            className="flex-1 relative cursor-ew-resize overflow-hidden"
          >
            {/* Ticks estéticos de segundos na régua */}
            <div className="absolute inset-0 flex justify-between px-2 text-[9px] font-mono font-bold text-brand-gray/60 items-center">
              <span>0:00</span>
              {duration > 0 && (
                <>
                  <span>{formatTime(duration * 0.25)}</span>
                  <span>{formatTime(duration * 0.5)}</span>
                  <span>{formatTime(duration * 0.75)}</span>
                  <span>{formatTime(duration)}</span>
                </>
              )}
            </div>

            {/* Linhas de Grid verticais em segundo plano para o restante da DAW */}
            <div className="absolute inset-0 flex justify-between pointer-events-none opacity-[0.03]">
              <div className="border-l border-white h-full" />
              <div className="border-l border-white h-full" style={{ left: '25%' }} />
              <div className="border-l border-white h-full" style={{ left: '50%' }} />
              <div className="border-l border-white h-full" style={{ left: '75%' }} />
              <div className="border-l border-white h-full" style={{ left: '100%' }} />
            </div>
          </div>
        </div>

        {/* Corpo Principal das Faixas (Scrollable) */}
        <div className="flex-1 overflow-y-auto relative px-6">

          {/* Renderização de Linhas (Tracks) */}
          <div className="flex flex-col gap-2 py-3">
            {sortedStems.map((stem) => {
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
                  className={`h-22 flex items-center transition-all duration-200 ${
                    isSilenced ? 'opacity-40' : ''
                  }`}
                >
                  
                  {/* PISTA ESQUERDA: Console de Controles (Faders e Panning) */}
                  <div className="w-[240px] pr-4 flex items-center justify-between gap-4 shrink-0 select-none">
                    {/* Coluna 1: M/S + Nome (Topo) e Slider Volume (Base) */}
                    <div className="flex-1 flex flex-col gap-2 min-w-0">
                      {/* Mute/Solo + Nome do Canal */}
                      <div className="flex items-center gap-1.5 select-none">
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
                        <span className="text-[11px] font-black tracking-wide text-white uppercase truncate ml-1">{stemName}</span>
                      </div>

                      {/* Fader de Volume */}
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
                        />
                      </div>
                    </div>

                    {/* Coluna 2: Panning Knob (L/R) ou MONO */}
                    <div className="shrink-0 flex items-center justify-center min-w-[50px]">
                      {!mono ? (
                        <div className="flex flex-col items-center select-none shrink-0 relative">
                          <RotaryKnob 
                            value={pan}
                            onChange={(val) => setStemPan(stemName, val)}
                            size={36}
                            hideLabels={true}
                          />
                          <div className="flex justify-between w-[48px] text-[8px] font-black text-brand-gray/50 mt-0.5 leading-none">
                            <span>L</span>
                            <span>R</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center select-none" style={{ width: 50 }}>
                          <span className="text-[8px] font-bold text-brand-gray/25 uppercase tracking-widest leading-none border border-dashed border-[#222] rounded p-1.5 px-2 text-center">MONO</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PISTA DIREITA: Canvas de Waveform com fundo fosco sólido em pílulas individuais */}
                  <div 
                    onClick={(e) => {
                      if (!tracksTimelineRef.current || !duration) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const offsetX = e.clientX - rect.left;
                      const percent = Math.max(0, Math.min(1.0, offsetX / rect.width));
                      seek(percent * duration);
                    }}
                    className="flex-1 h-full relative cursor-pointer overflow-hidden rounded-[8px] bg-[#1db954] select-none shadow-[0_1px_3px_rgba(0,0,0,0.3)] border border-[#1aa34a]/10"
                  >
                    {/* Linha Central sutil do track de fundo */}
                    <div className="absolute left-0 right-0 h-[1px] bg-brand-hover/10 top-1/2 z-10 pointer-events-none" />
                    
                    {/* Linhas de Grade Surtidas de Fundo */}
                    <div className="absolute inset-0 flex justify-between pointer-events-none opacity-[0.015] z-10">
                      <div className="border-l border-white h-full" />
                      <div className="border-l border-white h-full" style={{ left: '25%' }} />
                      <div className="border-l border-white h-full" style={{ left: '50%' }} />
                      <div className="border-l border-white h-full" style={{ left: '75%' }} />
                      <div className="border-l border-white h-full" style={{ left: '100%' }} />
                    </div>

                    <canvas 
                      id={`canvas-${stemName}`}
                      className="w-full h-full block relative z-20 bg-transparent"
                    />
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
          background: #1e1e1e;
          border: 1px solid #282828;
          border-radius: 1px;
        }
        input[type="range"].fader-input::-moz-range-track {
          height: 3px;
          background: #1e1e1e;
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
      `}</style>

    </div>
  );
};
