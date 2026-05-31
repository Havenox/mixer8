import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { X, Plus, Loader2, Check, AlertTriangle, Trash2, ListMusic } from 'lucide-react';

import { API_URL, SERVER_URL } from '../config';

export interface IPlaylist {
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
  TracksCount: number;
  OwnerUserName?: string;
  OwnerFirstName?: string;
  OwnerLastName?: string;
  OwnerAvatarUrl?: string;
}

interface IPlaylistContext {
  playlists: IPlaylist[];
  fetchPlaylists: () => Promise<void>;
  openAddToPlaylist: (trackId: string, trackTitle: string, trackArtist: string) => void;
  openCreatePlaylist: () => void;
  openEditPlaylist: (playlist: IPlaylist) => void;
  openDeletePlaylist: (playlist: IPlaylist) => void;
}

const PlaylistContext = createContext<IPlaylistContext | undefined>(undefined);

export const PlaylistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { Token, IsAuthenticated, CurrentUser } = useAuth();
  const [playlists, setPlaylists] = useState<IPlaylist[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [targetTrack, setTargetTrack] = useState<{ id: string; title: string; artist: string } | null>(null);
  
  // Estados de Criação de Playlist
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDescription, setNewPlaylistDescription] = useState('');
  const [newPlaylistVisibility, setNewPlaylistVisibility] = useState('Public');
  const [newCoverFile, setNewCoverFile] = useState<File | null>(null);
  const [newCoverPreview, setNewCoverPreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [playlistTracksMap, setPlaylistTracksMap] = useState<Record<string, string[]>>({}); // playlistId -> trackIds[]
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Estados Globais de Edição de Playlist
  const [playlistToEdit, setPlaylistToEdit] = useState<IPlaylist | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editVisibility, setEditVisibility] = useState('Public');
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null);
  const [deleteCoverFlag, setDeleteCoverFlag] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Colaboradores no Modal
  const [collabs, setCollabs] = useState<{ UserId: string; Email: string; AddedAt: string }[]>([]);
  const [newCollabEmail, setNewCollabEmail] = useState('');
  const [isAddingCollab, setIsAddingCollab] = useState(false);
  const [collabError, setCollabError] = useState('');

  // Estados Globais de Exclusão de Playlist
  const [playlistToDelete, setPlaylistToDelete] = useState<IPlaylist | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const openCreatePlaylist = () => {
    setTargetTrack(null);
    setIsCreateOpen(true);
    setNewPlaylistName('');
    setNewPlaylistDescription('');
    setNewPlaylistVisibility('Public');
    setNewCoverFile(null);
    setNewCoverPreview(null);
    setError('');
  };

  const openEditPlaylist = (playlist: IPlaylist) => {
    setPlaylistToEdit(playlist);
    setEditName(playlist.Name);
    setEditDescription(playlist.Description || '');
    setEditVisibility(playlist.Visibility);
    setEditCoverFile(null);
    setEditCoverPreview(playlist.CoverUrl ? (playlist.CoverUrl.startsWith('http') ? playlist.CoverUrl : `${SERVER_URL}${playlist.CoverUrl}`) : null);
    setDeleteCoverFlag(false);
    setEditError('');
    setCollabs([]);
    setNewCollabEmail('');
    setCollabError('');
  };

  const openDeletePlaylist = (playlist: IPlaylist) => {
    setPlaylistToDelete(playlist);
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

    // Preenche o mapeamento para saber em quais a música já está
    const map: Record<string, string[]> = {};
    for (const p of playlists) {
      const trackIds = await fetchPlaylistTrackIds(p.PlaylistId);
      map[p.PlaylistId] = trackIds;
    }
    setPlaylistTracksMap(map);
  };

  const handleAddTrackSubmit = async (playlistId: string) => {
    if (!targetTrack || isAdding || !Token) return;
    setIsAdding(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch(`${API_URL}/Playlists/${playlistId}/Tracks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Token}`
        },
        body: JSON.stringify({ TrackId: targetTrack.id })
      });

      if (res.ok) {
        setMessage('Música adicionada à playlist!');
        
        // Atualiza localmente
        setPlaylistTracksMap(prev => ({
          ...prev,
          [playlistId]: [...(prev[playlistId] || []), targetTrack.id]
        }));
        
        // Atualiza a barra lateral
        await fetchPlaylists();
        
        setTimeout(() => {
          setIsAddOpen(false);
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

  const handleCreatePlaylistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim() || isCreating || !Token) return;
    setIsCreating(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('Name', newPlaylistName.trim());
      formData.append('Description', newPlaylistDescription.trim());
      formData.append('Visibility', newPlaylistVisibility);

      if (newCoverFile) {
        formData.append('CoverFile', newCoverFile);
      }

      const res = await fetch(`${API_URL}/Playlists`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Token}`
        },
        body: formData
      });

      if (res.ok) {
        const createdPlaylist = await res.json();
        setIsCreateOpen(false);
        await fetchPlaylists();

        // Se veio do fluxo de adicionar música, adiciona imediatamente na recém criada
        if (targetTrack) {
          await handleAddTrackSubmit(createdPlaylist.PlaylistId);
        }
      } else {
        const errData = await res.json();
        setError(errData.ErrorMessage || 'Erro ao criar playlist.');
      }
    } catch {
      setError('Erro de conexão ao criar.');
    } finally {
      setIsCreating(false);
    }
  };

  // Efeito do timer de 3 segundos para exclusão de playlist
  useEffect(() => {
    let timer: any;
    if (playlistToDelete) {
      setDeleteCountdown(3);
      setDeleteError('');
      timer = setInterval(() => {
        setDeleteCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [playlistToDelete]);

  const handleConfirmDelete = async () => {
    if (!playlistToDelete || deleteCountdown > 0 || isDeleting) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`${API_URL}/Playlists/${playlistToDelete.PlaylistId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${Token}`
        }
      });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('playlist-deleted', { detail: { playlistId: playlistToDelete.PlaylistId } }));
        setPlaylistToDelete(null);
        await fetchPlaylists();
      } else {
        const errData = await res.json();
        setDeleteError(errData.ErrorMessage || 'Falha ao excluir playlist.');
      }
    } catch {
      setDeleteError('Erro de conexão ao excluir playlist.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistToEdit || isSavingEdit) return;
    setIsSavingEdit(true);
    setEditError('');

    try {
      const formData = new FormData();
      formData.append('Name', editName.trim());
      formData.append('Visibility', editVisibility);
      formData.append('Description', editDescription.trim());
      formData.append('DeleteCover', deleteCoverFlag ? 'true' : 'false');
      
      if (editCoverFile) {
        formData.append('CoverFile', editCoverFile);
      }

      const res = await fetch(`${API_URL}/Playlists/${playlistToEdit.PlaylistId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${Token}`
        },
        body: formData
      });

      if (res.ok) {
        const updatedPlaylist = await res.json();
        window.dispatchEvent(new CustomEvent('playlist-updated', { detail: updatedPlaylist }));
        setPlaylistToEdit(null);
        await fetchPlaylists();
      } else {
        const errData = await res.json();
        setEditError(errData.ErrorMessage || 'Falha ao salvar alterações.');
      }
    } catch {
      setEditError('Erro de conexão ao salvar alterações.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Buscar colaboradores quando abrir o modal de edição
  useEffect(() => {
    if (playlistToEdit && Token) {
      fetch(`${API_URL}/Playlists/${playlistToEdit.PlaylistId}`, {
        headers: { 'Authorization': `Bearer ${Token}` }
      })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error();
      })
      .then(data => {
        setCollabs(data.Collaborators || []);
      })
      .catch(() => console.warn('Não foi possível carregar colaboradores.'));
    }
  }, [playlistToEdit, Token]);

  const handleAddCollab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistToEdit || !newCollabEmail.trim() || isAddingCollab) return;
    setIsAddingCollab(true);
    setCollabError('');

    try {
      const res = await fetch(`${API_URL}/Playlists/${playlistToEdit.PlaylistId}/Collaborators`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Token}`
        },
        body: JSON.stringify({ Email: newCollabEmail.trim() })
      });

      if (res.ok) {
        const newCollab = await res.json();
        setCollabs(prev => [...prev, newCollab]);
        setNewCollabEmail('');
        await fetchPlaylists();
      } else {
        const errData = await res.json();
        setCollabError(errData.ErrorMessage || 'Falha ao adicionar colaborador.');
      }
    } catch {
      setCollabError('Erro de conexão ao adicionar colaborador.');
    } finally {
      setIsAddingCollab(false);
    }
  };

  const handleRemoveCollab = async (collabUserId: string) => {
    if (!playlistToEdit) return;
    if (!window.confirm('Tem certeza que deseja remover este colaborador?')) return;

    try {
      const res = await fetch(`${API_URL}/Playlists/${playlistToEdit.PlaylistId}/Collaborators/${collabUserId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${Token}`
        }
      });

      if (res.ok) {
        setCollabs(prev => prev.filter(c => c.UserId !== collabUserId));
        await fetchPlaylists();
      } else {
        alert('Falha ao remover colaborador.');
      }
    } catch {
      alert('Erro de conexão ao remover colaborador.');
    }
  };

  return (
    <PlaylistContext.Provider value={{ playlists, fetchPlaylists, openAddToPlaylist, openCreatePlaylist, openEditPlaylist, openDeletePlaylist }}>
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
                de {targetTrack.artist}
              </span>
            </div>

            {message && (
              <div className="bg-brand-green/10 border border-brand-green/30 p-2.5 rounded text-xs text-brand-green flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{message}</span>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded text-xs text-red-400">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5 shrink-0">
              <div className="flex justify-between items-center text-[10px] text-brand-gray font-bold uppercase tracking-wider px-1">
                <span>Minhas Listas</span>
                <button 
                  onClick={() => {
                    setIsAddOpen(false);
                    setIsCreateOpen(true);
                  }}
                  className="text-brand-green hover:underline cursor-pointer flex items-center gap-1 text-[9px]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nova Playlist</span>
                </button>
              </div>

              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1 border border-brand-hover rounded p-2 bg-black/20">
                {(() => {
                  const writeablePlaylists = playlists.filter(p => p.IsOwner || p.IsCollaborator);
                  if (writeablePlaylists.length === 0) {
                    return <span className="text-xs text-brand-gray/60 italic py-4 text-center">Nenhuma playlist disponível para edição.</span>;
                  }
                  return writeablePlaylists.map(p => {
                    const alreadyContains = (playlistTracksMap[p.PlaylistId] || []).includes(targetTrack.id);
                    return (
                      <button
                        key={p.PlaylistId}
                        disabled={alreadyContains || isAdding}
                        onClick={() => handleAddTrackSubmit(p.PlaylistId)}
                        className={`flex items-center justify-between p-2 rounded border text-left text-xs transition-all ${
                          alreadyContains 
                            ? 'bg-brand-hover/40 border-brand-hover/40 text-brand-gray cursor-not-allowed select-none' 
                            : 'bg-black/40 border-brand-hover text-white hover:bg-brand-hover/60 cursor-pointer'
                        }`}
                      >
                        <div className="flex flex-col truncate">
                          <span className="font-bold truncate">{p.Name}</span>
                          <span className="text-[9px] text-brand-gray">{p.TracksCount} {p.TracksCount === 1 ? 'música' : 'músicas'}</span>
                        </div>
                        {alreadyContains && (
                          <span className="text-[9px] bg-brand-hover text-brand-gray border border-brand-hover px-1.5 py-0.5 rounded uppercase font-bold shrink-0">
                            Já Adicionado
                          </span>
                        )}
                      </button>
                    );
                  });
                })()}
              </div>
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
                if (targetTrack) setIsAddOpen(true);
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
              <label className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">Descrição (Opcional)</label>
              <textarea 
                value={newPlaylistDescription}
                onChange={e => setNewPlaylistDescription(e.target.value)}
                placeholder="Descreva a vibe ou foco desta playlist..."
                rows={2}
                className="w-full bg-black border border-brand-hover rounded p-2 text-xs text-white focus:outline-none focus:border-brand-green resize-none"
              />
            </div>

            {/* Capa da Playlist */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">Capa da Playlist (Opcional)</label>
              <div className="flex items-center gap-4 bg-black/40 border border-brand-hover p-3 rounded">
                <div className="w-14 h-14 bg-black rounded overflow-hidden flex items-center justify-center text-brand-green border border-brand-hover shrink-0 relative">
                  {newCoverPreview ? (
                    <img 
                      src={newCoverPreview} 
                      alt="Capa" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ListMusic className="w-5 h-5 animate-pulse" />
                  )}
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <span className="text-[9px] text-brand-gray leading-normal">Defina uma imagem de capa personalizada (JPG, PNG ou WEBP).</span>
                  <div className="flex items-center gap-2 mt-1">
                    <label className="py-1 px-2.5 bg-brand-hover text-white font-bold rounded text-[9px] hover:bg-brand-hover/80 transition-colors cursor-pointer select-none">
                      Escolher Imagem
                      <input 
                        type="file"
                        accept="image/*"
                        disabled={isCreating}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setNewCoverFile(file);
                            setNewCoverPreview(URL.createObjectURL(file));
                          }
                        }}
                        className="hidden"
                      />
                    </label>

                    {newCoverPreview && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewCoverFile(null);
                          setNewCoverPreview(null);
                        }}
                        className="py-1 px-2.5 border border-red-900/50 hover:bg-red-950/20 text-red-400 font-bold rounded text-[9px] cursor-pointer"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              </div>
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

      {/* MODAL 3: CONFIGURAÇÃO DE PLAYLIST (UNIFICADO/GLOBAL) */}
      {playlistToEdit && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[100] p-4 select-none animate-in fade-in duration-200">
          <div className="bg-brand-card border border-brand-hover w-full max-w-lg p-6 rounded-md shadow-2xl flex flex-col gap-4 relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <button 
              type="button"
              onClick={() => setPlaylistToEdit(null)}
              className="absolute top-4 right-4 text-brand-gray hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col gap-1 pr-8">
              <span className="text-[10px] text-brand-green font-bold uppercase tracking-wider">Configurações</span>
              <h3 className="text-sm font-bold text-white">Editar Playlist</h3>
            </div>

            <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
              
              {/* Capa da Playlist */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">Capa da Playlist</label>
                <div className="flex items-center gap-4 bg-black/40 border border-brand-hover p-3 rounded">
                  <div className="w-16 h-16 bg-black rounded overflow-hidden flex items-center justify-center text-brand-green border border-brand-hover shrink-0 relative">
                    {editCoverPreview ? (
                      <img 
                        src={editCoverPreview} 
                        alt="Capa" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ListMusic className="w-6 h-6" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <span className="text-[10px] text-brand-gray leading-normal">Carregue um arquivo JPG, PNG ou WEBP para definir uma imagem personalizada.</span>
                    <div className="flex items-center gap-2">
                      <label className="py-1.5 px-3 bg-brand-hover text-white font-bold rounded text-[10px] hover:bg-brand-hover/80 transition-colors cursor-pointer select-none">
                        Escolher Imagem
                        <input 
                          type="file"
                          accept="image/*"
                          disabled={isSavingEdit}
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setEditCoverFile(file);
                              setEditCoverPreview(URL.createObjectURL(file));
                              setDeleteCoverFlag(false);
                            }
                          }}
                          className="hidden"
                        />
                      </label>

                      {editCoverPreview && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditCoverFile(null);
                            setEditCoverPreview(null);
                            setDeleteCoverFlag(true);
                          }}
                          className="py-1.5 px-3 border border-red-900/50 hover:bg-red-950/20 text-red-400 font-bold rounded text-[10px] cursor-pointer"
                        >
                          Remover Imagem
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Informações Básicas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">Nome da Playlist</label>
                  <input 
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    required
                    disabled={isSavingEdit}
                    className="w-full bg-black border border-brand-hover rounded p-2 text-xs text-white focus:outline-none focus:border-brand-green"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">Privacidade</label>
                  <select
                    value={editVisibility}
                    onChange={e => setEditVisibility(e.target.value)}
                    disabled={isSavingEdit}
                    className="w-full bg-black border border-brand-hover rounded p-2 text-xs text-white focus:outline-none focus:border-brand-green"
                  >
                    <option value="Public">Pública</option>
                    <option value="Private">Privada</option>
                    <option value="Unlisted">Não Listada</option>
                  </select>
                </div>
              </div>

              {/* Descrição */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">Descrição</label>
                <textarea 
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  placeholder="Vibe, estilo ou informações..."
                  rows={2}
                  disabled={isSavingEdit}
                  className="w-full bg-black border border-brand-hover rounded p-2 text-xs text-white focus:outline-none focus:border-brand-green resize-none"
                />
              </div>

              {editError && (
                <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded text-xs text-red-400">
                  {editError}
                </div>
              )}

              {/* Botões do Formulário */}
              <div className="flex justify-between items-center mt-1 pt-3 border-t border-brand-hover">
                {playlistToEdit && (playlistToEdit.IsOwner || CurrentUser?.UserRole === 'Admin') ? (
                  <button
                    type="button"
                    onClick={() => {
                      openDeletePlaylist(playlistToEdit);
                      setPlaylistToEdit(null);
                    }}
                    className="py-2 px-3.5 bg-red-950/20 hover:bg-red-900/40 border border-red-900/30 rounded font-bold text-xs text-red-400 hover:text-red-300 transition-all cursor-pointer shadow flex items-center gap-1.5"
                    title="Excluir Playlist"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    <span>Excluir Playlist</span>
                  </button>
                ) : <div />}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setPlaylistToEdit(null)}
                    disabled={isSavingEdit}
                    className="py-2 px-3 border border-brand-hover rounded text-xs font-semibold text-brand-gray hover:text-white cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit || !editName.trim()}
                    className="py-2 px-4 bg-brand-green text-black font-bold rounded text-xs hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:hover:scale-100 disabled:active:scale-100"
                  >
                    {isSavingEdit ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Salvando...</span>
                      </>
                    ) : (
                      <span>Salvar Alterações</span>
                    )}
                  </button>
                </div>
              </div>
            </form>

            {/* Gerenciamento de Colaboradores (Apenas Dono ou Admin) */}
            {(playlistToEdit.IsOwner || !playlistToEdit.IsCollaborator) && (
              <div className="flex flex-col gap-2.5 border-t border-brand-hover pt-4 mt-1 select-none">
                <div className="flex flex-col">
                  <span className="text-[10px] text-brand-green font-bold uppercase tracking-wider">Colaboradores</span>
                  <p className="text-[9px] text-brand-gray mt-0.5">Permite que outras pessoas busquem e adicionem faixas a esta playlist.</p>
                </div>

                {/* Formulário de Adicionar Colaborador */}
                <form onSubmit={handleAddCollab} className="flex gap-2">
                  <input 
                    type="email"
                    value={newCollabEmail}
                    onChange={e => setNewCollabEmail(e.target.value)}
                    placeholder="Adicionar por email (ex: joao@mixer8.com)"
                    disabled={isAddingCollab}
                    className="flex-1 bg-black border border-brand-hover rounded p-2 text-xs text-white focus:outline-none focus:border-brand-green"
                  />
                  <button 
                    type="submit"
                    disabled={isAddingCollab || !newCollabEmail.trim()}
                    className="py-2 px-4 bg-brand-hover hover:text-white text-brand-green rounded text-xs font-bold transition-all shrink-0 cursor-pointer"
                  >
                    {isAddingCollab ? 'Carregando...' : 'Adicionar'}
                  </button>
                </form>

                {collabError && (
                  <span className="text-[10px] text-red-400 bg-red-500/10 p-1.5 rounded border border-red-500/20 select-none">{collabError}</span>
                )}

                {/* Lista de Colaboradores Ativos */}
                <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto pr-1">
                  {collabs.length === 0 ? (
                    <span className="text-[10px] text-brand-gray/60 italic py-1">Sem colaboradores ativos.</span>
                  ) : (
                    collabs.map(c => (
                      <div key={c.UserId} className="flex items-center justify-between p-2 rounded bg-black/40 border border-brand-hover text-xs">
                        <div className="flex flex-col">
                          <span className="text-white font-semibold">{c.Email}</span>
                          <span className="text-[9px] text-brand-gray">Adicionado em {new Date(c.AddedAt).toLocaleDateString('pt-BR')}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCollab(c.UserId)}
                          className="p-1 rounded text-brand-gray hover:text-red-400 hover:bg-red-950/20 cursor-pointer transition-colors"
                          title="Remover Colaborador"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* MODAL 4: CONFIRMAÇÃO DE EXCLUSÃO DE PLAYLIST (UNIFICADO/GLOBAL) */}
      {playlistToDelete && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 select-none animate-in fade-in duration-200">
          <div className="bg-brand-card border border-brand-hover w-full max-w-md p-6 rounded shadow-2xl flex flex-col gap-4 relative animate-in zoom-in-95 duration-200">
            <button 
              type="button"
              onClick={() => setPlaylistToDelete(null)}
              className="absolute top-4 right-4 text-brand-gray hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 text-red-500">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Ação Destrutiva</span>
                <h3 className="text-sm font-bold text-white">Excluir Playlist</h3>
              </div>
            </div>

            <div className="bg-black/40 border border-brand-hover p-3 rounded flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-neutral-900 to-black rounded overflow-hidden flex items-center justify-center text-brand-green border border-brand-hover shrink-0">
                {playlistToDelete.CoverUrl ? (
                  <img 
                    src={playlistToDelete.CoverUrl.startsWith('http') ? playlistToDelete.CoverUrl : `${SERVER_URL}${playlistToDelete.CoverUrl}`} 
                    alt="Capa" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ListMusic className="w-5 h-5" />
                )}
              </div>
              <div className="flex flex-col truncate">
                <span className="font-bold text-white text-sm truncate">{playlistToDelete.Name}</span>
                <span className="text-xs text-brand-gray truncate">{playlistToDelete.TracksCount} {playlistToDelete.TracksCount === 1 ? 'música' : 'músicas'}</span>
              </div>
            </div>

            <p className="text-xs text-brand-gray leading-relaxed m-0">
              Esta ação é <strong className="text-red-400">irreversível</strong>. A playlist será excluída permanentemente. Caso possua uma imagem de capa personalizada salva no servidor, ela também será deletada fisicamente. As faixas originais não sofrerão alterações.
            </p>

            {deleteError && (
              <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded text-xs text-red-400">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-2 pt-3 border-t border-brand-hover">
              <button
                type="button"
                onClick={() => setPlaylistToDelete(null)}
                disabled={isDeleting}
                className="py-2 px-3 border border-brand-hover rounded text-xs font-semibold text-brand-gray hover:text-white cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteCountdown > 0 || isDeleting}
                className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-xs hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:hover:scale-100 disabled:active:scale-100"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : deleteCountdown > 0 ? (
                  <span>Aguarde ({deleteCountdown}s)</span>
                ) : (
                  <span>Confirmar Exclusão</span>
                )}
              </button>
            </div>
          </div>
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
