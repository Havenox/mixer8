import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Play, Pause, Disc, Music, Plus, CheckCircle, Clock, MoreVertical, 
  Heart, User, ListMusic
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import type { ITrack } from '../context/PlayerContext';
import { usePlaylists } from '../context/PlaylistContext';
import { useAuth } from '../context/AuthContext';
import { SERVER_URL } from '../config';

interface ExploreShelfProps {
  title: string;
  icon?: React.ReactNode;
  viewAllRoute?: string;
  items: any[];
  type: 'tracks' | 'playlists';
  isLoading?: boolean;
  layoutMode: 'grid' | 'compact-list';
  onTrackContextMenu?: (e: React.MouseEvent, track: ITrack) => void;
  onPlaylistContextMenu?: (e: React.MouseEvent, playlist: any) => void;
  onToggleSavePlaylist?: (playlist: any) => void;
}

const getPlaylistTotalDuration = (playlistId: string, tracksCount: number) => {
  if (tracksCount === 0) return '0 min';
  let sum = 0;
  for (let i = 0; i < playlistId.length; i++) {
    sum += playlistId.charCodeAt(i);
  }
  let totalSeconds = 0;
  for (let idx = 0; idx < tracksCount; idx++) {
    const trackSeed = (sum + idx) % 120;
    totalSeconds += 180 + trackSeed;
  }
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins}m`;
  }
  return `${totalMinutes} min`;
};

export const ExploreShelf: React.FC<ExploreShelfProps> = ({
  title,
  icon,
  viewAllRoute,
  items,
  type,
  isLoading = false,
  layoutMode,
  onTrackContextMenu,
  onPlaylistContextMenu,
  onToggleSavePlaylist
}) => {
  const { CurrentUser, IsAuthenticated, openLoginModal } = useAuth();
  const { loadTrack, currentTrack, isPlaying } = usePlayer();
  const { openAddToPlaylist } = usePlaylists();
  const navigate = useNavigate();

  const itemsToShow = items.slice(0, 6);

  const isCurrentPlaying = (track: ITrack) => {
    return currentTrack?.TrackId === track.TrackId && isPlaying;
  };

  const isCurrentLoaded = (track: ITrack) => {
    return currentTrack?.TrackId === track.TrackId;
  };

  const handlePlayClick = (track: ITrack) => {
    if (track.ExtractionStatus !== 'Pronto' && !track.ExtractionStatus.startsWith('Processando')) return;
    loadTrack(track, undefined, undefined, itemsToShow);
  };

  const handlePlaylistClick = (playlistId: string) => {
    navigate(`/playlists/${playlistId}`);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {/* Header Skeleton */}
        <div className="flex justify-between items-center border-b border-brand-hover pb-3">
          <div className="h-6 w-48 bg-brand-hover rounded animate-pulse" />
          {viewAllRoute && <div className="h-4 w-16 bg-brand-hover rounded animate-pulse" />}
        </div>
        {/* Items Skeleton */}
        <div className={
          layoutMode === 'grid' 
            ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4" 
            : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
        }>
          {Array.from({ length: 6 }).map((_, idx) => (
            <div 
              key={idx} 
              className={
                layoutMode === 'grid'
                  ? "bg-brand-card/40 border border-brand-hover p-4 rounded-md flex flex-col gap-3 h-[250px] animate-pulse"
                  : "bg-brand-card/20 border border-brand-hover p-2.5 rounded-md flex items-center gap-3 h-[68px] animate-pulse"
              }
            >
              {layoutMode === 'grid' ? (
                <>
                  <div className="w-full aspect-square bg-brand-hover rounded" />
                  <div className="h-4 bg-brand-hover rounded w-3/4" />
                  <div className="h-3 bg-brand-hover rounded w-1/2" />
                </>
              ) : (
                <>
                  <div className="w-12 h-12 bg-brand-hover rounded shrink-0" />
                  <div className="flex flex-col gap-2 flex-1">
                    <div className="h-3.5 bg-brand-hover rounded w-3/4" />
                    <div className="h-2.5 bg-brand-hover rounded w-1/2" />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (itemsToShow.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center border-b border-brand-hover pb-3">
          <h2 className="text-xl font-bold text-white m-0 flex items-center gap-2">
            {icon} {title}
          </h2>
        </div>
        <div className="text-xs text-brand-gray font-semibold py-8 text-center bg-brand-card/10 border border-brand-hover border-dashed rounded-lg flex flex-col items-center justify-center gap-2">
          {type === 'tracks' ? <Music className="w-10 h-10 text-brand-gray/30" /> : <ListMusic className="w-10 h-10 text-brand-gray/30" />}
          <span>Nenhum item disponível no momento.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
      {/* Header da Seção */}
      <div className="flex justify-between items-center border-b border-brand-hover pb-3">
        <h2 className="text-xl font-bold text-white m-0 flex items-center gap-2">
          {icon} {title}
        </h2>
        {viewAllRoute && (
          <button
            onClick={() => {
              if (!IsAuthenticated) {
                openLoginModal();
              } else {
                navigate(viewAllRoute);
              }
            }}
            className="text-xs text-brand-green hover:underline font-bold cursor-pointer bg-transparent border-0"
          >
            Ver todas
          </button>
        )}
      </div>

      {/* Renderização conforme o layout selecionado */}
      {layoutMode === 'grid' ? (
        /* GRADE CLÁSSICA (cards quadrados) */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {type === 'tracks' ? (
            /* Faixas em Grade */
            itemsToShow.map((track: ITrack) => {
              const isPlay = isCurrentPlaying(track);
              const isLoaded = isCurrentLoaded(track);
              return (
                <div 
                  key={track.TrackId} 
                  className={`bg-brand-card border p-4 rounded-md hover:bg-brand-hover group transition-all relative cursor-pointer flex flex-col justify-between select-none ${
                    isLoaded ? 'border-brand-green/30' : 'border-brand-hover'
                  }`}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (!IsAuthenticated) {
                      openLoginModal();
                    } else {
                      onTrackContextMenu?.(e, track);
                    }
                  }}
                  onClick={() => handlePlayClick(track)}
                >
                  {/* Botão de playlist no hover */}
                  {track.ExtractionStatus === 'Pronto' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!IsAuthenticated) {
                          openLoginModal();
                        } else {
                          openAddToPlaylist(track.TrackId, track.TrackTitle, track.ArtistName);
                        }
                      }}
                      className="absolute top-6 right-6 z-20 w-8 h-8 rounded-full bg-black/75 border border-brand-hover hover:border-brand-green text-brand-green hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-105 transition-all shadow-md cursor-pointer duration-200"
                      title="Adicionar à Playlist"
                    >
                      <Plus className="w-4.5 h-4.5" />
                    </button>
                  )}

                  <div className="w-full aspect-square bg-black border border-brand-hover rounded mb-4 flex items-center justify-center relative overflow-hidden group shadow-md shrink-0">
                    {track.CoverUrl ? (
                      <img 
                        src={track.CoverUrl.startsWith('http') ? track.CoverUrl : `${SERVER_URL}${track.CoverUrl}`} 
                        alt="Capa" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Disc className={`w-16 h-16 text-brand-green/20 group-hover:text-brand-green/40 transition-colors ${isPlay ? 'animate-spin' : ''}`} style={isPlay ? { animationDuration: '6s' } : {}} />
                    )}
                    <button 
                      disabled={track.ExtractionStatus !== 'Pronto' && !track.ExtractionStatus.startsWith('Processando')}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayClick(track);
                      }}
                      className="absolute w-12 h-12 rounded-full bg-brand-green text-black flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 hover:scale-105 transition-all shadow-lg duration-250 cursor-pointer disabled:opacity-30 disabled:scale-100"
                    >
                      {isPlay ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current translate-x-[1px]" />}
                    </button>
                  </div>

                  <div className="flex flex-col gap-1 mb-2">
                    <span className={`font-bold text-sm truncate ${isLoaded ? 'text-brand-green' : 'text-white'}`} title={track.TrackTitle}>
                      {track.TrackTitle}
                    </span>
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span className="text-xs text-brand-gray truncate">{track.ArtistName}</span>
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        {track.DeletionPending && (
                          <span className="text-[8px] bg-red-950/60 text-red-400 border border-red-900/50 px-1 py-0.5 rounded font-bold uppercase tracking-wider">
                            Excluir
                          </span>
                        )}
                        {track.UploadedBy === CurrentUser?.UserId && CurrentUser?.UserRole !== 'Admin' && (
                          <span className="text-[8px] bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 px-1 py-0.5 rounded font-bold uppercase tracking-wider">
                            Minha
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-brand-hover text-[10px] font-bold">
                    <span className="text-brand-gray uppercase">Stems: {track.Stems?.length || 0}</span>
                    {track.ExtractionStatus === 'Pronto' ? (
                      <span className="text-brand-green flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> PRONTO
                      </span>
                    ) : track.ExtractionStatus.startsWith('Processando') ? (
                      <span className="text-yellow-500 flex items-center gap-1 animate-pulse">
                        <Clock className="w-3.5 h-3.5 animate-spin" /> {track.ExtractionStatus.includes(':') ? track.ExtractionStatus.split(':')[1].trim().toUpperCase() : 'EXTRAINDO'}
                      </span>
                    ) : (
                      <span className="text-red-400">FALHOU</span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            /* Playlists em Grade */
            itemsToShow.map((playlist) => {
              const canManage = playlist.IsOwner || CurrentUser?.UserRole === 'Admin';
              const canContext = canManage || playlist.IsSaved || playlist.IsCollaborator;
              return (
                <div 
                  key={playlist.PlaylistId} 
                  className="bg-brand-card border border-brand-hover p-4 rounded-md hover:bg-brand-hover transition-all flex flex-col gap-3 group shadow-lg relative cursor-pointer select-none"
                  onClick={() => handlePlaylistClick(playlist.PlaylistId)}
                  onContextMenu={(e) => {
                    if (!IsAuthenticated) {
                      e.preventDefault();
                      openLoginModal();
                      return;
                    }
                    if (canContext) {
                      e.preventDefault();
                      onPlaylistContextMenu?.(e, playlist);
                    }
                  }}
                >
                  {/* Botão de opções */}
                  {canContext ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlaylistContextMenu?.(e, playlist);
                      }}
                      className="absolute top-6 right-6 z-20 w-8 h-8 rounded-full bg-black/75 border border-brand-hover hover:border-brand-green text-brand-gray hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-105 transition-all shadow-md cursor-pointer duration-200"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  ) : !IsAuthenticated ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openLoginModal();
                      }}
                      className="absolute top-6 right-6 z-20 w-8 h-8 rounded-full bg-black/75 border border-brand-hover hover:border-brand-green text-brand-gray hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-105 transition-all shadow-md cursor-pointer duration-200"
                      title="Opções da Playlist"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  ) : null}

                  <div className="w-full aspect-square bg-gradient-to-br from-brand-card to-black/60 border border-brand-hover rounded mb-1 flex items-center justify-center relative overflow-hidden group shadow-md shrink-0">
                    {playlist.CoverUrl ? (
                      <img 
                        src={playlist.CoverUrl.startsWith('http') ? playlist.CoverUrl : `${SERVER_URL}${playlist.CoverUrl}`} 
                        alt={playlist.Name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-neutral-900 via-brand-card to-black flex items-center justify-center">
                        <ListMusic className="w-16 h-16 text-brand-green/20 group-hover:text-brand-green/40 transition-colors duration-300" />
                      </div>
                    )}
                    <div className="absolute w-12 h-12 rounded-full bg-brand-green text-black flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 hover:scale-105 transition-all shadow-lg duration-250 cursor-pointer">
                      <Play className="w-6 h-6 fill-current translate-x-[1px]" />
                    </div>

                    {(!playlist.IsOwner || !IsAuthenticated) && onToggleSavePlaylist && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!IsAuthenticated) {
                            openLoginModal();
                          } else {
                            onToggleSavePlaylist(playlist);
                          }
                        }}
                        className={`absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/80 border flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-105 transition-all shadow-md cursor-pointer duration-200 ${
                          playlist.IsSaved ? 'border-brand-green text-brand-green' : 'border-brand-hover hover:border-white text-brand-gray'
                        }`}
                      >
                        <Heart className={`w-4.5 h-4.5 ${playlist.IsSaved ? 'fill-brand-green text-brand-green' : ''}`} />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col truncate">
                    <span className="font-bold text-sm text-white truncate group-hover:text-brand-green transition-colors duration-200">
                      {playlist.Name}
                    </span>
                    {playlist.Description && (
                      <span className="text-xs text-brand-gray truncate mt-0.5">
                        {playlist.Description}
                      </span>
                    )}

                    <div className="flex items-center gap-2 mt-1.5 select-none" onClick={e => e.stopPropagation()}>
                      {playlist.OwnerAvatarUrl ? (
                        <img 
                          src={playlist.OwnerAvatarUrl.startsWith('http') ? playlist.OwnerAvatarUrl : `${SERVER_URL}${playlist.OwnerAvatarUrl}`} 
                          alt="Criador" 
                          className="w-4 h-4 rounded-full object-cover border border-brand-green/20" 
                        />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-brand-hover border border-brand-green/20 flex items-center justify-center text-brand-green shrink-0">
                          <User className="w-2.5 h-2.5" />
                        </div>
                      )}
                      <span className="text-[10px] text-brand-gray truncate">
                        {playlist.OwnerFirstName?.trim() 
                          ? `${playlist.OwnerFirstName} ${playlist.OwnerLastName || ''}`.trim() 
                          : (playlist.OwnerUserName ? `@${playlist.OwnerUserName}` : playlist.OwnerEmail)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-brand-green font-semibold mt-1.5 select-none leading-none">
                      <span>{playlist.TracksCount} {playlist.TracksCount === 1 ? 'música' : 'músicas'}</span>
                      <span className="text-brand-gray/40 font-normal">•</span>
                      <div className="flex items-center gap-1 text-brand-gray font-normal leading-none h-3.5">
                        <Clock className="w-3 h-3 text-brand-gray/60 shrink-0" />
                        <span>{getPlaylistTotalDuration(playlist.PlaylistId, playlist.TracksCount)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* LISTA COMPACTA (tiles retangulares menores) */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {type === 'tracks' ? (
            /* Faixas em Lista Compacta */
            itemsToShow.map((track: ITrack) => {
              const isPlay = isCurrentPlaying(track);
              const isLoaded = isCurrentLoaded(track);
              return (
                <div 
                  key={track.TrackId} 
                  className={`bg-brand-card/30 border p-2.5 rounded-md hover:bg-brand-hover/60 hover:border-brand-green/30 hover:scale-[1.02] transition-all duration-200 cursor-pointer flex items-center gap-3 relative group select-none min-w-0 ${
                    isLoaded ? 'border-brand-green/30' : 'border-brand-hover'
                  }`}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (!IsAuthenticated) {
                      openLoginModal();
                    } else {
                      onTrackContextMenu?.(e, track);
                    }
                  }}
                  onClick={() => handlePlayClick(track)}
                >
                  {/* Capa pequena com Overlay de Play */}
                  <div className="w-12 h-12 bg-black border border-brand-hover rounded flex items-center justify-center text-brand-green shrink-0 relative overflow-hidden group/thumb">
                    {track.CoverUrl ? (
                      <img 
                        src={track.CoverUrl.startsWith('http') ? track.CoverUrl : `${SERVER_URL}${track.CoverUrl}`} 
                        alt="Capa" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Music className="w-5 h-5 text-brand-green/40" />
                    )}
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {isPlay ? (
                        <Pause className="w-5 h-5 text-brand-green fill-current" />
                      ) : (
                        <Play className="w-5 h-5 text-brand-green fill-current translate-x-[0.5px]" />
                      )}
                    </div>
                  </div>

                  {/* Detalhes de Texto */}
                  <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                    <span className={`font-bold text-xs truncate ${isLoaded ? 'text-brand-green' : 'text-white'}`} title={track.TrackTitle}>
                      {track.TrackTitle}
                    </span>
                    <span className="text-[10px] text-brand-gray truncate">{track.ArtistName}</span>
                  </div>

                  {/* Botão de Ações no Hover */}
                  <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!IsAuthenticated) {
                          openLoginModal();
                        } else {
                          onTrackContextMenu?.(e, track);
                        }
                      }}
                      className="w-6 h-6 rounded-full hover:bg-brand-hover hover:text-white text-brand-gray flex items-center justify-center transition-all cursor-pointer"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            /* Playlists em Lista Compacta */
            itemsToShow.map((playlist) => {
              const canManage = playlist.IsOwner || CurrentUser?.UserRole === 'Admin';
              const canContext = canManage || playlist.IsSaved || playlist.IsCollaborator;
              return (
                <div 
                  key={playlist.PlaylistId} 
                  className="bg-brand-card/30 border border-brand-hover p-2.5 rounded-md hover:bg-brand-hover/60 hover:border-brand-green/30 hover:scale-[1.02] transition-all duration-200 cursor-pointer flex items-center gap-3 relative group select-none min-w-0"
                  onClick={() => handlePlaylistClick(playlist.PlaylistId)}
                  onContextMenu={(e) => {
                    if (!IsAuthenticated) {
                      e.preventDefault();
                      openLoginModal();
                      return;
                    }
                    if (canContext) {
                      e.preventDefault();
                      onPlaylistContextMenu?.(e, playlist);
                    }
                  }}
                >
                  {/* Capa pequena da Playlist */}
                  <div className="w-12 h-12 bg-gradient-to-br from-brand-card to-black/60 border border-brand-hover rounded flex items-center justify-center text-brand-green shrink-0 relative overflow-hidden group/thumb">
                    {playlist.CoverUrl ? (
                      <img 
                        src={playlist.CoverUrl.startsWith('http') ? playlist.CoverUrl : `${SERVER_URL}${playlist.CoverUrl}`} 
                        alt="Capa" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ListMusic className="w-5 h-5 text-brand-green/40" />
                    )}
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-5 h-5 text-brand-green fill-current translate-x-[0.5px]" />
                    </div>
                  </div>

                  {/* Detalhes de Texto */}
                  <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                    <span className="font-bold text-xs truncate text-white group-hover:text-brand-green transition-colors" title={playlist.Name}>
                      {playlist.Name}
                    </span>
                    <span className="text-[10px] text-brand-gray truncate">
                      {playlist.TracksCount} {playlist.TracksCount === 1 ? 'música' : 'músicas'}
                    </span>
                  </div>

                  {/* Botão de Ações no Hover */}
                  {canContext ? (
                    <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlaylistContextMenu?.(e, playlist);
                        }}
                        className="w-6 h-6 rounded-full hover:bg-brand-hover hover:text-white text-brand-gray flex items-center justify-center transition-all cursor-pointer"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : !IsAuthenticated ? (
                    <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openLoginModal();
                        }}
                        className="w-6 h-6 rounded-full hover:bg-brand-hover hover:text-white text-brand-gray flex items-center justify-center transition-all cursor-pointer"
                        title="Opções da Playlist"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
