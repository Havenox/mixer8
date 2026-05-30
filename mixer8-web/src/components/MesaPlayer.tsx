import React, { useState, useEffect } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, 
  Sliders, RefreshCw, Mic, Disc, Layers, Music
} from 'lucide-react';

interface IStemVolume {
  Vocals: number;
  Drums: number;
  Bass: number;
  Piano: number;
  Others: number;
}

export const MesaPlayer: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(34); // porcentagem
  const [currentTime, setCurrentTime] = useState('1:42');
  const [totalTime] = useState('4:56');
  
  // Volumes das stems independentes (0.0 a 1.0)
  const [stemsVolume, setStemsVolume] = useState<IStemVolume>({
    Vocals: 0.8,
    Drums: 0.9,
    Bass: 0.7,
    Piano: 0.8,
    Others: 0.6
  });

  const [showMixer, setShowMixer] = useState(false);

  // Simula o progresso da música tocando
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.3;
        });

        // Simula atualização simples do relógio
        setCurrentTime((prev) => {
          const [m, s] = prev.split(':').map(Number);
          let newS = s + 1;
          let newM = m;
          if (newS >= 60) {
            newS = 0;
            newM += 1;
          }
          return `${newM}:${newS.toString().padStart(2, '0')}`;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleVolumeChange = (stem: keyof IStemVolume, val: number) => {
    setStemsVolume(prev => ({
      ...prev,
      [stem]: val
    }));
  };

  // Presets de mixagem rápidos
  const applyPreset = (preset: 'acapella' | 'karaoke' | 'instrumental' | 'reset') => {
    switch (preset) {
      case 'acapella':
        setStemsVolume({ Vocals: 1.0, Drums: 0.0, Bass: 0.0, Piano: 0.0, Others: 0.0 });
        break;
      case 'karaoke':
        setStemsVolume({ Vocals: 0.0, Drums: 0.9, Bass: 0.8, Piano: 0.8, Others: 0.8 });
        break;
      case 'instrumental':
        setStemsVolume({ Vocals: 0.0, Drums: 0.9, Bass: 0.8, Piano: 0.8, Others: 0.8 });
        break;
      case 'reset':
        setStemsVolume({ Vocals: 0.8, Drums: 0.8, Bass: 0.8, Piano: 0.8, Others: 0.8 });
        break;
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 h-24 bg-brand-black border-t border-brand-hover px-6 flex items-center justify-between z-50 shadow-2xl">
      
      {/* Esquerda: Info da Música */}
      <div className="flex items-center gap-4 w-1/4 min-w-[200px]">
        <div className="w-14 h-14 bg-brand-card border border-brand-hover rounded flex items-center justify-center relative overflow-hidden group shadow-lg">
          <Disc className={`w-8 h-8 text-brand-green ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '4s' }} />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Music className="w-5 h-5 text-white" />
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-white hover:underline cursor-pointer truncate">
            Bohemian Rhapsody (Stems Edition)
          </span>
          <span className="text-xs text-brand-gray hover:underline hover:text-white cursor-pointer truncate">
            Queen
          </span>
        </div>
        <div className="px-2 py-0.5 bg-brand-hover text-[9px] text-brand-green font-bold rounded uppercase tracking-wider border border-brand-green/20">
          5 Stems Ativos
        </div>
      </div>

      {/* Centro: Controles de Player */}
      <div className="flex flex-col items-center gap-2 w-2/5 max-w-[600px]">
        {/* Botões do Player */}
        <div className="flex items-center gap-6">
          <button className="text-brand-gray hover:text-white transition-colors cursor-pointer">
            <SkipBack className="w-5 h-5 fill-current" />
          </button>
          
          <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current translate-x-[1px]" />
            )}
          </button>

          <button className="text-brand-gray hover:text-white transition-colors cursor-pointer">
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-3 w-full text-xs text-brand-gray">
          <span>{currentTime}</span>
          <div className="flex-1 h-1 bg-brand-hover rounded-full overflow-hidden relative cursor-pointer group">
            <div 
              className="h-full bg-brand-gray group-hover:bg-brand-green rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span>{totalTime}</span>
        </div>
      </div>

      {/* Direita: Mixagem DAW & Volume Geral */}
      <div className="flex items-center gap-4 w-1/4 justify-end min-w-[220px] relative">
        {/* Botão de Toggle do Mixer de Stems */}
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

        {/* Barra de volume geral fictícia */}
        <div className="flex items-center gap-2 text-brand-gray">
          <Volume2 className="w-5 h-5" />
          <div className="w-20 h-1 bg-brand-hover rounded-full overflow-hidden relative cursor-pointer group">
            <div className="h-full bg-brand-gray group-hover:bg-brand-green rounded-full w-4/5" />
          </div>
        </div>

        {/* PAINEL FLUTUANTE DA DAW (Mesa de Mixagem de Stems) */}
        {showMixer && (
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
                className="py-1 px-1 bg-brand-hover rounded text-brand-gray hover:text-brand-green border border-transparent hover:border-brand-green/20 transition-all cursor-pointer"
              >
                Voz
              </button>
              <button 
                onClick={() => applyPreset('karaoke')} 
                className="py-1 px-1 bg-brand-hover rounded text-brand-gray hover:text-brand-green border border-transparent hover:border-brand-green/20 transition-all cursor-pointer"
              >
                Remover Voz
              </button>
              <button 
                onClick={() => applyPreset('instrumental')} 
                className="py-1 px-1 bg-brand-hover rounded text-brand-gray hover:text-brand-green border border-transparent hover:border-brand-green/20 transition-all cursor-pointer"
              >
                Instru.
              </button>
              <button 
                onClick={() => applyPreset('reset')} 
                className="py-1 px-1 bg-brand-hover rounded text-brand-gray hover:text-brand-green border border-transparent hover:border-brand-green/20 transition-all cursor-pointer"
              >
                Reset
              </button>
            </div>

            {/* Faders / Sliders Individuais */}
            <div className="flex flex-col gap-3 my-1">
              
              {/* Voz */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-white flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-brand-green" /> Voz (Vocals)
                  </span>
                  <span className="text-brand-gray">{Math.round(stemsVolume.Vocals * 100)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05"
                  value={stemsVolume.Vocals}
                  onChange={(e) => handleVolumeChange('Vocals', parseFloat(e.target.value))}
                  className="w-full accent-brand-green bg-brand-hover h-1 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Bateria */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-white">🥁 Bateria (Drums)</span>
                  <span className="text-brand-gray">{Math.round(stemsVolume.Drums * 100)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05"
                  value={stemsVolume.Drums}
                  onChange={(e) => handleVolumeChange('Drums', parseFloat(e.target.value))}
                  className="w-full accent-brand-green bg-brand-hover h-1 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Baixo */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-white">🎸 Baixo (Bass)</span>
                  <span className="text-brand-gray">{Math.round(stemsVolume.Bass * 100)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05"
                  value={stemsVolume.Bass}
                  onChange={(e) => handleVolumeChange('Bass', parseFloat(e.target.value))}
                  className="w-full accent-brand-green bg-brand-hover h-1 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Teclado */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-white">🎹 Teclado (Piano)</span>
                  <span className="text-brand-gray">{Math.round(stemsVolume.Piano * 100)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05"
                  value={stemsVolume.Piano}
                  onChange={(e) => handleVolumeChange('Piano', parseFloat(e.target.value))}
                  className="w-full accent-brand-green bg-brand-hover h-1 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Outros */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-white">✨ Outros (Ambient)</span>
                  <span className="text-brand-gray">{Math.round(stemsVolume.Others * 100)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05"
                  value={stemsVolume.Others}
                  onChange={(e) => handleVolumeChange('Others', parseFloat(e.target.value))}
                  className="w-full accent-brand-green bg-brand-hover h-1 rounded-lg appearance-none cursor-pointer"
                />
              </div>

            </div>

            {/* Presets Salvar */}
            <div className="flex justify-between items-center border-t border-brand-hover pt-3 text-[10px] text-brand-gray">
              <span>Preset Ativo: Mix_Fidelidade_01</span>
              <button className="flex items-center gap-1 text-brand-green hover:underline cursor-pointer">
                <RefreshCw className="w-3 h-3" /> Salvar Preset
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
