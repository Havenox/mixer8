import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ListMusic, Lock, Globe, EyeOff, Play, Pause, MoreVertical, MoreHorizontal, Clock, Heart, User, Loader2 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { SERVER_URL, API_URL } from '../config';
import { createPlaylistQueueProvider } from '../utils/queueProviders';

interface PlaylistListingProps {
  playlists: any[];
  layoutMode: 'grid' | 'list';
  isLoading?: boolean;
  isFetchingMore?: boolean;
  onToggleSavePlaylist?: (playlist: any) => void;
  onPlaylistContextMenu: (e: React.MouseEvent, playlist: any) => void;
}

const getPlaylistTotalDuration = (durationSeconds: number) => {
  if (!durationSeconds || durationSeconds <= 0) return '0 min';
  const totalMinutes = Math.floor(durationSeconds / 60);
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}h ${mins}m`;
  }
  return `${totalMinutes} min`;
};

export const PlaylistListing: React.FC<PlaylistListingProps> = ({
  playlists,
  layoutMode,
  isLoading = false,
  isFetchingMore = false,
  onToggleSavePlaylist,
  onPlaylistContextMenu
}) => {
  const { CurrentUser, Token } = useAuth();
  const navigate = useNavigate();
  const { currentPlaylistId, isPlaying, togglePlay, loadTrack, isShuffle } = usePlayer();

  const handlePlayPlaylistClick = async (e: React.MouseEvent, playlist: any) => {
    e.stopPropagation();
    const isActivePlaylist = currentPlaylistId === playlist.PlaylistId;
    if (isActivePlaylist) {
      togglePlay();
      return;
    }

    try {
      const headers: Record<string, string> = {};
      if (Token) {
        headers['Authorization'] = `Bearer ${Token}`;
      }
      const res = await fetch(`${API_URL}/Playlists/${playlist.PlaylistId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.Tracks && data.Tracks.length > 0) {
          const tracksQueue = data.Tracks.map((x: any) => ({
            TrackId: x.TrackId,
            TrackTitle: x.TrackTitle,
            ArtistName: x.ArtistName,
            CoverUrl: x.CoverUrl,
            ExtractionStatus: 'Pronto',
            CreatedAt: x.AddedAt,
            Bpm: x.Bpm,
            Key: x.Key,
            Stems: x.Stems ? x.Stems.map((s: any) => ({
              StemId: s.StemId,
              TrackId: s.TrackId,
              StemType: s.StemType,
              AudioUrl: s.AudioUrl
            })) : []
          }));
          const startIndex = isShuffle ? Math.floor(Math.random() * tracksQueue.length) : 0;
          const firstTrack = tracksQueue[startIndex];
          const provider = createPlaylistQueueProvider(API_URL, Token, playlist.PlaylistId);
          loadTrack(firstTrack, playlist.PlaylistId, undefined, tracksQueue, playlist.Name, provider);
        }
      }
    } catch (err) {
      console.error('Erro ao iniciar reprodução da playlist:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 text-xs text-brand-gray py-8 animate-pulse font-semibold">
        <Loader2 className="w-5 h-5 animate-spin text-brand-green" />
        <span>Carregando playlists...</span>
      </div>
    );
  }

  if (playlists.length === 0) {
    return (
      <div className="text-xs text-brand-gray font-semibold py-8 text-center bg-brand-card/10 border border-brand-hover border-dashed rounded-lg flex flex-col items-center justify-center gap-2">
        <ListMusic className="w-10 h-10 text-brand-gray/30" />
        <span>Nenhuma playlist disponível no momento.</span>
      </div>
    );
  }

  const handlePlaylistClick = (playlistId: string) => {
    navigate(`/playlists/${playlistId}`);
  };

  if (layoutMode === 'list') {
    return (
      <div className="flex flex-col gap-1 w-full select-none animate-in fade-in duration-300">
        {/* Cabeçalho da Lista */}
        <div className="hidden md:grid grid-cols-[50px_1fr_120px_120px_100px_80px] gap-4 px-4 py-2 border-b border-brand-hover/60 text-[10px] text-brand-gray font-bold uppercase tracking-wider select-none">
          <div className="text-center">Capa</div>
          <div>Playlist</div>
          <div className="hidden md:block">Criador</div>
          <div className="hidden md:block">Músicas & Tempo</div>
          <div className="hidden md:block">Status</div>
          <div className="text-right">Ações</div>
        </div>

        {/* Linhas */}
        <div className="flex flex-col gap-1.5 mt-2">
          {playlists.map((playlist) => {
            const canManage = playlist.IsOwner || CurrentUser?.UserRole === 'Admin';
            const canContext = canManage || playlist.IsSaved || playlist.IsCollaborator;
            const isActivePlaylist = currentPlaylistId === playlist.PlaylistId;
            
            return (
              <React.Fragment key={playlist.PlaylistId}>
                {/* Desktop View */}
                <div
                  className={`hidden md:grid md:grid-cols-[50px_1fr_120px_120px_100px_80px] gap-4 items-center px-4 py-2.5 rounded-md border transition-all group relative cursor-pointer ${
                    isActivePlaylist ? 'bg-brand-hover/40 border-brand-green/30' : 'border-brand-hover bg-brand-card/40 hover:bg-brand-hover/60'
                  }`}
                  onClick={() => handlePlaylistClick(playlist.PlaylistId)}
                  onContextMenu={(e) => {
                    if (canContext) {
                      e.preventDefault();
                      onPlaylistContextMenu(e, playlist);
                    }
                  }}
                >
                  {/* Capa */}
                  <div className="w-10 h-10 bg-gradient-to-br from-brand-card to-black/60 border border-brand-hover rounded overflow-hidden flex items-center justify-center text-brand-green shrink-0">
                    {playlist.CoverUrl ? (
                      <img 
                        src={playlist.CoverUrl.startsWith('http') ? playlist.CoverUrl : `${SERVER_URL}${playlist.CoverUrl}`} 
                        alt="Capa" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ListMusic className="w-5 h-5 text-brand-green/40" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex flex-col min-w-0">
                    <span className={`font-bold text-sm truncate group-hover:text-brand-green transition-colors duration-200 ${
                      isActivePlaylist ? 'text-brand-green' : 'text-white'
                    }`}>
                      {playlist.Name}
                    </span>
                    {playlist.Description && (
                      <span className="text-xs text-brand-gray truncate">
                        {playlist.Description}
                      </span>
                    )}
                  </div>

                  {/* Criador */}
                  <div className="hidden md:flex items-center gap-1.5 min-w-0 text-xs text-brand-gray select-none">
                    {playlist.OwnerAvatarUrl ? (
                      <img 
                        src={playlist.OwnerAvatarUrl.startsWith('http') ? playlist.OwnerAvatarUrl : `${SERVER_URL}${playlist.OwnerAvatarUrl}`} 
                        alt="Avatar" 
                        className="w-4 h-4 rounded-full object-cover border border-brand-green/20" 
                      />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-brand-hover border border-brand-green/20 flex items-center justify-center text-brand-green shrink-0">
                        <User className="w-2.5 h-2.5" />
                      </div>
                    )}
                    <span className="truncate">
                      {playlist.OwnerFirstName?.trim() 
                        ? `${playlist.OwnerFirstName} ${playlist.OwnerLastName || ''}`.trim() 
                        : (playlist.OwnerUserName ? `@${playlist.OwnerUserName}` : playlist.OwnerEmail)}
                    </span>
                  </div>

                  {/* Músicas & Duração */}
                  <div className="hidden md:flex items-center gap-1.5 text-xs text-brand-gray font-semibold leading-none select-none">
                    <span>{playlist.TracksCount} {playlist.TracksCount === 1 ? 'música' : 'músicas'}</span>
                    <span className="text-brand-gray/40">•</span>
                    <div className="flex items-center gap-1 text-[11px]">
                      <Clock className="w-3.5 h-3.5 text-brand-gray/60" />
                      <span>{getPlaylistTotalDuration(playlist.Duration)}</span>
                    </div>
                  </div>

                  {/* Status/Badges */}
                  <div className="hidden md:flex items-center gap-1.5 text-xs text-brand-gray select-none flex-wrap">
                    {playlist.Visibility === 'Private' ? (
                      <span className="flex items-center gap-1 text-brand-green">
                        <Lock className="w-3.5 h-3.5" /> Privada
                      </span>
                    ) : playlist.Visibility === 'Public' ? (
                      <span className="flex items-center gap-1 text-brand-gray">
                        <Globe className="w-3.5 h-3.5 text-brand-gray/60" /> Pública
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-brand-gray">
                        <EyeOff className="w-3.5 h-3.5 text-brand-gray/60" /> Oculta
                      </span>
                    )}
                    {playlist.IsCollaborator && (
                      <span className="px-1.5 py-0.5 bg-brand-green/10 text-[9px] text-brand-green font-bold rounded border border-brand-green/20 uppercase tracking-wider">
                        Colab
                      </span>
                    )}
                    {playlist.IsSaved && (
                      <span className="px-1.5 py-0.5 bg-blue-500/10 text-[9px] text-blue-400 font-bold rounded border border-blue-500/20 uppercase tracking-wider select-none">
                        Salva
                      </span>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                    {!playlist.IsOwner && onToggleSavePlaylist && (
                      <button
                        onClick={() => onToggleSavePlaylist(playlist)}
                        className={`w-7 h-7 rounded-full bg-black/60 border flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-105 transition-all shadow-md cursor-pointer duration-200 ${
                          playlist.IsSaved
                            ? 'border-brand-green text-brand-green'
                            : 'border-brand-hover hover:border-white text-brand-gray hover:text-white'
                        }`}
                        title={playlist.IsSaved ? "Remover da Biblioteca" : "Salvar na Biblioteca"}
                      >
                        <Heart className={`w-3.5 h-3.5 ${playlist.IsSaved ? 'fill-brand-green text-brand-green' : ''}`} />
                      </button>
                    )}
                    
                    {canContext && (
                      <button
                        onClick={(e) => onPlaylistContextMenu(e, playlist)}
                        className="w-7 h-7 rounded-full bg-black/40 border border-brand-hover hover:border-brand-green text-brand-gray hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                        title="Mais Opções"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Mobile View */}
                <div
                  className={`flex md:hidden items-center gap-3 p-2 rounded-md transition-colors cursor-pointer ${
                    isActivePlaylist ? 'bg-brand-hover/40 text-brand-green' : 'active:bg-brand-hover/40'
                  }`}
                  onClick={() => handlePlaylistClick(playlist.PlaylistId)}
                  onContextMenu={(e) => {
                    if (canContext) {
                      e.preventDefault();
                      onPlaylistContextMenu(e, playlist);
                    }
                  }}
                >
                  {/* Capa */}
                  <div className="w-11 h-11 bg-gradient-to-br from-brand-card to-black/60 border border-brand-hover rounded overflow-hidden flex items-center justify-center text-brand-green shrink-0">
                    {playlist.CoverUrl ? (
                      <img 
                        src={playlist.CoverUrl.startsWith('http') ? playlist.CoverUrl : `${SERVER_URL}${playlist.CoverUrl}`} 
                        alt="Capa" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ListMusic className="w-5 h-5 text-brand-green/40" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <span className={`font-bold text-sm truncate leading-tight ${isActivePlaylist ? 'text-brand-green' : 'text-white'}`}>
                      {playlist.Name}
                    </span>
                    <span className="text-xs text-brand-gray truncate mt-1 leading-none">
                      {playlist.TracksCount} {playlist.TracksCount === 1 ? 'música' : 'músicas'}
                      {playlist.Visibility === 'Private' && ' • Privada'}
                      {playlist.Visibility === 'Unlisted' && ' • Oculta'}
                      {playlist.IsCollaborator && ' • Colaborativa'}
                    </span>
                  </div>

                  {/* Reticências (Menu Mobile) */}
                  {canContext && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlaylistContextMenu(e, playlist);
                      }}
                      className="p-1.5 -mr-1.5 text-brand-gray/50 hover:text-white active:scale-90 transition-all cursor-pointer shrink-0"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {isFetchingMore && (
          <div className="flex items-center justify-center gap-2 text-xs text-brand-gray py-4">
            <Loader2 className="w-4 h-4 animate-spin text-brand-green" />
            <span>Carregando mais playlists...</span>
          </div>
        )}
      </div>
    );
  }

  // Layout em Grade (Default)
  return (
    <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(180px,220px))] gap-3 sm:gap-4 select-none w-full animate-in fade-in duration-300">
      {playlists.map((playlist) => {
        const canManage = playlist.IsOwner || CurrentUser?.UserRole === 'Admin';
        const canContext = canManage || playlist.IsSaved || playlist.IsCollaborator;
        const isActivePlaylist = currentPlaylistId === playlist.PlaylistId;
        return (
          <div 
            key={playlist.PlaylistId} 
            className={`bg-brand-card border p-2.5 sm:p-4 rounded-md hover:bg-brand-hover transition-all flex flex-col gap-2 sm:gap-3 group shadow-lg relative cursor-pointer ${
              isActivePlaylist ? 'border-brand-green/30 bg-brand-hover/40' : 'border-brand-hover'
            }`}
            onClick={() => handlePlaylistClick(playlist.PlaylistId)}
            onContextMenu={(e) => {
              if (canContext) {
                e.preventDefault();
                onPlaylistContextMenu(e, playlist);
              }
            }}
          >
            {/* Botão rápido de opções para mobile/acessibilidade */}
            {canContext && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPlaylistContextMenu(e, playlist);
                }}
                className="absolute top-6 right-6 z-20 w-8 h-8 rounded-full bg-black/75 border border-brand-hover hover:border-brand-green text-brand-gray hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-105 transition-all shadow-md cursor-pointer duration-200"
                title="Opções da Playlist"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            )}

            <div className="w-full aspect-square bg-gradient-to-br from-brand-card to-black/60 border border-brand-hover rounded mb-0.5 sm:mb-1 flex items-center justify-center relative overflow-hidden group shadow-md shrink-0">
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
              
              {/* Botão flutuante de reprodução/detalhes no hover */}
              <button 
                type="button"
                onClick={(e) => handlePlayPlaylistClick(e, playlist)}
                className="absolute w-12 h-12 rounded-full bg-brand-green text-black flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 hover:scale-105 transition-all shadow-lg duration-250 cursor-pointer border-0"
              >
                {isActivePlaylist && isPlaying ? (
                  <Pause className="w-6 h-6 fill-current" />
                ) : (
                  <Play className="w-6 h-6 fill-current translate-x-[1px]" />
                )}
              </button>

              {!playlist.IsOwner && onToggleSavePlaylist && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSavePlaylist(playlist);
                  }}
                  className={`absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/80 border flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-105 transition-all shadow-md cursor-pointer duration-200 ${
                    playlist.IsSaved
                      ? 'border-brand-green text-brand-green'
                      : 'border-brand-hover hover:border-white text-brand-gray hover:text-white'
                  }`}
                  title={playlist.IsSaved ? "Remover da Biblioteca" : "Salvar na Biblioteca"}
                >
                  <Heart className={`w-4.5 h-4.5 ${playlist.IsSaved ? 'fill-brand-green text-brand-green' : ''}`} />
                </button>
              )}
            </div>
            
            <div className="flex flex-col truncate">
              <span className={`font-bold text-sm text-white truncate group-hover:text-brand-green transition-colors duration-200 ${
                isActivePlaylist ? 'text-brand-green' : 'text-white'
              }`} title={playlist.Name}>
                {playlist.Name}
              </span>
              
              {playlist.Description && (
                <span className="text-xs text-brand-gray truncate mt-0.5" title={playlist.Description}>
                  {playlist.Description}
                </span>
              )}
              
              {/* Foto + Nome/Nickname do Criador */}
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
              
              {/* Qtd Músicas • Reloginho Duração */}
              <div className="flex items-center gap-1.5 text-[10px] text-brand-green font-semibold mt-1.5 select-none leading-none">
                <span>{playlist.TracksCount} {playlist.TracksCount === 1 ? 'música' : 'músicas'}</span>
                <span className="text-brand-gray/40 font-normal select-none">•</span>
                <div className="flex items-center gap-1 text-brand-gray font-normal leading-none h-3.5">
                  <Clock className="w-3 h-3 text-brand-gray/60 shrink-0" />
                  <span>{getPlaylistTotalDuration(playlist.Duration)}</span>
                </div>
              </div>

              {/* Visibilidade / Colaborativa / Salva Badges */}
              <div className="flex items-center gap-1.5 mt-2 select-none flex-wrap leading-none text-[10px]">
                <div className="flex items-center gap-1 text-[9px] text-brand-gray">
                  {playlist.Visibility === 'Private' ? (
                    <>
                      <Lock className="w-3 h-3 text-brand-green" />
                      <span>Privada</span>
                    </>
                  ) : playlist.Visibility === 'Public' ? (
                    <>
                      <Globe className="w-3 h-3 text-brand-gray/60" />
                      <span>Pública</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3 h-3 text-brand-gray/60" />
                      <span>Oculta</span>
                    </>
                  )}
                </div>
                {playlist.IsCollaborator && (
                  <div className="px-1.5 py-0.5 bg-brand-green/10 text-[8px] text-brand-green font-bold rounded border border-brand-green/20 uppercase tracking-wider">
                    Colaborativa
                  </div>
                )}
                {playlist.IsSaved && (
                  <div className="px-1.5 py-0.5 bg-blue-500/10 text-[8px] text-blue-400 font-bold rounded border border-blue-500/20 uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-blue-400 shrink-0" />
                    Salva
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {isFetchingMore && (
        <div className="flex items-center justify-center gap-2 text-xs text-brand-gray py-4 col-span-full">
          <Loader2 className="w-5 h-5 animate-spin text-brand-green" />
          <span>Carregando mais playlists...</span>
        </div>
      )}
    </div>
  );
};
