import React, { useState } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, 
  Sliders, RefreshCw, Disc, Layers, Music
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SERVER_URL = API_URL.replace('/api', '');

export const MesaPlayer: React.FC = () => {
  const { 
    currentTrack, 
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
    setMasterVolume
  } = usePlayer();

  const [showMixer, setShowMixer] = useState(false);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [dragProgressTime, setDragProgressTime] = useState(0);

  const displayTime = isDraggingProgress ? dragProgressTime : currentTime;

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

  return (
    <div className="fixed bottom-0 left-0 right-0 h-24 bg-brand-black border-t border-brand-hover px-3 md:px-6 flex items-center justify-between z-50 shadow-2xl animate-in slide-in-from-bottom duration-300">
      
      {/* Esquerda: Info da Música Real */}
      <div className="flex items-center gap-2.5 md:gap-4 flex-1 md:flex-initial min-w-0 md:w-1/4 md:min-w-[200px]">
        <div className="w-10 h-10 md:w-14 md:h-14 bg-brand-card border border-brand-hover rounded flex items-center justify-center relative overflow-hidden group shadow-lg shrink-0">
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
          <span className="text-xs md:text-sm font-semibold text-white hover:underline cursor-pointer truncate leading-tight">
            {currentTrack.TrackTitle}
          </span>
          <span className="text-[10px] md:text-xs text-brand-gray/80 hover:text-white cursor-pointer truncate mt-0.5 leading-none">
            {currentTrack.ArtistName}
          </span>
        </div>
        <div className="hidden sm:inline-block px-2 py-0.5 bg-brand-hover text-[9px] text-brand-green font-bold rounded uppercase tracking-wider border border-brand-green/20 shrink-0 select-none">
          {currentTrack.Stems?.length || 0} Stems
        </div>
      </div>

      {/* Centro: Controles de Player Sincronizado */}
      <div className="flex flex-col items-center gap-1 md:gap-2 flex-[2] md:flex-initial max-w-[600px] min-w-0 px-2">
        {/* Botões do Player */}
        <div className="flex items-center gap-4 md:gap-6">
          <button 
            onClick={() => seek(Math.max(0, currentTime - 10))}
            className="text-brand-gray hover:text-white transition-colors cursor-pointer"
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
            onClick={() => seek(Math.min(duration, currentTime + 10))}
            className="text-brand-gray hover:text-white transition-colors cursor-pointer"
          >
            <SkipForward className="w-4 h-4 md:w-5 md:h-5 fill-current" />
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
            onMouseDown={() => {
              setIsDraggingProgress(true);
              setDragProgressTime(currentTime);
            }}
            onTouchStart={() => {
              setIsDraggingProgress(true);
              setDragProgressTime(currentTime);
            }}
            onChange={(e) => setDragProgressTime(parseFloat(e.target.value))}
            onMouseUp={(e) => {
              setIsDraggingProgress(false);
              seek(parseFloat((e.target as HTMLInputElement).value));
            }}
            onTouchEnd={(e) => {
              setIsDraggingProgress(false);
              seek(parseFloat((e.target as HTMLInputElement).value));
            }}
            className="flex-1 accent-brand-green bg-brand-hover h-1 md:h-1.5 rounded-lg appearance-none cursor-pointer min-w-0"
          />
          <span className="w-6 md:w-8 shrink-0">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Direita: Mixagem DAW & Volume Geral */}
      <div className="flex items-center gap-2 md:gap-4 flex-1 md:flex-initial md:w-1/4 justify-end min-w-0 md:min-w-[220px] relative select-none">
        
        {/* Botão de Mixer apenas se houver múltiplas stems */}
        {hasMultipleStems ? (
          <button 
            onClick={() => setShowMixer(!showMixer)}
            className={`flex items-center justify-center gap-2 p-2 md:px-3 md:py-1.5 rounded-full border transition-all cursor-pointer shrink-0 ${
              showMixer 
                ? 'bg-brand-green/10 border-brand-green text-brand-green shadow-md' 
                : 'border-brand-hover text-brand-gray hover:text-white hover:border-white'
            }`}
            title="Mesa Mixer de Stems"
          >
            <Sliders className="w-4 h-4 shrink-0" />
            <span className="hidden md:inline text-xs font-semibold">Mixer Stems</span>
          </button>
        ) : (
          <div className="hidden md:block text-[10px] text-brand-gray font-bold uppercase border border-brand-hover px-3 py-1.5 rounded-full bg-black/20 shrink-0">
            Faixa Única / Mono
          </div>
        )}

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
            className="w-14 sm:w-20 accent-brand-green bg-brand-hover h-1 md:h-1.5 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* PAINEL FLUTUANTE DA DAW (Mesa de Mixagem Dinâmica para até 10 stems) */}
        {showMixer && hasMultipleStems && (
          <div className="absolute right-0 bottom-28 w-80 bg-brand-card border border-brand-hover p-5 rounded-lg shadow-2xl flex flex-col gap-4 animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between border-b border-brand-hover pb-3">
              <div className="flex items-center gap-2 text-white">
                <Layers className="w-5 h-5 text-brand-green" />
                <span className="font-bold text-sm">Mesa de Som (Stems)</span>
              </div>
              <span className="text-[10px] bg-brand-hover text-brand-green font-bold px-1.5 py-0.5 rounded">
                REALTIME
              </span>
            </div>

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
                        className="w-full accent-brand-green bg-brand-hover h-1 rounded-lg appearance-none cursor-pointer"
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
          </div>
        )}
      </div>

    </div>
  );
};
