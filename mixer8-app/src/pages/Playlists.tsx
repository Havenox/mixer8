import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlaylists } from '../context/PlaylistContext';
import type { IPlaylist } from '../context/PlaylistContext';
import { useAuth } from '../context/AuthContext';
import { 
  ListMusic, PlusCircle, Lock, Globe, EyeOff, Play, Edit, Trash2, MoreVertical, Clock, AlertTriangle,
  LayoutGrid, List
} from 'lucide-react';

import { PlaylistListing } from '../components/PlaylistListing';
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

  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>(
    () => (localStorage.getItem('mixer8:layout-preference') as 'grid' | 'list') || 'grid'
  );
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; playlist: IPlaylist } | null>(null);
  const [collabPlaylistToLeave, setCollabPlaylistToLeave] = useState<IPlaylist | null>(null);

  const handleLayoutToggle = (mode: 'grid' | 'list') => {
    setLayoutMode(mode);
    localStorage.setItem('mixer8:layout-preference', mode);
  };

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
        
        <div className="flex items-center gap-4">
          {/* Seletor de visualização (Grade vs Lista) */}
          <div className="flex items-center bg-black/60 border border-brand-hover p-1 rounded-md">
            <button
              onClick={() => handleLayoutToggle('grid')}
              className={`p-1.5 rounded transition-all cursor-pointer ${
                layoutMode === 'grid' ? 'bg-brand-green text-black' : 'text-brand-gray hover:text-white'
              }`}
              title="Visualização em Grade"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleLayoutToggle('list')}
              className={`p-1.5 rounded transition-all cursor-pointer ${
                layoutMode === 'list' ? 'bg-brand-green text-black' : 'text-brand-gray hover:text-white'
              }`}
              title="Visualização em Lista"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button 
            onClick={openCreatePlaylist}
            className="flex items-center gap-2 py-2.5 px-5 bg-brand-green text-black font-black rounded-full hover:scale-105 active:scale-95 transition-all shadow-md shadow-brand-green/10 cursor-pointer text-xs uppercase tracking-wider shrink-0"
          >
            <PlusCircle className="w-5 h-5 shrink-0" />
            <span>Criar Playlist</span>
          </button>
        </div>
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
        <PlaylistListing
          playlists={playlists}
          layoutMode={layoutMode}
          onToggleSavePlaylist={handleUnsavePlaylist}
          onPlaylistContextMenu={(e, playlist) => {
            setContextMenu({
              x: e.clientX,
              y: e.clientY,
              playlist
            });
          }}
        />
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
