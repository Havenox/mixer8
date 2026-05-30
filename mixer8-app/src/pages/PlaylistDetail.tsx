import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { usePlaylists } from '../context/PlaylistContext';
import { 
  Play, Pause, Disc, Music, Users, Plus, Trash,
  Loader2, ArrowLeft, Settings, ShieldAlert, X
} from 'lucide-react';


const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SERVER_URL = API_URL.replace('/api', '');

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
  OwnerId: string;
  OwnerEmail: string;
  CoverUrl?: string;
  CreatedAt: string;
  IsOwner: boolean;
  IsCollaborator: boolean;
  Tracks: IPlaylistTrack[];
  Collaborators: IPlaylistCollaborator[];
}

export const PlaylistDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { Token, CurrentUser } = useAuth();
  const { loadTrack, currentTrack, isPlaying, togglePlay } = usePlayer();
  const { fetchPlaylists } = usePlaylists();
  const navigate = useNavigate();

  const [playlist, setPlaylist] = useState<IPlaylistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modais internos de gerenciamento
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editVisibility, setEditVisibility] = useState('Public');
  const [editCoverUrl, setEditCoverUrl] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const [showCollabsModal, setShowCollabsModal] = useState(false);
  const [newCollabEmail, setNewCollabEmail] = useState('');
  const [isAddingCollab, setIsAddingCollab] = useState(false);
  const [collabError, setCollabError] = useState('');

  const fetchPlaylistDetails = async () => {
    if (!Token || !id) return;
    try {
      const res = await fetch(`${API_URL}/Playlists/${id}`, {
        headers: {
          'Authorization': `Bearer ${Token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setPlaylist(data);
        setEditName(data.Name);
        setEditVisibility(data.Visibility);
        setEditCoverUrl(data.CoverUrl || '');
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

  const handlePlayTrack = (t: IPlaylistTrack) => {
    // Mapeia para o formato esperado pelo PlayerContext (ITrack)
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
    loadTrack(trackToPlay);
  };

  const handleRemoveTrack = async (trackId: string) => {
    if (!Token || !playlist) return;
    if (!window.confirm('Tem certeza que deseja remover esta música da playlist?')) return;

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

  const handleUpdatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Token || !playlist) return;

    setIsUpdating(true);
    try {
      const res = await fetch(`${API_URL}/Playlists/${playlist.PlaylistId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Token}`
        },
        body: JSON.stringify({
          Name: editName.trim(),
          Visibility: editVisibility,
          CoverUrl: editCoverUrl.trim() || null
        })
      });

      if (res.ok) {
        setShowEditModal(false);
        fetchPlaylistDetails();
        fetchPlaylists(); // atualiza barra lateral
      } else {
        alert('Falha ao atualizar playlist.');
      }
    } catch {
      alert('Erro de conexão.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeletePlaylist = async () => {
    if (!Token || !playlist) return;
    if (!window.confirm('ATENÇÃO: Tem certeza que deseja EXCLUIR permanentemente esta playlist?')) return;

    try {
      const res = await fetch(`${API_URL}/Playlists/${playlist.PlaylistId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${Token}`
        }
      });

      if (res.ok) {
        fetchPlaylists();
        navigate('/dashboard');
      } else {
        alert('Falha ao excluir playlist.');
      }
    } catch {
      alert('Erro de conexão.');
    }
  };

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Token || !playlist || !newCollabEmail.trim()) return;

    setIsAddingCollab(true);
    setCollabError('');
    try {
      const res = await fetch(`${API_URL}/Playlists/${playlist.PlaylistId}/Collaborators`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Token}`
        },
        body: JSON.stringify({
          Email: newCollabEmail.trim()
        })
      });

      if (res.ok) {
        const added = await res.json();
        setPlaylist(prev => {
          if (!prev) return null;
          return {
            ...prev,
            Collaborators: [...prev.Collaborators, added]
          };
        });
        setNewCollabEmail('');
      } else {
        const errData = await res.json();
        setCollabError(errData.ErrorMessage || 'Falha ao adicionar colaborador.');
      }
    } catch {
      setCollabError('Erro de conexão.');
    } finally {
      setIsAddingCollab(false);
    }
  };

  const handleRemoveCollaborator = async (collabUserId: string) => {
    if (!Token || !playlist) return;
    if (!window.confirm('Deseja remover este colaborador?')) return;

    try {
      const res = await fetch(`${API_URL}/Playlists/${playlist.PlaylistId}/Collaborators/${collabUserId}`, {
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
            Collaborators: prev.Collaborators.filter(c => c.UserId !== collabUserId)
          };
        });
      } else {
        alert('Falha ao remover colaborador.');
      }
    } catch {
      alert('Erro de conexão.');
    }
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
        <span className="font-semibold text-sm">Buscando playlist do PostgreSQL...</span>
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-brand-gray select-none px-6">
        <ShieldAlert className="w-12 h-12 text-red-400" />
        <span className="font-bold text-sm text-center">{error || 'Playlist não encontrada.'}</span>
        <button 
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 py-2 px-4 bg-brand-hover rounded-md text-xs text-white hover:bg-brand-hover/80 transition-all font-semibold cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para Biblioteca
        </button>
      </div>
    );
  }

  const isPlaylistOwner = playlist.OwnerId === CurrentUser?.UserId;
  const isOwnerOrAdmin = isPlaylistOwner || CurrentUser?.UserRole === 'Admin';

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300 select-none pb-12">
      {/* Botão de voltar */}
      <button 
        onClick={() => navigate('/dashboard')}
        className="self-start flex items-center gap-2 text-brand-gray hover:text-white transition-colors font-semibold text-xs cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar para Biblioteca
      </button>

      {/* 1. Spotify Header */}
      <div className="flex flex-col md:flex-row gap-6 items-end bg-gradient-to-b from-brand-hover/40 to-transparent p-6 rounded-lg border border-brand-hover/30 shadow-inner">
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

          <div className="flex items-center gap-2 text-xs text-brand-gray font-medium flex-wrap">
            <span className="text-white font-bold">{playlist.OwnerEmail}</span>
            <span>•</span>
            <span>{playlist.Tracks.length} {playlist.Tracks.length === 1 ? 'música' : 'músicas'}</span>
            <span>•</span>
            <span>Criada em {new Date(playlist.CreatedAt).toLocaleDateString('pt-BR')}</span>
          </div>
        </div>

        {/* Ações (Editar / Colaboradores) */}
        {isOwnerOrAdmin && (
          <div className="flex gap-2 self-stretch md:self-end justify-end mt-4 md:mt-0 shrink-0">
            <button
              onClick={() => setShowCollabsModal(true)}
              className="flex items-center gap-2 py-2 px-3.5 bg-brand-hover hover:bg-brand-hover/80 rounded font-bold text-xs text-white transition-all cursor-pointer shadow border border-brand-hover"
              title="Gerenciar Colaboradores"
            >
              <Users className="w-4 h-4 text-brand-green" />
              <span>Colaboradores</span>
            </button>

            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-2 py-2 px-3.5 bg-brand-hover hover:bg-brand-hover/80 rounded font-bold text-xs text-white transition-all cursor-pointer shadow border border-brand-hover"
              title="Configurações da Playlist"
            >
              <Settings className="w-4 h-4" />
              <span>Ajustes</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Playlist Track List */}
      <div className="bg-brand-card border border-brand-hover p-6 rounded-md shadow-xl flex flex-col gap-6 mt-4">
        {playlist.Tracks.length === 0 ? (
          <div className="text-center py-10 flex flex-col gap-3 items-center">
            <Disc className="w-12 h-12 text-brand-gray/30" />
            <span className="text-sm font-semibold text-brand-gray">Nenhuma música adicionada ainda.</span>
            <p className="text-xs text-brand-gray/60 max-w-sm">
              Navegue pelo painel Explorar ou Minha Biblioteca, clique com o botão direito nas músicas e selecione "Adicionar à Playlist" para rechear sua lista!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full select-none">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-brand-hover text-brand-gray font-bold uppercase tracking-wider text-[10px] pb-3">
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-3">Título / Artista</th>
                  <th className="py-2.5 px-3 w-40">Adicionado por</th>
                  <th className="py-2.5 px-3 w-40">Adicionado em</th>
                  <th className="py-2.5 px-3 w-16 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {playlist.Tracks.map((t, index) => {
                  const isCurrentTrack = currentTrack && currentTrack.TrackId === t.TrackId;
                  const canDelete = isOwnerOrAdmin || t.AddedById === CurrentUser?.UserId;

                  return (
                    <tr 
                      key={t.TrackId} 
                      className={`border-b border-brand-hover/40 hover:bg-brand-hover/30 transition-colors group ${
                        isCurrentTrack ? 'bg-brand-hover/10' : ''
                      }`}
                    >
                      {/* Play Action / Index */}
                      <td className="py-3 px-3 text-center text-brand-gray font-semibold relative">
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
                      <td className="py-3 px-3">
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

                      {/* Quem adicionou (exibe e-mail dos colaboradores) */}
                      <td className="py-3 px-3 text-brand-gray truncate">
                        {playlist.Collaborators.length > 0 || !isPlaylistOwner ? (
                          <span className="capitalize">{t.AddedByEmail.split('@')[0]}</span>
                        ) : (
                          <span className="italic">Dono</span>
                        )}
                      </td>

                      {/* Data de adição */}
                      <td className="py-3 px-3 text-brand-gray">
                        {formatDistanceToNow(t.AddedAt)}
                      </td>

                      {/* Excluir faixa */}
                      <td className="py-3 px-3 text-right">
                        {canDelete ? (
                          <button
                            onClick={() => handleRemoveTrack(t.TrackId)}
                            className="p-1.5 text-brand-gray hover:text-red-400 rounded hover:bg-black/40 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                            title="Remover música da Playlist"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-[9px] text-brand-gray/30 italic">Somente dono</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL ADJUSTS (Editar Playlist) */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
          <form 
            onSubmit={handleUpdatePlaylist}
            className="bg-brand-card border border-brand-hover w-full max-w-md p-6 rounded shadow-2xl flex flex-col gap-4 relative animate-in zoom-in-95 duration-200"
          >
            <button 
              type="button"
              onClick={() => setShowEditModal(false)}
              className="absolute top-4 right-4 text-brand-gray hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col gap-1 pr-8">
              <span className="text-[10px] text-brand-green font-bold uppercase tracking-wider">Ajustes da Playlist</span>
              <h3 className="text-sm font-bold text-white">Editar Metadados</h3>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">Nome da Playlist</label>
              <input 
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                required
                className="w-full bg-black border border-brand-hover rounded p-2 text-xs text-white focus:outline-none focus:border-brand-green"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">Privacidade</label>
              <select
                value={editVisibility}
                onChange={e => setEditVisibility(e.target.value)}
                className="w-full bg-black border border-brand-hover rounded p-2 text-xs text-white focus:outline-none focus:border-brand-green"
              >
                <option value="Public">Pública</option>
                <option value="Private">Privada</option>
                <option value="Unlisted">Não Listada</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">URL de Capa Customizada (Opcional)</label>
              <input 
                type="text"
                value={editCoverUrl}
                onChange={e => setEditCoverUrl(e.target.value)}
                placeholder="Ex: http://.../imagem.jpg"
                className="w-full bg-black border border-brand-hover rounded p-2 text-xs text-white focus:outline-none focus:border-brand-green"
              />
            </div>

            <div className="flex justify-between items-center mt-3 pt-3 border-t border-brand-hover">
              <button
                type="button"
                onClick={handleDeletePlaylist}
                className="py-2 px-3 text-red-400 font-bold border border-red-500/20 hover:border-red-500 hover:bg-red-500/5 rounded text-xs transition-all cursor-pointer"
              >
                Excluir Playlist
              </button>

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="py-2 px-3 border border-brand-hover rounded text-xs font-semibold text-brand-gray hover:text-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUpdating || !editName.trim()}
                  className="py-2 px-4 bg-brand-green text-black font-bold rounded text-xs hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Salvar'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* MODAL COLLABORATORS (Gerenciar Colaboradores) */}
      {showCollabsModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 select-none">
          <div className="bg-brand-card border border-brand-hover w-full max-w-md p-6 rounded shadow-2xl flex flex-col gap-4 relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowCollabsModal(false)}
              className="absolute top-4 right-4 text-brand-gray hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col gap-1 pr-8">
              <span className="text-[10px] text-brand-green font-bold uppercase tracking-wider">Colaboradores</span>
              <h3 className="text-sm font-bold text-white">Autorizar Editores</h3>
              <p className="text-[10px] text-brand-gray mt-0.5">Colaboradores podem pesquisar e adicionar músicas à sua playlist.</p>
            </div>

            {collabError && (
              <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded text-xs text-red-400">
                {collabError}
              </div>
            )}

            {/* Adicionar Colaborador Form */}
            <form onSubmit={handleAddCollaborator} className="flex gap-2">
              <input 
                type="email"
                value={newCollabEmail}
                onChange={e => setNewCollabEmail(e.target.value)}
                placeholder="E-mail do usuário..."
                required
                className="flex-1 bg-black border border-brand-hover rounded p-2 text-xs text-white focus:outline-none focus:border-brand-green"
              />
              <button
                type="submit"
                disabled={isAddingCollab || !newCollabEmail.trim()}
                className="py-2 px-3 bg-brand-green text-black font-bold rounded text-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
              >
                {isAddingCollab ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
            </form>

            <div className="h-[1px] bg-brand-hover my-1" />

            {/* Lista de Colaboradores */}
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
              <span className="text-[10px] text-brand-gray font-bold uppercase tracking-wider mb-1">Membros Atuais</span>
              
              {playlist.Collaborators.length === 0 ? (
                <div className="text-xs text-brand-gray italic py-3 text-center">
                  Nenhum colaborador adicionado ainda.
                </div>
              ) : (
                playlist.Collaborators.map(c => (
                  <div key={c.UserId} className="bg-black/40 border border-brand-hover p-2.5 rounded flex items-center justify-between">
                    <div className="flex flex-col truncate">
                      <span className="text-xs font-bold text-white truncate">{c.Email}</span>
                      <span className="text-[9px] text-brand-gray">Adicionado em {new Date(c.AddedAt).toLocaleDateString('pt-BR')}</span>
                    </div>

                    <button
                      onClick={() => handleRemoveCollaborator(c.UserId)}
                      className="p-1 text-brand-gray hover:text-red-400 rounded hover:bg-black/60 transition-all cursor-pointer"
                      title="Remover Colaborador"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowCollabsModal(false)}
              className="mt-2 w-full py-2 bg-brand-hover hover:bg-brand-hover/80 text-white font-semibold rounded text-xs transition-all cursor-pointer text-center"
            >
              Concluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
