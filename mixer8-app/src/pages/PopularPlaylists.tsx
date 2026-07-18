import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePlaylists } from '../context/PlaylistContext';
import { 
  ListMusic, LayoutGrid, List, ArrowLeft, AlertTriangle, Edit, Trash2 
} from 'lucide-react';
import { PlaylistListing } from '../components/PlaylistListing';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { API_URL } from '../config';

export const PopularPlaylists: React.FC = () => {
  const { CurrentUser, Token } = useAuth();
  const { openEditPlaylist, openDeletePlaylist, fetchPlaylists: reloadAllPlaylists } = usePlaylists();
  const navigate = useNavigate();

  const [playlists, setPlaylists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>(
    () => (localStorage.getItem('mixer8:layout-preference') as 'grid' | 'list') || 'grid'
  );

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; playlist: any } | null>(null);
  const [collabPlaylistToLeave, setCollabPlaylistToLeave] = useState<any | null>(null);

  // Fechar menus
  useEffect(() => {
    const handleClose = () => setContextMenu(null);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  const handleLayoutToggle = (mode: 'grid' | 'list') => {
    setLayoutMode(mode);
    localStorage.setItem('mixer8:layout-preference', mode);
  };

  const fetchPopular = async (resetPage = false) => {
    const targetPage = resetPage ? 1 : page;
    if (resetPage) {
      setIsLoading(true);
      setPage(1);
      setHasMore(true);
    } else {
      setIsFetchingMore(true);
    }

    try {
      const headers: Record<string, string> = {};
      if (Token) {
        headers['Authorization'] = `Bearer ${Token}`;
      }
      const res = await fetch(`${API_URL}/Playlists/Popular?page=${targetPage}&limit=20`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (resetPage) {
          setPlaylists(data);
        } else {
          setPlaylists(prev => {
            const existingIds = new Set(prev.map(p => p.PlaylistId));
            const newPlaylists = data.filter((p: any) => !existingIds.has(p.PlaylistId));
            return [...prev, ...newPlaylists];
          });
        }

        if (data.length < 20) {
          setHasMore(false);
        } else {
          setPage(prev => (resetPage ? 2 : prev + 1));
        }
      }
    } catch {
      setError('Falha ao conectar com o banco de dados principal.');
    } finally {
      setIsLoading(false);
      setIsFetchingMore(false);
    }
  };

  useEffect(() => {
    fetchPopular(true);
  }, [Token]);

  // Hook de Infinite Scroll
  useInfiniteScroll(hasMore, isFetchingMore, isLoading, () => fetchPopular(false));

  const handleToggleSavePlaylist = async (playlist: any) => {
    if (!Token) return;
    const isSaved = playlist.IsSaved;
    const url = `${API_URL}/Playlists/${playlist.PlaylistId}/Save`;
    
    try {
      const res = await fetch(url, {
        method: isSaved ? 'DELETE' : 'POST',
        headers: { 'Authorization': `Bearer ${Token}` }
      });
      if (res.ok) {
        setPlaylists(prev => prev.map(p => {
          if (p.PlaylistId === playlist.PlaylistId) {
            return { ...p, IsSaved: !isSaved };
          }
          return p;
        }));
        await reloadAllPlaylists();
      }
    } catch (err) {
      console.error('Erro ao alternar salvamento:', err);
    }
  };

  const handleLeaveCollaboration = async (playlist: any) => {
    if (!Token || !CurrentUser) return;
    try {
      const res = await fetch(`${API_URL}/Playlists/${playlist.PlaylistId}/Collaborators/${CurrentUser.UserId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${Token}` }
      });
      if (res.ok) {
        setCollabPlaylistToLeave(null);
        fetchPopular(true);
        await reloadAllPlaylists();
      }
    } catch (err) {
      console.error("Erro ao deixar colaboração", err);
    }
  };

  return (
    <div className="flex flex-col gap-6 select-none animate-in fade-in duration-300">
      
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-hover pb-5">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="p-2 border border-brand-hover hover:border-white rounded-full text-brand-gray hover:text-white transition-all cursor-pointer"
            title="Voltar para Explorar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-2">
              <ListMusic className="w-8 h-8 text-brand-green" /> Playlists Populares
            </h1>
            <p className="text-sm text-brand-gray">Playlists públicas mais ouvidas da nossa comunidade.</p>
          </div>
        </div>

        {/* Seletor de visualização (Grade vs Lista) */}
        <div className="flex items-center bg-black/60 border border-brand-hover p-1 rounded-md self-start sm:self-auto">
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
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded text-xs text-red-400 flex items-start gap-2 max-w-[500px]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid/List de Playlists */}
      <PlaylistListing 
        playlists={playlists}
        layoutMode={layoutMode}
        isLoading={isLoading}
        isFetchingMore={isFetchingMore}
        onToggleSavePlaylist={handleToggleSavePlaylist}
        onPlaylistContextMenu={(e, playlist) => {
          setContextMenu({ x: e.clientX, y: e.clientY, playlist });
        }}
      />

      {/* MENU DE CONTEXTO */}
      {contextMenu && (
        <div 
          className="fixed z-50 bg-brand-card border border-brand-hover rounded shadow-2xl py-1.5 w-48 text-xs font-semibold select-none cursor-pointer"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          {(contextMenu.playlist.IsOwner || CurrentUser?.UserRole === 'Admin') && (
            <>
              <div 
                onClick={() => {
                  openEditPlaylist(contextMenu.playlist);
                  setContextMenu(null);
                }}
                className="px-4 py-2 hover:bg-brand-hover hover:text-brand-green flex items-center gap-2.5 transition-colors"
              >
                <Edit className="w-4 h-4 text-brand-gray" />
                <span>Editar Playlist</span>
              </div>
              <div className="h-[1px] bg-brand-hover my-1" />
              <div 
                onClick={() => {
                  openDeletePlaylist(contextMenu.playlist);
                  setContextMenu(null);
                }}
                className="px-4 py-2 hover:bg-brand-hover hover:text-red-400 text-red-500 flex items-center gap-2.5 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Excluir Playlist</span>
              </div>
            </>
          )}

          {contextMenu.playlist.IsSaved && !contextMenu.playlist.IsOwner && (
            <div 
              onClick={() => {
                handleToggleSavePlaylist(contextMenu.playlist);
                setContextMenu(null);
              }}
              className="px-4 py-2 hover:bg-brand-hover hover:text-red-400 text-red-500 flex items-center gap-2.5 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Remover da Biblioteca</span>
            </div>
          )}

          {contextMenu.playlist.IsCollaborator && !contextMenu.playlist.IsOwner && (
            <div 
              onClick={() => {
                setCollabPlaylistToLeave(contextMenu.playlist);
                setContextMenu(null);
              }}
              className="px-4 py-2 hover:bg-brand-hover hover:text-red-400 text-red-500 flex items-center gap-2.5 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Parar de Colaborar</span>
            </div>
          )}
        </div>
      )}

      {/* MODAL DE DEIXAR COLAB */}
      {collabPlaylistToLeave && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
          <div className="bg-brand-card border border-brand-hover p-6 rounded-md max-w-sm w-full flex flex-col gap-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-500">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-white text-base">Parar de Colaborar?</h3>
            </div>
            <p className="text-xs text-brand-gray leading-relaxed">
              Você tem certeza que deseja parar de colaborar com a playlist <strong className="text-white">"{collabPlaylistToLeave.Name}"</strong>?
            </p>
            <div className="flex justify-end gap-2.5 mt-2">
              <button onClick={() => setCollabPlaylistToLeave(null)} className="py-2 px-4 rounded bg-brand-hover hover:bg-brand-hover/80 text-xs font-bold text-white transition-all cursor-pointer">Cancelar</button>
              <button onClick={() => handleLeaveCollaboration(collabPlaylistToLeave)} className="py-2 px-4 rounded bg-red-500 hover:bg-red-600 text-xs font-bold text-white transition-all cursor-pointer">Confirmar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
