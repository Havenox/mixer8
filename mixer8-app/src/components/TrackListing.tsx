import React from 'react';
import { 
  Play, Pause, Disc, Music, Plus, Loader2, Info, MoreVertical 
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { TrackStatusBadge } from './TrackStatusBadge';
import type { ITrack } from '../context/PlayerContext';
import { usePlaylists } from '../context/PlaylistContext';
import { useAuth } from '../context/AuthContext';
import { SERVER_URL } from '../config';

interface TrackListingProps {
  tracks: ITrack[];
  layoutMode: 'grid' | 'list';
  isLoading?: boolean;
  isFetchingMore?: boolean;
  showUploaderInfo?: boolean;
  onTrackContextMenu: (e: React.MouseEvent, track: ITrack) => void;
  tracksQueue?: ITrack[];
}

export const TrackListing: React.FC<TrackListingProps> = ({
  tracks,
  layoutMode,
  isLoading = false,
  isFetchingMore = false,
  showUploaderInfo = false,
  onTrackContextMenu,
  tracksQueue
}) => {
  const { CurrentUser } = useAuth();
  const { loadTrack, currentTrack, isPlaying } = usePlayer();
  const { openAddToPlaylist } = usePlaylists();

  const handlePlayClick = (track: ITrack) => {
    if (track.ExtractionStatus !== 'Pronto' && !track.ExtractionStatus.startsWith('Processando')) return;
    loadTrack(track, undefined, undefined, tracksQueue || tracks);
  };

  const isCurrentPlaying = (track: ITrack) => {
    return currentTrack?.TrackId === track.TrackId && isPlaying;
  };

  const isCurrentLoaded = (track: ITrack) => {
    return currentTrack?.TrackId === track.TrackId;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 text-xs text-brand-gray py-8 animate-pulse font-semibold">
        <Loader2 className="w-5 h-5 animate-spin text-brand-green" />
        <span>Carregando músicas...</span>
      </div>
    );
  }

  if (tracks.length === 0) {
    return (
      <div className="text-xs text-brand-gray font-semibold py-8 text-center bg-brand-card/10 border border-brand-hover border-dashed rounded-lg">
        Nenhuma música disponível no momento.
      </div>
    );
  }

  if (layoutMode === 'list') {
    return (
      <div className="flex flex-col gap-1 w-full select-none animate-in fade-in duration-300">
        {/* Cabeçalho da Lista */}
        <div className="grid grid-cols-[40px_1fr_120px_120px_80px] gap-4 px-4 py-2 border-b border-brand-hover/60 text-[10px] text-brand-gray font-bold uppercase tracking-wider select-none">
          <div className="text-center">#</div>
          <div>Título / Artista</div>
          <div className="hidden md:block">Stems</div>
          <div className="hidden md:block">Status</div>
          <div className="text-right">Ações</div>
        </div>

        {/* Linhas de Faixas */}
        <div className="flex flex-col gap-1.5 mt-2">
          {tracks.map((track, idx) => {
            const isLoaded = isCurrentLoaded(track);
            const isPlay = isCurrentPlaying(track);
            
            return (
              <div
                key={track.TrackId}
                className={`grid grid-cols-[40px_1fr_80px] md:grid-cols-[40px_1fr_120px_120px_80px] gap-4 items-center px-4 py-2.5 rounded-md border hover:bg-brand-hover/60 transition-all group relative cursor-pointer ${
                  isLoaded ? 'bg-brand-hover/40 border-brand-green/30' : 'bg-brand-card/40 border-brand-hover'
                }`}
                onClick={() => handlePlayClick(track)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onTrackContextMenu(e, track);
                }}
              >
                {/* # / Botão de Play */}
                <div className="flex items-center justify-center text-xs">
                  <div className="relative w-5 h-5 flex items-center justify-center">
                    <span className={`text-brand-gray font-bold group-hover:opacity-0 transition-opacity ${isLoaded ? 'text-brand-green' : ''}`}>
                      {idx + 1}
                    </span>
                    <button
                      disabled={track.ExtractionStatus !== 'Pronto' && !track.ExtractionStatus.startsWith('Processando')}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayClick(track);
                      }}
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 text-brand-green hover:scale-110 active:scale-95 transition-all cursor-pointer disabled:opacity-30 disabled:hover:scale-100"
                    >
                      {isPlay ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current translate-x-[0.5px]" />}
                    </button>
                  </div>
                </div>

                {/* Info / Capa */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 bg-black border border-brand-hover rounded overflow-hidden flex items-center justify-center text-brand-green shrink-0 relative">
                    {track.CoverUrl ? (
                      <img 
                        src={track.CoverUrl.startsWith('http') ? track.CoverUrl : `${SERVER_URL}${track.CoverUrl}`} 
                        alt="Capa" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Music className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className={`font-bold text-sm truncate ${isLoaded ? 'text-brand-green' : 'text-white'}`}>
                      {track.TrackTitle}
                    </span>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-brand-gray truncate">{track.ArtistName}</span>
                      
                      {/* Badges de Visibilidade e Moderação */}
                      {track.DeletionPending && (
                        <div className="relative group/tooltip flex items-center gap-1 select-none shrink-0" onClick={e => e.stopPropagation()}>
                          <span className="text-[8px] bg-red-950/60 text-red-400 border border-red-900/50 px-1 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">
                            Marcado pra Excluir
                          </span>
                          {CurrentUser?.UserRole === 'Admin' && track.DeletionReason && (
                            <>
                              <Info className="w-3 h-3 text-red-400/80 hover:text-red-400 cursor-pointer shrink-0" />
                              <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-brand-card border border-brand-hover text-[10px] text-brand-gray rounded shadow-2xl invisible group-hover/tooltip:visible opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 z-50 pointer-events-none leading-relaxed normal-case text-left font-normal select-text">
                                <strong className="text-white block mb-0.5">Motivo da exclusão:</strong>
                                {track.DeletionReason}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                      {track.UploadedBy === CurrentUser?.UserId && CurrentUser?.UserRole !== 'Admin' && (
                        <span className="text-[8px] bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 px-1 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 select-none">
                          Minha
                        </span>
                      )}
                      {track.Visibility === 'Private' && (
                        <div className="relative group/tooltip flex items-center gap-1 select-none shrink-0" onClick={e => e.stopPropagation()}>
                          <span className="text-[8px] bg-red-950/40 text-red-400 border border-red-900/30 px-1 py-0.5 rounded font-bold uppercase tracking-wider">
                            Privada
                          </span>
                          <Info className="w-3 h-3 text-red-400/80 hover:text-red-400 cursor-pointer shrink-0" />
                          <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-brand-card border border-brand-hover text-[10px] text-brand-gray rounded shadow-2xl invisible group-hover/tooltip:visible opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 z-50 pointer-events-none leading-relaxed font-normal normal-case text-left select-none">
                            Essa música é privada e só aparece para quem fez o upload dela.
                          </div>
                        </div>
                      )}
                      {track.Visibility === 'Unlisted' && (
                        <div className="relative group/tooltip flex items-center gap-1 select-none shrink-0" onClick={e => e.stopPropagation()}>
                          <span className="text-[8px] bg-yellow-950/40 text-yellow-500 border border-yellow-900/30 px-1 py-0.5 rounded font-bold uppercase tracking-wider">
                            Não Listada
                          </span>
                          <Info className="w-3 h-3 text-yellow-500/80 hover:text-yellow-500 cursor-pointer shrink-0" />
                          <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-brand-card border border-brand-hover text-[10px] text-brand-gray rounded shadow-2xl invisible group-hover/tooltip:visible opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 z-50 pointer-events-none leading-relaxed font-normal normal-case text-left select-none">
                            Essa música só aparece para quem fez o upload dela, donos de playlists onde foi adicionada e colaboradores autorizados.
                          </div>
                        </div>
                      )}
                    </div>
                    {showUploaderInfo && (track.UploadedByUserName || track.UploadedByEmail) && (
                      <span className="text-[9px] text-brand-gray/60 mt-0.5 truncate select-text">
                        Uploader: {track.UploadedByUserName ? `@${track.UploadedByUserName}` : ''} {track.UploadedByEmail ? `(${track.UploadedByEmail})` : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stems */}
                <div className="hidden md:block text-xs text-brand-gray font-semibold">
                  {track.Stems?.length || 0} faixas
                </div>

                {/* Status */}
                <div className="hidden md:block text-xs font-bold">
                  <TrackStatusBadge status={track.ExtractionStatus} />
                </div>

                {/* Ações */}
                <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                  {(track.ExtractionStatus === 'Pronto' || track.ExtractionStatus.startsWith('Processando')) && openAddToPlaylist && (
                    <button
                      onClick={() => openAddToPlaylist(track.TrackId, track.TrackTitle, track.ArtistName)}
                      className="w-7 h-7 rounded-full bg-black/60 border border-brand-hover hover:border-brand-green text-brand-green hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-105 transition-all shadow-md cursor-pointer duration-200"
                      title="Adicionar à Playlist"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  )}
                  
                  <button
                    onClick={(e) => onTrackContextMenu(e, track)}
                    className="w-7 h-7 rounded-full bg-black/40 border border-brand-hover hover:border-brand-green text-brand-gray hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    title="Mais Opções"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {isFetchingMore && (
          <div className="flex items-center justify-center gap-2 text-xs text-brand-gray py-4">
            <Loader2 className="w-4 h-4 animate-spin text-brand-green" />
            <span>Carregando mais faixas...</span>
          </div>
        )}
      </div>
    );
  }

  // Layout em Grade (Default)
  return (
    <div className="flex flex-col gap-6 select-none w-full animate-in fade-in duration-300">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,220px))] gap-4">
        {tracks.map((track) => {
          const isPlay = isCurrentPlaying(track);
          const isLoaded = isCurrentLoaded(track);
          
          return (
            <div 
              key={track.TrackId} 
              className={`bg-brand-card border p-4 rounded-md hover:bg-brand-hover group transition-all relative cursor-pointer flex flex-col justify-between ${
                isLoaded ? 'border-brand-green/30' : 'border-brand-hover'
              }`}
              onContextMenu={(e) => {
                e.preventDefault();
                onTrackContextMenu(e, track);
              }}
              onClick={() => handlePlayClick(track)}
            >
              {/* Botão rápido de adicionar à playlist no hover */}
              {(track.ExtractionStatus === 'Pronto' || track.ExtractionStatus.startsWith('Processando')) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openAddToPlaylist(track.TrackId, track.TrackTitle, track.ArtistName);
                  }}
                  className="absolute top-6 right-6 z-20 w-8 h-8 rounded-full bg-black/75 border border-brand-hover hover:border-brand-green text-brand-green hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-105 transition-all shadow-md cursor-pointer duration-200"
                  title="Adicionar à Playlist"
                >
                  <Plus className="w-4.5 h-4.5" />
                </button>
              )}

              <div className="w-full aspect-square bg-black border border-brand-hover rounded mb-4 flex items-center justify-center relative overflow-hidden group shadow-md">
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
                      <div className="relative group/tooltip flex items-center gap-1 select-none">
                        <span className="text-[8px] bg-red-950/60 text-red-400 border border-red-900/50 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">
                          Marcado pra Excluir
                        </span>
                        {CurrentUser?.UserRole === 'Admin' && track.DeletionReason && (
                          <>
                            <Info className="w-3.5 h-3.5 text-red-400/80 hover:text-red-400 cursor-pointer shrink-0" />
                            <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-brand-card border border-brand-hover text-[10px] text-brand-gray rounded shadow-2xl invisible group-hover/tooltip:visible opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 z-50 pointer-events-none leading-relaxed normal-case text-left font-normal select-text">
                              <strong className="text-white block mb-0.5">Motivo da exclusão:</strong>
                              {track.DeletionReason}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    {track.UploadedBy === CurrentUser?.UserId && CurrentUser?.UserRole !== 'Admin' && (
                      <span className="text-[8px] bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 px-1 py-0.5 rounded font-bold uppercase tracking-wider">
                        Minha
                      </span>
                    )}
                    {track.Visibility === 'Private' && (
                      <div className="relative group/tooltip flex items-center gap-1 select-none">
                        <span className="text-[8px] bg-red-950/40 text-red-400 border border-red-900/30 px-1 py-0.5 rounded font-bold uppercase tracking-wider">
                          Privada
                        </span>
                        <Info className="w-3 h-3 text-red-400/80 hover:text-red-400 cursor-pointer shrink-0" />
                        <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-brand-card border border-brand-hover text-[10px] text-brand-gray rounded shadow-2xl invisible group-hover/tooltip:visible opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 z-50 pointer-events-none leading-relaxed font-normal normal-case text-left">
                          Essa música é privada e só aparece para quem fez o upload dela.
                        </div>
                      </div>
                    )}
                    {track.Visibility === 'Unlisted' && (
                      <div className="relative group/tooltip flex items-center gap-1 select-none">
                        <span className="text-[8px] bg-yellow-950/40 text-yellow-500 border border-yellow-900/30 px-1 py-0.5 rounded font-bold uppercase tracking-wider">
                          Não Listada
                        </span>
                        <Info className="w-3 h-3 text-yellow-500/80 hover:text-yellow-500 cursor-pointer shrink-0" />
                        <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-brand-card border border-brand-hover text-[10px] text-brand-gray rounded shadow-2xl invisible group-hover/tooltip:visible opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 z-50 pointer-events-none leading-relaxed font-normal normal-case text-left">
                          Essa música só aparece para quem fez o upload dela, donos de playlists onde foi adicionada e colaboradores autorizados.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {showUploaderInfo && (track.UploadedByUserName || track.UploadedByEmail) && (
                  <span className="text-[10px] text-brand-gray/60 mt-1 select-text">
                    Uploader: {track.UploadedByUserName ? `@${track.UploadedByUserName}` : ''} {track.UploadedByEmail ? `(${track.UploadedByEmail})` : ''}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between mt-3 pt-2 border-t border-brand-hover text-[10px] font-bold">
                <span className="text-brand-gray uppercase">Stems: {track.Stems?.length || 0} faixas</span>
                
                <TrackStatusBadge status={track.ExtractionStatus} showMixLabel={true} />
              </div>
            </div>
          );
        })}
      </div>
      {isFetchingMore && (
        <div className="flex items-center justify-center gap-2 text-xs text-brand-gray py-4">
          <Loader2 className="w-5 h-5 animate-spin text-brand-green" />
          <span>Carregando mais faixas...</span>
        </div>
      )}
    </div>
  );
};
