import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { usePlaylists } from '../context/PlaylistContext';
import type { IPlaylist } from '../context/PlaylistContext';
import { 
  Play, Pause, Disc, Music, Users,
  Loader2, ArrowLeft, Settings, Trash2,
  Clock, X, AlertTriangle, Plus, Minus,
  Lock, Globe, EyeOff
} from 'lucide-react';

import { API_URL, SERVER_URL } from '../config';

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
  Order: number;
  Duration: number;
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
  IsSaved: boolean;
  Tracks: IPlaylistTrack[];
  Collaborators: IPlaylistCollaborator[];
  OwnerUserName?: string;
  OwnerFirstName?: string;
  OwnerLastName?: string;
  OwnerAvatarUrl?: string;
}

export const PlaylistDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { Token, CurrentUser, IsAuthenticated } = useAuth();
  const { loadTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { fetchPlaylists, openEditPlaylist, openDeletePlaylist, openAddToPlaylist } = usePlaylists();
  const navigate = useNavigate();

  const [playlist, setPlaylist] = useState<IPlaylistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Estados e lógicas para Colunas Redimensionáveis (Spotify-like)
  const [colWidths, setColWidths] = useState({
    index: 48,
    titleArtist: 380,
    addedBy: 160,
    addedAt: 160,
    duration: 64
  });

  const [resizing, setResizing] = useState<{
    col: 'index' | 'titleArtist' | 'addedBy' | 'addedAt' | 'duration';
    startX: number;
    startWidth: number;
  } | null>(null);

  const minWidths = {
    index: 40,
    titleArtist: 150,
    addedBy: 100,
    addedAt: 100,
    duration: 50
  };

  const startResize = (
    col: 'index' | 'titleArtist' | 'addedBy' | 'addedAt' | 'duration',
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({
      col,
      startX: e.clientX,
      startWidth: colWidths[col]
    });
  };

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizing.startX;
      const newWidth = Math.max(minWidths[resizing.col], resizing.startWidth + deltaX);
      setColWidths(prev => ({
        ...prev,
        [resizing.col]: newWidth
      }));
    };

    const handleMouseUp = () => {
      setResizing(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing]);

  // Efeito para manter o cursor de redimensionamento e desativar seleção global durante o arraste
  useEffect(() => {
    if (resizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizing]);

  // Estados do Menu de Contexto e Exclusão Física de Música (Admin)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; track: IPlaylistTrack } | null>(null);
  const [trackToDelete, setTrackToDelete] = useState<IPlaylistTrack | null>(null);
  const [trackToRemove, setTrackToRemove] = useState<IPlaylistTrack | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Timer regressivo para exclusão da música da plataforma (Admin)
  useEffect(() => {
    let timer: any;
    if (trackToDelete && deleteCountdown > 0) {
      timer = setTimeout(() => {
        setDeleteCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [trackToDelete, deleteCountdown]);

  // Listener para fechar o menu de contexto
  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const fetchPlaylistDetails = async () => {
    if (!id) return;
    try {
      const headers: Record<string, string> = {};
      if (Token) {
        headers['Authorization'] = `Bearer ${Token}`;
      }
      const res = await fetch(`${API_URL}/Playlists/${id}`, {
        headers
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
    loadTrack(trackToPlay, playlist?.PlaylistId);
  };

  const handleRemoveTrack = async (trackId: string) => {
    if (!Token || !playlist) return;

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

  // Exclusão física definitiva de música da plataforma (Admin)
  const handleConfirmDeleteTrack = async () => {
    if (!trackToDelete || deleteCountdown > 0 || isDeleting || !Token) return;

    setIsDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`${API_URL}/Tracks/${trackToDelete.TrackId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${Token}`
        }
      });

      if (res.ok) {
        if (currentTrack && currentTrack.TrackId === trackToDelete.TrackId) {
          loadTrack(null);
        }
        setTrackToDelete(null);
        fetchPlaylistDetails(); // Recarrega reativamente a lista
      } else {
        setDeleteError('Não foi possível excluir a música da plataforma. Verifique as credenciais de admin.');
      }
    } catch {
      setDeleteError('Erro de conexão ao tentar excluir música da plataforma.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatTrackDuration = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const getPlaylistTotalDurationString = (tracks: IPlaylistTrack[]) => {
    if (tracks.length === 0) return '0 min';
    const totalSeconds = tracks.reduce((acc, t) => acc + (t.Duration || 0), 0);
    const totalMinutes = Math.floor(totalSeconds / 60);
    if (totalMinutes >= 60) {
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      return `${hours}h ${mins}m`;
    }
    return `${totalMinutes} min`;
  };

  // Handlers para Drag-and-Drop
  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>, index: number) => {
    if (draggedIndex === null) return;
    e.preventDefault();

    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const isLowerHalf = relativeY > rect.height / 2;

    const targetIndex = isLowerHalf ? index + 1 : index;
    if (dragOverIndex !== targetIndex) {
      setDragOverIndex(targetIndex);
    }
  };

  const handleTableDragLeave = (e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setDragOverIndex(null);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = async (e: React.DragEvent<HTMLTableRowElement>) => {
    e.preventDefault();
    
    const targetPos = dragOverIndex;
    setDragOverIndex(null);
    setDraggedIndex(null);

    if (draggedIndex === null || targetPos === null || !playlist) return;

    if (targetPos === draggedIndex || targetPos === draggedIndex + 1) {
      return;
    }

    const updatedTracks = [...playlist.Tracks];
    const [draggedTrack] = updatedTracks.splice(draggedIndex, 1);
    const insertIndex = targetPos > draggedIndex ? targetPos - 1 : targetPos;
    updatedTracks.splice(insertIndex, 0, draggedTrack);

    // Atualização otimista
    setPlaylist(prev => {
      if (!prev) return null;
      return {
        ...prev,
        Tracks: updatedTracks
      };
    });

    try {
      const trackIds = updatedTracks.map(t => t.TrackId);
      const res = await fetch(`${API_URL}/Playlists/${playlist.PlaylistId}/Reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Token}`
        },
        body: JSON.stringify({ TrackIds: trackIds })
      });

      if (!res.ok) {
        console.error('Failed to save playlist track order.');
        // Reverte se a requisição falhar
        fetchPlaylistDetails();
      } else {
        window.dispatchEvent(new CustomEvent('playlist-updated', { detail: { PlaylistId: playlist.PlaylistId } }));
      }
    } catch (error) {
      console.error('Network error saving playlist track order:', error);
      // Reverte se a requisição falhar
      fetchPlaylistDetails();
    }
  };

  const getOwnerDisplayName = (
    firstName?: string,
    lastName?: string,
    userName?: string,
    email?: string
  ) => {
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    if (firstName) return firstName;
    if (userName) return userName;
    if (email) {
      const part = email.split('@')[0];
      return part.charAt(0).toUpperCase() + part.slice(1);
    }
    return 'Usuário';
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
        <span className="font-semibold text-sm">Carregando...</span>
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
  const isCollaborator = playlist.Collaborators.some(c => c.UserId === CurrentUser?.UserId);
  const canModifyPlaylist = isPlaylistOwner || isCollaborator || CurrentUser?.UserRole === 'Admin';
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
      IsCollaborator: isCollaborator,
      IsSaved: playlist.IsSaved || false,
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
      IsCollaborator: isCollaborator,
      IsSaved: playlist.IsSaved || false,
      TracksCount: playlist.Tracks.length
    };
    openDeletePlaylist(iPlaylist);
  };

  const handleTrackContextMenu = (e: React.MouseEvent, track: IPlaylistTrack) => {
    e.preventDefault();
    if (!IsAuthenticated) return; // Desativa menu de contexto para usuários anônimos
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      track
    });
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
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-end bg-gradient-to-b from-brand-hover/40 to-transparent p-6 rounded-lg border border-brand-hover/30 shadow-inner">
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

          <div className="flex items-center gap-2 text-xs text-brand-gray font-medium flex-wrap mt-2.5 select-none leading-none">
            {/* Foto de perfil real ou fallback do criador */}
            <div className="flex items-center gap-1.5 shrink-0 h-5">
              {playlist.OwnerAvatarUrl ? (
                <img 
                  src={playlist.OwnerAvatarUrl.startsWith('http') ? playlist.OwnerAvatarUrl : `${SERVER_URL}${playlist.OwnerAvatarUrl}`} 
                  alt="Avatar do Criador" 
                  className="w-5 h-5 rounded-full object-cover border border-brand-green/20 shadow-sm select-none"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-brand-green text-black flex items-center justify-center font-black text-[10px] uppercase shadow-sm select-none">
                  {getOwnerDisplayName(playlist.OwnerFirstName, playlist.OwnerLastName, playlist.OwnerUserName, playlist.OwnerEmail).charAt(0)}
                </div>
              )}
              <span 
                onClick={() => {
                  if (playlist.OwnerUserName) {
                    navigate(`/@${playlist.OwnerUserName}`);
                  }
                }}
                className={`text-white font-bold ${playlist.OwnerUserName ? 'hover:underline cursor-pointer' : ''}`}
              >
                {getOwnerDisplayName(playlist.OwnerFirstName, playlist.OwnerLastName, playlist.OwnerUserName, playlist.OwnerEmail)}
              </span>
            </div>
            
            <span className="text-brand-gray/40 font-normal select-none shrink-0">•</span>
            
            <span className="shrink-0">{playlist.Tracks.length} {playlist.Tracks.length === 1 ? 'música' : 'músicas'}</span>
            
            <span className="text-brand-gray/40 font-normal select-none shrink-0">•</span>
            
            <div className="flex items-center gap-1 shrink-0 text-brand-gray select-none h-4">
              <Clock className="w-3.5 h-3.5 text-brand-gray/60 shrink-0" />
              <span>{getPlaylistTotalDurationString(playlist.Tracks)}</span>
            </div>
            
            <span className="text-brand-gray/40 font-normal select-none shrink-0">•</span>
            
            <div className="flex items-center gap-1 shrink-0 text-brand-gray select-none uppercase text-[10px] font-bold h-4">
              {playlist.Visibility === 'Private' ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-brand-green shrink-0" />
                  <span>Privada</span>
                </>
              ) : playlist.Visibility === 'Public' ? (
                <>
                  <Globe className="w-3.5 h-3.5 text-brand-green/60 shrink-0" />
                  <span>Pública</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-brand-gray/60 shrink-0" />
                  <span>Não Listada</span>
                </>
              )}
            </div>
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
      <div className="bg-black/15 p-6 rounded-lg flex flex-col gap-6 mt-4">
        {playlist.Tracks.length === 0 ? (
          <div className="text-center py-10 flex flex-col gap-3 items-center">
            <Disc className="w-12 h-12 text-brand-gray/30 animate-pulse" />
            <span className="text-sm font-semibold text-brand-gray">Nenhuma música adicionada ainda.</span>
            <p className="text-xs text-brand-gray/60 max-w-sm leading-relaxed">
              Navegue pelo painel Explorar ou Minha Biblioteca, clique com o botão direito nas músicas e selecione "Adicionar à Playlist" para rechear sua lista!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full select-none">
            <table className="w-full text-left text-xs border-collapse table-fixed" style={{ minWidth: '600px' }}>
              <thead>
                <tr className="border-b border-brand-hover text-brand-gray font-bold uppercase tracking-wider text-[10px] pb-3 group">
                  <th 
                    style={{ width: colWidths.index }} 
                    className="py-2.5 px-3 text-center relative select-none"
                  >
                    <span className="truncate block">#</span>
                    <div 
                      onMouseDown={(e) => startResize('index', e)}
                      className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-full cursor-col-resize flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <div className="w-[1px] h-3 bg-brand-gray/40" />
                    </div>
                  </th>
                  <th 
                    style={{ width: colWidths.titleArtist }} 
                    className="py-2.5 px-3 relative select-none"
                  >
                    <span className="truncate block">Título / Artista</span>
                    <div 
                      onMouseDown={(e) => startResize('titleArtist', e)}
                      className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-full cursor-col-resize flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <div className="w-[1px] h-3 bg-brand-gray/40" />
                    </div>
                  </th>
                  <th 
                    style={{ width: colWidths.addedBy }} 
                    className="py-2.5 px-3 relative select-none"
                  >
                    <span className="truncate block">Adicionado por</span>
                    <div 
                      onMouseDown={(e) => startResize('addedBy', e)}
                      className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-full cursor-col-resize flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <div className="w-[1px] h-3 bg-brand-gray/40" />
                    </div>
                  </th>
                  <th 
                    style={{ width: colWidths.addedAt }} 
                    className="py-2.5 px-3 relative select-none"
                  >
                    <span className="truncate block">Adicionado em</span>
                    <div 
                      onMouseDown={(e) => startResize('addedAt', e)}
                      className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-full cursor-col-resize flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <div className="w-[1px] h-3 bg-brand-gray/40" />
                    </div>
                  </th>
                  <th 
                    style={{ width: colWidths.duration }} 
                    className="py-2.5 px-3 text-right relative select-none"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <Clock className="w-4 h-4 text-brand-gray shrink-0" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody onDragLeave={canModifyPlaylist ? handleTableDragLeave : undefined}>
                {playlist.Tracks.map((t, index) => {
                  const isCurrentTrack = currentTrack && currentTrack.TrackId === t.TrackId;

                  return (
                    <tr 
                      key={t.TrackId} 
                      onContextMenu={(e) => handleTrackContextMenu(e, t)}
                      draggable={canModifyPlaylist}
                      onDragStart={canModifyPlaylist ? (e) => handleDragStart(e, index) : undefined}
                      onDragOver={canModifyPlaylist ? (e) => handleDragOver(e, index) : undefined}
                      onDragEnd={canModifyPlaylist ? handleDragEnd : undefined}
                      onDrop={canModifyPlaylist ? (e) => handleDrop(e) : undefined}
                      className={`border-b border-brand-hover/40 hover:bg-brand-hover/30 transition-colors group ${
                        isCurrentTrack ? 'bg-brand-hover/10' : ''
                      } ${draggedIndex === index ? '!opacity-35 !bg-brand-hover/65' : ''} ${
                        dragOverIndex === index && draggedIndex !== index && draggedIndex !== index - 1 ? '!border-t-2 !border-t-brand-green' : ''
                      } ${
                        dragOverIndex === index + 1 && index === playlist.Tracks.length - 1 && draggedIndex !== index ? '!border-b-2 !border-b-brand-green' : ''
                      } ${canModifyPlaylist ? 'cursor-default' : ''}`}
                    >
                      {/* Play Action / Index */}
                      <td className="py-3 px-3 text-center text-brand-gray font-semibold relative select-none">
                        <span className="group-hover:opacity-0 transition-opacity">
                          {index + 1}
                        </span>
                        <button
                          onClick={() => {
                            if (isCurrentTrack) {
                              togglePlay();
                            } else {
                              handlePlayTrack(t);
                            }
                          }}
                          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 text-brand-green hover:scale-110 transition-all cursor-pointer bg-brand-card/90 rounded-l"
                        >
                          {isCurrentTrack && isPlaying ? (
                            <Pause className="w-4 h-4 fill-current" />
                          ) : (
                            <Play className="w-4 h-4 fill-current translate-x-[0.5px]" />
                          )}
                        </button>
                      </td>

                      {/* Título & Capa */}
                      <td className="py-3 px-3 min-w-0">
                        <div className="flex items-center gap-3 truncate">
                          <div className="w-9 h-9 bg-black rounded overflow-hidden flex items-center justify-center text-brand-green shrink-0 border border-brand-hover">
                            {t.CoverUrl ? (
                              <img 
                                src={t.CoverUrl.startsWith('http') ? t.CoverUrl : `${SERVER_URL}${t.CoverUrl}`} 
                                alt="Capa" 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Music className="w-4 h-4" />
                            )}
                          </div>
                          <div className="flex flex-col truncate">
                            <span className={`font-bold truncate text-sm ${isCurrentTrack ? 'text-brand-green' : 'text-white'}`}>
                              {t.TrackTitle}
                            </span>
                            <span className="text-[11px] text-brand-gray truncate">
                              {t.ArtistName}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Quem adicionou */}
                      <td className="py-3 px-3 text-brand-gray truncate">
                        {playlist.Collaborators.length > 0 || !isPlaylistOwner ? (
                          <span className="capitalize">{t.AddedByEmail.split('@')[0]}</span>
                        ) : (
                          <span className="italic">Dono</span>
                        )}
                      </td>

                      {/* Data de adição */}
                      <td className="py-3 px-3 text-brand-gray truncate">
                        {formatDistanceToNow(t.AddedAt)}
                      </td>

                      {/* Duração real */}
                      <td className="py-3 px-3 text-right text-brand-gray font-medium truncate">
                        {formatTrackDuration(t.Duration)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MENU DE CONTEXTO PARA INTERAÇÃO COM A MÚSICA */}
      {contextMenu && (
        <div 
          className="fixed bg-brand-card border border-brand-hover p-1 rounded shadow-2xl z-[90] flex flex-col min-w-[170px] animate-in fade-in duration-100"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => {
              openAddToPlaylist(contextMenu.track.TrackId, contextMenu.track.TrackTitle, contextMenu.track.ArtistName);
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-2 rounded text-xs font-semibold hover:bg-brand-hover text-white transition-all cursor-pointer flex items-center gap-2 hover:text-brand-green"
          >
            <Plus className="w-4 h-4 text-brand-green shrink-0" />
            <span>Adicionar à playlist</span>
          </button>

          {/* Opção para remover da playlist (dono, colaboradores ou admin) */}
          {canModifyPlaylist && (
            <button
              onClick={() => {
                setTrackToRemove(contextMenu.track);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-2 rounded text-xs font-semibold hover:bg-brand-hover text-white transition-all cursor-pointer flex items-center gap-2"
            >
              <Minus className="w-4 h-4 text-brand-gray shrink-0" />
              <span>Remover desta playlist</span>
            </button>
          )}

          {/* Seção do Administrador para exclusão total da plataforma */}
          {CurrentUser?.UserRole === 'Admin' && (
            <>
              <div className="h-[1px] bg-brand-hover my-1" />
              <button
                onClick={() => {
                  setTrackToDelete(contextMenu.track);
                  setDeleteCountdown(3);
                  setDeleteError('');
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-2 rounded text-xs font-semibold hover:bg-red-950/20 text-white hover:text-red-400 transition-all cursor-pointer flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4 text-red-500 shrink-0" />
                <span>Excluir Música</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* MODAL DE EXCLUSÃO DE MÚSICA DA PLATAFORMA (Timer de 3s - Admin) */}
      {trackToDelete && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
          <div className="bg-brand-card border border-brand-hover w-full max-w-md p-6 rounded shadow-2xl flex flex-col gap-4 relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setTrackToDelete(null)}
              className="absolute top-4 right-4 text-brand-gray hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 text-red-500">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Ação Destrutiva - Admin</span>
                <h3 className="text-sm font-bold text-white">Excluir Música Permanentemente</h3>
              </div>
            </div>

            <div className="bg-black/40 border border-brand-hover p-3 rounded flex items-center gap-3">
              <div className="w-12 h-12 bg-black rounded overflow-hidden flex items-center justify-center text-brand-green border border-brand-hover shrink-0">
                {trackToDelete.CoverUrl ? (
                  <img 
                    src={trackToDelete.CoverUrl.startsWith('http') ? trackToDelete.CoverUrl : `${SERVER_URL}${trackToDelete.CoverUrl}`} 
                    alt="Capa" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Music className="w-5 h-5" />
                )}
              </div>
              <div className="flex flex-col truncate">
                <span className="font-bold text-white text-sm truncate">{trackToDelete.TrackTitle}</span>
                <span className="text-xs text-brand-gray truncate">{trackToDelete.ArtistName}</span>
              </div>
            </div>

            <p className="text-xs text-brand-gray leading-relaxed m-0">
              Esta ação é <strong className="text-red-400">irreversível</strong>. A música será removida permanentemente de todo o sistema Mixer8, seus arquivos físicos de áudio/stems e imagem de capa serão deletados do servidor, e ela será desassociada de todas as playlists.
            </p>

            {deleteError && (
              <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded text-xs text-red-400">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-2 pt-3 border-t border-brand-hover">
              <button
                type="button"
                onClick={() => setTrackToDelete(null)}
                disabled={isDeleting}
                className="py-2 px-3 border border-brand-hover rounded text-xs font-semibold text-brand-gray hover:text-white cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTrack}
                disabled={deleteCountdown > 0 || isDeleting}
                className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-xs hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:hover:scale-100 disabled:active:scale-100"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : deleteCountdown > 0 ? (
                  <span>Excluir ({deleteCountdown}s)</span>
                ) : (
                  <span>Confirmar Exclusão</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE REMOÇÃO DE MÚSICA DA PLAYLIST (CUSTOM REACT MODAL) */}
      {trackToRemove && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
          <div className="bg-brand-card border border-brand-hover w-full max-w-md p-6 rounded shadow-2xl flex flex-col gap-4 relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setTrackToRemove(null)}
              className="absolute top-4 right-4 text-brand-gray hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 text-brand-green">
              <Music className="w-6 h-6 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] text-brand-green font-bold uppercase tracking-wider">Ajuste de Playlist</span>
                <h3 className="text-sm font-bold text-white">Remover Música da Playlist</h3>
              </div>
            </div>

            <div className="bg-black/40 border border-brand-hover p-3 rounded flex items-center gap-3">
              <div className="w-12 h-12 bg-black rounded overflow-hidden flex items-center justify-center text-brand-green border border-brand-hover shrink-0">
                {trackToRemove.CoverUrl ? (
                  <img 
                    src={trackToRemove.CoverUrl.startsWith('http') ? trackToRemove.CoverUrl : `${SERVER_URL}${trackToRemove.CoverUrl}`} 
                    alt="Capa" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Music className="w-5 h-5" />
                )}
              </div>
              <div className="flex flex-col truncate">
                <span className="font-bold text-white text-sm truncate">{trackToRemove.TrackTitle}</span>
                <span className="text-xs text-brand-gray truncate">{trackToRemove.ArtistName}</span>
              </div>
            </div>

            <p className="text-xs text-brand-gray leading-relaxed m-0">
              Tem certeza que deseja remover esta música da playlist? Ela <strong className="text-white">continuará disponível</strong> em sua biblioteca e na plataforma, mas não fará mais parte desta lista.
            </p>

            <div className="flex justify-end gap-3 mt-2 pt-3 border-t border-brand-hover">
              <button
                type="button"
                onClick={() => setTrackToRemove(null)}
                className="py-2 px-3 border border-brand-hover rounded text-xs font-semibold text-brand-gray hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  handleRemoveTrack(trackToRemove.TrackId);
                  setTrackToRemove(null);
                }}
                className="py-2 px-4 bg-brand-green text-black font-bold rounded text-xs hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
              >
                Confirmar Remoção
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
