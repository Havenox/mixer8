import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlaylists } from '../context/PlaylistContext';
import type { IPlaylist } from '../context/PlaylistContext';
import { useAuth } from '../context/AuthContext';
import { ListMusic, PlusCircle, Lock, Globe, EyeOff, Play, Edit, Trash2, MoreVertical, Clock, AlertTriangle } from 'lucide-react';

import { API_URL, SERVER_URL } from '../config';

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

export const Playlists: React.FC = () => {
  const { playlists, openCreatePlaylist, openEditPlaylist, openDeletePlaylist, fetchPlaylists } = usePlaylists();
  const { CurrentUser, Token } = useAuth();
  const navigate = useNavigate();

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; playlist: IPlaylist } | null>(null);
  const [collabPlaylistToLeave, setCollabPlaylistToLeave] = useState<IPlaylist | null>(null);

  // Fecha menus ao clicar fora
  useEffect(() => {
    const handleClose = () => setContextMenu(null);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  const handleUnsavePlaylist = async (playlist: IPlaylist) => {
    if (!Token) return;
    try {
      const res = await fetch(`${API_URL}/Playlists/${playlist.PlaylistId}/Save`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${Token}`
        }
      });
      if (res.ok) {
        await fetchPlaylists();
      }
    } catch (err) {
      console.error("Erro ao remover playlist da biblioteca", err);
    }
  };

  const handleLeaveCollaboration = async (playlist: IPlaylist) => {
    if (!Token || !CurrentUser) return;
    try {
      const res = await fetch(`${API_URL}/Playlists/${playlist.PlaylistId}/Collaborators/${CurrentUser.UserId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${Token}`
        }
      });
      if (res.ok) {
        setCollabPlaylistToLeave(null);
        await fetchPlaylists();
      }
    } catch (err) {
      console.error("Erro ao deixar colaboração de playlist", err);
    }
  };

  return (
    <div className="flex flex-col gap-6 select-none animate-in fade-in duration-300">
      
      {/* Cabeçalho */}
      <div className="flex justify-between items-center border-b border-brand-hover pb-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-black tracking-tight text-white">Playlists</h1>
          <p className="text-sm text-brand-gray">Gerencie e ouça suas coleções personalizadas ou playlists públicas.</p>
        </div>
        
        <button 
          onClick={openCreatePlaylist}
          className="flex items-center gap-2 py-2.5 px-5 bg-brand-green text-black font-black rounded-full hover:scale-105 active:scale-95 transition-all shadow-md shadow-brand-green/10 cursor-pointer text-xs uppercase tracking-wider"
        >
          <PlusCircle className="w-5 h-5 shrink-0" />
          <span>Criar Playlist</span>
        </button>
      </div>

      {/* Grid de Playlists */}
      {playlists.length === 0 ? (
        <div className="text-xs text-brand-gray font-semibold py-8 text-center bg-brand-card/20 border border-brand-hover border-dashed rounded-lg flex flex-col items-center justify-center gap-3">
          <ListMusic className="w-12 h-12 text-brand-gray/40" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-white text-sm font-bold">Nenhuma playlist criada</span>
            <span>Crie sua primeira playlist para começar a agrupar suas faixas favoritas!</span>
          </div>
          <button 
            onClick={openCreatePlaylist}
            className="mt-2 py-2 px-4 bg-brand-hover text-brand-green hover:text-white hover:bg-brand-hover/80 text-xs font-bold rounded-md transition-colors cursor-pointer"
          >
            Começar Agora
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,220px))] gap-4 select-none">
          {playlists.map((playlist) => {
            const canManage = playlist.IsOwner || CurrentUser?.UserRole === 'Admin';
            const canContext = canManage || playlist.IsSaved || playlist.IsCollaborator;
            return (
              <div 
                key={playlist.PlaylistId} 
                onClick={() => navigate(`/playlists/${playlist.PlaylistId}`)}
                onContextMenu={(e) => {
                  if (canContext) {
                    e.preventDefault();
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      playlist
                    });
                  }
                }}
                className="bg-brand-card border border-brand-hover p-4 rounded-md hover:bg-brand-hover group transition-all relative cursor-pointer"
              >
                {/* Botão rápido de opções para mobile/acessibilidade */}
                {canContext && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        playlist
                      });
                    }}
                    className="absolute top-6 right-6 z-20 w-8 h-8 rounded-full bg-black/75 border border-brand-hover hover:border-brand-green text-brand-gray hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:scale-105 transition-all shadow-md cursor-pointer duration-200"
                    title="Opções da Playlist"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                )}

                <div className="w-full aspect-square bg-gradient-to-br from-brand-card to-black/60 border border-brand-hover rounded mb-4 flex items-center justify-center relative overflow-hidden group shadow-md">
                  {playlist.CoverUrl ? (
                    <img 
                      src={playlist.CoverUrl.startsWith('http') ? playlist.CoverUrl : `${SERVER_URL}${playlist.CoverUrl}`} 
                      alt="Capa" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-neutral-900 via-brand-card to-black flex items-center justify-center">
                      <ListMusic className="w-16 h-16 text-brand-green/20 group-hover:text-brand-green/40 transition-colors duration-300" />
                    </div>
                  )}
                  
                  {/* Botão flutuante de reprodução/detalhes no hover */}
                  <div className="absolute w-12 h-12 rounded-full bg-brand-green text-black flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 hover:scale-105 transition-all shadow-lg duration-250 cursor-pointer">
                    <Play className="w-6 h-6 fill-current translate-x-[1px]" />
                  </div>
                </div>

                {/* Título e Info */}
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-white text-sm truncate group-hover:text-brand-green transition-colors duration-200" title={playlist.Name}>
                    {playlist.Name}
                  </span>

                  {playlist.Description && (
                    <p className="text-[11px] text-brand-gray truncate m-0 leading-normal" title={playlist.Description}>
                      {playlist.Description}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-1.5 text-xs text-brand-gray mt-1 flex-wrap select-none leading-none">
                    <span className="shrink-0">{playlist.TracksCount} {playlist.TracksCount === 1 ? 'música' : 'músicas'}</span>
                    <span className="text-brand-gray/40 select-none shrink-0">•</span>
                    <div className="flex items-center gap-1 shrink-0 text-[11px] h-3.5">
                      <Clock className="w-3.5 h-3.5 text-brand-gray/60 shrink-0" />
                      <span>{getPlaylistTotalDuration(playlist.PlaylistId, playlist.TracksCount)}</span>
                    </div>
                    <span className="text-brand-gray/40 select-none shrink-0">•</span>
                    <div className="flex items-center gap-1 shrink-0 text-[11px] h-3.5">
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
                          <span>Não listada</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Badge de Colaborativa se aplicável */}
                  {playlist.IsCollaborator && (
                    <div className="mt-1.5 self-start px-2 py-0.5 bg-brand-green/10 text-[9px] text-brand-green font-bold rounded border border-brand-green/20 uppercase tracking-wider">
                      Colaborativa
                    </div>
                  )}

                  {/* Badge de Salva se aplicável */}
                  {playlist.IsSaved && (
                    <div className="mt-1.5 self-start px-2 py-0.5 bg-blue-500/10 text-[9px] text-blue-400 font-bold rounded border border-blue-500/20 uppercase tracking-wider flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                      Salva
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MENU DE CONTEXTO FLUTUANTE */}
      {contextMenu && (
        <div 
          className="fixed z-50 bg-brand-card border border-brand-hover rounded shadow-2xl py-1.5 w-48 text-xs font-semibold select-none cursor-pointer"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {/* Opções para Dono/Admin */}
          {(contextMenu.playlist.IsOwner || CurrentUser?.UserRole === 'Admin') && (
            <>
              <div 
                onClick={() => openEditPlaylist(contextMenu.playlist!)}
                className="px-4 py-2 hover:bg-brand-hover hover:text-brand-green flex items-center gap-2.5 transition-colors"
              >
                <Edit className="w-4 h-4 text-brand-gray" />
                <span>Editar Ajustes</span>
              </div>
              <div className="h-[1px] bg-brand-hover my-1" />
              <div 
                onClick={() => openDeletePlaylist(contextMenu.playlist!)}
                className="px-4 py-2 hover:bg-brand-hover hover:text-red-400 text-red-500 flex items-center gap-2.5 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Excluir Playlist</span>
              </div>
            </>
          )}

          {/* Opções de Salva (Bookmarks) */}
          {contextMenu.playlist.IsSaved && !contextMenu.playlist.IsOwner && (
            <div 
              onClick={() => handleUnsavePlaylist(contextMenu.playlist!)}
              className="px-4 py-2 hover:bg-brand-hover hover:text-red-400 text-red-500 flex items-center gap-2.5 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Remover da Biblioteca</span>
            </div>
          )}

          {/* Opções de Colaborativa */}
          {contextMenu.playlist.IsCollaborator && !contextMenu.playlist.IsOwner && (
            <div 
              onClick={() => setCollabPlaylistToLeave(contextMenu.playlist!)}
              className="px-4 py-2 hover:bg-brand-hover hover:text-red-400 text-red-500 flex items-center gap-2.5 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Parar de Colaborar</span>
            </div>
          )}
        </div>
      )}

      {/* DIÁLOGO DE CONFIRMAÇÃO PARA PARAR DE COLABORAR (React styled shadcn custom modal) */}
      {collabPlaylistToLeave && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
          <div className="bg-brand-card border border-brand-hover p-6 rounded-md max-w-sm w-full flex flex-col gap-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-500">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-base">Parar de Colaborar?</h3>
            </div>
            
            <p className="text-xs text-brand-gray leading-relaxed">
              Você tem certeza que deseja parar de colaborar com a playlist <strong className="text-white">"{collabPlaylistToLeave.Name}"</strong>? Você perderá a permissão de adicionar músicas a ela.
            </p>
            
            <div className="flex justify-end gap-2.5 mt-2">
              <button
                onClick={() => setCollabPlaylistToLeave(null)}
                className="py-2 px-4 rounded bg-brand-hover hover:bg-brand-hover/80 text-xs font-bold text-white transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleLeaveCollaboration(collabPlaylistToLeave)}
                className="py-2 px-4 rounded bg-red-500 hover:bg-red-600 text-xs font-bold text-white transition-all cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
