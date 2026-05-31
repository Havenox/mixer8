import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

export interface IStem {
  StemId: string;
  TrackId: string;
  StemType: string;
  AudioUrl: string;
}

export interface ITrack {
  TrackId: string;
  TrackTitle: string;
  ArtistName: string;
  ExtractionStatus: string;
  CreatedAt: string;
  CoverUrl?: string;
  Stems: IStem[];
}

interface IPlayerContext {
  currentTrack: ITrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  stemsVolume: Record<string, number>;
  stemsMute: Record<string, boolean>;
  stemsSolo: Record<string, boolean>;
  masterVolume: number;
  loadTrack: (track: ITrack | null) => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  setStemVolume: (type: string, volume: number) => void;
  toggleStemMute: (type: string) => void;
  toggleStemSolo: (type: string) => void;
  setMasterVolume: (volume: number) => void;
}

const PlayerContext = createContext<IPlayerContext | undefined>(undefined);

// Lista das 10 Stems padronizadas da especificação
export const STANDARD_STEMS = [
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

import { API_URL, SERVER_URL } from '../config';

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<ITrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Volumes individuais de stems (padrão 1.0, exceto metronomo)
  const [stemsVolume, setStemsVolume] = useState<Record<string, number>>({});
  const [stemsMute, setStemsMute] = useState<Record<string, boolean>>({});
  const [stemsSolo, setStemsSolo] = useState<Record<string, boolean>>({});
  const [masterVolume, setMasterVolumeState] = useState(() => {
    const saved = localStorage.getItem('mixer8_master_volume');
    return saved !== null ? parseFloat(saved) : 1.0;
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainNodeRef = useRef<GainNode | null>(null);
  
  // Referências para gerenciar elementos de áudio e nós do Web Audio API sem causar re-renders indesejados
  const activeStemsRef = useRef<{
    audio: HTMLAudioElement;
    gainNode: GainNode;
    sourceNode: MediaElementAudioSourceNode;
    type: string;
  }[]>([]);

  // Atualiza os ganhos de todas as stems ativas com base em volume, mute e solo
  const updateAudioGains = (
    volumes: Record<string, number>,
    mutes: Record<string, boolean>,
    solos: Record<string, boolean>
  ) => {
    const hasAnySolo = Object.values(solos).some(v => v);

    activeStemsRef.current.forEach(item => {
      const type = item.type;
      const vol = volumes[type] ?? (type === 'Metrônomo' ? 0.0 : 1.0);
      const isMuted = mutes[type] ?? false;
      const isSoloed = solos[type] ?? false;

      let targetGain = 0;
      if (hasAnySolo) {
        // Se houver qualquer SOLO ativo, apenas as marcadas com SOLO tocam (mesmo se estiverem em Mute)
        targetGain = isSoloed ? vol : 0;
      } else {
        // Sem SOLO ativo, tocamos baseado no volume individual do fader e Mute
        targetGain = isMuted ? 0 : vol;
      }

      item.gainNode.gain.setValueAtTime(targetGain, audioContextRef.current?.currentTime || 0);
    });
  };

  // Limpa tudo ao desmontar
  useEffect(() => {
    return () => {
      cleanupActiveStems();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const cleanupActiveStems = () => {
    activeStemsRef.current.forEach(item => {
      item.audio.pause();
      item.audio.src = '';
      item.audio.load();
      item.gainNode.disconnect();
      item.sourceNode.disconnect();
    });
    activeStemsRef.current = [];
  };

  const initAudioContext = () => {
    if (!audioContextRef.current) {
      // Suporta múltiplos browsers
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      // Cria e conecta o nó de ganho master
      const masterGain = ctx.createGain();
      masterGain.gain.value = masterVolume;
      masterGain.connect(ctx.destination);
      masterGainNodeRef.current = masterGain;
    }
    return audioContextRef.current;
  };

  const loadTrack = async (track: ITrack | null) => {
    setIsPlaying(false);
    cleanupActiveStems();
    setCurrentTime(0);
    setDuration(0);
    setCurrentTrack(track);

    if (!track || !track.Stems || track.Stems.length === 0) {
      return;
    }

    const ctx = initAudioContext();
    
    // Inicializa os volumes padrões para cada tipo de stem disponível na música
    const initialVolumes: Record<string, number> = {};
    const loadedStems: typeof activeStemsRef.current = [];

    // Master track/audio elemento de referência para progresso
    let masterAudioElement: HTMLAudioElement | null = null;

    track.Stems.forEach(stem => {
      const stemType = stem.StemType; // ex: Voz, Bateria, Baixo
      // O volume padrão das stems é 100% (1.0), exceto para o "Metrônomo" que inicia zerado (0.0)
      initialVolumes[stemType] = stemType === 'Metrônomo' ? 0.0 : 1.0;

      // Se for uma URL relativa, resolve com a URL do servidor backend para evitar 404 local
      const fullAudioUrl = stem.AudioUrl.startsWith('http')
        ? stem.AudioUrl
        : `${SERVER_URL}${stem.AudioUrl}`;

      // Cria elemento HTML5 Audio com pré-carregamento apenas dos metadados (streaming progressivo)
      const audio = new Audio(fullAudioUrl);
      audio.crossOrigin = 'anonymous';
      audio.preload = 'metadata';

      // Cria nós de Web Audio correspondentes
      const sourceNode = ctx.createMediaElementSource(audio);
      const gainNode = ctx.createGain();
      
      // Conecta o fluxo: Áudio -> Volume Canal -> Volume Master -> Saída física
      sourceNode.connect(gainNode);
      if (masterGainNodeRef.current) {
        gainNode.connect(masterGainNodeRef.current);
      } else {
        gainNode.connect(ctx.destination);
      }

      // Define volume inicial com base nas regras de default
      gainNode.gain.value = stemType === 'Metrônomo' ? 0.0 : 1.0;

      loadedStems.push({
        audio,
        gainNode,
        sourceNode,
        type: stemType
      });

      if (!masterAudioElement) {
        masterAudioElement = audio;
      }
    });

    setStemsMute({});
    setStemsSolo({});
    setStemsVolume(initialVolumes);
    activeStemsRef.current = loadedStems;
    updateAudioGains(initialVolumes, {}, {});

    // Sincroniza progresso e duração a partir do master audio
    if (masterAudioElement) {
      const master = masterAudioElement as HTMLAudioElement;

      master.addEventListener('durationchange', () => {
        setDuration(master.duration);
      });

      master.addEventListener('timeupdate', () => {
        setCurrentTime(master.currentTime);
      });

      master.addEventListener('ended', () => {
        setIsPlaying(false);
        seek(0);
      });
    }

    // Auto-play instantâneo
    setIsPlaying(true);
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Executa play simultâneo em todos os canais de áudio
    activeStemsRef.current.forEach(item => {
      item.audio.currentTime = 0;
      item.audio.play().catch(() => {
        // Bloqueio de auto-play nativo do browser, ignorado silenciosamente
      });
    });
  };

  const togglePlay = async () => {
    if (!currentTrack || activeStemsRef.current.length === 0) return;

    const ctx = initAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    if (isPlaying) {
      activeStemsRef.current.forEach(item => {
        item.audio.pause();
      });
      setIsPlaying(false);
    } else {
      // Sincroniza tempos milimetricamente antes de tocar
      const targetTime = activeStemsRef.current[0]?.audio.currentTime || 0;
      activeStemsRef.current.forEach(item => {
        item.audio.currentTime = targetTime;
        item.audio.play().catch(() => {});
      });
      setIsPlaying(true);
    }
  };

  const seek = (seconds: number) => {
    if (activeStemsRef.current.length === 0) return;
    
    activeStemsRef.current.forEach(item => {
      item.audio.currentTime = seconds;
    });
    setCurrentTime(seconds);
  };

  const setStemVolume = (type: string, volume: number) => {
    setStemsVolume(prev => {
      const next = { ...prev, [type]: volume };
      updateAudioGains(next, stemsMute, stemsSolo);
      return next;
    });
  };

  const toggleStemMute = (type: string) => {
    setStemsMute(prev => {
      const next = { ...prev, [type]: !prev[type] };
      updateAudioGains(stemsVolume, next, stemsSolo);
      return next;
    });
  };

  const toggleStemSolo = (type: string) => {
    setStemsSolo(prev => {
      const next = { ...prev, [type]: !prev[type] };
      updateAudioGains(stemsVolume, stemsMute, next);
      return next;
    });
  };

  const setMasterVolume = (volume: number) => {
    setMasterVolumeState(volume);
    if (masterGainNodeRef.current && audioContextRef.current) {
      masterGainNodeRef.current.gain.setValueAtTime(volume, audioContextRef.current.currentTime);
    }
  };

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        stemsVolume,
        stemsMute,
        stemsSolo,
        masterVolume,
        loadTrack,
        togglePlay,
        seek,
        setStemVolume,
        toggleStemMute,
        toggleStemSolo,
        setMasterVolume
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer deve ser utilizado dentro de um PlayerProvider');
  }
  return context;
};
