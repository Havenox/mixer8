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
  currentQueue: ITrack[];
  loadTrack: (track: ITrack | null, playlistId?: string, albumId?: string, tracksQueue?: ITrack[]) => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  setStemVolume: (type: string, volume: number) => void;
  toggleStemMute: (type: string) => void;
  toggleStemSolo: (type: string) => void;
  setMasterVolume: (volume: number) => void;
  downloadTrackForOffline: (track: ITrack) => Promise<void>;
  isTrackDownloaded: (track: ITrack) => Promise<boolean>;
  removeTrackOffline: (track: ITrack) => Promise<void>;
  playNextTrack: () => void;
  playPreviousTrack: () => void;
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

const CACHE_NAME = 'mixer8-stems-cache';

const getCachedOrFetchAudioUrl = async (url: string, isPremiumUser: boolean): Promise<string> => {
  if (typeof window === 'undefined' || !window.caches) {
    return url;
  }
  try {
    const cache = await caches.open(CACHE_NAME);
    const expiryKey = `mixer8_cache_expiry_${url}`;
    const expiry = localStorage.getItem(expiryKey);
    
    // Para usuários Premium, ignoramos a expiração (offline eterno)
    if (expiry && !isPremiumUser) {
      const expiresAt = parseInt(expiry, 10);
      if (Date.now() > expiresAt) {
        // console.log('[CACHE] Cache expirou para:', url);
        await cache.delete(url);
        localStorage.removeItem(expiryKey);
        return url;
      }
    }

    const cachedResponse = await cache.match(url);
    if (cachedResponse) {
      // console.log('[CACHE] Hit! Carregando do cache local:', url);
      const blob = await cachedResponse.blob();
      return URL.createObjectURL(blob);
    }
  } catch (err) {
    console.warn('[CACHE] Erro ao obter do cache:', err);
  }
  return url;
};

const cacheAudioInBackground = async (url: string, durationInSeconds: number, isPremiumUser: boolean) => {
  if (typeof window === 'undefined' || !window.caches) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(url);
    if (!cachedResponse) {
      const res = await fetch(url);
      if (res.ok) {
        await cache.put(url, res.clone());
        
        if (!isPremiumUser) {
          // Define a expiração apenas para usuários não Premium: duração da música * 10 em segundos
          const ttlSeconds = durationInSeconds * 10;
          const expiresAt = Date.now() + ttlSeconds * 1000;
          localStorage.setItem(`mixer8_cache_expiry_${url}`, expiresAt.toString());
          // console.log(`[CACHE] Audio cacheado em background. Expira em ${ttlSeconds}s:`, url);
        } else {
          // console.log(`[CACHE] Audio cacheado permanentemente em background (Premium):`, url);
        }
      }
    }
  } catch (err) {
    console.warn('[CACHE] Erro ao salvar audio em cache de background:', err);
  }
};

const cleanExpiredAudioCache = async (isPremiumUser: boolean) => {
  if (isPremiumUser) {
    // console.log('[CACHE-GC] Usuário Premium ativo. Pulando limpeza de expirados.');
    return;
  }
  if (typeof window === 'undefined' || !window.caches) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith('mixer8_cache_expiry_')) {
        const url = key.replace('mixer8_cache_expiry_', '');
        const expiry = localStorage.getItem(key);
        if (expiry) {
          const expiresAt = parseInt(expiry, 10);
          if (Date.now() > expiresAt) {
            // console.log('[CACHE-GC] Removendo cache expirado:', url);
            await cache.delete(url);
            localStorage.removeItem(key);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[CACHE-GC] Erro na limpeza de expirados:', err);
  }
};

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { Token, CurrentUser } = useAuth();
  const [currentTrack, setCurrentTrack] = useState<ITrack | null>(null);
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string | null>(null);
  const [currentAlbumId, setCurrentAlbumId] = useState<string | null>(null);
  const [currentQueue, setCurrentQueue] = useState<ITrack[]>([]);
  const currentQueueRef = useRef<ITrack[]>([]);

  const updateQueue = (queue: ITrack[]) => {
    setCurrentQueue(queue);
    currentQueueRef.current = queue;
  };

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

  // Referências locais para a barreira de sincronização e streaming progressivo silencioso
  const syncBarrierPromiseRef = useRef<Promise<void> | null>(null);
  const syncBarrierResolveRef = useRef<(() => void) | null>(null);
  const isSyncingRef = useRef(false);

  // Determina se o usuário tem privilégio Premium (PaidUser, Admin, Moderator)
  const isPremium = CurrentUser?.UserRole === 'PaidUser' || CurrentUser?.UserRole === 'Admin' || CurrentUser?.UserRole === 'Moderator';

  // Atualiza os ganhos de todas as stems ativas com base em volume, mute e solo
  const updateAudioGains = (
    volumes: Record<string, number>,
    mutes: Record<string, boolean>,
    solos: Record<string, boolean>
  ) => {
    const hasAnySolo = Object.values(solos).some(v => v);
    const isSyncing = isSyncingRef.current;

    activeStemsRef.current.forEach(item => {
      const type = item.type;
      
      let targetGain = 0;
      if (!isSyncing) {
        const vol = volumes[type] ?? (type === 'Metrônomo' ? 0.0 : 1.0);
        const isMuted = mutes[type] ?? false;
        const isSoloed = solos[type] ?? false;

        if (hasAnySolo) {
          // Se houver qualquer SOLO ativo, apenas as marcadas com SOLO tocam (mesmo se estiverem em Mute)
          targetGain = isSoloed ? vol : 0;
        } else {
          // Sem SOLO ativo, tocamos baseado no volume individual do fader e Mute
          targetGain = isMuted ? 0 : vol;
        }
      }

      item.gainNode.gain.setValueAtTime(targetGain, audioContextRef.current?.currentTime || 0);
    });
  };

  // Limpa tudo ao desmontar e executa Garbage Collector do cache ao montar/atualizar autenticação
  useEffect(() => {
    cleanExpiredAudioCache(isPremium);

    return () => {
      cleanupActiveStems();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [CurrentUser]);

  // Loop de alinhamento contínuo contra drift (desvio) rodando a cada 250ms
  useEffect(() => {
    if (!isPlaying || activeStemsRef.current.length <= 1) return;

    const interval = setInterval(() => {
      // Se estiver na fase de sincronização inicial ou de seek, pula a correção
      if (isSyncingRef.current) return;

      const masterItem = activeStemsRef.current[0];
      if (!masterItem) return;

      const masterTime = masterItem.audio.currentTime;
      const masterDuration = masterItem.audio.duration;

      // Se a música terminou ou está muito perto do fim (últimos 1.5s), não corrige drift.
      // Isso evita congestionar a thread de áudio com múltiplos seeks concorrentes no final da faixa,
      // o que gerava repetições em loop (gaguejos) e impedia o disparo do evento 'ended' no elemento master.
      if (masterItem.audio.ended || (masterDuration && masterTime >= masterDuration - 1.5)) {
        return;
      }

      for (let i = 1; i < activeStemsRef.current.length; i++) {
        const item = activeStemsRef.current[i];
        
        // Se a stem secundária terminou ou está pausada, pula a correção
        if (item.audio.ended || item.audio.paused) continue;

        const diff = Math.abs(item.audio.currentTime - masterTime);
        // Se o desvio for maior do que 50 milissegundos (0.05s)
        if (diff > 0.05) {
          // console.log(`[SYNC] Ajustando drift em stem '${item.type}': desvio de ${(diff * 1000).toFixed(1)}ms. Novo tempo alinhado: ${masterTime.toFixed(3)}s`);
          item.audio.currentTime = masterTime;
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isPlaying, currentTrack]);

  const cleanupActiveStems = () => {
    activeStemsRef.current.forEach(item => {
      item.audio.pause();
      const src = item.audio.src;
      item.audio.src = '';
      item.audio.load();
      if (src.startsWith('blob:')) {
        URL.revokeObjectURL(src);
      }
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

  const playNextTrack = () => {
    if (currentQueueRef.current.length === 0 || !currentTrack) return;
    const currentIndex = currentQueueRef.current.findIndex(t => t.TrackId === currentTrack.TrackId);
    if (currentIndex !== -1 && currentIndex < currentQueueRef.current.length - 1) {
      const nextTrack = currentQueueRef.current[currentIndex + 1];
      console.log('[AUTOPLAY] Pulando para a próxima faixa:', nextTrack.TrackTitle);
      loadTrack(nextTrack, currentPlaylistId || undefined, currentAlbumId || undefined);
    } else {
      console.log('[AUTOPLAY] Última faixa atingida na fila de reprodução.');
      setIsPlayingSynced(false);
      seek(0);
    }
  };

  const playPreviousTrack = () => {
    if (currentQueueRef.current.length === 0 || !currentTrack) return;
    const currentIndex = currentQueueRef.current.findIndex(t => t.TrackId === currentTrack.TrackId);
    
    // Se a música estiver tocando há mais de 3 segundos, o comportamento padrão do Spotify é reiniciar a música atual
    if (currentTime > 3) {
      console.log('[PLAYBACK] Reiniciando faixa atual...');
      seek(0);
      return;
    }

    if (currentIndex > 0) {
      const prevTrack = currentQueueRef.current[currentIndex - 1];
      console.log('[PLAYBACK] Voltando para a faixa anterior:', prevTrack.TrackTitle);
      loadTrack(prevTrack, currentPlaylistId || undefined, currentAlbumId || undefined);
    } else {
      console.log('[PLAYBACK] Primeira faixa atingida. Reiniciando...');
      seek(0);
    }
  };

  const loadTrack = async (
    track: ITrack | null,
    playlistId?: string,
    albumId?: string,
    tracksQueue?: ITrack[]
  ) => {
    setIsPlayingSynced(false);
    cleanupActiveStems();
    setCurrentTime(0);
    setDuration(0);
    setCurrentTrack(track);
    setCurrentPlaylistId(playlistId || null);
    setCurrentAlbumId(albumId || null);

    if (tracksQueue) {
      updateQueue(tracksQueue);
    } else if (track) {
      // Se tocada de forma avulsa sem fila e a fila atual não contém ela, cria uma fila unitária
      const existsInQueue = currentQueueRef.current.some(t => t.TrackId === track.TrackId);
      if (!existsInQueue) {
        updateQueue([track]);
      }
    }

    listeningAccumulatorRef.current = 0;
    hasRecordedPlayRef.current = false;

    if (!track || !track.Stems || track.Stems.length === 0) {
      return;
    }

    const ctx = initAudioContext();
    
    // Ativa a fase de sincronização inicial silenciosa
    isSyncingRef.current = true;

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
      console.warn('[SYNC] Safety timeout de 3.5s atingido. Liberando áudio.');
      resolveBarrier();
    }, 3500);

    const checkSyncBarrier = () => {
      stemsLoadedCount++;
      if (stemsLoadedCount === totalStemsCount) {
        clearTimeout(safetyTimeout);
        resolveBarrier();
      }
    };

    // Mapeia e resolve as URLs das stems (utilizando cache local se disponível)
    const resolvedStems = await Promise.all(
      track.Stems.map(async stem => {
        const fullAudioUrl = stem.AudioUrl.startsWith('http')
          ? stem.AudioUrl
          : `${SERVER_URL}${stem.AudioUrl}`;
        const url = await getCachedOrFetchAudioUrl(fullAudioUrl, isPremium);
        return {
          ...stem,
          ResolvedUrl: url
        };
      })
    );

    resolvedStems.forEach(stem => {
      const stemType = stem.StemType; // ex: Voz, Bateria, Baixo
      // O volume padrão das stems é 100% (1.0), exceto para o "Metrônomo" que inicia zerado (0.0)
      initialVolumes[stemType] = stemType === 'Metrônomo' ? 0.0 : 1.0;

      // Cria elemento HTML5 Audio. Se a ResolvedUrl for um Blob URL, ele carrega localmente de forma instantânea
      const audio = new Audio(stem.ResolvedUrl);
      audio.crossOrigin = 'anonymous';
      audio.preload = 'metadata';

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

      // Inicialmente ganho = 0 por conta da fase de sincronização silenciosa
      gainNode.gain.value = 0;

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
    
    // Atualiza os ganhos para zero de forma explícita
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
        playNextTrack();
      });
    }

    // Liga a reprodução nos elementos de áudio para disparar o buffering progressivo do navegador
    setIsPlayingSynced(true);
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Executa play silencioso imediato em todos os canais para iniciar o streaming progressivo
    await Promise.all(
      activeStemsRef.current.map(async item => {
        item.audio.currentTime = 0;
        try {
          await item.audio.play();
        } catch (err) {
          console.warn(`[PLAY] Auto-play block ou erro ao pré-iniciar stem ${item.type}:`, err);
        }
      })
    );

    // Aguarda barreira de sincronização (stems com dados suficientes para tocar)
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

    // Fim da fase de sincronização inicial
    isSyncingRef.current = false;

    // Se o usuário pausou enquanto carregava, pausamos todas as stems e saímos
    if (!isPlayingRef.current) {
      activeStemsRef.current.forEach(item => {
        item.audio.pause();
      });
      return;
    }

    // Alinha os tempos com precisão e restaura volumes originais
    const targetTime = activeStemsRef.current[0]?.audio.currentTime || 0;
    activeStemsRef.current.forEach(item => {
      item.audio.currentTime = targetTime;
    });

    updateAudioGains(initialVolumes, {}, {});

    // Dispara o download em cache de background após 3 segundos para priorizar reprodução inicial
    setTimeout(() => {
      if (activeStemsRef.current === loadedStems) {
        const trackDuration = masterAudioElement?.duration || 180;
        track.Stems.forEach(stem => {
          const fullAudioUrl = stem.AudioUrl.startsWith('http')
            ? stem.AudioUrl
            : `${SERVER_URL}${stem.AudioUrl}`;
          cacheAudioInBackground(fullAudioUrl, trackDuration, isPremium);
        });
      }
    }, 3000);
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

      // Se a sincronização inicial acabou, garante que os volumes estão ativos
      if (!isSyncingRef.current) {
        updateAudioGains(stemsVolume, stemsMute, stemsSolo);
      }
    }
  };

  const seek = async (seconds: number) => {
    if (activeStemsRef.current.length === 0) return;

    // Se estivermos tocando por Blob URLs locais, a resposta é imediata e não gera tráfego de rede.
    // Mas se estivermos rodando via streaming de rede progressivo, precisamos de uma barreira rápida para evitar stutters
    const isBlob = activeStemsRef.current[0]?.audio.src.startsWith('blob:');

    if (isBlob) {
      activeStemsRef.current.forEach(item => {
        item.audio.currentTime = seconds;
      });
      setCurrentTime(seconds);
      return;
    }

    // Caso de streaming de rede: Barreira de sincronização no Seek
    isSyncingRef.current = true;
    updateAudioGains(stemsVolume, stemsMute, stemsSolo);

    let stemsLoadedCount = 0;
    const totalStemsCount = activeStemsRef.current.length;
    let isSeekBarrierResolved = false;

    const seekBarrierPromise = new Promise<void>((resolve) => {
      const resolveSeek = () => {
        if (isSeekBarrierResolved) return;
        isSeekBarrierResolved = true;
        resolve();
      };

      // Safety timeout para seek (2 segundos)
      const safetyTimeout = setTimeout(() => {
        console.warn('[SEEK-SYNC] Safety timeout atingido durante seek.');
        resolveSeek();
      }, 2000);

      const checkSeekBarrier = () => {
        stemsLoadedCount++;
        if (stemsLoadedCount === totalStemsCount) {
          clearTimeout(safetyTimeout);
          resolveSeek();
        }
      };

      activeStemsRef.current.forEach(item => {
        const audio = item.audio;

        const onSeeked = () => {
          audio.removeEventListener('seeked', onSeeked);
          audio.removeEventListener('error', onSeekedError);
          checkSeekBarrier();
        };

        const onSeekedError = () => {
          audio.removeEventListener('seeked', onSeeked);
          audio.removeEventListener('error', onSeekedError);
          checkSeekBarrier();
        };

        if (audio.readyState >= 3) {
          checkSeekBarrier();
        } else {
          audio.addEventListener('seeked', onSeeked);
          audio.addEventListener('error', onSeekedError);
        }

        audio.currentTime = seconds;
      });
    });

    setCurrentTime(seconds);

    try {
      await seekBarrierPromise;
    } catch (err) {
      console.error('[SEEK-SYNC] Erro na barreira de seek:', err);
    }

    isSyncingRef.current = false;
    
    // Se o usuário ainda quer tocar
    if (isPlayingRef.current) {
      updateAudioGains(stemsVolume, stemsMute, stemsSolo);
    }
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
            // console.log('[PLAY RECORDED]', await res.json());
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

  const downloadTrackForOffline = async (track: ITrack) => {
    if (!isPremium) {
      console.warn('[CACHE] Usuário não é Premium. Download para offline bloqueado.');
      return;
    }
    try {
      // console.log(`[CACHE] Iniciando download offline completo da faixa: ${track.TrackTitle}`);
      await Promise.all(
        track.Stems.map(async stem => {
          const fullAudioUrl = stem.AudioUrl.startsWith('http')
            ? stem.AudioUrl
            : `${SERVER_URL}${stem.AudioUrl}`;
          
          if (typeof window !== 'undefined' && window.caches) {
            const cache = await caches.open(CACHE_NAME);
            const cachedResponse = await cache.match(fullAudioUrl);
            if (!cachedResponse) {
              const res = await fetch(fullAudioUrl);
              if (res.ok) {
                await cache.put(fullAudioUrl, res.clone());
              }
            }
            // Garante que não há nenhuma expiração configurada para este arquivo
            const expiryKey = `mixer8_cache_expiry_${fullAudioUrl}`;
            localStorage.removeItem(expiryKey);
          }
        })
      );
      // console.log(`[CACHE] Download concluído com sucesso: ${track.TrackTitle}`);
      window.dispatchEvent(new CustomEvent('track-downloaded', { detail: { trackId: track.TrackId } }));
    } catch (err) {
      console.error('[CACHE] Erro no download offline da faixa:', err);
    }
  };

  const isTrackDownloaded = async (track: ITrack): Promise<boolean> => {
    if (typeof window === 'undefined' || !window.caches || !track.Stems || track.Stems.length === 0) {
      return false;
    }
    try {
      const cache = await caches.open(CACHE_NAME);
      for (const stem of track.Stems) {
        const fullAudioUrl = stem.AudioUrl.startsWith('http')
          ? stem.AudioUrl
          : `${SERVER_URL}${stem.AudioUrl}`;
        const matched = await cache.match(fullAudioUrl);
        if (!matched) return false;
      }
      return true;
    } catch {
      return false;
    }
  };

  const removeTrackOffline = async (track: ITrack) => {
    try {
      // console.log(`[CACHE] Removendo download offline da faixa: ${track.TrackTitle}`);
      if (typeof window !== 'undefined' && window.caches) {
        const cache = await caches.open(CACHE_NAME);
        for (const stem of track.Stems) {
          const fullAudioUrl = stem.AudioUrl.startsWith('http')
            ? stem.AudioUrl
            : `${SERVER_URL}${stem.AudioUrl}`;
          await cache.delete(fullAudioUrl);
          const expiryKey = `mixer8_cache_expiry_${fullAudioUrl}`;
          localStorage.removeItem(expiryKey);
        }
      }
      // console.log(`[CACHE] Downloads removidos para a faixa: ${track.TrackTitle}`);
      window.dispatchEvent(new CustomEvent('track-downloaded', { detail: { trackId: track.TrackId } }));
    } catch (err) {
      console.error('[CACHE] Erro ao remover track do cache:', err);
    }
  };

  // Atualização de Metadados na Media Session API
  useEffect(() => {
    if (!currentTrack || !('mediaSession' in navigator)) return;

    const fullCoverUrl = currentTrack.CoverUrl 
      ? (currentTrack.CoverUrl.startsWith('http') ? currentTrack.CoverUrl : `${SERVER_URL}${currentTrack.CoverUrl}`)
      : '';

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.TrackTitle,
      artist: currentTrack.ArtistName,
      album: currentPlaylistId ? 'Playlist Mixer8' : (currentAlbumId ? 'Álbum Mixer8' : 'Biblioteca Mixer8'),
      artwork: fullCoverUrl ? [
        { src: fullCoverUrl, sizes: '96x96', type: 'image/webp' },
        { src: fullCoverUrl, sizes: '128x128', type: 'image/webp' },
        { src: fullCoverUrl, sizes: '192x192', type: 'image/webp' },
        { src: fullCoverUrl, sizes: '256x256', type: 'image/webp' },
        { src: fullCoverUrl, sizes: '384x384', type: 'image/webp' },
        { src: fullCoverUrl, sizes: '512x512', type: 'image/webp' },
      ] : []
    });
  }, [currentTrack, currentPlaylistId, currentAlbumId]);

  // Atualização do Estado de Reprodução (Playing/Paused)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  // Registro de Action Handlers Nativos para a Lockscreen / Fones Bluetooth
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', () => {
      togglePlay();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      togglePlay();
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      playNextTrack();
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      playPreviousTrack();
    });
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) {
        seek(details.seekTime);
      }
    });

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('seekto', null);
    };
  }, [currentTrack, isPlaying]);

  // Sincronização Dinâmica da Posição de Reprodução na Barra do Sistema
  useEffect(() => {
    if (!('mediaSession' in navigator) || !duration || isNaN(duration)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: duration,
        playbackRate: 1.0,
        position: Math.min(currentTime, duration)
      });
    } catch (err) {
      console.warn('[MEDIA-SESSION] Erro ao sincronizar posição de mídia:', err);
    }
  }, [currentTime, duration]);

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
        setMasterVolume,
        downloadTrackForOffline,
        isTrackDownloaded,
        removeTrackOffline,
        currentQueue,
        playNextTrack,
        playPreviousTrack
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
