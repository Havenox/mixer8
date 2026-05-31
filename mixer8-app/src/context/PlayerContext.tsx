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
  loadTrack: (track: ITrack | null, playlistId?: string, albumId?: string) => void;
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

import { SERVER_URL, API_URL } from '../config';
import { useAuth } from './AuthContext';

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { Token } = useAuth();
  const [currentTrack, setCurrentTrack] = useState<ITrack | null>(null);
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string | null>(null);
  const [currentAlbumId, setCurrentAlbumId] = useState<string | null>(null);

  const listeningAccumulatorRef = useRef(0);
  const hasRecordedPlayRef = useRef(false);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const isPlayingRef = useRef(false);
  const setIsPlayingSynced = (val: boolean) => {
    setIsPlaying(val);
    isPlayingRef.current = val;
  };

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

  // Referências locais para a barreira de sincronização
  const syncBarrierPromiseRef = useRef<Promise<void> | null>(null);
  const syncBarrierResolveRef = useRef<(() => void) | null>(null);

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

  // Loop de alinhamento contínuo contra drift (desvio) rodando a cada 250ms
  useEffect(() => {
    if (!isPlaying || activeStemsRef.current.length <= 1) return;

    const interval = setInterval(() => {
      const masterItem = activeStemsRef.current[0];
      if (!masterItem) return;

      const masterTime = masterItem.audio.currentTime;

      for (let i = 1; i < activeStemsRef.current.length; i++) {
        const item = activeStemsRef.current[i];
        const diff = Math.abs(item.audio.currentTime - masterTime);
        // Se o desvio for maior do que 50 milissegundos (0.05s)
        if (diff > 0.05) {
          console.log(`[SYNC] Ajustando drift em stem '${item.type}': desvio de ${(diff * 1000).toFixed(1)}ms. Novo tempo alinhado: ${masterTime.toFixed(3)}s`);
          item.audio.currentTime = masterTime;
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isPlaying, currentTrack]);

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

  const loadTrack = async (track: ITrack | null, playlistId?: string, albumId?: string) => {
    setIsPlayingSynced(false);
    cleanupActiveStems();
    setCurrentTime(0);
    setDuration(0);
    setCurrentTrack(track);
    setCurrentPlaylistId(playlistId || null);
    setCurrentAlbumId(albumId || null);

    listeningAccumulatorRef.current = 0;
    hasRecordedPlayRef.current = false;

    if (!track || !track.Stems || track.Stems.length === 0) {
      return;
    }

    const ctx = initAudioContext();
    
    // Inicializa os volumes padrões para cada tipo de stem disponível na música
    const initialVolumes: Record<string, number> = {};
    const loadedStems: typeof activeStemsRef.current = [];

    // Master track/audio elemento de referência para progresso
    let masterAudioElement: HTMLAudioElement | null = null;

    let stemsLoadedCount = 0;
    const totalStemsCount = track.Stems.length;
    let isBarrierResolved = false;

    // Sincronização: Criação da Promise de barreira
    syncBarrierPromiseRef.current = new Promise<void>((resolve) => {
      syncBarrierResolveRef.current = resolve;
    });

    const resolveBarrier = () => {
      if (isBarrierResolved) return;
      isBarrierResolved = true;
      syncBarrierResolveRef.current?.();
      syncBarrierPromiseRef.current = null;
    };

    // Timeout de segurança para não congelar o player em falhas de rede (3.5 segundos)
    const safetyTimeout = setTimeout(() => {
      console.warn('[SYNC] Safety timeout de 3.5s atingido. Liberando reprodução com as stems prontas.');
      resolveBarrier();
    }, 3500);

    const checkSyncBarrier = () => {
      stemsLoadedCount++;
      if (stemsLoadedCount === totalStemsCount) {
        clearTimeout(safetyTimeout);
        resolveBarrier();
      }
    };

    track.Stems.forEach(stem => {
      const stemType = stem.StemType; // ex: Voz, Bateria, Baixo
      // O volume padrão das stems é 100% (1.0), exceto para o "Metrônomo" que inicia zerado (0.0)
      initialVolumes[stemType] = stemType === 'Metrônomo' ? 0.0 : 1.0;

      // Se for uma URL relativa, resolve com a URL do servidor backend para evitar 404 local
      const fullAudioUrl = stem.AudioUrl.startsWith('http')
        ? stem.AudioUrl
        : `${SERVER_URL}${stem.AudioUrl}`;

      // Cria elemento HTML5 Audio com pré-carregamento agressivo ('auto')
      const audio = new Audio(fullAudioUrl);
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';

      const onCanPlay = () => {
        audio.removeEventListener('canplay', onCanPlay);
        audio.removeEventListener('error', onError);
        checkSyncBarrier();
      };

      const onError = (e: any) => {
        console.warn(`[SYNC] Erro ao carregar stem ${stemType}:`, e);
        audio.removeEventListener('canplay', onCanPlay);
        audio.removeEventListener('error', onError);
        checkSyncBarrier(); // Conta como carregado para não travar
      };

      // Se por algum motivo já estiver pronto
      if (audio.readyState >= 3) {
        checkSyncBarrier();
      } else {
        audio.addEventListener('canplay', onCanPlay);
        audio.addEventListener('error', onError);
      }

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
        setIsPlayingSynced(false);
        seek(0);
      });
    }

    // Auto-play instantâneo
    setIsPlayingSynced(true);
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Aguarda barreira de sincronização
    try {
      if (syncBarrierPromiseRef.current) {
        await syncBarrierPromiseRef.current;
      }
    } catch (err) {
      console.error('[SYNC] Falha ao aguardar barreira de sincronização:', err);
    }

    // Verifica se a track atual ainda é esta após o await
    if (activeStemsRef.current !== loadedStems) {
      return;
    }

    // Se o usuário pausou enquanto carregava, não inicia o play
    if (!isPlayingRef.current) {
      return;
    }

    // Executa play simultâneo em todos os canais de áudio na mesma microtask
    await Promise.all(
      activeStemsRef.current.map(async item => {
        item.audio.currentTime = 0;
        try {
          await item.audio.play();
        } catch (err) {
          console.warn(`[PLAY] Bloqueio de auto-play ou erro na stem ${item.type}:`, err);
        }
      })
    );
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
      setIsPlayingSynced(false);
    } else {
      // Sincroniza tempos milimetricamente antes de tocar
      const targetTime = activeStemsRef.current[0]?.audio.currentTime || 0;
      setIsPlayingSynced(true);
      
      await Promise.all(
        activeStemsRef.current.map(async item => {
          item.audio.currentTime = targetTime;
          try {
            await item.audio.play();
          } catch (err) {
            console.warn(`[PLAY] Erro ao tocar stem ${item.type}:`, err);
          }
        })
      );
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

  // Efeito para acumular tempo escutado e registrar reprodução (PlayCount) com rate-limit
  useEffect(() => {
    if (!isPlaying || !currentTrack || hasRecordedPlayRef.current) return;

    const interval = setInterval(async () => {
      listeningAccumulatorRef.current += 1;

      // Limiar: 30 segundos (ou 50% da música caso ela seja mais curta que 30s)
      const targetSeconds = Math.min(30, Math.floor(duration > 0 ? duration / 2 : 30));

      if (listeningAccumulatorRef.current >= targetSeconds) {
        hasRecordedPlayRef.current = true;
        clearInterval(interval);

        try {
          const body: Record<string, string> = {};
          if (currentPlaylistId) body['PlaylistId'] = currentPlaylistId;
          if (currentAlbumId) body['AlbumId'] = currentAlbumId;

          const headers: Record<string, string> = {
            'Content-Type': 'application/json'
          };
          if (Token) {
            headers['Authorization'] = `Bearer ${Token}`;
          }

          const res = await fetch(`${API_URL}/Tracks/${currentTrack.TrackId}/RecordPlay`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
          });

          if (res.ok) {
            console.log('[PLAY RECORDED]', await res.json());
          } else {
            console.warn('[PLAY RECORD FAILED]', res.status);
          }
        } catch (err) {
          console.error('[PLAY RECORD ERROR]', err);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, currentTrack, duration, currentPlaylistId, currentAlbumId, Token]);

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
