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
    masterVolume,
    togglePlay, 
    seek, 
    setStemVolume,
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

  // Presets rápidos para 10 stems (Apenas se houver stems suficientes na lista)
  const applyPreset = (preset: 'acapella' | 'karaoke' | 'instrumental' | 'reset') => {
    if (!currentTrack.Stems) return;

    currentTrack.Stems.forEach(stem => {
      const type = stem.StemType;
      
      switch (preset) {
        case 'acapella':
          // Apenas Vocais ligado, resto zerado
          setStemVolume(type, type === 'Vocais' ? 1.0 : 0.0);
          break;
        case 'karaoke':
          // Vocais desligado, metrônomo desligado, resto ligado
          setStemVolume(type, (type === 'Vocais' || type === 'Metrônomo') ? 0.0 : 0.8);
          break;
        case 'instrumental':
          // Vocais desligado, resto ligado
          setStemVolume(type, type === 'Vocais' ? 0.0 : 0.8);
          break;
        case 'reset':
          // Todos os canais em 0.8
          setStemVolume(type, 0.8);
          break;
      }
    });
  };

  const hasMultipleStems = currentTrack.Stems && currentTrack.Stems.length > 1;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-24 bg-brand-black border-t border-brand-hover px-6 flex items-center justify-between z-50 shadow-2xl animate-in slide-in-from-bottom duration-300">
      
      {/* Esquerda: Info da Música Real */}
      <div className="flex items-center gap-4 w-1/4 min-w-[200px]">
        <div className="w-14 h-14 bg-brand-card border border-brand-hover rounded flex items-center justify-center relative overflow-hidden group shadow-lg shrink-0">
          {currentTrack.CoverUrl ? (
            <img 
              src={currentTrack.CoverUrl.startsWith('http') ? currentTrack.CoverUrl : `${SERVER_URL}${currentTrack.CoverUrl}`} 
              alt="Capa" 
              className="w-full h-full object-cover"
            />
          ) : (
            <Disc className={`w-8 h-8 text-brand-green ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
          )}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Music className="w-5 h-5 text-white" />
          </div>
        </div>
        <div className="flex flex-col truncate max-w-[150px]">
          <span className="text-sm font-medium text-white hover:underline cursor-pointer truncate">
            {currentTrack.TrackTitle}
          </span>
          <span className="text-xs text-brand-gray hover:underline hover:text-white cursor-pointer truncate">
            {currentTrack.ArtistName}
          </span>
        </div>
        <div className="px-2 py-0.5 bg-brand-hover text-[9px] text-brand-green font-bold rounded uppercase tracking-wider border border-brand-green/20 shrink-0 select-none">
          {currentTrack.Stems?.length || 0} Stems
        </div>
      </div>

      {/* Centro: Controles de Player Sincronizado */}
      <div className="flex flex-col items-center gap-2 w-2/5 max-w-[600px]">
        {/* Botões do Player */}
        <div className="flex items-center gap-6">
          <button 
            onClick={() => seek(Math.max(0, currentTime - 10))}
            className="text-brand-gray hover:text-white transition-colors cursor-pointer"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>
          
          <button 
            onClick={togglePlay}
            className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer shadow-lg"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current translate-x-[1px]" />
            )}
          </button>

          <button 
            onClick={() => seek(Math.min(duration, currentTime + 10))}
            className="text-brand-gray hover:text-white transition-colors cursor-pointer"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
        </div>

        {/* Progress Bar com Click/Arrasto e Bolinha Premium */}
        <div className="flex items-center gap-3 w-full text-xs text-brand-gray select-none">
          <span className="w-8 text-right">{formatTime(displayTime)}</span>
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
            className="flex-1 accent-brand-green bg-brand-hover h-1.5 rounded-lg appearance-none cursor-pointer"
          />
          <span className="w-8">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Direita: Mixagem DAW & Volume Geral */}
      <div className="flex items-center gap-4 w-1/4 justify-end min-w-[220px] relative select-none">
        
        {/* Botão de Mixer apenas se houver múltiplas stems */}
        {hasMultipleStems ? (
          <button 
            onClick={() => setShowMixer(!showMixer)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
              showMixer 
                ? 'bg-brand-green/10 border-brand-green text-brand-green shadow-md' 
                : 'border-brand-hover text-brand-gray hover:text-white hover:border-white'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span className="text-xs font-semibold">Mixer Stems</span>
          </button>
        ) : (
          <div className="text-[10px] text-brand-gray font-bold uppercase border border-brand-hover px-3 py-1.5 rounded-full bg-black/20">
            Faixa Única / Mono
          </div>
        )}

        {/* Barra de volume geral real com Bolinha Premium */}
        <div className="flex items-center gap-2 text-brand-gray">
          <Volume2 className="w-5 h-5 shrink-0" />
          <input 
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={masterVolume}
            onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
            className="w-20 accent-brand-green bg-brand-hover h-1.5 rounded-lg appearance-none cursor-pointer"
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

            {/* Faders / Sliders Dinâmicos baseados nas Stems Reais */}
            <div className="flex flex-col gap-3 my-1 max-h-[300px] overflow-y-auto pr-1">
              {currentTrack.Stems.map((stem) => {
                const stemName = stem.StemType; // ex: Voz, Bateria, Baixo
                const volume = stemsVolume[stemName] ?? 0.8;
                
                return (
                  <div key={stem.StemId} className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-white flex items-center gap-1.5 capitalize font-semibold">
                        {stemName}
                      </span>
                      <span className="text-brand-gray">{Math.round(volume * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
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
