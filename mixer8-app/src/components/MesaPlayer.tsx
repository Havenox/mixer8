import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, 
  Sliders, RefreshCw, Disc, Music, ChevronDown,
  Shuffle, Repeat, Repeat1, Clock, Activity, X
} from 'lucide-react';

import { SERVER_URL } from '../config';
import { transposeChord } from '../hooks/useLyricsChords';
import type { IChordBeat } from '../hooks/useLyricsChords';

export const MesaPlayer: React.FC = () => {
  const { 
    currentTrack, 
    currentPlaylistId,
    currentPlaylistName,
    isPlaying, 
    currentTime, 
    duration, 
    stemsVolume, 
    stemsMute,
    stemsSolo,
    masterVolume,
    togglePlay, 
    seek, 
    setStemVolume,
    toggleStemMute,
    toggleStemSolo,
    setMasterVolume,
    playNextTrack,
    playPreviousTrack,
    isShuffle,
    repeatMode,
    toggleShuffle,
    toggleRepeatMode,
    transpose,
    activeOverlay,
    setActiveOverlay
  } = usePlayer();

  const navigate = useNavigate();

  const [chords, setChords] = useState<IChordBeat[] | null>(null);
  const [showMixer, setShowMixer] = useState(false);
  const mixerRef = useRef<HTMLDivElement>(null);

  // Fecha o popup do mixer ao clicar fora dele
  useEffect(() => {
    if (!showMixer) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (mixerRef.current && !mixerRef.current.contains(target) && !target.closest('.mixer-trigger-btn')) {
        setShowMixer(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMixer]);

  // Carrega as cifras (chords.json) quando a faixa atual for alterada
  useEffect(() => {
    setChords(null);
    if (!currentTrack?.TrackId) return;

    let isMounted = true;
    const fetchChords = async () => {
      try {
        const response = await fetch(`${SERVER_URL}/stems/${currentTrack.TrackId}/chords.json`);
        if (response.ok) {
          const data = await response.json();
          if (isMounted) {
            setChords(data);
          }
        }
      } catch (e) {
        console.warn("Chords not available for this track:", e);
      }
    };
    fetchChords();
    return () => {
      isMounted = false;
    };
  }, [currentTrack?.TrackId]);

  // Calcula o acorde ativo com base estrita no tempo e na transposição atual
  const currentChord = useMemo(() => {
    if (!chords || chords.length === 0) return '';
    let activeBeat = chords[0];
    for (let i = 0; i < chords.length; i++) {
      if (chords[i].curr_beat_time <= currentTime) {
        activeBeat = chords[i];
      } else {
        break;
      }
    }
    const rawChord = activeBeat && activeBeat.chord_simple_pop !== 'N' 
      ? activeBeat.chord_simple_pop 
      : '';
    return rawChord ? transposeChord(rawChord, transpose) : '';
  }, [chords, currentTime, transpose]);

  const [sliderValue, setSliderValue] = useState<number | null>(null);

  const displayTime = sliderValue ?? currentTime;
  const progressPercent = (displayTime / (duration || 1)) * 100;

  // Atalhos globais de teclado (Espaço para play/pause, Setas Esquerda/Direita para +/- 1s)
  const stateRef = useRef({ currentTime, duration });
  useEffect(() => {
    stateRef.current = { currentTime, duration };
  }, [currentTime, duration]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seek(Math.max(0, stateRef.current.currentTime - 1));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seek(Math.min(stateRef.current.duration || 0, stateRef.current.currentTime + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [togglePlay, seek]);

  // Se nenhuma música foi carregada ainda, o player fica 100% oculto no rodapé (Zero Mocks)
  if (!currentTrack) {
    return null;
  }

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs === 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Presets rápidos para as stems
  const applyPreset = (preset: 'acapella' | 'karaoke' | 'instrumental' | 'reset') => {
    if (!currentTrack.Stems) return;

    currentTrack.Stems.forEach(stem => {
      const type = stem.StemType;
      
      switch (preset) {
        case 'acapella':
          // Apenas Voz e Vocal ligados, resto zerado (mantém compatibilidade com o legado 'Vocais')
          setStemVolume(type, (type === 'Voz' || type === 'Vocal' || type === 'Vocais') ? 1.0 : 0.0);
          break;
        case 'karaoke':
        case 'instrumental':
          // Voz/Vocal desligados, metrônomo desligado, resto ligado
          setStemVolume(type, (type === 'Voz' || type === 'Vocal' || type === 'Vocais' || type === 'Metrônomo') ? 0.0 : 1.0);
          break;
        case 'reset':
          // Todos os canais retornados para o default (1.0, e metronomo a 0.0)
          setStemVolume(type, type === 'Metrônomo' ? 0.0 : 1.0);
          break;
      }
    });
  };

  const hasMultipleStems = currentTrack.Stems && currentTrack.Stems.length > 1;
  const isProcessingOrSingleStem = !!(currentTrack.ExtractionStatus?.startsWith('Processando') || 
    currentTrack.ExtractionStatus === 'Falhou' ||
    (currentTrack.Stems && currentTrack.Stems.length === 1 && currentTrack.Stems[0].StemType === 'Completo'));

  return (
    <>
      {/* 1. DESKTOP AUDIO PLAYER */}
      <div className="fixed bottom-0 left-0 right-0 h-24 bg-brand-black border-t border-brand-hover px-3 md:px-6 hidden md:flex items-center justify-between z-50 shadow-2xl animate-in slide-in-from-bottom duration-300">
        
        {/* Esquerda: Info da Música Real */}
        <div className="flex items-center gap-2.5 md:gap-4 flex-1 md:flex-none min-w-0 md:w-1/4 md:min-w-[200px]">
          <div 
            onClick={() => {
              setActiveOverlay(prev => prev === 'lyrics' ? 'none' : 'lyrics');
            }}
            className="w-10 h-10 md:w-14 md:h-14 bg-brand-card border border-brand-hover rounded flex items-center justify-center relative overflow-hidden group shadow-lg shrink-0 cursor-pointer"
            title="Abrir Letras & Cifras"
          >
            {currentTrack.CoverUrl ? (
              <img 
                src={currentTrack.CoverUrl.startsWith('http') ? currentTrack.CoverUrl : `${SERVER_URL}${currentTrack.CoverUrl}`} 
                alt="Capa" 
                className="w-full h-full object-cover"
              />
            ) : (
              <Disc className={`w-6 h-6 md:w-8 md:h-8 text-brand-green ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
            )}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Music className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
          </div>
          <div className="flex flex-col truncate max-w-[80px] xs:max-w-[120px] md:max-w-[150px]">
            <span 
              onClick={() => togglePlay()}
              className="text-xs md:text-sm font-semibold text-white hover:underline cursor-pointer truncate leading-tight"
            >
              {currentTrack.TrackTitle}
            </span>
            <span 
              onClick={() => navigate(`/library?search=${encodeURIComponent(currentTrack.ArtistName)}`)}
              className="text-[10px] md:text-xs text-brand-gray/80 hover:text-white cursor-pointer hover:underline truncate mt-0.5 leading-none"
            >
              {currentTrack.ArtistName}
            </span>
          </div>
          <div className={`hidden sm:flex ${currentChord ? 'flex-col gap-1 items-start justify-center' : 'items-center justify-center'} shrink-0`}>
            <div className="px-2 py-0.5 bg-brand-hover text-[9px] text-brand-green font-bold rounded uppercase tracking-wider border border-brand-green/20 select-none">
              {currentTrack.Stems?.length || 0} Stems
            </div>
            {currentChord && (
              <div className="px-1.5 py-0.5 bg-brand-green/10 text-[9px] text-brand-green font-bold rounded tracking-wider border border-brand-green/30 select-none">
                {currentChord}
              </div>
            )}
          </div>
        </div>

        {/* Centro: Controles de Player Sincronizado */}
        <div className="flex flex-col items-center gap-1 md:gap-2 flex-[2] md:flex-1 max-w-[600px] w-full min-w-0 px-2">
          {/* Botões do Player */}
          <div className="flex items-center gap-4 md:gap-6">
            {/* Shuffle (Aleatório) */}
            <button 
              onClick={toggleShuffle}
              className={`transition-colors cursor-pointer flex flex-col items-center justify-center relative p-1 ${
                isShuffle 
                  ? 'text-brand-green hover:text-brand-green/80' 
                  : 'text-brand-gray hover:text-white'
              }`}
              title={isShuffle ? 'Desativar modo aleatório' : 'Ativar modo aleatório'}
            >
              <Shuffle className="w-4 h-4 md:w-[18px] md:h-[18px]" />
              {isShuffle && (
                <span className="absolute -bottom-1 w-[3px] h-[3px] bg-brand-green rounded-full shadow-[0_0_8px_#1db954]" />
              )}
            </button>

            <button 
              onClick={playPreviousTrack}
              className="text-brand-gray hover:text-white transition-colors cursor-pointer"
              title="Música anterior"
            >
              <SkipBack className="w-4 h-4 md:w-5 md:h-5 fill-current" />
            </button>
            
            <button 
              onClick={togglePlay}
              className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer shadow-lg shrink-0"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 md:w-5 md:h-5 fill-current" />
              ) : (
                <Play className="w-4 h-4 md:w-5 md:h-5 fill-current translate-x-[0.5px] md:translate-x-[1px]" />
              )}
            </button>
            
            <button 
              onClick={playNextTrack}
              className="text-brand-gray hover:text-white transition-colors cursor-pointer"
              title="Próxima música"
            >
              <SkipForward className="w-4 h-4 md:w-5 md:h-5 fill-current" />
            </button>

            {/* Repeat (Repetição) */}
            <button 
              onClick={toggleRepeatMode}
              className={`transition-colors cursor-pointer flex flex-col items-center justify-center relative p-1 ${
                repeatMode !== 'off'
                  ? 'text-brand-green hover:text-brand-green/80' 
                  : 'text-brand-gray hover:text-white'
              }`}
              title={
                repeatMode === 'one' 
                  ? 'Repetir uma faixa' 
                  : repeatMode === 'all' 
                    ? 'Repetir a lista toda' 
                    : 'Não repetir'
              }
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-4 h-4 md:w-[18px] md:h-[18px]" />
              ) : (
                <Repeat className="w-4 h-4 md:w-[18px] md:h-[18px]" />
              )}
              {repeatMode !== 'off' && (
                <span className="absolute -bottom-1 w-[3px] h-[3px] bg-brand-green rounded-full shadow-[0_0_8px_#1db954]" />
              )}
            </button>
          </div>

          {/* Progress Bar com Click/Arrasto e Bolinha Premium */}
          <div className="flex items-center gap-2 md:gap-3 w-full text-[10px] md:text-xs text-brand-gray select-none">
            <span className="w-6 md:w-8 text-right shrink-0">{formatTime(displayTime)}</span>
            <input 
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={displayTime}
              onChange={(e) => setSliderValue(parseFloat(e.target.value))}
              onMouseUp={(e) => {
                const val = parseFloat((e.target as HTMLInputElement).value);
                seek(val);
                setSliderValue(null);
                (e.target as HTMLInputElement).blur();
              }}
              onTouchEnd={(e) => {
                const val = parseFloat((e.target as HTMLInputElement).value);
                seek(val);
                setSliderValue(null);
                (e.target as HTMLInputElement).blur();
              }}
              onKeyDown={(e) => {
                if (['ArrowLeft', 'ArrowRight', ' ', 'Spacebar'].includes(e.key)) {
                  e.preventDefault();
                }
              }}
              className="flex-1 accent-brand-green dynamic-progress h-1 md:h-1.5 rounded-lg appearance-none cursor-pointer min-w-0"
              style={{ '--slider-progress': `${progressPercent}%` } as React.CSSProperties}
            />
            <span className="w-6 md:w-8 shrink-0">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Direita: Mixagem DAW & Volume Geral */}
        <div className="flex items-center gap-2 md:gap-4 flex-1 md:flex-none md:w-1/4 justify-end min-w-0 md:min-w-[220px] relative select-none">
          
          {/* Botão de Estúdio DAW (PC/Tablet) */}
          <button 
            onClick={() => {
              setActiveOverlay(prev => prev === 'daw' ? 'none' : 'daw');
            }}
            className={`hidden md:flex items-center justify-center p-2 rounded-full border transition-all cursor-pointer shrink-0 ${
              activeOverlay === 'daw'
                ? 'bg-brand-green/10 border-brand-green text-brand-green shadow-md font-bold'
                : 'border-brand-hover text-brand-gray hover:text-white hover:border-white'
            }`}
            title="Estúdio DAW (PC/Tablet)"
          >
            <Activity className="w-4 h-4 shrink-0" />
          </button>

          {/* Botão de Mixer se houver múltiplas stems ou estiver em processamento */}
          {(hasMultipleStems || isProcessingOrSingleStem) && (
            <button 
              onClick={() => setShowMixer(!showMixer)}
              className={`mixer-trigger-btn flex items-center justify-center p-2 rounded-full border transition-all cursor-pointer shrink-0 ${
                showMixer 
                  ? 'bg-brand-green/10 border-brand-green text-brand-green shadow-md' 
                  : 'border-brand-hover text-brand-gray hover:text-white hover:border-white'
              }`}
              title="Mixer de Som"
            >
              <Sliders className="w-4 h-4 shrink-0" />
            </button>
          )}

          {/* Botão de Letras / Cifras */}
          <button 
            onClick={() => {
              setActiveOverlay(prev => prev === 'lyrics' ? 'none' : 'lyrics');
            }}
            className={`flex items-center justify-center p-2 rounded-full border transition-all cursor-pointer shrink-0 ${
              activeOverlay === 'lyrics'
                ? 'bg-brand-green/10 border-brand-green text-brand-green shadow-md font-bold'
                : 'border-brand-hover text-brand-gray hover:text-white hover:border-white'
            }`}
            title="Letras e Cifras"
          >
            <Music className="w-4 h-4 shrink-0" />
          </button>

          {/* Barra de volume geral real com Bolinha Premium */}
          <div className="flex items-center gap-1.5 md:gap-2 text-brand-gray shrink-0">
            <Volume2 className="w-4 h-4 md:w-5 md:h-5 shrink-0" />
            <input 
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={masterVolume}
              onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
              className="w-14 sm:w-20 accent-brand-green dynamic-progress h-1 md:h-1.5 rounded-lg appearance-none cursor-pointer"
              style={{ '--slider-progress': `${masterVolume * 100}%` } as React.CSSProperties}
            />
          </div>

          {/* PAINEL FLUTUANTE DA DAW (Mesa de Mixagem Dinâmica para até 10 stems) */}
          {showMixer && (hasMultipleStems || isProcessingOrSingleStem) && (
            <div 
              ref={mixerRef}
              className="absolute right-0 bottom-28 w-80 bg-brand-card border border-brand-hover p-5 rounded-lg shadow-2xl flex flex-col gap-4 animate-in slide-in-from-bottom-2 duration-200 z-50 select-none"
            >
              <div className="flex items-center justify-between border-b border-brand-hover pb-3">
                <div className="flex items-center gap-2 text-white">
                  <Sliders className="w-4 h-4 text-brand-green" />
                  <span className="font-bold text-sm text-white">Mixer de Som</span>
                  {isProcessingOrSingleStem && (
                    <span className="text-[9px] bg-brand-hover text-amber-400 font-bold px-1.5 py-0.5 rounded ml-1">
                      Prévia
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowMixer(false)}
                  className="p-1 rounded text-brand-gray hover:text-white hover:bg-brand-hover/50 transition-colors cursor-pointer"
                  title="Fechar Mixer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isProcessingOrSingleStem ? (
                <div className="flex flex-col items-center justify-center text-center p-4 gap-3">
                  <Clock className="w-8 h-8 text-yellow-500 animate-pulse" />
                  <p className="text-xs text-brand-gray leading-relaxed m-0 font-medium">
                    Mixagem em processamento. Ouça a prévia completa enquanto separamos os canais.
                  </p>
                </div>
              ) : (
                <>

              {/* Presets Rápidos */}
              <div className="grid grid-cols-4 gap-1.5 text-[10px] font-bold uppercase">
                <button 
                  onClick={() => applyPreset('acapella')} 
                  className="py-1 px-1 bg-brand-hover rounded text-brand-gray hover:text-brand-green border border-transparent hover:border-brand-green/20 transition-all cursor-pointer text-center"
                >
                  Voz
                </button>
                <button 
                  onClick={() => applyPreset('karaoke')} 
                  className="py-1 px-1 bg-brand-hover rounded text-brand-gray hover:text-brand-green border border-transparent hover:border-brand-green/20 transition-all cursor-pointer text-center"
                >
                  Sem Voz
                </button>
                <button 
                  onClick={() => applyPreset('instrumental')} 
                  className="py-1 px-1 bg-brand-hover rounded text-brand-gray hover:text-brand-green border border-transparent hover:border-brand-green/20 transition-all cursor-pointer text-center"
                >
                  Instru.
                </button>
                <button 
                  onClick={() => applyPreset('reset')} 
                  className="py-1 px-1 bg-brand-hover rounded text-brand-gray hover:text-brand-green border border-transparent hover:border-brand-green/20 transition-all cursor-pointer text-center"
                >
                  Reset
                </button>
              </div>

              {/* Faders / Sliders Dinâmicos baseados nas Stems Reais Ordenadas */}
              <div className="flex flex-col gap-3 my-1 max-h-[300px] overflow-y-auto pr-1">
                {[...currentTrack.Stems]
                  .sort((a, b) => {
                    const order = [
                      'Voz',
                      'Vocal',
                      'Bateria',
                      'Baixo',
                      'Guitarra',
                      'Guitarra Solo',
                      'Guitarra Base',
                      'Sopro',
                      'Teclado',
                      'Piano',
                      'Cordas',
                      'Outros',
                      'Metrônomo'
                    ];
                    const indexA = order.indexOf(a.StemType);
                    const indexB = order.indexOf(b.StemType);
                    // Compatibilidade legada para "Vocais" (mapeia para a posição de "Voz")
                    const valA = a.StemType === 'Vocais' ? 0 : (indexA === -1 ? 999 : indexA);
                    const valB = b.StemType === 'Vocais' ? 0 : (indexB === -1 ? 999 : indexB);
                    return valA - valB;
                  })
                  .map((stem) => {
                    const stemName = stem.StemType; // ex: Voz, Bateria, Baixo
                    const volume = stemsVolume[stemName] ?? (stemName === 'Metrônomo' ? 0.0 : 1.0);
                    const isMuted = stemsMute[stemName] ?? false;
                    const isSoloed = stemsSolo[stemName] ?? false;
                    const hasAnySolo = Object.values(stemsSolo).some(v => v);
                    const isSilenced = hasAnySolo ? !isSoloed : isMuted;
                    
                    return (
                      <div key={stem.StemId} className={`flex flex-col gap-1 transition-all duration-200 ${isSilenced ? 'opacity-40' : 'opacity-100'}`}>
                        <div className="flex justify-between text-xs font-medium items-center">
                          <span className="text-white flex items-center gap-1.5 capitalize font-semibold select-none">
                            <span>{stemName}</span>
                            <span className="flex items-center gap-1 shrink-0 ml-1">
                              <button
                                onClick={() => toggleStemMute(stemName)}
                                className={`w-4 h-4 rounded-[3px] flex items-center justify-center text-[9px] font-black transition-all border cursor-pointer ${
                                  isMuted
                                    ? 'bg-red-500 text-white border-red-500 hover:bg-red-500'
                                    : 'bg-brand-hover hover:bg-red-500/80 hover:text-white hover:border-red-500/80 text-brand-gray border-transparent'
                                }`}
                                title="Mute"
                              >
                                M
                              </button>
                              <button
                                onClick={() => toggleStemSolo(stemName)}
                                className={`w-4 h-4 rounded-[3px] flex items-center justify-center text-[9px] font-black transition-all border cursor-pointer ${
                                  isSoloed
                                    ? 'bg-yellow-500 text-black border-yellow-500 hover:bg-yellow-500'
                                    : 'bg-brand-hover hover:bg-yellow-500/80 hover:text-black hover:border-yellow-500/80 text-brand-gray border-transparent'
                                }`}
                                title="Solo"
                              >
                                S
                              </button>

                            </span>
                          </span>
                          <span className="text-brand-gray font-mono">{Math.round(volume * 100)}%</span>
                        </div>
                        <input 
                           type="range" 
                           min="0" 
                           max="1.5" 
                           step="0.05"
                           value={volume}
                           onChange={(e) => setStemVolume(stemName, parseFloat(e.target.value))}
                           className="w-full accent-brand-green dynamic-progress h-1 rounded-lg appearance-none cursor-pointer"
                           style={{ '--slider-progress': `${(volume / 1.5) * 100}%` } as React.CSSProperties}
                         />
                      </div>
                    );
                  })}
              </div>

              {/* Presets Salvar */}
              <div className="flex justify-between items-center border-t border-brand-hover pt-3 text-[10px] text-brand-gray">
                <span>Preset Ativo: Personalizado</span>
                <button className="flex items-center gap-1 text-brand-green hover:underline cursor-pointer">
                  <RefreshCw className="w-3 h-3 animate-spin" style={{ animationDuration: '6s' }} /> Salvar Preset
                </button>
              </div>
              </>
              )}
            </div>
          )}
        </div>

      </div>

      {/* 2. COMPACT MOBILE AUDIO PLAYER */}
      <div 
        onClick={() => setActiveOverlay('player')}
        className="fixed bottom-0 left-0 right-0 h-16 bg-brand-black/95 backdrop-blur border-t border-brand-hover px-4 flex md:hidden items-center justify-between z-50 shadow-xl select-none cursor-pointer"
      >
        {/* Barra de progresso interativa no topo absoluto do mini player com seek de precisão */}
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute -top-1.5 left-0 right-0 h-4 flex items-center z-20 group cursor-pointer"
        >
          {/* Visual Track */}
          <div className="relative w-full h-[3px] bg-brand-hover group-hover:h-1.5 transition-all">
            {/* Filled Progress */}
            <div 
              className="absolute left-0 top-0 h-full bg-brand-green" 
              style={{ width: `${progressPercent}%` }}
            />
            {/* Pequena bolinha verde sutil (thumb) */}
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-brand-green shadow-[0_0_6px_#1db954] opacity-100 transition-opacity"
              style={{ left: `calc(${progressPercent}% - 5px)` }}
            />
          </div>
          
          {/* Invisible interactive input range */}
          <input 
            type="range"
            min="0"
            max={duration || 100}
            step="1"
            value={displayTime}
            onChange={(e) => setSliderValue(parseFloat(e.target.value))}
            onMouseUp={(e) => {
              const val = parseFloat((e.target as HTMLInputElement).value);
              seek(val);
              setSliderValue(null);
              (e.target as HTMLInputElement).blur();
            }}
            onTouchEnd={(e) => {
              const val = parseFloat((e.target as HTMLInputElement).value);
              seek(val);
              setSliderValue(null);
              (e.target as HTMLInputElement).blur();
            }}
            onKeyDown={(e) => {
              if (['ArrowLeft', 'ArrowRight', ' ', 'Spacebar'].includes(e.key)) {
                e.preventDefault();
              }
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>

        {/* Info da música no canto */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {currentTrack.CoverUrl ? (
            <img 
              src={currentTrack.CoverUrl.startsWith('http') ? currentTrack.CoverUrl : `${SERVER_URL}${currentTrack.CoverUrl}`} 
              alt="Capa" 
              className="w-10 h-10 rounded object-cover shadow-md shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded bg-brand-card flex items-center justify-center text-brand-green border border-brand-green/20 shrink-0">
              <Disc className={`w-5 h-5 ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
            </div>
          )}
          <div className="flex flex-col min-w-0 max-w-[125px] xs:max-w-[165px]">
            <span className="text-xs font-semibold text-white truncate leading-tight">
              {currentTrack.TrackTitle}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5 truncate">
              <span 
                onClick={() => navigate(`/library?search=${encodeURIComponent(currentTrack.ArtistName)}`)}
                className="text-[10px] text-brand-gray/80 hover:text-white cursor-pointer hover:underline truncate"
              >
                {currentTrack.ArtistName}
              </span>
              {currentChord && (
                <span className="px-1 py-0.2 bg-brand-green/10 text-[8px] text-brand-green font-bold rounded tracking-wider border border-brand-green/30 select-none shrink-0 leading-none">
                  {currentChord}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Controles de Mídia e Atalhos de Overlays Compactos */}
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Atalho DAW */}
          <button 
            onClick={(e) => { e.stopPropagation(); setActiveOverlay(prev => prev === 'daw' ? 'none' : 'daw'); }}
            className={`p-1.5 transition-colors cursor-pointer rounded-full ${
              activeOverlay === 'daw' 
                ? 'text-brand-green bg-brand-green/15' 
                : 'text-brand-gray/80 hover:text-white'
            }`}
            title="Estúdio DAW"
          >
            <Activity className="w-4 h-4" />
          </button>

          {/* Atalho Mixer */}
          {(hasMultipleStems || isProcessingOrSingleStem) && (
            <button 
              onClick={(e) => { e.stopPropagation(); setActiveOverlay(prev => prev === 'mixer' ? 'none' : 'mixer'); }}
              className={`p-1.5 transition-colors cursor-pointer rounded-full ${
                activeOverlay === 'mixer' 
                  ? 'text-brand-green bg-brand-green/15' 
                  : 'text-brand-gray/80 hover:text-white'
              }`}
              title="Mixer de Som"
            >
              <Sliders className="w-4 h-4" />
            </button>
          )}

          {/* Atalho Letras & Cifras */}
          <button 
            onClick={(e) => { e.stopPropagation(); setActiveOverlay(prev => prev === 'lyrics' ? 'none' : 'lyrics'); }}
            className={`p-1.5 transition-colors cursor-pointer rounded-full ${
              activeOverlay === 'lyrics' 
                ? 'text-brand-green bg-brand-green/15' 
                : 'text-brand-gray/80 hover:text-white'
            }`}
            title="Letras & Cifras"
          >
            <Music className="w-4 h-4" />
          </button>

          {/* Botão Play / Pause */}
          <button 
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer shadow shrink-0 ml-1"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current text-black" />
            ) : (
              <Play className="w-4 h-4 fill-current text-black translate-x-[0.5px]" />
            )}
          </button>
        </div>
      </div>

      {/* 3. FULL SCREEN MOBILE AUDIO PLAYER */}
      {activeOverlay === 'player' && (
        <div className="fixed inset-0 bg-gradient-to-b from-brand-hover via-brand-black to-brand-black z-50 flex flex-col p-6 overflow-y-auto select-none md:hidden animate-in slide-in-from-bottom duration-300">
          {/* Header */}
          <div className="flex items-center justify-between w-full shrink-0 mb-4 select-none">
            <button 
              onClick={() => setActiveOverlay('none')} 
              className="p-2 text-brand-gray hover:text-white transition-colors cursor-pointer shrink-0"
              title="Fechar Player"
            >
              <ChevronDown className="w-6 h-6" />
            </button>
            
            <div className="flex flex-col items-center max-w-[220px] xs:max-w-[280px] text-center min-w-0">
              {currentPlaylistId ? (
                <button
                  onClick={() => {
                    setActiveOverlay('none');
                    navigate(`/playlists/${currentPlaylistId}`);
                  }}
                  className="group flex flex-col items-center cursor-pointer min-w-0 max-w-full"
                  title="Ir para a Playlist"
                >
                  <span className="text-[9px] text-brand-gray font-black uppercase tracking-widest leading-none group-hover:text-white transition-colors">
                    Tocando da Playlist
                  </span>
                  <span className="text-xs font-bold text-white group-hover:text-brand-green transition-colors truncate max-w-full mt-0.5">
                    {currentPlaylistName || 'Playlist'}
                  </span>
                </button>
              ) : (
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">
                    Tocando da biblioteca
                  </span>
                </div>
              )}
            </div>

            <div className="w-10 shrink-0" /> {/* Spacer */}
          </div>

          {/* Capa Gigante */}
          <div className="flex-1 flex items-center justify-center my-4 max-h-[340px] shrink-0">
            <div 
              onClick={() => setActiveOverlay(prev => prev === 'lyrics' ? 'none' : 'lyrics')}
              className="w-full aspect-square max-w-[260px] xs:max-w-[300px] rounded-lg overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/5 bg-brand-card flex items-center justify-center cursor-pointer"
              title="Abrir Letras & Cifras"
            >
              {currentTrack.CoverUrl ? (
                <img 
                  src={currentTrack.CoverUrl.startsWith('http') ? currentTrack.CoverUrl : `${SERVER_URL}${currentTrack.CoverUrl}`} 
                  alt="Capa" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <Disc className={`w-32 h-32 text-brand-green ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} />
              )}
            </div>
          </div>

          {/* Informações da Música */}
          <div className="flex justify-between items-center w-full px-2 mb-4 shrink-0">
            <div className="flex flex-col min-w-0 flex-1 mr-2">
              <h2 className="text-xl font-bold text-white truncate leading-tight select-text">
                {currentTrack.TrackTitle}
              </h2>
              <div className="flex items-center gap-2 mt-1 truncate">
                <p 
                  onClick={() => navigate(`/library?search=${encodeURIComponent(currentTrack.ArtistName)}`)}
                  className="text-sm text-brand-gray hover:text-white cursor-pointer hover:underline truncate select-text"
                >
                  {currentTrack.ArtistName}
                </p>
                {currentChord && (
                  <span className="px-1.5 py-0.5 bg-brand-green/10 text-[9px] text-brand-green font-bold rounded tracking-wider border border-brand-green/30 select-none shrink-0 leading-none">
                    {currentChord}
                  </span>
                )}
              </div>
            </div>
            <div className="px-2 py-0.5 bg-brand-hover text-[9px] text-brand-green font-bold rounded uppercase tracking-wider border border-brand-green/20 shrink-0">
              {currentTrack.Stems?.length || 0} Stems
            </div>
          </div>

          {/* Linha de Tempo / Progresso */}
          <div className="w-full px-2 mb-4 shrink-0 select-none">
            <input 
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={displayTime}
              onChange={(e) => setSliderValue(parseFloat(e.target.value))}
              onMouseUp={(e) => {
                const val = parseFloat((e.target as HTMLInputElement).value);
                seek(val);
                setSliderValue(null);
                (e.target as HTMLInputElement).blur();
              }}
              onTouchEnd={(e) => {
                const val = parseFloat((e.target as HTMLInputElement).value);
                seek(val);
                setSliderValue(null);
                (e.target as HTMLInputElement).blur();
              }}
              onKeyDown={(e) => {
                if (['ArrowLeft', 'ArrowRight', ' ', 'Spacebar'].includes(e.key)) {
                  e.preventDefault();
                }
              }}
              className="w-full accent-brand-green dynamic-progress h-1.5 rounded-lg appearance-none cursor-pointer"
              style={{ '--slider-progress': `${progressPercent}%` } as React.CSSProperties}
            />
            <div className="flex justify-between text-xs text-brand-gray mt-2 font-semibold">
              <span>{formatTime(displayTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Controles Principais Mobile (Duas linhas para evitar quebra/overflow lateral) */}
          <div className="w-full shrink-0 flex flex-col gap-6 mb-6">
            
            {/* Linha 1: Controles de Playback (Mídia) */}
            <div className="flex items-center justify-between w-full px-6">
              {/* Shuffle (Aleatório) */}
              <button 
                onClick={toggleShuffle}
                className={`transition-colors cursor-pointer flex flex-col items-center justify-center relative p-2 ${
                  isShuffle 
                    ? 'text-brand-green' 
                    : 'text-brand-gray hover:text-white'
                }`}
              >
                <Shuffle className="w-5 h-5" />
                {isShuffle && (
                  <span className="absolute -bottom-1 w-[3px] h-[3px] bg-brand-green rounded-full shadow-[0_0_8px_#1db954]" />
                )}
              </button>

              <button 
                onClick={playPreviousTrack}
                className="text-brand-gray hover:text-white active:scale-95 transition-transform cursor-pointer p-2"
                title="Anterior"
              >
                <SkipBack className="w-6 h-6 fill-current" />
              </button>
              
              <button 
                onClick={togglePlay}
                className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer shadow-2xl shrink-0"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6 fill-current text-black" />
                ) : (
                  <Play className="w-6 h-6 fill-current text-black translate-x-[0.5px]" />
                )}
              </button>
              
              <button 
                onClick={playNextTrack}
                className="text-brand-gray hover:text-white active:scale-95 transition-transform cursor-pointer p-2"
                title="Próxima"
              >
                <SkipForward className="w-6 h-6 fill-current" />
              </button>

              {/* Repeat (Repetição) */}
              <button 
                onClick={toggleRepeatMode}
                className={`transition-colors cursor-pointer flex flex-col items-center justify-center relative p-2 ${
                  repeatMode !== 'off' 
                    ? 'text-brand-green' 
                    : 'text-brand-gray hover:text-white'
                }`}
              >
                {repeatMode === 'one' ? (
                  <Repeat1 className="w-5 h-5" />
                ) : (
                  <Repeat className="w-5 h-5" />
                )}
                {repeatMode !== 'off' && (
                  <span className="absolute -bottom-1 w-[3px] h-[3px] bg-brand-green rounded-full shadow-[0_0_8px_#1db954]" />
                )}
              </button>
            </div>

            {/* Linha 2: Utilidades (DAW, Mixer e Letras) */}
            <div className="flex items-center justify-center gap-3 w-full px-2">
              <button 
                onClick={() => setActiveOverlay(prev => prev === 'daw' ? 'none' : 'daw')}
                className="flex items-center gap-1.5 py-2 px-4 rounded-full border border-brand-hover text-brand-gray hover:text-white hover:border-brand-green/30 transition-all cursor-pointer"
                title="Estúdio DAW"
              >
                <Activity className="w-4 h-4 text-brand-green" />
                <span className="text-xs font-bold">DAW</span>
              </button>

              {(hasMultipleStems || isProcessingOrSingleStem) && (
                <button 
                  onClick={() => setActiveOverlay(prev => prev === 'mixer' ? 'none' : 'mixer')}
                  className="flex items-center gap-1.5 py-2 px-4 rounded-full border border-brand-hover text-brand-gray hover:text-white hover:border-brand-green/30 transition-all cursor-pointer"
                  title="Mixer de Som"
                >
                  <Sliders className="w-4 h-4 text-brand-green" />
                  <span className="text-xs font-bold">Mixer</span>
                </button>
              )}

              <button 
                onClick={() => setActiveOverlay(prev => prev === 'lyrics' ? 'none' : 'lyrics')}
                className="flex items-center gap-1.5 py-2 px-4 rounded-full border border-brand-hover text-brand-gray hover:text-white hover:border-brand-green/30 transition-all cursor-pointer"
                title="Letras e Cifras"
              >
                <Music className="w-4 h-4 text-brand-green" />
                <span className="text-xs font-bold">Letras</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
