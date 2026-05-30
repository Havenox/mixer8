import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { X, Lock, Globe, EyeOff, Plus, Loader2, Check } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface IPlaylist {
  PlaylistId: string;
  Name: string;
  Visibility: string;
  OwnerId: string;
  OwnerEmail: string;
  CoverUrl?: string;
  CreatedAt: string;
  IsOwner: boolean;
  IsCollaborator: boolean;
  TracksCount: number;
}

interface IPlaylistContext {
  playlists: IPlaylist[];
  fetchPlaylists: () => Promise<void>;
  openAddToPlaylist: (trackId: string, trackTitle: string, trackArtist: string) => void;
  openCreatePlaylist: () => void;
}

const PlaylistContext = createContext<IPlaylistContext | undefined>(undefined);

export const PlaylistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { Token, IsAuthenticated } = useAuth();
  const [playlists, setPlaylists] = useState<IPlaylist[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [targetTrack, setTargetTrack] = useState<{ id: string; title: string; artist: string } | null>(null);
  
  // Estados dos formulários de modal
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistVisibility, setNewPlaylistVisibility] = useState('Public');
  const [isCreating, setIsCreating] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [playlistTracksMap, setPlaylistTracksMap] = useState<Record<string, string[]>>({}); // playlistId -> trackIds[]
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const openCreatePlaylist = () => {
    setTargetTrack(null);
    setIsCreateOpen(true);
    setNewPlaylistName('');
    setError('');
  };

  const fetchPlaylists = async () => {
    if (!Token) return;
    try {
      const res = await fetch(`${API_URL}/Playlists`, {
        headers: {
          'Authorization': `Bearer ${Token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setPlaylists(data);
      }
    } catch (err) {
      console.error('Erro ao buscar playlists:', err);
    }
  };

  // Carrega as playlists e mapeia as faixas de cada uma para verificação de duplicidade rápida
  useEffect(() => {
    if (IsAuthenticated && Token) {
      fetchPlaylists();
    } else {
      setPlaylists([]);
    }
  }, [IsAuthenticated, Token]);

  // Busca faixas de todas as playlists em lote para saber quais já possuem a música selecionada
  const fetchPlaylistTrackIds = async (playlistId: string) => {
    if (!Token) return [];
    try {
      const res = await fetch(`${API_URL}/Playlists/${playlistId}`, {
        headers: { 'Authorization': `Bearer ${Token}` }
      });
      if (res.ok) {
        const data = await res.json();
        return data.Tracks.map((t: any) => t.TrackId) as string[];
      }
    } catch (err) {
      console.error('Erro ao buscar faixas da playlist:', err);
    }
    return [];
  };

  const openAddToPlaylist = async (trackId: string, trackTitle: string, trackArtist: string) => {
    setTargetTrack({ id: trackId, title: trackTitle, artist: trackArtist });
    setIsAddOpen(true);
    setMessage('');
    setError('');

    // Preenche o mapa de faixas das playlists do usuário
    if (Token && playlists.length > 0) {
      const map: Record<string, string[]> = {};
      await Promise.all(
        playlists.map(async (p) => {
          const ids = await fetchPlaylistTrackIds(p.PlaylistId);
          map[p.PlaylistId] = ids;
        })
      );
      setPlaylistTracksMap(map);
    }
  };

  const handleCreatePlaylistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Token || !newPlaylistName.trim()) return;

    setIsCreating(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/Playlists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Token}`
        },
        body: JSON.stringify({
          Name: newPlaylistName.trim(),
          Visibility: newPlaylistVisibility
        })
      });

      if (res.ok) {
        const created: IPlaylist = await res.json();
        setPlaylists(prev => [created, ...prev]);
        setNewPlaylistName('');
        setIsCreateOpen(false);
        setIsAddOpen(true); // retorna ao modal de adição
        
        // Atualiza a nova playlist no mapa com lista vazia
        setPlaylistTracksMap(prev => ({ ...prev, [created.PlaylistId]: [] }));
      } else {
        const errData = await res.json();
        setError(errData.ErrorMessage || 'Falha ao criar playlist.');
      }
    } catch {
      setError('Erro de rede ao conectar.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddTrackToPlaylist = async (playlistId: string) => {
    if (!Token || !targetTrack || isAdding) return;

    setIsAdding(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`${API_URL}/Playlists/${playlistId}/Tracks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Token}`
        },
        body: JSON.stringify({
          TrackId: targetTrack.id
        })
      });

      if (res.ok) {
        setMessage('Adicionado com sucesso!');
        // Atualiza o mapa localmente
        setPlaylistTracksMap(prev => ({
          ...prev,
          [playlistId]: [...(prev[playlistId] || []), targetTrack.id]
        }));
        
        // Atualiza contagem de tracks localmente nas playlists
        setPlaylists(prev => prev.map(p => 
          p.PlaylistId === playlistId 
            ? { ...p, TracksCount: p.TracksCount + 1 } 
            : p
        ));

        setTimeout(() => {
          setIsAddOpen(false);
          setTargetTrack(null);
        }, 1000);
      } else {
        const errData = await res.json();
        setError(errData.ErrorMessage || 'Erro ao adicionar música.');
      }
    } catch {
      setError('Erro de conexão ao adicionar.');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <PlaylistContext.Provider value={{ playlists, fetchPlaylists, openAddToPlaylist, openCreatePlaylist }}>
      {children}

      {/* MODAL 1: ADICIONAR MÚSICA À PLAYLIST */}
      {isAddOpen && targetTrack && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[100] p-4 select-none animate-in fade-in duration-200">
          <div className="bg-brand-card border border-brand-hover w-full max-w-md p-6 rounded-md shadow-2xl flex flex-col gap-4 relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setIsAddOpen(false)}
              className="absolute top-4 right-4 text-brand-gray hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col gap-1 pr-8">
              <span className="text-[10px] text-brand-green font-bold uppercase tracking-wider">Adicionar à Playlist</span>
              <h3 className="text-sm font-bold text-white truncate max-w-full">
                "{targetTrack.title}"
              </h3>
              <span className="text-xs text-brand-gray truncate">
                {targetTrack.artist}
              </span>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded text-xs text-red-400">
                {error}
              </div>
            )}

            {message && (
              <div className="bg-brand-green/10 border border-brand-green/30 p-2.5 rounded text-xs text-brand-green flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>{message}</span>
              </div>
            )}

            {/* Ação de Criar Nova Playlist */}
            <button
              onClick={() => {
                setIsAddOpen(false);
                setIsCreateOpen(true);
              }}
              className="flex items-center gap-3 py-2 px-3 bg-brand-hover/40 border border-brand-hover hover:border-brand-green rounded text-xs text-brand-green font-bold transition-all cursor-pointer justify-center"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Nova Playlist</span>
            </button>

            <div className="h-[1px] bg-brand-hover my-1" />

            {/* Listagem de Playlists Existentes */}
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
              <span className="text-[10px] text-brand-gray font-bold uppercase tracking-wider mb-1">Escolha uma playlist</span>
              
              {playlists.length === 0 ? (
                <div className="text-xs text-brand-gray italic py-4 text-center">
                  Nenhuma playlist criada. Comece criando uma!
                </div>
              ) : (
                playlists.map(p => {
                  const isAlreadyAdded = (playlistTracksMap[p.PlaylistId] || []).includes(targetTrack.id);
                  const isOwnerOrCollab = p.IsOwner || p.IsCollaborator;

                  return (
                    <button
                      key={p.PlaylistId}
                      disabled={isAlreadyAdded || isAdding || !isOwnerOrCollab}
                      onClick={() => handleAddTrackToPlaylist(p.PlaylistId)}
                      className={`flex items-center justify-between p-3 rounded border text-left transition-all ${
                        isAlreadyAdded 
                          ? 'bg-black/30 border-transparent text-brand-gray/40 cursor-not-allowed'
                          : !isOwnerOrCollab 
                          ? 'bg-black/10 border-transparent text-brand-gray/30 cursor-not-allowed'
                          : 'bg-black/40 border-brand-hover hover:border-white hover:bg-black/75 cursor-pointer text-white'
                      }`}
                    >
                      <div className="flex flex-col gap-0.5 truncate">
                        <span className="text-xs font-bold truncate">{p.Name}</span>
                        <span className="text-[9px] text-brand-gray flex items-center gap-1">
                          {p.Visibility === 'Private' && <Lock className="w-3 h-3 text-brand-green" />}
                          {p.Visibility === 'Public' && <Globe className="w-3 h-3 text-brand-gray" />}
                          {p.Visibility === 'Unlisted' && <EyeOff className="w-3 h-3 text-brand-gray" />}
                          <span>{p.TracksCount} {p.TracksCount === 1 ? 'música' : 'músicas'}</span>
                        </span>
                      </div>
                      
                      {isAlreadyAdded && (
                        <span className="text-[9px] px-2 py-0.5 bg-brand-hover text-brand-gray font-bold rounded">
                          Já adicionado
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CRIAR PLAYLIST */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[100] p-4 select-none animate-in fade-in duration-200">
          <form 
            onSubmit={handleCreatePlaylistSubmit}
            className="bg-brand-card border border-brand-hover w-full max-w-md p-6 rounded-md shadow-2xl flex flex-col gap-4 relative animate-in zoom-in-95 duration-200"
          >
            <button 
              type="button"
              onClick={() => {
                setIsCreateOpen(false);
                if (targetTrack) setIsAddOpen(true); // retorna para o anterior se houver track
              }}
              className="absolute top-4 right-4 text-brand-gray hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col gap-1 pr-8">
              <span className="text-[10px] text-brand-green font-bold uppercase tracking-wider">Nova Playlist</span>
              <h3 className="text-sm font-bold text-white">Criar Nova Lista</h3>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded text-xs text-red-400">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">Nome da Playlist</label>
              <input 
                type="text"
                value={newPlaylistName}
                onChange={e => setNewPlaylistName(e.target.value)}
                placeholder="Ex: Minhas Preferidas, Foco Total, etc."
                required
                className="w-full bg-black border border-brand-hover rounded p-2 text-xs text-white focus:outline-none focus:border-brand-green"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">Privacidade e Visibilidade</label>
              <select
                value={newPlaylistVisibility}
                onChange={e => setNewPlaylistVisibility(e.target.value)}
                className="w-full bg-black border border-brand-hover rounded p-2 text-xs text-white focus:outline-none focus:border-brand-green"
              >
                <option value="Public">Pública (Todos podem visualizar)</option>
                <option value="Private">Privada (Apenas você e colaboradores acessam)</option>
                <option value="Unlisted">Não Listada (Apenas quem tem o link acessa)</option>
              </select>
            </div>

            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false);
                  if (targetTrack) setIsAddOpen(true);
                }}
                className="flex-1 py-2 px-3 border border-brand-hover hover:border-white rounded text-xs font-semibold hover:text-white transition-all cursor-pointer text-center text-brand-gray"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isCreating || !newPlaylistName.trim()}
                className="flex-1 py-2 px-3 bg-brand-green text-black font-bold rounded text-xs hover:scale-[1.02] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:scale-100"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Criando...</span>
                  </>
                ) : (
                  <span>Criar Playlist</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </PlaylistContext.Provider>
  );
};

export const usePlaylists = () => {
  const context = useContext(PlaylistContext);
  if (!context) {
    throw new Error('usePlaylists deve ser utilizado dentro de um PlaylistProvider');
  }
  return context;
};
