import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { usePlaylists } from '../context/PlaylistContext';
import type { IPlaylist } from '../context/PlaylistContext';
import { 
  Play, Pause, Disc, Music, Users,
  Loader2, ArrowLeft, Settings, Trash2
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SERVER_URL = API_URL.replace('/api', '');

interface IPlaylistStem {
  StemId: string;
  TrackId: string;
  StemType: string;
  AudioUrl: string;
}

interface IPlaylistTrack {
  TrackId: string;
  TrackTitle: string;
  ArtistName: string;
  CoverUrl?: string;
  AddedById: string;
  AddedByEmail: string;
  AddedAt: string;
  Stems: IPlaylistStem[];
}

interface IPlaylistCollaborator {
  UserId: string;
  Email: string;
  AddedAt: string;
}

interface IPlaylistDetail {
  PlaylistId: string;
  Name: string;
  Visibility: string;
  Description?: string;
  OwnerId: string;
  OwnerEmail: string;
  CoverUrl?: string;
  CreatedAt: string;
  IsOwner: boolean;
  IsCollaborator: boolean;
  Tracks: IPlaylistTrack[];
  Collaborators: IPlaylistCollaborator[];
}

export const PlaylistDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { Token, CurrentUser } = useAuth();
  const { loadTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { fetchPlaylists, openEditPlaylist, openDeletePlaylist } = usePlaylists();
  const navigate = useNavigate();

  const [playlist, setPlaylist] = useState<IPlaylistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchPlaylistDetails = async () => {
    if (!Token || !id) return;
    try {
      const res = await fetch(`${API_URL}/Playlists/${id}`, {
        headers: {
          'Authorization': `Bearer ${Token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setPlaylist(data);
        setError('');
      } else {
        setError('Não foi possível carregar os detalhes da playlist ou você não tem acesso.');
      }
    } catch {
      setError('Erro de rede ao conectar com a API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchPlaylistDetails();
  }, [id, Token]);

  // Listeners de eventos para atualização em tempo real com modal global
  useEffect(() => {
    const handleUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.PlaylistId === id) {
        fetchPlaylistDetails();
      }
    };
    const handleDeleted = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && customEvent.detail.playlistId === id) {
        navigate('/playlists');
      }
    };

    window.addEventListener('playlist-updated', handleUpdated);
    window.addEventListener('playlist-deleted', handleDeleted);

    return () => {
      window.removeEventListener('playlist-updated', handleUpdated);
      window.removeEventListener('playlist-deleted', handleDeleted);
    };
  }, [id, navigate]);

  const handlePlayTrack = (t: IPlaylistTrack) => {
    const trackToPlay = {
      TrackId: t.TrackId,
      TrackTitle: t.TrackTitle,
      ArtistName: t.ArtistName,
      CoverUrl: t.CoverUrl,
      ExtractionStatus: 'Pronto',
      CreatedAt: t.AddedAt,
      Stems: t.Stems.map(s => ({
        StemId: s.StemId,
        TrackId: s.TrackId,
        StemType: s.StemType,
        AudioUrl: s.AudioUrl
      }))
    };
    loadTrack(trackToPlay);
  };

  const handleRemoveTrack = async (trackId: string) => {
    if (!Token || !playlist) return;
    if (!window.confirm('Tem certeza que deseja remover esta música da playlist?')) return;

    try {
      const res = await fetch(`${API_URL}/Playlists/${playlist.PlaylistId}/Tracks/${trackId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${Token}`
        }
      });

      if (res.ok) {
        setPlaylist(prev => {
          if (!prev) return null;
          return {
            ...prev,
            Tracks: prev.Tracks.filter(t => t.TrackId !== trackId)
          };
        });
        fetchPlaylists(); // atualiza barra lateral
      } else {
        alert('Falha ao remover música.');
      }
    } catch {
      alert('Erro de conexão ao remover música.');
    }
  };

  const formatDistanceToNow = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 0) return 'Hoje';
      if (diffDays === 1) return 'Ontem';
      if (diffDays < 30) return `há ${diffDays} dias`;
      
      const diffMonths = Math.floor(diffDays / 30);
      if (diffMonths === 1) return 'há 1 mês';
      return `há ${diffMonths} meses`;
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center gap-2.5 text-brand-gray select-none">
        <Loader2 className="w-6 h-6 animate-spin text-brand-green" />
        <span className="font-semibold text-sm">Buscando playlist do PostgreSQL...</span>
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="h-full flex items-center justify-center select-none">
        <span className="font-bold text-sm text-center text-red-400">{error || 'Playlist não encontrada.'}</span>
      </div>
    );
  }

  const isPlaylistOwner = playlist.OwnerId === CurrentUser?.UserId;
  const isOwnerOrAdmin = isPlaylistOwner || CurrentUser?.UserRole === 'Admin';

  const triggerGlobalEdit = () => {
    const iPlaylist: IPlaylist = {
      PlaylistId: playlist.PlaylistId,
      Name: playlist.Name,
      Visibility: playlist.Visibility,
      Description: playlist.Description,
      OwnerId: playlist.OwnerId,
      OwnerEmail: playlist.OwnerEmail,
      CoverUrl: playlist.CoverUrl,
      CreatedAt: playlist.CreatedAt,
      IsOwner: isPlaylistOwner,
      IsCollaborator: !isPlaylistOwner && playlist.Collaborators.some(c => c.UserId === CurrentUser?.UserId),
      TracksCount: playlist.Tracks.length
    };
    openEditPlaylist(iPlaylist);
  };

  const triggerGlobalDelete = () => {
    const iPlaylist: IPlaylist = {
      PlaylistId: playlist.PlaylistId,
      Name: playlist.Name,
      Visibility: playlist.Visibility,
      Description: playlist.Description,
      OwnerId: playlist.OwnerId,
      OwnerEmail: playlist.OwnerEmail,
      CoverUrl: playlist.CoverUrl,
      CreatedAt: playlist.CreatedAt,
      IsOwner: isPlaylistOwner,
      IsCollaborator: !isPlaylistOwner && playlist.Collaborators.some(c => c.UserId === CurrentUser?.UserId),
      TracksCount: playlist.Tracks.length
    };
    openDeletePlaylist(iPlaylist);
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300 select-none pb-12">
      {/* Botão de voltar */}
      <button 
        onClick={() => navigate('/playlists')}
        className="self-start flex items-center gap-2 text-brand-gray hover:text-white transition-colors font-semibold text-xs cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar para Playlists
      </button>

      {/* 1. Header */}
      <div className="flex flex-col md:flex-row gap-6 items-end bg-gradient-to-b from-brand-hover/40 to-transparent p-6 rounded-lg border border-brand-hover/30 shadow-inner">
        {/* Capa */}
        <div className="w-48 h-48 bg-black rounded shadow-2xl flex items-center justify-center shrink-0 overflow-hidden relative group border border-brand-hover">
          {playlist.CoverUrl ? (
            <img 
              src={playlist.CoverUrl.startsWith('http') ? playlist.CoverUrl : `${SERVER_URL}${playlist.CoverUrl}`} 
              alt="Capa da Playlist" 
              className="w-full h-full object-cover"
            />
          ) : (
            <Music className="w-16 h-16 text-brand-green/20" />
          )}
        </div>

        {/* Info Cabeçalho */}
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-brand-green/10 border border-brand-green/30 text-brand-green px-2 py-0.5 rounded uppercase font-bold tracking-wider">
              {playlist.Visibility === 'Public' ? 'Pública' : playlist.Visibility === 'Private' ? 'Privada' : 'Não Listada'}
            </span>
            {playlist.Collaborators.length > 0 && (
              <span className="text-[10px] bg-purple-500/10 border border-purple-500/30 text-purple-300 px-2 py-0.5 rounded uppercase font-bold tracking-wider flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Colaborativa
              </span>
            )}
          </div>

          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-tight m-0 uppercase select-text">
            {playlist.Name}
          </h1>

          {playlist.Description && (
            <p className="text-xs text-brand-gray leading-normal m-0 select-text max-w-xl">
              {playlist.Description}
            </p>
          )}

          <div className="flex items-center gap-2 text-xs text-brand-gray font-medium flex-wrap">
            <span className="text-white font-bold">{playlist.OwnerEmail}</span>
            <span>•</span>
            <span>{playlist.Tracks.length} {playlist.Tracks.length === 1 ? 'música' : 'músicas'}</span>
            <span>•</span>
            <span>Criada em {new Date(playlist.CreatedAt).toLocaleDateString('pt-BR')}</span>
          </div>
        </div>

        {/* Ações (Configurações) */}
        {isOwnerOrAdmin && (
          <div className="flex gap-2 self-stretch md:self-end justify-end mt-4 md:mt-0 shrink-0">
            <button
              onClick={triggerGlobalEdit}
              className="flex items-center gap-2 py-2 px-3.5 bg-brand-hover hover:bg-brand-hover/80 rounded font-bold text-xs text-white transition-all cursor-pointer shadow border border-brand-hover"
              title="Configurações da Playlist"
            >
              <Settings className="w-4 h-4 text-brand-green" />
              <span>Configurações</span>
            </button>
            <button
              onClick={triggerGlobalDelete}
              className="flex items-center gap-2 py-2 px-3.5 bg-brand-hover hover:bg-brand-hover/80 rounded font-bold text-xs text-red-400 hover:text-red-300 transition-all cursor-pointer shadow border border-brand-hover"
              title="Excluir Playlist"
            >
              <Trash2 className="w-4 h-4 text-red-500" />
              <span>Excluir</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Playlist Track List */}
      <div className="flex flex-col gap-3">
        {playlist.Tracks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-brand-gray border border-brand-hover border-dashed rounded-lg gap-3">
            <Music className="w-12 h-12 text-brand-gray/30" />
            <div className="text-center flex flex-col gap-1">
              <span className="text-white font-bold text-sm">Esta playlist está vazia</span>
              <span className="text-xs max-w-sm leading-relaxed">
                Navegue pelo painel Explorar ou Minha Biblioteca, clique com o botão direito nas músicas e selecione "Adicionar à Playlist" para rechear sua lista!
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {/* Header das colunas */}
            <div className="grid grid-cols-12 px-4 py-2 text-[10px] text-brand-gray font-bold uppercase tracking-wider border-b border-brand-hover">
              <span className="col-span-1 text-center">#</span>
              <span className="col-span-4">Título</span>
              <span className="col-span-3">Artista</span>
              <span className="col-span-3">Adicionado Por</span>
              <span className="col-span-1 text-right">Ação</span>
            </div>

            {/* Listagem real */}
            <div className="flex flex-col gap-1">
              {playlist.Tracks.map((t) => {
                const isActive = currentTrack?.TrackId === t.TrackId;
                
                return (
                  <div 
                    key={t.TrackId}
                    className={`grid grid-cols-12 px-4 py-2.5 items-center rounded border transition-all text-xs font-semibold select-none ${
                      isActive 
                        ? 'bg-brand-green/10 border-brand-green/30 text-brand-green'
                        : 'bg-brand-card/40 border-brand-hover hover:bg-brand-hover text-white'
                    }`}
                  >
                    {/* Index / Play / Pause */}
                    <div className="col-span-1 flex items-center justify-center">
                      <button
                        onClick={() => {
                          if (isActive) {
                            togglePlay();
                          } else {
                            handlePlayTrack(t);
                          }
                        }}
                        className="w-7 h-7 rounded-full bg-brand-hover hover:bg-brand-green hover:text-black flex items-center justify-center transition-all cursor-pointer text-brand-green"
                      >
                        {isActive && isPlaying ? (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current translate-x-[0.5px]" />
                        )}
                      </button>
                    </div>

                    {/* Capa + Título */}
                    <div className="col-span-4 flex items-center gap-3 truncate">
                      <div className="w-10 h-10 bg-black rounded overflow-hidden flex items-center justify-center text-brand-green border border-brand-hover shrink-0">
                        {t.CoverUrl ? (
                          <img 
                            src={t.CoverUrl.startsWith('http') ? t.CoverUrl : `${SERVER_URL}${t.CoverUrl}`} 
                            alt="Capa" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Disc className="w-5 h-5 text-brand-green/20" />
                        )}
                      </div>
                      <span className="truncate font-bold">{t.TrackTitle}</span>
                    </div>

                    {/* Artista */}
                    <span className="col-span-3 truncate text-brand-gray">{t.ArtistName}</span>

                    {/* Adicionado Por */}
                    <div className="col-span-3 flex flex-col truncate">
                      <span className="truncate text-white font-bold">{t.AddedByEmail}</span>
                      <span className="text-[10px] text-brand-gray truncate">{formatDistanceToNow(t.AddedAt)}</span>
                    </div>

                    {/* Ação de remover (se for dono ou adicionou) */}
                    <div className="col-span-1 flex justify-end">
                      {(isPlaylistOwner || t.AddedById === CurrentUser?.UserId || CurrentUser?.UserRole === 'Admin') ? (
                        <button
                          onClick={() => handleRemoveTrack(t.TrackId)}
                          className="p-1.5 rounded text-brand-gray hover:text-red-400 hover:bg-red-950/20 cursor-pointer transition-colors"
                          title="Remover música da Playlist"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-[9px] text-brand-gray/40 select-none">Bloqueado</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
