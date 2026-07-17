import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { Sliders, Clock, X } from 'lucide-react';

export const MobileMixerOverlay: React.FC = () => {
  const {
    currentTrack,
    stemsVolume,
    stemsMute,
    stemsSolo,
    setStemVolume,
    toggleStemMute,
    toggleStemSolo,
    setActiveOverlay
  } = usePlayer();

  if (!currentTrack) return null;

  const applyPreset = (preset: 'acapella' | 'karaoke' | 'instrumental' | 'reset') => {
    if (!currentTrack.Stems) return;
    currentTrack.Stems.forEach((stem) => {
      const type = stem.StemType;
      switch (preset) {
        case 'acapella':
          setStemVolume(type, (type === 'Voz' || type === 'Vocal' || type === 'Vocais') ? 1.0 : 0.0);
          break;
        case 'karaoke':
        case 'instrumental':
          setStemVolume(type, (type === 'Voz' || type === 'Vocal' || type === 'Vocais' || type === 'Metrônomo') ? 0.0 : 1.0);
          break;
        case 'reset':
          setStemVolume(type, type === 'Metrônomo' ? 0.0 : 1.0);
          break;
      }
    });
  };

  const isProcessingOrSingleStem = !!(currentTrack.ExtractionStatus?.startsWith('Processando') || 
    (currentTrack.Stems && currentTrack.Stems.length === 1 && currentTrack.Stems[0].StemType === 'Completo'));

  const sortedStems = [...(currentTrack.Stems || [])].sort((a, b) => {
    const order = [
      'Voz', 'Vocal', 'Bateria', 'Baixo', 'Guitarra', 'Guitarra Solo',
      'Guitarra Base', 'Sopro', 'Teclado', 'Piano', 'Cordas', 'Outros', 'Metrônomo'
    ];
    const indexA = order.indexOf(a.StemType);
    const indexB = order.indexOf(b.StemType);
    const valA = a.StemType === 'Vocais' ? 0 : (indexA === -1 ? 999 : indexA);
    const valB = b.StemType === 'Vocais' ? 0 : (indexB === -1 ? 999 : indexB);
    return valA - valB;
  });

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] text-white select-none animate-in fade-in duration-200">
      {/* Sub-Barra Ultra-Fina do Mixer Overlay */}
      <div className="h-8 border-b border-brand-hover/80 bg-[#141414] px-3.5 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-brand-green" />
          <span className="text-[11px] font-bold tracking-wider text-white">Mixer de Som</span>
        </div>
        <button
          onClick={() => setActiveOverlay('none')}
          className="p-1 rounded text-brand-gray hover:text-white hover:bg-brand-hover/50 transition-colors cursor-pointer"
          title="Fechar Mixer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Conteúdo do Mixer */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 pb-24">
        {isProcessingOrSingleStem ? (
          <div className="flex flex-col items-center justify-center text-center p-8 gap-3 bg-brand-dark/40 border border-brand-hover rounded-xl my-auto">
            <Clock className="w-10 h-10 text-amber-400 animate-pulse" />
            <p className="text-xs text-brand-gray leading-relaxed font-medium">
              Mixagem em processamento. Ouça a prévia completa enquanto separamos os canais de áudio.
            </p>
          </div>
        ) : (
          <>
            {/* Presets Rápidos */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-extrabold text-brand-gray/60 uppercase tracking-widest">Presets Rápidos</span>
              <div className="grid grid-cols-4 gap-2 text-[10px] font-extrabold uppercase">
                <button 
                  onClick={() => applyPreset('acapella')} 
                  className="py-2 px-1 bg-[#181818] hover:bg-[#222] rounded-lg text-brand-gray hover:text-brand-green border border-white/5 transition-all cursor-pointer text-center active:scale-95"
                >
                  Voz
                </button>
                <button 
                  onClick={() => applyPreset('karaoke')} 
                  className="py-2 px-1 bg-[#181818] hover:bg-[#222] rounded-lg text-brand-gray hover:text-brand-green border border-white/5 transition-all cursor-pointer text-center active:scale-95"
                >
                  Sem Voz
                </button>
                <button 
                  onClick={() => applyPreset('instrumental')} 
                  className="py-2 px-1 bg-[#181818] hover:bg-[#222] rounded-lg text-brand-gray hover:text-brand-green border border-white/5 transition-all cursor-pointer text-center active:scale-95"
                >
                  Instru.
                </button>
                <button 
                  onClick={() => applyPreset('reset')} 
                  className="py-2 px-1 bg-[#181818] hover:bg-[#222] rounded-lg text-brand-gray hover:text-brand-green border border-white/5 transition-all cursor-pointer text-center active:scale-95"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Faders / Sliders Dinâmicos */}
            <div className="flex flex-col gap-3.5 mt-2">
              <span className="text-[9px] font-extrabold text-brand-gray/60 uppercase tracking-widest">Controle de Canais</span>
              {sortedStems.map((stem) => {
                const stemName = stem.StemType;
                const volume = stemsVolume[stemName] ?? (stemName === 'Metrônomo' ? 0.0 : 1.0);
                const isMuted = stemsMute[stemName] ?? false;
                const isSoloed = stemsSolo[stemName] ?? false;
                const hasAnySolo = Object.values(stemsSolo).some(v => v);
                const isSilenced = hasAnySolo ? !isSoloed : isMuted;

                return (
                  <div key={stem.StemId} className={`flex flex-col gap-1.5 p-3 bg-[#141414] border border-white/5 rounded-xl transition-all duration-200 ${isSilenced ? 'opacity-40' : 'opacity-100'}`}>
                    <div className="flex justify-between text-xs font-medium items-center">
                      <span className="text-white flex items-center gap-2 capitalize font-bold select-none">
                        <span>{stemName}</span>
                        <span className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => toggleStemMute(stemName)}
                            className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-black transition-all border cursor-pointer ${
                              isMuted
                                ? 'bg-red-600 text-white border-red-600'
                                : 'bg-[#222] hover:bg-red-600/80 hover:text-white text-brand-gray border-transparent'
                            }`}
                            title="Mute"
                          >
                            M
                          </button>
                          <button
                            onClick={() => toggleStemSolo(stemName)}
                            className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-black transition-all border cursor-pointer ${
                              isSoloed
                                ? 'bg-amber-400 text-black border-amber-400'
                                : 'bg-[#222] hover:bg-amber-400/80 hover:text-black text-brand-gray border-transparent'
                            }`}
                            title="Solo"
                          >
                            S
                          </button>
                        </span>
                      </span>
                      <span className="text-brand-green font-mono font-bold text-xs">{Math.round(volume * 100)}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1.5" 
                      step="0.05"
                      value={volume}
                      onChange={(e) => setStemVolume(stemName, parseFloat(e.target.value))}
                      className="w-full accent-brand-green dynamic-progress h-1.5 rounded-lg appearance-none cursor-pointer"
                      style={{ '--slider-progress': `${(volume / 1.5) * 100}%` } as React.CSSProperties}
                    />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
