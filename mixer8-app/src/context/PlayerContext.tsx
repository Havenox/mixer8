import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { exportMixToMp3 } from '../utils/mixExporter';

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
  DownloadUrl?: string;
  Stems: IStem[];
  Visibility?: string;
  UploadedBy?: string;
  UploadedByEmail?: string;
  UploadedByUserName?: string;
  DeletionPending?: boolean;
  DeletionReason?: string;
  Bpm?: number | null;
  Key?: string | null;
}

export const isMetronomeStem = (type?: string): boolean => {
  if (!type) return false;
  const lower = type.toLowerCase();
  return lower.includes('metronomo') || lower.includes('metrônomo') || lower.includes('metronome') || lower.includes('click');
};

interface IPlayerContext {
  currentTrack: ITrack | null;
  currentPlaylistId: string | null;
  currentPlaylistName: string | null;
  currentAlbumId: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  stemsVolume: Record<string, number>;
  stemsMute: Record<string, boolean>;
  stemsSolo: Record<string, boolean>;
  stemsPan: Record<string, number>;
  masterVolume: number;
  currentQueue: ITrack[];
  loadTrack: (track: ITrack | null, playlistId?: string, albumId?: string, tracksQueue?: ITrack[], playlistName?: string) => void;
  togglePlay: () => void;
  seek: (seconds: number) => void;
  setStemVolume: (type: string, volume: number) => void;
  toggleStemMute: (type: string) => void;
  toggleStemSolo: (type: string) => void;
  setStemPan: (type: string, pan: number) => void;
  setMasterVolume: (volume: number) => void;
  downloadTrackForOffline: (track: ITrack) => Promise<void>;
  isTrackDownloaded: (track: ITrack) => Promise<boolean>;
  removeTrackOffline: (track: ITrack) => Promise<void>;
  playNextTrack: () => void;
  playPreviousTrack: () => void;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  toggleShuffle: () => void;
  toggleRepeatMode: () => void;
  isPremium: boolean;
  transpose: number;
  setTranspose: React.Dispatch<React.SetStateAction<number>>;
  bpmDelta: number;
  setBpmDelta: React.Dispatch<React.SetStateAction<number>>;
  audioEngineMode: 'Power' | 'Lite';
  setAudioEngineMode: (mode: 'Power' | 'Lite') => void;
  activeOverlay: ActiveOverlayType;
  setActiveOverlay: React.Dispatch<React.SetStateAction<ActiveOverlayType>>;
  showChords: boolean;
  setShowChords: React.Dispatch<React.SetStateAction<boolean>>;
  isExporting: boolean;
  exportProgress: number;
  exportStatusMessage: string;
  exportFileName: string;
  exportCoverUrl?: string;
  exportError: string | null;
  exportSuccess: boolean;
  exportMix: () => Promise<void>;
  closeExportToast: () => void;
}

export type ActiveOverlayType = 'none' | 'daw' | 'lyrics' | 'mixer' | 'player';

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
        console.log('[CACHE] Cache expirou para:', url);
        await cache.delete(url);
        localStorage.removeItem(expiryKey);
        return url;
      }
    }

    const cachedResponse = await cache.match(url);
    if (cachedResponse) {
      console.log('[CACHE] Hit! Carregando do cache local:', url);
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
          console.log(`[CACHE] Audio cacheado em background. Expira em ${ttlSeconds}s:`, url);
        } else {
          console.log(`[CACHE] Audio cacheado permanentemente em background (Premium):`, url);
        }
      }
    }
  } catch (err) {
    console.warn('[CACHE] Erro ao salvar audio em cache de background:', err);
  }
};

const cleanExpiredAudioCache = async (isPremiumUser: boolean) => {
  if (isPremiumUser) {
    console.log('[CACHE-GC] Usuário Premium ativo. Pulando limpeza de expirados.');
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
            console.log('[CACHE-GC] Removendo cache expirado:', url);
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
  const [currentPlaylistName, setCurrentPlaylistName] = useState<string | null>(null);
  const [transpose, setTranspose] = useState<number>(0);
  const [bpmDelta, setBpmDelta] = useState<number>(0);
  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlayType>('none');
  const [showChords, setShowChords] = useState<boolean>(() => {
    return localStorage.getItem('mixer8:show-chords') === 'true';
  });
  const [currentAlbumId, setCurrentAlbumId] = useState<string | null>(null);

  // Fecha qualquer overlay ativo quando nenhuma música estiver carregada
  useEffect(() => {
    if (!currentTrack) {
      setActiveOverlay('none');
    }
  }, [currentTrack]);

  // Carrega configurações de transposição e BPM específicas de cada música do localStorage
  useEffect(() => {
    if (currentTrack?.TrackId) {
      const cachedTranspose = localStorage.getItem(`mixer8:track:${currentTrack.TrackId}:transpose`);
      const cachedBpmDelta = localStorage.getItem(`mixer8:track:${currentTrack.TrackId}:bpm-delta`);
      setTranspose(cachedTranspose ? parseInt(cachedTranspose) : 0);
      setBpmDelta(cachedBpmDelta ? parseInt(cachedBpmDelta) : 0);
    } else {
      setTranspose(0);
      setBpmDelta(0);
    }
  }, [currentTrack?.TrackId]);

  // Salva transposição do tom da música atual no localStorage
  useEffect(() => {
    if (currentTrack?.TrackId) {
      localStorage.setItem(`mixer8:track:${currentTrack.TrackId}:transpose`, String(transpose));
    }
  }, [transpose, currentTrack?.TrackId]);

  // Salva variação de BPM da música atual no localStorage
  useEffect(() => {
    if (currentTrack?.TrackId) {
      localStorage.setItem(`mixer8:track:${currentTrack.TrackId}:bpm-delta`, String(bpmDelta));
    }
  }, [bpmDelta, currentTrack?.TrackId]);

  // Salva estado global de exibição de cifras no localStorage
  useEffect(() => {
    localStorage.setItem('mixer8:show-chords', String(showChords));
  }, [showChords]);
  const [currentQueue, setCurrentQueue] = useState<ITrack[]>([]);
  const currentQueueRef = useRef<ITrack[]>([]);

  const currentTrackRef = useRef<ITrack | null>(null);
  const currentPlaylistIdRef = useRef<string | null>(null);
  const currentPlaylistNameRef = useRef<string | null>(null);
  const currentAlbumIdRef = useRef<string | null>(null);

  // Busca o nome da playlist se tivermos o playlistId mas faltar o nome da playlist
  useEffect(() => {
    if (!currentPlaylistId || currentPlaylistName) return;

    let isMounted = true;
    const fetchPlaylistInfo = async () => {
      try {
        const headers: Record<string, string> = {};
        if (Token) headers['Authorization'] = `Bearer ${Token}`;
        const res = await fetch(`${API_URL}/Playlists/${currentPlaylistId}`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data?.Name) {
            setCurrentPlaylistName(data.Name);
            currentPlaylistNameRef.current = data.Name;
          }
        }
      } catch (err) {
        console.warn('Erro ao buscar nome da playlist:', err);
      }
    };

    fetchPlaylistInfo();
    return () => { isMounted = false; };
  }, [currentPlaylistId, currentPlaylistName, Token]);

  // Referências de funções do player para evitar unbind/rebind de event listeners e handlers da mediaSession
  const playNextTrackRef = useRef<() => void>(() => {});
  const playPreviousTrackRef = useRef<() => void>(() => {});
  const togglePlayRef = useRef<() => void>(() => {});
  const seekRef = useRef<(seconds: number) => Promise<void>>(() => Promise.resolve());

  // Estados e referências mutáveis de Shuffle (Aleatório) e Repeat (Repetição)
  const [isShuffle, setIsShuffle] = useState(() => {
    const saved = localStorage.getItem('mixer8_shuffle');
    return saved !== null ? saved === 'true' : false;
  });
  const isShuffleRef = useRef(isShuffle);

  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>(() => {
    const saved = localStorage.getItem('mixer8_repeat_mode');
    return saved !== null ? (saved as 'off' | 'all' | 'one') : 'all';
  });
  const repeatModeRef = useRef(repeatMode);

  // Histórico de faixas tocadas em ordem cronológica no modo aleatório para evitar repetições
  const playedTrackIdsRef = useRef<string[]>([]);

  const setIsShuffleSynced = (val: boolean) => {
    setIsShuffle(val);
    isShuffleRef.current = val;
    localStorage.setItem('mixer8_shuffle', String(val));
  };

  const setRepeatModeSynced = (val: 'off' | 'all' | 'one') => {
    setRepeatMode(val);
    repeatModeRef.current = val;
    localStorage.setItem('mixer8_repeat_mode', val);
  };

  const toggleShuffle = () => {
    const newVal = !isShuffleRef.current;
    setIsShuffleSynced(newVal);
    console.log('[PLAYER-SETTING] Modo aleatório (Shuffle) alterado para:', newVal);
    // Se ativou shuffle, garantimos que a faixa atual esteja no histórico para não repeti-la
    if (newVal && currentTrackRef.current) {
      playedTrackIdsRef.current = [currentTrackRef.current.TrackId];
    } else {
      playedTrackIdsRef.current = [];
    }
  };

  const toggleRepeatMode = () => {
    let nextMode: 'off' | 'all' | 'one';
    if (repeatModeRef.current === 'off') {
      nextMode = 'all';
    } else if (repeatModeRef.current === 'all') {
      nextMode = 'one';
    } else {
      nextMode = 'off';
    }
    setRepeatModeSynced(nextMode);
    console.log('[PLAYER-SETTING] Modo de repetição alterado para:', nextMode);
  };


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
  
  // Volumes individuais de stems (padrão 1.0, exceto metronomo) - carregados de localStorage para persistência
  const [stemsVolume, setStemsVolume] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('mixer8_stems_volume');
    return saved !== null ? JSON.parse(saved) : {};
  });
  const [stemsMute, setStemsMute] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('mixer8_stems_mute');
    return saved !== null ? JSON.parse(saved) : {};
  });
  const [stemsSolo, setStemsSolo] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('mixer8_stems_solo');
    return saved !== null ? JSON.parse(saved) : {};
  });
  const [stemsPan, setStemsPan] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('mixer8_stems_pan');
    return saved !== null ? JSON.parse(saved) : {};
  });
  const [masterVolume, setMasterVolumeState] = useState(() => {
    const saved = localStorage.getItem('mixer8_master_volume');
    return saved !== null ? parseFloat(saved) : 1.0;
  });

  // Referências mutáveis globais para mutes, solos e volumes das stems para evitar atrasos reativos ou closures obsoletas
  const stemsVolumeRef = useRef<Record<string, number>>(stemsVolume);
  const stemsMuteRef = useRef<Record<string, boolean>>(stemsMute);
  const stemsSoloRef = useRef<Record<string, boolean>>(stemsSolo);
  const stemsPanRef = useRef<Record<string, number>>(stemsPan);

  // Sincroniza referências com os estados a cada ciclo de render
  useEffect(() => {
    stemsVolumeRef.current = stemsVolume;
    stemsMuteRef.current = stemsMute;
    stemsSoloRef.current = stemsSolo;
    stemsPanRef.current = stemsPan;
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainNodeRef = useRef<GainNode | null>(null);
  const pitchWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const metronomeDelayNodeRef = useRef<DelayNode | null>(null);

  // Referências para gerenciar elementos de áudio e nós do Web Audio API sem causar re-renders indesejados
  const activeStemsRef = useRef<{
    audio: HTMLAudioElement;
    gainNode: GainNode;
    sourceNode: MediaElementAudioSourceNode;
    pannerNode?: StereoPannerNode;
    type: string;
  }[]>([]);

  // Referências locais para a barreira de sincronização e streaming progressivo silencioso
  const syncBarrierPromiseRef = useRef<Promise<void> | null>(null);
  const syncBarrierResolveRef = useRef<(() => void) | null>(null);
  const isSyncingRef = useRef(false);

  const [audioEngineMode, setAudioEngineModeState] = useState<'Power' | 'Lite'>(() => {
    const saved = localStorage.getItem('mixer8_audio_engine_mode');
    if (saved === 'Power' || saved === 'Lite') return saved;
    return CurrentUser?.AudioEngineMode === 'Lite' ? 'Lite' : 'Power';
  });

  const setAudioEngineMode = (mode: 'Power' | 'Lite') => {
    setAudioEngineModeState(mode);
    localStorage.setItem('mixer8_audio_engine_mode', mode);
  };

  useEffect(() => {
    if (CurrentUser?.AudioEngineMode === 'Lite' || CurrentUser?.AudioEngineMode === 'Power') {
      setAudioEngineModeState(CurrentUser.AudioEngineMode as 'Power' | 'Lite');
      localStorage.setItem('mixer8_audio_engine_mode', CurrentUser.AudioEngineMode);
    }
  }, [CurrentUser]);

  // Aplica as configurações atuais de Pitch (tom) e Tempo (BPM) a todos os elementos de áudio e nós de processamento
  const applyPitchAndTempoSettings = useCallback(() => {
    const baseBpm = currentTrackRef.current?.Bpm || 120;
    const targetBpm = Math.max(30, baseBpm + bpmDelta);
    const speedRatio = targetBpm / baseBpm;

    if (audioEngineMode === 'Power') {
      // 1. Modo Power: WASM SIMD (Signalsmith Stretch) na thread de AudioWorklet cuida da afinação/tom
      if (pitchWorkletNodeRef.current) {
        pitchWorkletNodeRef.current.port.postMessage({ type: 'SET_PITCH', semitones: transpose });
      }

      // Compensação de latência de processamento do nó WASM (Signalsmith Stretch) no Metrônomo (120ms)
      if (metronomeDelayNodeRef.current) {
        const targetDelay = (transpose !== 0 && pitchWorkletNodeRef.current) ? 0.12 : 0.0;
        try {
          const ctx = audioContextRef.current;
          if (ctx) {
            metronomeDelayNodeRef.current.delayTime.setValueAtTime(targetDelay, ctx.currentTime);
          } else {
            metronomeDelayNodeRef.current.delayTime.value = targetDelay;
          }
        } catch (err) {
          metronomeDelayNodeRef.current.delayTime.value = targetDelay;
        }
      }

      // Altera o playbackRate dos elementos HTMLAudioElement mantendo preservesPitch = true (time stretch sem alterar tom nativo)
      activeStemsRef.current.forEach(item => {
        if (item.audio) {
          (item.audio as any).preservesPitch = true;
          (item.audio as any).webkitPreservesPitch = true;
          (item.audio as any).mozPreservesPitch = true;
          item.audio.playbackRate = speedRatio;
        }
      });
    } else if (audioEngineMode === 'Lite') {
      // No modo Lite, a latência é zero
      if (metronomeDelayNodeRef.current) {
        metronomeDelayNodeRef.current.delayTime.value = 0.0;
      }

      // 2. Modo Lite: Web Audio API Nativo do navegador
      // Quando transpose === 0, mantém preservesPitch = true para que a alteração de BPM preserve o tom original (sem efeito de disco)
      const pitchRatio = Math.pow(2, transpose / 12);
      const combinedRate = pitchRatio * speedRatio;
      const shouldPreservePitch = transpose === 0;

      activeStemsRef.current.forEach(item => {
        if (item.audio) {
          const isMetronome = isMetronomeStem(item.type);
          if (isMetronome) {
            // O Metrônomo NUNCA altera o tom (sempre preserva o tom original e usa apenas a taxa de velocidade do BPM)
            (item.audio as any).preservesPitch = true;
            (item.audio as any).webkitPreservesPitch = true;
            (item.audio as any).mozPreservesPitch = true;
            item.audio.playbackRate = speedRatio;
          } else {
            (item.audio as any).preservesPitch = shouldPreservePitch;
            (item.audio as any).webkitPreservesPitch = shouldPreservePitch;
            (item.audio as any).mozPreservesPitch = shouldPreservePitch;
            item.audio.playbackRate = combinedRate;
          }
        }
      });
    }
  }, [transpose, bpmDelta, audioEngineMode]);

  // Atualização em tempo real da transposição de tom e velocidade/BPM ao mudar estados reativos
  useEffect(() => {
    applyPitchAndTempoSettings();
  }, [applyPitchAndTempoSettings, currentTrack?.Bpm]);


  // Estado de configurações globais de permissões do sistema
  const [systemSettings, setSystemSettings] = useState<Record<string, string>>({
    PremiumFeature_DownloadOffline: 'Admin,Moderator,PaidUser'
  });

  const fetchSystemSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/SystemSettings`);
      if (res.ok) {
        const data = await res.json();
        setSystemSettings(data);
      }
    } catch (err) {
      console.warn('[SETTINGS] Falha ao obter configuracoes de rede. Usando defaults.', err);
    }
  };

  useEffect(() => {
    fetchSystemSettings();
    window.addEventListener('system-settings-changed', fetchSystemSettings);
    return () => {
      window.removeEventListener('system-settings-changed', fetchSystemSettings);
    };
  }, []);

  const checkFeaturePermission = (featureKey: string): boolean => {
    const allowedRolesStr = systemSettings[featureKey] || 'Admin,Moderator,PaidUser';
    const allowedRoles = allowedRolesStr.split(',').map(r => r.trim().toLowerCase());
    const userRole = CurrentUser ? CurrentUser.UserRole.toLowerCase() : 'anonymous';
    return allowedRoles.includes(userRole);
  };

  // Determina se o usuário tem privilégio Premium (PaidUser, Admin, Moderator ou anonymous conforme config do sistema)
  const isPremium = checkFeaturePermission('PremiumFeature_DownloadOffline');

  // Atualiza os ganhos de todas as stems ativas com base em volume, mute e solo
  const updateAudioGains = (
    volumes: Record<string, number>,
    mutes: Record<string, boolean>,
    solos: Record<string, boolean>
  ) => {
    const hasAnySolo = Object.values(solos).some(v => v);
    const isSyncing = isSyncingRef.current;
    const stemsCount = activeStemsRef.current.length;

    activeStemsRef.current.forEach(item => {
      const type = item.type;
      
      let targetGain = 0;
      if (!isSyncing) {
        if (stemsCount === 1) {
          // Isenção de faixa única: se a música contém apenas uma stem, ignora o mixer e toca a 100% (1.0)
          targetGain = 1.0;
        } else {
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
      const src = item.audio.src;
      item.audio.src = '';
      item.audio.load();
      if (src.startsWith('blob:')) {
        URL.revokeObjectURL(src);
      }
      item.gainNode.disconnect();
      if (item.pannerNode) {
        item.pannerNode.disconnect();
      }
      item.sourceNode.disconnect();
    });
    activeStemsRef.current = [];
    if (metronomeDelayNodeRef.current) {
      try {
        metronomeDelayNodeRef.current.disconnect();
      } catch (e) {}
      metronomeDelayNodeRef.current = null;
    }
  };

  const initAudioContext = async () => {
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

      try {
        const wasmRes = await fetch('/wasm/signalsmith-stretch.wasm');
        if (!wasmRes.ok) throw new Error('HTTP ' + wasmRes.status + ' fetching signalsmith-stretch.wasm');
        const wasmBuffer = await wasmRes.arrayBuffer();
        const wasmModule = await WebAssembly.compile(wasmBuffer);

        await ctx.audioWorklet.addModule('/wasm/pitch-shift-processor.js?v=' + Date.now());
        const worklet = new AudioWorkletNode(ctx, 'pitch-shift-processor', {
          processorOptions: { wasmModule }
        });
        worklet.connect(masterGain);
        pitchWorkletNodeRef.current = worklet;
        console.log('[WASM-AUDIO] AudioWorklet Signalsmith Stretch SIMD inicializado com sucesso.');
      } catch (err) {
        console.warn('[WASM-AUDIO] Falha ao carregar AudioWorklet WASM. Usando fallback Lite.', err);
      }
    }
    return audioContextRef.current;
  };

  const playNextTrack = () => {
    const activeTrack = currentTrackRef.current;
    const queue = currentQueueRef.current;
    
    console.log('[AUTOPLAY] playNextTrack chamado. Fila:', queue.length, 'Faixa ativa:', activeTrack?.TrackTitle, 'Shuffle:', isShuffleRef.current, 'Repeat:', repeatModeRef.current);
    if (queue.length === 0 || !activeTrack) {
      console.warn('[AUTOPLAY] playNextTrack ignorado: fila vazia ou sem faixa ativa.');
      return;
    }

    // 1. Regra de Repeat One (Repetir 1): Se estiver ativado, repete a faixa atual independente de shuffle/queue
    if (repeatModeRef.current === 'one') {
      console.log('[AUTOPLAY] Modo Repeat One ativo. Reiniciando a faixa atual:', activeTrack.TrackTitle);
      loadTrack(activeTrack, currentPlaylistIdRef.current || undefined, currentAlbumIdRef.current || undefined, undefined, currentPlaylistNameRef.current || undefined);
      return;
    }

    // 2. Regra de Shuffle (Aleatório)
    if (isShuffleRef.current) {
      // Filtrar as faixas que ainda não foram tocadas nesta rodada
      const unplayed = queue.filter(t => !playedTrackIdsRef.current.includes(t.TrackId));
      console.log('[AUTOPLAY] Faixas restantes não tocadas no aleatório:', unplayed.map(t => t.TrackTitle));

      if (unplayed.length > 0) {
        // Escolhe uma faixa aleatória entre as não tocadas
        const randomIndex = Math.floor(Math.random() * unplayed.length);
        const nextTrack = unplayed[randomIndex];
        console.log('[AUTOPLAY] Modo Shuffle ativo. Faixa sorteada:', nextTrack.TrackTitle);
        
        // Registra no histórico para não tocá-la novamente
        playedTrackIdsRef.current.push(nextTrack.TrackId);
        loadTrack(nextTrack, currentPlaylistIdRef.current || undefined, currentAlbumIdRef.current || undefined, undefined, currentPlaylistNameRef.current || undefined);
      } else {
        // Todas as faixas foram tocadas
        if (repeatModeRef.current === 'all') {
          console.log('[AUTOPLAY] Todas as faixas tocadas no Shuffle. Reiniciando fila aleatória (Repeat All)...');
          // Limpa o histórico, mas mantém a nova faixa inicial no histórico
          playedTrackIdsRef.current = [];
          
          // Sorteia qualquer música da fila (preferencialmente diferente da atual se a fila tiver mais de uma música)
          const pool = queue.length > 1 ? queue.filter(t => t.TrackId !== activeTrack.TrackId) : queue;
          const randomIndex = Math.floor(Math.random() * pool.length);
          const nextTrack = pool[randomIndex];
          
          playedTrackIdsRef.current.push(nextTrack.TrackId);
          loadTrack(nextTrack, currentPlaylistIdRef.current || undefined, currentAlbumIdRef.current || undefined, undefined, currentPlaylistNameRef.current || undefined);
        } else {
          console.log('[AUTOPLAY] Todas as faixas tocadas no Shuffle. Parando player (Repeat Off)...');
          playedTrackIdsRef.current = [];
          setIsPlayingSynced(false);
          seek(0);
        }
      }
      return;
    }

    // 3. Regra de Reprodução Sequencial (Shuffle desligado)
    const currentIndex = queue.findIndex(t => t.TrackId === activeTrack.TrackId);
    if (currentIndex !== -1 && currentIndex < queue.length - 1) {
      const nextTrack = queue[currentIndex + 1];
      console.log('[AUTOPLAY] Pulando para a próxima faixa sequencial:', nextTrack.TrackTitle);
      loadTrack(nextTrack, currentPlaylistIdRef.current || undefined, currentAlbumIdRef.current || undefined, undefined, currentPlaylistNameRef.current || undefined);
    } else {
      // Chegamos ao fim da fila
      if (repeatModeRef.current === 'all') {
        const nextTrack = queue[0];
        console.log('[AUTOPLAY] Fim da fila sequencial. Retornando ao início (Repeat All):', nextTrack.TrackTitle);
        loadTrack(nextTrack, currentPlaylistIdRef.current || undefined, currentAlbumIdRef.current || undefined, undefined, currentPlaylistNameRef.current || undefined);
      } else {
        console.log('[AUTOPLAY] Fim da fila sequencial atingido. Parando player (Repeat Off)...');
        setIsPlayingSynced(false);
        seek(0);
      }
    }
  };

  const playPreviousTrack = () => {
    const activeTrack = currentTrackRef.current;
    const queue = currentQueueRef.current;

    if (queue.length === 0 || !activeTrack) return;
    
    // Se a música estiver tocando há mais de 3 segundos, o comportamento padrão é reiniciar a música atual
    if (currentTime > 3) {
      console.log('[PLAYBACK] Reiniciando faixa atual...');
      seek(0);
      return;
    }

    // 1. Regra de Shuffle: Volta com base no histórico de faixas tocadas
    if (isShuffleRef.current) {
      if (playedTrackIdsRef.current.length > 1) {
        // Remove a faixa atual (último item)
        playedTrackIdsRef.current.pop();
        // Obtém o ID da faixa que tocou imediatamente antes
        const prevTrackId = playedTrackIdsRef.current[playedTrackIdsRef.current.length - 1];
        const prevTrack = queue.find(t => t.TrackId === prevTrackId);
        
        if (prevTrack) {
          console.log('[PLAYBACK] Voltando para a faixa anterior do histórico do Shuffle:', prevTrack.TrackTitle);
          // Nota: chamamos loadTrack, que vai re-registrar ela no histórico se não estiver, mas o final da pilha já a contém
          loadTrack(prevTrack, currentPlaylistIdRef.current || undefined, currentAlbumIdRef.current || undefined, undefined, currentPlaylistNameRef.current || undefined);
          return;
        }
      }
      
      // Se não há histórico anterior no modo Shuffle, apenas reinicia a faixa
      console.log('[PLAYBACK] Sem histórico de faixas anteriores no Shuffle. Reiniciando...');
      seek(0);
      return;
    }

    // 2. Regra de Reprodução Sequencial (Shuffle desligado)
    const currentIndex = queue.findIndex(t => t.TrackId === activeTrack.TrackId);
    if (currentIndex > 0) {
      const prevTrack = queue[currentIndex - 1];
      console.log('[PLAYBACK] Voltando para a faixa sequencial anterior:', prevTrack.TrackTitle);
      loadTrack(prevTrack, currentPlaylistIdRef.current || undefined, currentAlbumIdRef.current || undefined, undefined, currentPlaylistNameRef.current || undefined);
    } else {
      if (repeatModeRef.current === 'all') {
        const prevTrack = queue[queue.length - 1];
        console.log('[PLAYBACK] Primeira faixa atingida. Indo para a última (Repeat All):', prevTrack.TrackTitle);
        loadTrack(prevTrack, currentPlaylistIdRef.current || undefined, currentAlbumIdRef.current || undefined, undefined, currentPlaylistNameRef.current || undefined);
      } else {
        console.log('[PLAYBACK] Primeira faixa atingida. Reiniciando (Repeat Off/One)...');
        seek(0);
      }
    }
  };

  const loadTrack = async (
    track: ITrack | null,
    playlistId?: string,
    albumId?: string,
    tracksQueue?: ITrack[],
    playlistName?: string
  ) => {
    console.log(`[PLAYER-LIFECYCLE] Iniciando loadTrack para a faixa: ${track?.TrackTitle || 'null'}`);
    setIsPlayingSynced(false);
    cleanupActiveStems();
    setCurrentTime(0);
    setDuration(0);
    setTranspose(0);
    setBpmDelta(0);
    
    // Atualiza estados para renderização reativa
    setCurrentTrack(track);
    setCurrentPlaylistId(playlistId || null);
    setCurrentPlaylistName(playlistName || null);
    setCurrentAlbumId(albumId || null);

    // Atualiza referências mutáveis imediatamente de forma síncrona
    currentTrackRef.current = track;
    currentPlaylistIdRef.current = playlistId || null;
    currentPlaylistNameRef.current = playlistName || null;
    currentAlbumIdRef.current = albumId || null;

    if (tracksQueue) {
      updateQueue(tracksQueue);
      // Se carregou uma fila de faixas totalmente nova, limpamos o histórico e adicionamos a faixa atual
      playedTrackIdsRef.current = track ? [track.TrackId] : [];
      console.log('[PLAYER-LIFECYCLE] Nova fila carregada. Histórico de tocadas resetado.');
    } else if (track) {
      // Se tocada de forma avulsa sem fila e a fila atual não contém ela, cria uma fila unitária
      const existsInQueue = currentQueueRef.current.some(t => t.TrackId === track.TrackId);
      if (!existsInQueue) {
        updateQueue([track]);
        playedTrackIdsRef.current = [track.TrackId];
        console.log('[PLAYER-LIFECYCLE] Faixa avulsa. Fila unitária criada. Histórico de tocadas resetado.');
      } else {
        // Já existe na fila. Garantimos que esteja adicionada no histórico
        if (!playedTrackIdsRef.current.includes(track.TrackId)) {
          playedTrackIdsRef.current.push(track.TrackId);
        }
      }
    }

    listeningAccumulatorRef.current = 0;
    hasRecordedPlayRef.current = false;

    if (!track || !track.Stems || track.Stems.length === 0) {
      return;
    }

    const ctx = await initAudioContext();
    
    // Ativa a fase de sincronização inicial silenciosa
    isSyncingRef.current = true;

    // Lê os volumes, mutes e solos globais salvos diretamente de localStorage para evitar delay ou closures obsoletas
    const savedVolumesStr = localStorage.getItem('mixer8_stems_volume');
    const savedMutesStr = localStorage.getItem('mixer8_stems_mute');
    const savedSolosStr = localStorage.getItem('mixer8_stems_solo');

    const globalVolumes: Record<string, number> = savedVolumesStr ? JSON.parse(savedVolumesStr) : {};
    const globalMutes: Record<string, boolean> = savedMutesStr ? JSON.parse(savedMutesStr) : {};
    const globalSolos: Record<string, boolean> = savedSolosStr ? JSON.parse(savedSolosStr) : {};

    // Mantém todos os volumes globais persistidos no dicionário inicial de carregamento
    const initialVolumes: Record<string, number> = { ...globalVolumes };
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
      // Se a stem atual do novo track ainda não possui um volume global salvo, aplica o valor padrão
      if (initialVolumes[stemType] === undefined) {
        initialVolumes[stemType] = stemType === 'Metrônomo' ? 0.0 : 1.0;
      }

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
      
      let pannerNode: StereoPannerNode | undefined;
      try {
        pannerNode = ctx.createStereoPanner();
        const panValue = stemsPanRef.current[stemType] ?? 0.0;
        pannerNode.pan.value = panValue;
      } catch (err) {
        console.warn(`[PLAYER-AUDIO] StereoPanner não suportado para stem ${stemType}:`, err);
      }
      
      // Conecta o fluxo: Áudio -> Volume Canal -> Stereo Panner (se houver) -> Delay (se Metrônomo) -> PitchWorklet/Master -> Saída física
      sourceNode.connect(gainNode);
      const isMetronome = isMetronomeStem(stemType);
      const targetDest: AudioNode = (!isMetronome && audioEngineMode === 'Power' && pitchWorkletNodeRef.current)
        ? pitchWorkletNodeRef.current
        : (masterGainNodeRef.current || ctx.destination);

      let delayNode: DelayNode | undefined;
      if (isMetronome) {
        try {
          delayNode = ctx.createDelay(1.0);
          const initialDelay = (transpose !== 0 && audioEngineMode === 'Power' && pitchWorkletNodeRef.current) ? 0.12 : 0.0;
          delayNode.delayTime.value = initialDelay;
          metronomeDelayNodeRef.current = delayNode;
        } catch (err) {
          console.warn('[PLAYER-AUDIO] Falha ao criar DelayNode para o metrônomo:', err);
        }
      }

      const postPannerDest = (isMetronome && delayNode) ? delayNode : targetDest;

      if (pannerNode) {
        gainNode.connect(pannerNode);
        pannerNode.connect(postPannerDest);
      } else {
        gainNode.connect(postPannerDest);
      }

      if (isMetronome && delayNode) {
        delayNode.connect(targetDest);
      }

      // Inicialmente ganho = 0 por conta da fase de sincronização silenciosa
      gainNode.gain.value = 0;

      loadedStems.push({
        audio,
        gainNode,
        sourceNode,
        pannerNode,
        type: stemType
      });

      if (!masterAudioElement) {
        masterAudioElement = audio;
      }
    });

    // Atualiza os estados e referências mutáveis imediatamente
    setStemsVolume(initialVolumes);
    setStemsMute(globalMutes);
    setStemsSolo(globalSolos);

    stemsVolumeRef.current = initialVolumes;
    stemsMuteRef.current = globalMutes;
    stemsSoloRef.current = globalSolos;

    activeStemsRef.current = loadedStems;
    
    // Atualiza os ganhos de forma explícita respeitando mutes e solos persistidos de forma imediata e síncrona
    updateAudioGains(initialVolumes, globalMutes, globalSolos);

    // Aplica as configurações de pitch (tom) e tempo (BPM delta) nas stems carregadas
    applyPitchAndTempoSettings();

    // Sincroniza progresso e duração a partir do master audio
    if (masterAudioElement) {
      const master = masterAudioElement as HTMLAudioElement;

      master.addEventListener('durationchange', () => {
        setDuration(master.duration);
      });

      master.addEventListener('timeupdate', () => {
        setCurrentTime(master.currentTime);
      });

      console.log(`[PLAYER-EVENTS] Vinculando listener 'ended' no elemento master para a faixa: ${track?.TrackTitle}`);
      master.addEventListener('ended', () => {
        console.log('[AUTOPLAY-EVENT] Evento ended disparado no elemento master de áudio!');
        playNextTrackRef.current();
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

    updateAudioGains(stemsVolumeRef.current, stemsMuteRef.current, stemsSoloRef.current);

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

    const ctx = await initAudioContext();
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

  // Efeito de renderização sem dependências para manter as referências das funções sempre atualizadas com a closure atualizada
  useEffect(() => {
    playNextTrackRef.current = playNextTrack;
    playPreviousTrackRef.current = playPreviousTrack;
    togglePlayRef.current = togglePlay;
    seekRef.current = seek;
  });

  const setStemVolume = (type: string, volume: number) => {
    setStemsVolume(prev => {
      const next = { ...prev, [type]: volume };
      stemsVolumeRef.current = next;
      updateAudioGains(next, stemsMuteRef.current, stemsSoloRef.current);
      localStorage.setItem('mixer8_stems_volume', JSON.stringify(next));
      return next;
    });
  };

  const toggleStemMute = (type: string) => {
    setStemsMute(prev => {
      const next = { ...prev, [type]: !prev[type] };
      stemsMuteRef.current = next;
      updateAudioGains(stemsVolumeRef.current, next, stemsSoloRef.current);
      localStorage.setItem('mixer8_stems_mute', JSON.stringify(next));
      return next;
    });
  };

  const toggleStemSolo = (type: string) => {
    setStemsSolo(prev => {
      const next = { ...prev, [type]: !prev[type] };
      stemsSoloRef.current = next;
      updateAudioGains(stemsVolumeRef.current, stemsMuteRef.current, next);
      localStorage.setItem('mixer8_stems_solo', JSON.stringify(next));
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
      console.log(`[CACHE] Iniciando download offline completo da faixa: ${track.TrackTitle}`);
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
      console.log(`[CACHE] Download concluído com sucesso: ${track.TrackTitle}`);
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
      console.log(`[CACHE] Removendo download offline da faixa: ${track.TrackTitle}`);
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
      console.log(`[CACHE] Downloads removidos para a faixa: ${track.TrackTitle}`);
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

  // Registro de Action Handlers Nativos para a Lockscreen / Fones Bluetooth - roda apenas no mount
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    console.log('[PLAYER-LIFECYCLE] Registrando handlers da Media Session API uma única vez no mount');
    navigator.mediaSession.setActionHandler('play', () => {
      togglePlayRef.current();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      togglePlayRef.current();
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      playNextTrackRef.current();
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      playPreviousTrackRef.current();
    });
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) {
        seekRef.current(details.seekTime);
      }
    });

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('seekto', null);
    };
  }, []);

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

  const setStemPan = (type: string, pan: number) => {
    const clampedPan = Math.max(-1.0, Math.min(1.0, pan));
    setStemsPan(prev => {
      const next = { ...prev, [type]: clampedPan };
      localStorage.setItem('mixer8_stems_pan', JSON.stringify(next));
      return next;
    });

    const target = activeStemsRef.current.find(s => s.type === type);
    if (target && target.pannerNode) {
      target.pannerNode.pan.value = clampedPan;
    }
  };

  // Estados para exportação de mixagem em MP3 192kbps 48kHz
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatusMessage, setExportStatusMessage] = useState('');
  const [exportFileName, setExportFileName] = useState('');
  const [exportCoverUrl, setExportCoverUrl] = useState<string | undefined>(undefined);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  const closeExportToast = useCallback(() => {
    if (isExporting) return;
    setExportSuccess(false);
    setExportError(null);
    setExportProgress(0);
    setExportStatusMessage('');
    setExportFileName('');
    setExportCoverUrl(undefined);
  }, [isExporting]);

  const exportMix = async () => {
    if (isExporting) return;
    if (!currentTrackRef.current) {
      setExportError('Nenhuma música ativa para exportar.');
      return;
    }

    setIsExporting(true);
    setExportSuccess(false);
    setExportError(null);
    setExportProgress(0);
    setExportStatusMessage('Iniciando exportação assíncrona...');
    setExportCoverUrl(currentTrackRef.current?.CoverUrl);

    try {
      const result = await exportMixToMp3({
        currentTrack: currentTrackRef.current,
        stemsVolume,
        stemsMute,
        stemsSolo,
        stemsPan,
        masterVolume,
        transpose,
        bpmDelta,
        isPremium,
        getCachedOrFetchAudioUrl,
        onProgress: (progress, status) => {
          setExportProgress(progress);
          setExportStatusMessage(status);
        }
      });

      setExportFileName(result.fileName);

      // Dispara o download automático do Blob gerado
      const blobUrl = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = result.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExportSuccess(true);
      console.log('[EXPORT] Mixagem exportada com sucesso:', result.fileName);
    } catch (err: any) {
      console.error('[EXPORT] Erro ao exportar mixagem:', err);
      setExportError(err?.message || 'Ocorreu um erro inesperado ao exportar a mixagem.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        currentPlaylistId,
        currentPlaylistName,
        currentAlbumId,
        isPlaying,
        currentTime,
        duration,
        stemsVolume,
        stemsMute,
        stemsSolo,
        stemsPan,
        masterVolume,
        loadTrack,
        togglePlay,
        seek,
        setStemVolume,
        toggleStemMute,
        toggleStemSolo,
        setStemPan,
        setMasterVolume,
        downloadTrackForOffline,
        isTrackDownloaded,
        removeTrackOffline,
        currentQueue,
        playNextTrack,
        playPreviousTrack,
        isShuffle,
        repeatMode,
        toggleShuffle,
        toggleRepeatMode,
        isPremium,
        transpose,
        setTranspose,
        bpmDelta,
        setBpmDelta,
        audioEngineMode,
        setAudioEngineMode,
        activeOverlay,
        setActiveOverlay,
        showChords,
        setShowChords,
        isExporting,
        exportProgress,
        exportStatusMessage,
        exportFileName,
        exportCoverUrl,
        exportError,
        exportSuccess,
        exportMix,
        closeExportToast
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
