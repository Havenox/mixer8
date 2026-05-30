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
  masterVolume: number;
  loadTrack: (track: ITrack) => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  setStemVolume: (type: string, volume: number) => void;
  setMasterVolume: (volume: number) => void;
}

const PlayerContext = createContext<IPlayerContext | undefined>(undefined);

// Lista das 10 Stems padronizadas da especificação
export const STANDARD_STEMS = [
  'Vocais',
  'Bateria',
  'Baixo',
  'Guitarra',
  'Piano',
  'Teclado',
  'Sopro',
  'Cordas',
  'Metrônomo',
  'Outros'
];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SERVER_URL = API_URL.replace('/api', '');

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<ITrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Volumes individuais de stems (padrão 0.8)
  const [stemsVolume, setStemsVolume] = useState<Record<string, number>>({});
  const [masterVolume, setMasterVolumeState] = useState(0.8);

  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainNodeRef = useRef<GainNode | null>(null);
  
  // Referências para gerenciar elementos de áudio e nós do Web Audio API sem causar re-renders indesejados
  const activeStemsRef = useRef<{
    audio: HTMLAudioElement;
    gainNode: GainNode;
    sourceNode: MediaElementAudioSourceNode;
    type: string;
  }[]>([]);

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

  const loadTrack = async (track: ITrack) => {
    setIsPlaying(false);
    cleanupActiveStems();
    setCurrentTime(0);
    setDuration(0);
    setCurrentTrack(track);

    if (!track.Stems || track.Stems.length === 0) {
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
      initialVolumes[stemType] = 0.8;

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

      // Define volume inicial
      gainNode.gain.value = 0.8;

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

    setStemsVolume(initialVolumes);
    activeStemsRef.current = loadedStems;

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
    setStemsVolume(prev => ({ ...prev, [type]: volume }));
    
    // Atualiza ganho direto no nó Web Audio API
    const stemNode = activeStemsRef.current.find(item => item.type === type);
    if (stemNode) {
      stemNode.gainNode.gain.setValueAtTime(volume, audioContextRef.current?.currentTime || 0);
    }
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
        masterVolume,
        loadTrack,
        togglePlay,
        seek,
        setStemVolume,
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
