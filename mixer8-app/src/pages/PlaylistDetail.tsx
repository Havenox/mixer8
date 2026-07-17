import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { usePlaylists } from '../context/PlaylistContext';
import type { IPlaylist } from '../context/PlaylistContext';
import { 
  Play, Pause, Disc, Music, Users, Download,
  Loader2, ArrowLeft, Settings, Trash2,
  Clock, X, AlertTriangle, Plus, Minus,
  Lock, Globe, EyeOff, MoreHorizontal,
  Heart, Share2, ListMusic, CheckCircle, Info, ShieldAlert
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
  Visibility?: string;
  UploadedBy?: string;
  UploadedByEmail?: string;
  UploadedByUserName?: string;
  DeletionPending?: boolean;
  DeletionReason?: string;
  Bpm?: number | null;
  Key?: string | null;
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
  const { Token, CurrentUser, IsAuthenticated, openLoginModal } = useAuth();
  const { loadTrack, currentTrack, isPlaying, togglePlay, downloadTrackForOffline, isTrackDownloaded, removeTrackOffline, isPremium, currentPlaylistId, isShuffle } = usePlayer();
  const { fetchPlaylists, openEditPlaylist, openAddToPlaylist } = usePlaylists();
  const navigate = useNavigate();

  const [playlist, setPlaylist] = useState<IPlaylistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [playlistDownloadStatus, setPlaylistDownloadStatus] = useState<'none' | 'loading' | 'downloaded'>('none');
  const [showRemoveDownloadModal, setShowRemoveDownloadModal] = useState(false);
  const [trackToRemoveDownload, setTrackToRemoveDownload] = useState<IPlaylistTrack | null>(null);
  const [downloadedTrackIds, setDownloadedTrackIds] = useState<Record<string, boolean>>({});
  const [downloadingTrackIds, setDownloadingTrackIds] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [selectedTrackIndex, setSelectedTrackIndex] = useState<number | null>(null);
  const [mobileTrackMenu, setMobileTrackMenu] = useState<IPlaylistTrack | null>(null);
  const [mobilePlaylistMenuOpen, setMobilePlaylistMenuOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);

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
  const [trackToReview, setTrackToReview] = useState<IPlaylistTrack | null>(null);

  const [trackToRemove, setTrackToRemove] = useState<IPlaylistTrack | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deletionReasonInput, setDeletionReasonInput] = useState('');

  useEffect(() => {
    if (trackToDelete) {
      setDeletionReasonInput('');
    }
  }, [trackToDelete]);

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

  // Listener para fechar o menu de contexto e limpar a seleção
  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('tbody')) {
        setSelectedTrackIndex(null);
      }
    };
    window.addEventListener('click', closeMenu);
    document.addEventListener('click', handleGlobalClick);
    return () => {
      window.removeEventListener('click', closeMenu);
      document.removeEventListener('click', handleGlobalClick);
    };
  }, []);



  // Efeito de Checagem Reativa do Cache
  useEffect(() => {
    const updateCachedTracks = async () => {
      if (!playlist || !isPremium) return;
      const dict: Record<string, boolean> = {};
      let allDownloaded = playlist.Tracks.length > 0;

      for (const t of playlist.Tracks) {
        const trackToVerify = {
          TrackId: t.TrackId,
          Stems: t.Stems.map(s => ({
            StemId: s.StemId,
            TrackId: s.TrackId,
            StemType: s.StemType,
            AudioUrl: s.AudioUrl
          }))
        } as any;
        const isDownloaded = await isTrackDownloaded(trackToVerify);
        dict[t.TrackId] = isDownloaded;
        if (!isDownloaded) {
          allDownloaded = false;
        }
      }
      setDownloadedTrackIds(dict);
      setPlaylistDownloadStatus(allDownloaded ? 'downloaded' : 'none');
    };

    updateCachedTracks();

    const handleCacheChanged = () => {
      updateCachedTracks();
    };
    window.addEventListener('track-downloaded', handleCacheChanged);
    return () => {
      window.removeEventListener('track-downloaded', handleCacheChanged);
    };
  }, [playlist, isPremium, isTrackDownloaded]);

  const handlePlaylistDownloadClick = async () => {
    if (!playlist) return;
    if (playlistDownloadStatus === 'none') {
      setPlaylistDownloadStatus('loading');
      try {
        for (const t of playlist.Tracks) {
          const trackToDownload = {
            TrackId: t.TrackId,
            TrackTitle: t.TrackTitle,
            ArtistName: t.ArtistName,
            CoverUrl: t.CoverUrl,
            Stems: t.Stems.map(s => ({
              StemId: s.StemId,
              TrackId: s.TrackId,
              StemType: s.StemType,
              AudioUrl: s.AudioUrl
            }))
          } as any;
          await downloadTrackForOffline(trackToDownload);
        }
        setPlaylistDownloadStatus('downloaded');
      } catch (err) {
        console.error('[CACHE] Erro ao baixar playlist:', err);
        setPlaylistDownloadStatus('none');
      }
    } else if (playlistDownloadStatus === 'downloaded') {
      setShowRemoveDownloadModal(true);
    }
  };

  const handleRemovePlaylistDownloads = async () => {
    if (!playlist) return;
    try {
      for (const t of playlist.Tracks) {
        const trackToRemove = {
          TrackId: t.TrackId,
          TrackTitle: t.TrackTitle,
          ArtistName: t.ArtistName,
          CoverUrl: t.CoverUrl,
          Stems: t.Stems.map(s => ({
            StemId: s.StemId,
            TrackId: s.TrackId,
            StemType: s.StemType,
            AudioUrl: s.AudioUrl
          }))
        } as any;
        await removeTrackOffline(trackToRemove);
      }
      setPlaylistDownloadStatus('none');
      setShowRemoveDownloadModal(false);
    } catch (err) {
      console.error('[CACHE] Erro ao remover downloads da playlist:', err);
    }
  };

  const handleTrackDownloadClick = async (t: IPlaylistTrack) => {
    if (!isPremium) return;
    const isDownloaded = downloadedTrackIds[t.TrackId];
    const trackObj = {
      TrackId: t.TrackId,
      TrackTitle: t.TrackTitle,
      ArtistName: t.ArtistName,
      CoverUrl: t.CoverUrl,
      Stems: t.Stems.map(s => ({
        StemId: s.StemId,
        TrackId: s.TrackId,
        StemType: s.StemType,
        AudioUrl: s.AudioUrl
      }))
    } as any;

    if (isDownloaded) {
      setTrackToRemoveDownload(t);
    } else {
      setDownloadingTrackIds(prev => ({ ...prev, [t.TrackId]: true }));
      try {
        await downloadTrackForOffline(trackObj);
      } catch (err) {
        console.error('[CACHE] Erro ao baixar faixa offline:', err);
      } finally {
        setDownloadingTrackIds(prev => ({ ...prev, [t.TrackId]: false }));
      }
    }
  };

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
    if (currentTrack && currentTrack.TrackId === t.TrackId) {
      togglePlay();
      return;
    }
    const trackToPlay = {
      TrackId: t.TrackId,
      TrackTitle: t.TrackTitle,
      ArtistName: t.ArtistName,
      CoverUrl: t.CoverUrl,
      ExtractionStatus: 'Pronto',
      CreatedAt: t.AddedAt,
      Bpm: t.Bpm,
      Key: t.Key,
      Stems: t.Stems.map(s => ({
        StemId: s.StemId,
        TrackId: s.TrackId,
        StemType: s.StemType,
        AudioUrl: s.AudioUrl
      }))
    };

    const tracksQueue = playlist ? playlist.Tracks.map(x => ({
      TrackId: x.TrackId,
      TrackTitle: x.TrackTitle,
      ArtistName: x.ArtistName,
      CoverUrl: x.CoverUrl,
      ExtractionStatus: 'Pronto',
      CreatedAt: x.AddedAt,
      Bpm: x.Bpm,
      Key: x.Key,
      Stems: x.Stems.map(s => ({
        StemId: s.StemId,
        TrackId: s.TrackId,
        StemType: s.StemType,
        AudioUrl: s.AudioUrl
      }))
    })) : [];

    loadTrack(trackToPlay, playlist?.PlaylistId, undefined, tracksQueue, playlist?.Name);
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
      const res = await fetch(`${API_URL}/Tracks/${trackToDelete.TrackId}?reason=${encodeURIComponent(deletionReasonInput)}`, {
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
        const errorData = await res.json().catch(() => ({}));
        setDeleteError(errorData.ErrorMessage || 'Não foi possível concluir a exclusão.');
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

  const handleToggleSavePlaylist = async () => {
    if (!IsAuthenticated || !Token) {
      openLoginModal();
      return;
    }
    if (!playlist) return;
    const isCurrentlySaved = playlist.IsSaved;
    try {
      const res = await fetch(`${API_URL}/Playlists/${playlist.PlaylistId}/Save`, {
        method: isCurrentlySaved ? 'DELETE' : 'POST',
        headers: {
          'Authorization': `Bearer ${Token}`
        }
      });
      if (res.ok) {
        setPlaylist(prev => {
          if (!prev) return null;
          return {
            ...prev,
            IsSaved: !isCurrentlySaved
          };
        });
        fetchPlaylists(); // atualiza barra lateral
      }
    } catch (err) {
      console.error("Erro ao salvar/remover playlist", err);
    }
  };

  const handleSharePlaylist = () => {
    navigator.clipboard.writeText(window.location.href);
    setShowToast(true);
  };

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const handlePlayPlaylist = () => {
    if (playlist && playlist.Tracks.length > 0) {
      const isActivePlaylist = currentPlaylistId === playlist.PlaylistId;
      if (isActivePlaylist) {
        togglePlay();
      } else {
        const tracksQueue = playlist.Tracks.map(x => ({
          TrackId: x.TrackId,
          TrackTitle: x.TrackTitle,
          ArtistName: x.ArtistName,
          CoverUrl: x.CoverUrl,
          ExtractionStatus: 'Pronto',
          CreatedAt: x.AddedAt,
          Bpm: x.Bpm,
          Key: x.Key,
          Stems: x.Stems.map(s => ({
            StemId: s.StemId,
            TrackId: s.TrackId,
            StemType: s.StemType,
            AudioUrl: s.AudioUrl
          }))
        }));
        
        const startIndex = isShuffle ? Math.floor(Math.random() * tracksQueue.length) : 0;
        const firstTrack = tracksQueue[startIndex];
        loadTrack(firstTrack, playlist.PlaylistId, undefined, tracksQueue, playlist.Name);
      }
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


  const handleTrackContextMenu = (e: React.MouseEvent, track: IPlaylistTrack) => {
    e.preventDefault();
    if (!IsAuthenticated) {
      openLoginModal();
      return;
    }
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
      <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-center md:items-end bg-transparent md:bg-gradient-to-b md:from-brand-hover/40 md:to-transparent p-0 md:p-6 rounded-none md:rounded-lg border-none md:border md:border-brand-hover/30 shadow-none md:shadow-inner text-center md:text-left">
        {/* Capa */}
        <div className="w-52 h-52 md:w-48 md:h-48 bg-black rounded shadow-2xl flex items-center justify-center shrink-0 overflow-hidden relative group border border-brand-hover mx-auto md:mx-0">
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
        <div className="flex-1 flex flex-col gap-1.5 md:gap-2 w-full">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <span className="text-[10px] bg-brand-green/10 border border-brand-green/30 text-brand-green px-2 py-0.5 rounded uppercase font-bold tracking-wider">
              {playlist.Visibility === 'Public' ? 'Pública' : playlist.Visibility === 'Private' ? 'Privada' : 'Não Listada'}
            </span>
            {playlist.Collaborators.length > 0 && (
              <span className="text-[10px] bg-purple-500/10 border border-purple-500/30 text-purple-300 px-2 py-0.5 rounded uppercase font-bold tracking-wider flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Colaborativa
              </span>
            )}
          </div>

          <h1 className="text-2xl md:text-5xl font-black tracking-tight text-white leading-tight m-0 uppercase select-text">
            {playlist.Name}
          </h1>

          {playlist.Description && (
            <p className="text-xs text-brand-gray leading-normal m-0 select-text max-w-xl mx-auto md:mx-0">
              {playlist.Description}
            </p>
          )}

          <div className="flex items-center justify-center md:justify-start gap-2 text-xs text-brand-gray font-medium flex-wrap mt-1 md:mt-2.5 select-none leading-none">
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

        {/* Ações Desktop (Configurações, Download, Curtir, Compartilhar) - Oculto no Mobile */}
        <div className="hidden md:flex gap-3 self-end justify-end mt-0 shrink-0 items-center w-auto">
          {playlist.Tracks.length > 0 && (
            <button
              onClick={handlePlayPlaylist}
              className="w-10 h-10 rounded-full bg-brand-green text-black flex items-center justify-center shadow hover:scale-105 active:scale-95 transition-all cursor-pointer mr-1"
              title={currentPlaylistId === playlist.PlaylistId && isPlaying ? "Pausar Playlist" : "Tocar Playlist"}
            >
              {currentPlaylistId === playlist.PlaylistId && isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current translate-x-[1px]" />
              )}
            </button>
          )}

          <button
            onClick={handleToggleSavePlaylist}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shadow hover:scale-105 active:scale-95 ${
              playlist.IsSaved
                ? 'bg-brand-green text-black border-none'
                : 'bg-transparent border border-brand-gray/30 text-brand-gray hover:text-white hover:border-white'
            }`}
            title={playlist.IsSaved ? "Remover da Biblioteca" : "Salvar na Biblioteca"}
          >
            <Heart className={`w-4 h-4 ${playlist.IsSaved ? 'fill-current text-black' : ''}`} />
          </button>

          <button
            onClick={handleSharePlaylist}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-transparent border border-brand-gray/30 hover:border-white text-brand-gray hover:text-white hover:bg-white/5 transition-all cursor-pointer shadow hover:scale-105 active:scale-95"
            title="Compartilhar Playlist"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {isPremium && (
            <button
              onClick={handlePlaylistDownloadClick}
              disabled={playlistDownloadStatus === 'loading'}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer shadow hover:scale-105 active:scale-95 ${
                playlistDownloadStatus === 'downloaded'
                  ? 'bg-brand-green text-black border-none'
                  : playlistDownloadStatus === 'loading'
                  ? 'bg-transparent border border-brand-green/30 text-brand-green cursor-not-allowed'
                  : 'bg-transparent border border-brand-gray/30 text-brand-gray hover:text-white hover:border-white'
              }`}
              title={
                playlistDownloadStatus === 'downloaded'
                  ? 'Remover download offline'
                  : playlistDownloadStatus === 'loading'
                  ? 'Baixando faixas...'
                  : 'Baixar Playlist Offline'
              }
            >
              {playlistDownloadStatus === 'loading' ? (
                <Loader2 className="w-4 h-4 animate-spin text-brand-green" />
              ) : (
                <Download className={`w-4 h-4 ${playlistDownloadStatus === 'downloaded' ? 'fill-current text-black' : ''}`} />
              )}
            </button>
          )}

          {isOwnerOrAdmin && (
            <button
              onClick={triggerGlobalEdit}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-transparent border border-brand-gray/30 hover:border-white text-brand-gray hover:text-white hover:bg-white/5 transition-all cursor-pointer shadow hover:scale-105 active:scale-95"
              title="Configurações da Playlist"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Ações Mobile (Estilo Spotify) - Exibido apenas no Mobile */}
      <div className="flex md:hidden items-center justify-between px-2 py-1 select-none w-full shrink-0">
        <div className="flex items-center gap-6">
          {/* Botão de Salvar/Gostar da Playlist na Biblioteca */}
          <button
            onClick={handleToggleSavePlaylist}
            className="text-brand-gray hover:text-brand-green active:scale-90 transition-all cursor-pointer p-1"
            title={playlist.IsSaved ? "Remover da Biblioteca" : "Salvar na Biblioteca"}
          >
            <Heart 
              className={`w-6 h-6 ${playlist.IsSaved ? 'fill-brand-green text-brand-green' : 'text-brand-gray hover:text-white'}`} 
            />
          </button>

          {/* Botão de Compartilhar Playlist */}
          <button
            onClick={handleSharePlaylist}
            className="text-brand-gray hover:text-white active:scale-90 transition-all cursor-pointer p-1"
            title="Compartilhar Playlist"
          >
            <Share2 className="w-6 h-6" />
          </button>

          {/* Botão de Reticências para mais opções da playlist */}
          <button
            onClick={() => setMobilePlaylistMenuOpen(true)}
            className="text-brand-gray hover:text-white active:scale-90 transition-all cursor-pointer p-1"
            title="Mais Opções da Playlist"
          >
            <MoreHorizontal className="w-6 h-6" />
          </button>
        </div>

        {/* Botão Gigante de Play Circular Verde no lado direito */}
        {playlist.Tracks.length > 0 && (
          <button
            onClick={handlePlayPlaylist}
            className="w-12 h-12 rounded-full bg-brand-green text-black flex items-center justify-center shadow-lg active:scale-95 hover:scale-105 transition-all cursor-pointer"
            title={currentPlaylistId === playlist.PlaylistId && isPlaying ? "Pausar Playlist" : "Tocar Playlist"}
          >
            {currentPlaylistId === playlist.PlaylistId && isPlaying ? (
              <Pause className="w-6 h-6 fill-current" />
            ) : (
              <Play className="w-6 h-6 fill-current translate-x-[1px]" />
            )}
          </button>
        )}
      </div>

      {/* 2. Playlist Track List */}
      <div className="bg-transparent md:bg-black/15 p-0 md:p-6 rounded-none md:rounded-lg flex flex-col gap-4 md:gap-6 mt-2 md:mt-4">
        {playlist.Tracks.length === 0 ? (
          <div className="text-center py-10 flex flex-col gap-3 items-center">
            <Disc className="w-12 h-12 text-brand-gray/30 animate-pulse" />
            <span className="text-sm font-semibold text-brand-gray">Nenhuma música adicionada ainda.</span>
            <p className="text-xs text-brand-gray/60 max-w-sm leading-relaxed">
              Navegue pelo painel Explorar ou Minha Biblioteca, clique com o botão direito nas músicas e selecione "Adicionar à Playlist" para rechear sua lista!
            </p>
          </div>
        ) : (
          <>
            {/* Desktop View: Table */}
            <div className="hidden md:block overflow-x-auto w-full select-none">
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
                    {isPremium && (
                      <th style={{ width: 44 }} className="py-2.5 px-3 relative select-none">
                        {/* Coluna vazia para download */}
                      </th>
                    )}
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
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          if (target.closest('button') || target.closest('.hover\\:underline') || target.tagName === 'A') {
                            return;
                          }
                          setSelectedTrackIndex(index);
                        }}
                        onDoubleClick={(e) => {
                          const target = e.target as HTMLElement;
                          if (target.closest('button') || target.closest('.hover\\:underline') || target.tagName === 'A') {
                            return;
                          }
                          if (isCurrentTrack) {
                            togglePlay();
                          } else {
                            handlePlayTrack(t);
                          }
                        }}
                        className={`border-b border-brand-hover/40 hover:bg-brand-hover/30 transition-colors group ${
                          isCurrentTrack ? 'bg-brand-hover/10' : ''
                        } ${selectedTrackIndex === index ? '!bg-brand-hover/55 border-l-2 border-l-brand-green' : ''} ${draggedIndex === index ? '!opacity-35 !bg-brand-hover/65' : ''} ${
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
                            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 text-brand-green hover:scale-110 transition-all cursor-pointer bg-brand-card/90 rounded-l animate-in fade-in duration-100"
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
                              <div className="flex items-center gap-2 min-w-0">
                                <span 
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (isCurrentTrack) {
                                      navigate('/daw');
                                      return;
                                    }
                                    const trackToPlay = {
                                      TrackId: t.TrackId,
                                      TrackTitle: t.TrackTitle,
                                      ArtistName: t.ArtistName,
                                      CoverUrl: t.CoverUrl,
                                      ExtractionStatus: 'Pronto',
                                      CreatedAt: t.AddedAt,
                                      Bpm: t.Bpm,
                                      Key: t.Key,
                                      Stems: t.Stems.map(s => ({
                                        StemId: s.StemId,
                                        TrackId: s.TrackId,
                                        StemType: s.StemType,
                                        AudioUrl: s.AudioUrl
                                      }))
                                    };
                                    const tracksQueue = playlist ? playlist.Tracks.map(x => ({
                                      TrackId: x.TrackId,
                                      TrackTitle: x.TrackTitle,
                                      ArtistName: x.ArtistName,
                                      CoverUrl: x.CoverUrl,
                                      ExtractionStatus: 'Pronto',
                                      CreatedAt: x.AddedAt,
                                      Bpm: x.Bpm,
                                      Key: x.Key,
                                      Stems: x.Stems.map(s => ({
                                        StemId: s.StemId,
                                        TrackId: s.TrackId,
                                        StemType: s.StemType,
                                        AudioUrl: s.AudioUrl
                                      }))
                                    })) : [];
                                    await loadTrack(trackToPlay, playlist?.PlaylistId, undefined, tracksQueue, playlist?.Name);
                                    navigate('/daw');
                                  }}
                                  className={`font-bold truncate text-sm hover:underline cursor-pointer ${isCurrentTrack ? 'text-brand-green' : 'text-white'}`}
                                >
                                  {t.TrackTitle}
                                </span>
                                {t.DeletionPending && (
                                  <div className="relative group/tooltip flex items-center gap-1 select-none shrink-0 animate-pulse">
                                    <span className="text-[8px] bg-red-950/60 text-red-400 border border-red-900/50 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                      Marcado pra Excluir
                                    </span>
                                    {CurrentUser?.UserRole === 'Admin' && t.DeletionReason && (
                                      <>
                                        <Info className="w-3.5 h-3.5 text-red-400/80 hover:text-red-400 cursor-pointer shrink-0" />
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-brand-card border border-brand-hover text-[11px] text-brand-gray rounded shadow-2xl invisible group-hover/tooltip:visible opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 z-50 pointer-events-none leading-relaxed normal-case text-left font-normal">
                                          <strong className="text-white block mb-0.5">Motivo da exclusão:</strong>
                                          {t.DeletionReason}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                                {t.Visibility === 'Private' && (
                                  <div className="relative group/tooltip shrink-0 flex items-center gap-1 select-none">
                                    <span className="text-[8px] bg-red-950/40 text-red-400 border border-red-900/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                      Privada
                                    </span>
                                    <Info className="w-3 h-3 text-red-400/80 hover:text-red-400 cursor-pointer shrink-0" />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-brand-card border border-brand-hover text-[11px] text-brand-gray rounded shadow-2xl invisible group-hover/tooltip:visible opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 z-50 pointer-events-none leading-relaxed font-normal normal-case text-left">
                                      Essa musica é privada e só aparece para quem fez o upload dela.
                                    </div>
                                  </div>
                                )}
                                {t.Visibility === 'Unlisted' && (
                                  <div className="relative group/tooltip shrink-0 flex items-center gap-1 select-none">
                                    <span className="text-[8px] bg-yellow-950/40 text-yellow-500 border border-yellow-900/30 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                      Não Listada
                                    </span>
                                    <Info className="w-3 h-3 text-yellow-500/80 hover:text-yellow-500 cursor-pointer shrink-0" />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-brand-card border border-brand-hover text-[11px] text-brand-gray rounded shadow-2xl invisible group-hover/tooltip:visible opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 z-50 pointer-events-none leading-relaxed font-normal normal-case text-left">
                                      Essa musica só aparece para quem fez o upload dela, pra quem é dono da playlist e pra quem é colaborador da playlist, e nao aparecerá pro resto do publico.
                                    </div>
                                  </div>
                                )}
                              </div>
                              <span 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Future: navigate(`/artists/${t.ArtistName}`)
                                }}
                                className="text-[11px] text-brand-gray truncate hover:underline cursor-pointer mt-0.5"
                              >
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

                        {isPremium && (
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTrackDownloadClick(t);
                                }}
                                disabled={downloadingTrackIds[t.TrackId]}
                                className={`w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                                  downloadedTrackIds[t.TrackId]
                                    ? 'bg-brand-green text-black border-none'
                                    : downloadingTrackIds[t.TrackId]
                                    ? 'bg-transparent text-brand-green border-none'
                                    : 'bg-transparent text-brand-gray/40 hover:text-white border border-brand-gray/25 opacity-0 group-hover:opacity-100'
                                }`}
                                title={
                                  downloadedTrackIds[t.TrackId]
                                    ? 'Remover download offline'
                                    : downloadingTrackIds[t.TrackId]
                                    ? 'Baixando...'
                                    : 'Salvar para ouvir offline'
                                }
                              >
                                {downloadingTrackIds[t.TrackId] ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : downloadedTrackIds[t.TrackId] ? (
                                  <Download className="w-3.5 h-3.5 fill-current text-black" />
                                ) : (
                                  <Download className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                        )}

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

            {/* Mobile View: minimalist vertical list */}
            <div className="flex md:hidden flex-col gap-1 w-full select-none">
              {playlist.Tracks.map((t) => {
                const isCurrentTrack = currentTrack && currentTrack.TrackId === t.TrackId;

                return (
                  <div 
                    key={t.TrackId}
                    onClick={() => {
                      if (isCurrentTrack) {
                        togglePlay();
                      } else {
                        handlePlayTrack(t);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (!IsAuthenticated) {
                        openLoginModal();
                      } else {
                        setMobileTrackMenu(t);
                      }
                    }}
                    className={`flex items-center gap-3 p-2 rounded-md active:bg-brand-hover/40 transition-colors cursor-pointer ${
                      isCurrentTrack ? 'bg-brand-hover/10' : ''
                    }`}
                  >
                    {/* Capa */}
                    <div className="w-11 h-11 bg-black rounded overflow-hidden flex items-center justify-center text-brand-green shrink-0 border border-brand-hover relative">
                      {t.CoverUrl ? (
                        <img 
                          src={t.CoverUrl.startsWith('http') ? t.CoverUrl : `${SERVER_URL}${t.CoverUrl}`} 
                          alt="Capa" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Music className="w-4 h-4" />
                      )}
                      {isCurrentTrack && isPlaying && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <div className="flex gap-0.5 items-end h-3">
                            <div className="w-0.75 bg-brand-green animate-bounce" style={{ animationDuration: '0.6s' }} />
                            <div className="w-0.75 bg-brand-green animate-bounce h-2" style={{ animationDuration: '0.8s', animationDelay: '0.15s' }} />
                            <div className="w-0.75 bg-brand-green animate-bounce h-1" style={{ animationDuration: '0.5s', animationDelay: '0.3s' }} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Título & Artista */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span 
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (isCurrentTrack) {
                              navigate('/daw');
                              return;
                            }
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
                            const tracksQueue = playlist ? playlist.Tracks.map(x => ({
                              TrackId: x.TrackId,
                              TrackTitle: x.TrackTitle,
                              ArtistName: x.ArtistName,
                              CoverUrl: x.CoverUrl,
                              ExtractionStatus: 'Pronto',
                              CreatedAt: x.AddedAt,
                              Stems: x.Stems.map(s => ({
                                StemId: s.StemId,
                                TrackId: s.TrackId,
                                StemType: s.StemType,
                                AudioUrl: s.AudioUrl
                              }))
                            })) : [];
                            await loadTrack(trackToPlay, playlist?.PlaylistId, undefined, tracksQueue, playlist?.Name);
                            navigate('/daw');
                          }}
                          className={`font-bold text-sm truncate hover:underline cursor-pointer leading-tight ${
                            isCurrentTrack ? 'text-brand-green' : 'text-white'
                          }`}
                        >
                          {t.TrackTitle}
                        </span>
                        {t.DeletionPending && (
                          <div className="relative group/tooltip flex items-center gap-1 select-none shrink-0 animate-pulse">
                            <span className="text-[7px] bg-red-950/60 text-red-400 border border-red-900/50 px-1 py-0.2 rounded font-bold uppercase tracking-wider">
                              Marcado pra Excluir
                            </span>
                            {CurrentUser?.UserRole === 'Admin' && t.DeletionReason && (
                              <>
                                <Info className="w-2.5 h-2.5 text-red-400/80 hover:text-red-400 cursor-pointer shrink-0" />
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-brand-card border border-brand-hover text-[10px] text-brand-gray rounded shadow-2xl invisible group-hover/tooltip:visible opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 z-50 pointer-events-none leading-relaxed normal-case text-left font-normal">
                                  <strong className="text-white block mb-0.5">Motivo da exclusão:</strong>
                                  {t.DeletionReason}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                        {t.Visibility === 'Private' && (
                          <div className="relative group/tooltip shrink-0 flex items-center gap-0.5 select-none">
                            <span className="text-[7px] bg-red-950/40 text-red-400 border border-red-900/30 px-1 py-0.2 rounded font-bold uppercase tracking-wider">
                              Privada
                            </span>
                            <Info className="w-2.5 h-2.5 text-red-400/80 shrink-0" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-brand-card border border-brand-hover text-[10px] text-brand-gray rounded shadow-2xl invisible group-hover/tooltip:visible opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 z-50 pointer-events-none leading-relaxed font-normal normal-case text-left">
                              Essa musica é privada e só aparece para quem fez o upload dela.
                            </div>
                          </div>
                        )}
                        {t.Visibility === 'Unlisted' && (
                          <div className="relative group/tooltip shrink-0 flex items-center gap-0.5 select-none">
                            <span className="text-[7px] bg-yellow-950/40 text-yellow-500 border border-yellow-900/30 px-1 py-0.2 rounded font-bold uppercase tracking-wider">
                              Não Listada
                            </span>
                            <Info className="w-2.5 h-2.5 text-yellow-500/80 shrink-0" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-brand-card border border-brand-hover text-[10px] text-brand-gray rounded shadow-2xl invisible group-hover/tooltip:visible opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 z-50 pointer-events-none leading-relaxed font-normal normal-case text-left">
                              Essa musica só aparece para quem fez o upload dela, pra quem é dono da playlist e pra quem é colaborador da playlist, e nao aparecerá pro resto do publico.
                            </div>
                          </div>
                        )}
                      </div>
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          // Future: navigate(`/artists/${t.ArtistName}`)
                        }}
                        className="text-xs text-brand-gray truncate hover:underline cursor-pointer mt-0.5 leading-none"
                      >
                        {t.ArtistName}
                      </span>
                    </div>

                    {/* Reticências (Menu Mobile) */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!IsAuthenticated) {
                          openLoginModal();
                        } else {
                          setMobileTrackMenu(t);
                        }
                      }}
                      className="p-1.5 -mr-1.5 text-brand-gray/50 hover:text-white active:scale-90 transition-all cursor-pointer shrink-0"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
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
          {(CurrentUser?.UserRole === 'Admin' || contextMenu.track.UploadedBy === CurrentUser?.UserId) && (
            <>
              <div className="h-[1px] bg-brand-hover my-1" />
              {CurrentUser?.UserRole === 'Admin' && contextMenu.track.DeletionPending ? (
                <button
                  onClick={() => {
                    setTrackToReview(contextMenu.track);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-2 rounded text-xs font-semibold hover:bg-brand-hover text-white transition-all cursor-pointer flex items-center gap-2 hover:text-brand-green"
                >
                  <ShieldAlert className="w-4 h-4 text-brand-green shrink-0" />
                  <span>Avaliar Solicitação</span>
                </button>
              ) : (
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
              )}
            </>
          )}
        </div>
      )}

      {/* MODAL DE EXCLUSÃO DE MÚSICA DA PLATAFORMA (Timer de 3s - Admin) */}
      {trackToDelete && (
        <div 
          onClick={() => { if (!isDeleting) setTrackToDelete(null); }}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200"
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="bg-brand-card border border-brand-hover w-full max-w-md p-6 rounded shadow-2xl flex flex-col gap-4 relative animate-in zoom-in-95 duration-200"
          >
            <button 
              onClick={() => setTrackToDelete(null)}
              className="absolute top-4 right-4 text-brand-gray hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 text-red-500">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">
                  {CurrentUser?.UserRole === 'Admin' ? 'Ação Destrutiva - Admin' : 'Solicitar Exclusão'}
                </span>
                <h3 className="text-sm font-bold text-white">
                  {CurrentUser?.UserRole === 'Admin' ? 'Excluir Música Permanentemente' : 'Solicitar Exclusão da Música'}
                </h3>
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
              {CurrentUser?.UserRole === 'Admin' ? (
                <>
                  Esta ação é <strong className="text-red-400">irreversível</strong>. A música será removida permanentemente de todo o sistema Mixer8, seus arquivos físicos de áudio/stems e imagem de capa serão deletados do servidor, e ela será desassociada de todas as playlists.
                </>
              ) : (
                <>
                  Esta solicitação enviará a música para moderação de um administrador e ela será <strong className="text-red-400">ocultada imediatamente</strong> da plataforma para todos os usuários normais.
                </>
              )}
            </p>

            {CurrentUser?.UserRole !== 'Admin' && (
              <div className="flex flex-col gap-1.5 mt-1">
                <label className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">Motivo da Exclusão (Opcional)</label>
                <textarea
                  value={deletionReasonInput}
                  onChange={(e) => setDeletionReasonInput(e.target.value)}
                  placeholder="Ex: Direitos autorais, arquivo incorreto, solicitação legal..."
                  className="w-full bg-black border border-brand-hover rounded p-2 text-xs text-white focus:outline-none focus:border-brand-green h-16 resize-none"
                  maxLength={1000}
                />
              </div>
            )}

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
                    <span>{CurrentUser?.UserRole === 'Admin' ? 'Excluindo...' : 'Solicitando...'}</span>
                  </>
                ) : deleteCountdown > 0 ? (
                  <span>{CurrentUser?.UserRole === 'Admin' ? `Excluir (${deleteCountdown}s)` : `Solicitar (${deleteCountdown}s)`}</span>
                ) : (
                  <span>{CurrentUser?.UserRole === 'Admin' ? 'Confirmar Exclusão' : 'Confirmar Solicitação'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE REVISÃO E AVALIAÇÃO DE EXCLUSÃO (ADMIN ONLY) */}
      {trackToReview && (
        <div 
          onClick={() => { if (!isDeleting) setTrackToReview(null); }}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200"
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="bg-brand-card border border-brand-hover w-full max-w-md p-6 rounded shadow-2xl flex flex-col gap-4 relative animate-in zoom-in-95 duration-200"
          >
            <button 
              onClick={() => setTrackToReview(null)}
              className="absolute top-4 right-4 text-brand-gray hover:text-white cursor-pointer"
              disabled={isDeleting}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 text-brand-green">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] text-brand-green font-bold uppercase tracking-wider">Painel de Moderação</span>
                <h3 className="text-sm font-bold text-white">Revisar Solicitação de Exclusão</h3>
              </div>
            </div>

            <div className="bg-black/40 border border-brand-hover p-3 rounded flex items-center gap-3">
              <div className="w-12 h-12 bg-black rounded overflow-hidden flex items-center justify-center text-brand-green border border-brand-hover shrink-0">
                {trackToReview.CoverUrl ? (
                  <img 
                    src={trackToReview.CoverUrl.startsWith('http') ? trackToReview.CoverUrl : `${SERVER_URL}${trackToReview.CoverUrl}`} 
                    alt="Capa" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Music className="w-5 h-5" />
                )}
              </div>
              <div className="flex flex-col truncate">
                <span className="font-bold text-white text-sm truncate">{trackToReview.TrackTitle}</span>
                <span className="text-xs text-brand-gray truncate">{trackToReview.ArtistName}</span>
                {(trackToReview.UploadedByUserName || trackToReview.UploadedByEmail) && (
                  <span className="text-[10px] text-brand-gray/70 truncate mt-0.5 select-text">
                    Uploader: {trackToReview.UploadedByUserName ? `@${trackToReview.UploadedByUserName}` : ''} {trackToReview.UploadedByEmail ? `(${trackToReview.UploadedByEmail})` : ''}
                  </span>
                )}
              </div>
            </div>

            <div className="bg-red-950/20 border border-red-900/30 p-4 rounded flex flex-col gap-1.5">
              <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Justificativa do Solicitante</span>
              <p className="text-xs text-white leading-relaxed m-0 italic select-text">
                "{trackToReview.DeletionReason || "Nenhum motivo informado pelo usuário."}"
              </p>
            </div>

            {deleteError && (
              <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded text-xs text-red-400">
                {deleteError}
              </div>
            )}

            <div className="flex justify-between gap-3 mt-2 pt-3 border-t border-brand-hover">
              <button
                type="button"
                onClick={() => setTrackToReview(null)}
                disabled={isDeleting}
                className="py-2 px-3 border border-brand-hover rounded text-xs font-semibold text-brand-gray hover:text-white cursor-pointer disabled:opacity-50"
              >
                Voltar
              </button>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (isDeleting) return;
                    setIsDeleting(true);
                    setDeleteError('');
                    try {
                      const res = await fetch(`${API_URL}/Tracks/${trackToReview.TrackId}/Restore`, {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${Token}`
                        }
                      });
                      if (res.ok) {
                        setTrackToReview(null);
                        fetchPlaylistDetails();
                      } else {
                        const errorData = await res.json().catch(() => ({}));
                        setDeleteError(errorData.ErrorMessage || 'Falha ao restaurar a música.');
                      }
                    } catch {
                      setDeleteError('Erro de conexão ao tentar restaurar a música.');
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                  disabled={isDeleting}
                  className="py-2 px-3 bg-brand-green text-black font-bold rounded text-xs hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:hover:scale-100"
                >
                  Manter Ativa (Restaurar)
                </button>
                
                <button
                  type="button"
                  onClick={async () => {
                    if (isDeleting) return;
                    setTrackToDelete(trackToReview);
                    setTrackToReview(null);
                  }}
                  disabled={isDeleting}
                  className="py-2 px-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-xs hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:hover:scale-100"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE REMOÇÃO DE MÚSICA DA PLAYLIST (CUSTOM REACT MODAL) */}
      {trackToRemove && (
        <div 
          onClick={() => setTrackToRemove(null)}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200"
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="bg-brand-card border border-brand-hover w-full max-w-md p-6 rounded shadow-2xl flex flex-col gap-4 relative animate-in zoom-in-95 duration-200"
          >
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

      {/* MODAL DE CONFIRMAÇÃO DE REMOÇÃO DE DOWNLOADS DA PLAYLIST */}
      {showRemoveDownloadModal && (
        <div 
          onClick={() => setShowRemoveDownloadModal(false)}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200"
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="bg-brand-card border border-brand-hover w-full max-w-md p-6 rounded shadow-2xl flex flex-col gap-4 relative animate-in zoom-in-95 duration-200"
          >
            <button 
              onClick={() => setShowRemoveDownloadModal(false)}
              className="absolute top-4 right-4 text-brand-gray hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 text-red-500">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Armazenamento Local</span>
                <h3 className="text-sm font-bold text-white">Remover Downloads da Playlist</h3>
              </div>
            </div>

            <p className="text-xs text-brand-gray leading-relaxed m-0">
              Tem certeza que deseja remover os downloads offline de todas as faixas desta playlist? Elas <strong className="text-white">continuarão salvas na plataforma</strong>, mas você precisará de internet para carregá-las e tocá-las novamente.
            </p>

            <div className="flex justify-end gap-3 mt-2 pt-3 border-t border-brand-hover">
              <button
                type="button"
                onClick={() => setShowRemoveDownloadModal(false)}
                className="py-2 px-3 border border-brand-hover rounded text-xs font-semibold text-brand-gray hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRemovePlaylistDownloads}
                className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-xs hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
              >
                Confirmar Remoção
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE REMOÇÃO DE DOWNLOAD DE MÚSICA INDIVIDUAL */}
      {trackToRemoveDownload && (
        <div 
          onClick={() => setTrackToRemoveDownload(null)}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200"
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="bg-brand-card border border-brand-hover w-full max-w-md p-6 rounded shadow-2xl flex flex-col gap-4 relative animate-in zoom-in-95 duration-200"
          >
            <button 
              onClick={() => setTrackToRemoveDownload(null)}
              className="absolute top-4 right-4 text-brand-gray hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 text-red-500">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Armazenamento Local</span>
                <h3 className="text-sm font-bold text-white">Remover Download da Música</h3>
              </div>
            </div>

            <div className="bg-black/40 border border-brand-hover p-3 rounded flex items-center gap-3">
              <div className="w-12 h-12 bg-black rounded overflow-hidden flex items-center justify-center text-brand-green border border-brand-hover shrink-0">
                {trackToRemoveDownload.CoverUrl ? (
                  <img 
                    src={trackToRemoveDownload.CoverUrl.startsWith('http') ? trackToRemoveDownload.CoverUrl : `${SERVER_URL}${trackToRemoveDownload.CoverUrl}`} 
                    alt="Capa" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Music className="w-5 h-5" />
                )}
              </div>
              <div className="flex flex-col truncate">
                <span className="font-bold text-white text-sm truncate">{trackToRemoveDownload.TrackTitle}</span>
                <span className="text-xs text-brand-gray truncate">{trackToRemoveDownload.ArtistName}</span>
              </div>
            </div>

            <p className="text-xs text-brand-gray leading-relaxed m-0">
              Tem certeza que deseja remover o download offline desta música? Ela <strong className="text-white">continuará na playlist</strong>, mas você precisará de internet para carregá-la e tocá-la novamente.
            </p>

            <div className="flex justify-end gap-3 mt-2 pt-3 border-t border-brand-hover">
              <button
                type="button"
                onClick={() => setTrackToRemoveDownload(null)}
                className="py-2 px-3 border border-brand-hover rounded text-xs font-semibold text-brand-gray hover:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const trackToClean = {
                      TrackId: trackToRemoveDownload.TrackId,
                      TrackTitle: trackToRemoveDownload.TrackTitle,
                      ArtistName: trackToRemoveDownload.ArtistName,
                      CoverUrl: trackToRemoveDownload.CoverUrl,
                      Stems: trackToRemoveDownload.Stems.map(s => ({
                        StemId: s.StemId,
                        TrackId: s.TrackId,
                        StemType: s.StemType,
                        AudioUrl: s.AudioUrl
                      }))
                    } as any;
                    await removeTrackOffline(trackToClean);
                  } catch (err) {
                    console.error('[CACHE] Erro ao remover download de track:', err);
                  } finally {
                    setTrackToRemoveDownload(null);
                  }
                }}
                className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-xs hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
              >
                Confirmar Remoção
              </button>
            </div>
          </div>
        </div>
      )}
      {/* BACKDROP DO MENU MOBILE */}
      {mobileTrackMenu && (
        <div 
          className="fixed inset-0 bg-black/60 z-[95] animate-in fade-in duration-200 md:hidden"
          onClick={() => setMobileTrackMenu(null)}
        />
      )}

      {/* BOTTOM SHEET DO MENU MOBILE */}
      {mobileTrackMenu && (
        <div className="fixed inset-x-0 bottom-0 bg-brand-card border-t border-brand-hover rounded-t-2xl shadow-2xl p-5 z-[100] flex flex-col gap-4 animate-in slide-in-from-bottom duration-250 md:hidden select-none animate-duration-200">
          {/* Barra discreta de arrastar no topo */}
          <div className="w-12 h-1 bg-brand-gray/30 rounded-full mx-auto mb-1 shrink-0" />

          {/* Cabeçalho com Info da Música */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-12 h-12 bg-black rounded overflow-hidden flex items-center justify-center text-brand-green shrink-0 border border-brand-hover">
              {mobileTrackMenu.CoverUrl ? (
                <img 
                  src={mobileTrackMenu.CoverUrl.startsWith('http') ? mobileTrackMenu.CoverUrl : `${SERVER_URL}${mobileTrackMenu.CoverUrl}`} 
                  alt="Capa" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <Music className="w-5 h-5" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm text-white truncate leading-tight select-text">
                {mobileTrackMenu.TrackTitle}
              </span>
              <span className="text-xs text-brand-gray truncate mt-1 select-text">
                {mobileTrackMenu.ArtistName}
              </span>
            </div>
          </div>

          <div className="h-[1px] bg-brand-hover w-full shrink-0" />

          {/* Opções */}
          <div className="flex flex-col gap-1 overflow-y-auto max-h-[300px]">
            <button
              onClick={() => {
                openAddToPlaylist(mobileTrackMenu.TrackId, mobileTrackMenu.TrackTitle, mobileTrackMenu.ArtistName);
                setMobileTrackMenu(null);
              }}
              className="w-full text-left px-3 py-3 rounded-lg text-sm font-semibold hover:bg-brand-hover text-white active:bg-brand-hover/50 transition-all cursor-pointer flex items-center gap-3"
            >
              <Plus className="w-5 h-5 text-brand-green shrink-0" />
              <span>Adicionar à playlist</span>
            </button>

            {isPremium && (
              <button
                onClick={() => {
                  handleTrackDownloadClick(mobileTrackMenu);
                  setMobileTrackMenu(null);
                }}
                disabled={downloadingTrackIds[mobileTrackMenu.TrackId]}
                className="w-full text-left px-3 py-3 rounded-lg text-sm font-semibold hover:bg-brand-hover text-white active:bg-brand-hover/50 transition-all cursor-pointer flex items-center gap-3"
              >
                {downloadingTrackIds[mobileTrackMenu.TrackId] ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-brand-green shrink-0" />
                    <span>Baixando stems...</span>
                  </>
                ) : downloadedTrackIds[mobileTrackMenu.TrackId] ? (
                  <>
                    <Download className="w-5 h-5 fill-current text-brand-green shrink-0" />
                    <span>Remover download offline</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 text-brand-gray shrink-0" />
                    <span>Baixar para ouvir offline</span>
                  </>
                )}
              </button>
            )}

            {/* Opção para remover da playlist */}
            {canModifyPlaylist && (
              <button
                onClick={() => {
                  setTrackToRemove(mobileTrackMenu);
                  setMobileTrackMenu(null);
                }}
                className="w-full text-left px-3 py-3 rounded-lg text-sm font-semibold hover:bg-brand-hover text-white active:bg-brand-hover/50 transition-all cursor-pointer flex items-center gap-3"
              >
                <Minus className="w-5 h-5 text-brand-gray shrink-0" />
                <span>Remover desta playlist</span>
              </button>
            )}

            {/* Exclusão do Admin */}
            {CurrentUser?.UserRole === 'Admin' && (
              <>
                <div className="h-[1px] bg-brand-hover my-1 shrink-0" />
                {mobileTrackMenu.DeletionPending ? (
                  <button
                    onClick={() => {
                      setTrackToReview(mobileTrackMenu);
                      setMobileTrackMenu(null);
                    }}
                    className="w-full text-left px-3 py-3 rounded-lg text-sm font-semibold hover:bg-brand-hover text-white active:bg-brand-hover/80 transition-all cursor-pointer flex items-center gap-3"
                  >
                    <ShieldAlert className="w-5 h-5 text-brand-green shrink-0" />
                    <span>Avaliar Solicitação</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setTrackToDelete(mobileTrackMenu);
                      setDeleteCountdown(3);
                      setDeleteError('');
                      setMobileTrackMenu(null);
                    }}
                    className="w-full text-left px-3 py-3 rounded-lg text-sm font-semibold hover:bg-red-950/20 text-white hover:text-red-400 active:bg-red-950/40 transition-all cursor-pointer flex items-center gap-3"
                  >
                    <Trash2 className="w-5 h-5 text-red-500 shrink-0" />
                    <span>Excluir Música (Total)</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* BACKDROP DO MENU PLAYLIST MOBILE */}
      {mobilePlaylistMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-[95] animate-in fade-in duration-200 md:hidden"
          onClick={() => setMobilePlaylistMenuOpen(false)}
        />
      )}

      {/* BOTTOM SHEET DO MENU PLAYLIST MOBILE */}
      {mobilePlaylistMenuOpen && (
        <div className="fixed inset-x-0 bottom-0 bg-brand-card border-t border-brand-hover rounded-t-2xl shadow-2xl p-5 z-[100] flex flex-col gap-4 animate-in slide-in-from-bottom duration-250 md:hidden select-none animate-duration-200">
          {/* Barra discreta de arrastar no topo */}
          <div className="w-12 h-1 bg-brand-gray/30 rounded-full mx-auto mb-1 shrink-0" />

          {/* Cabeçalho com Info da Playlist */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-12 h-12 bg-black rounded overflow-hidden flex items-center justify-center text-brand-green shrink-0 border border-brand-hover">
              {playlist.CoverUrl ? (
                <img 
                  src={playlist.CoverUrl.startsWith('http') ? playlist.CoverUrl : `${SERVER_URL}${playlist.CoverUrl}`} 
                  alt="Capa" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <ListMusic className="w-5 h-5" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm text-white truncate leading-tight select-text">
                {playlist.Name}
              </span>
              <span className="text-xs text-brand-gray truncate mt-1 select-text">
                de {getOwnerDisplayName(playlist.OwnerFirstName, playlist.OwnerLastName, playlist.OwnerUserName, playlist.OwnerEmail)}
              </span>
            </div>
          </div>

          <div className="h-[1px] bg-brand-hover w-full shrink-0" />

          {/* Opções */}
          <div className="flex flex-col gap-1 overflow-y-auto max-h-[300px]">
            {isPremium && (
              <button
                onClick={() => {
                  handlePlaylistDownloadClick();
                  setMobilePlaylistMenuOpen(false);
                }}
                disabled={playlistDownloadStatus === 'loading'}
                className="w-full text-left px-3 py-3 rounded-lg text-sm font-semibold hover:bg-brand-hover text-white active:bg-brand-hover/50 transition-all cursor-pointer flex items-center gap-3"
              >
                {playlistDownloadStatus === 'loading' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-brand-green shrink-0" />
                    <span>Baixando faixas...</span>
                  </>
                ) : playlistDownloadStatus === 'downloaded' ? (
                  <>
                    <Download className="w-5 h-5 fill-current text-brand-green shrink-0" />
                    <span>Remover downloads offline</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 text-brand-gray shrink-0" />
                    <span>Baixar playlist para ouvir offline</span>
                  </>
                )}
              </button>
            )}

            {isOwnerOrAdmin && (
              <button
                onClick={() => {
                  triggerGlobalEdit();
                  setMobilePlaylistMenuOpen(false);
                }}
                className="w-full text-left px-3 py-3 rounded-lg text-sm font-semibold hover:bg-brand-hover text-white active:bg-brand-hover/50 transition-all cursor-pointer flex items-center gap-3"
              >
                <Settings className="w-5 h-5 text-brand-green shrink-0" />
                <span>Configurações da Playlist</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Toast Notificação de Link Copiado */}
      {showToast && (
        <div className="fixed bottom-20 md:bottom-28 right-4 md:right-8 bg-brand-green text-black px-4 py-3 rounded-lg shadow-2xl flex items-center gap-2.5 font-bold text-xs z-[200] animate-in slide-in-from-bottom duration-300 select-none">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>Link copiado com sucesso!</span>
        </div>
      )}
    </div>
  );
};
