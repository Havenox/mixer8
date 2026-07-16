import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { PlaylistProvider, usePlaylists } from './context/PlaylistContext';
import type { ITrack } from './context/PlayerContext';
import { PersistentLayout } from './components/PersistentLayout';
import { Dashboard } from './pages/Dashboard';
import { Admin } from './pages/Admin';
import { UploadDireto } from './pages/UploadDireto';
import { PlaylistDetail } from './pages/PlaylistDetail';
import { Playlists } from './pages/Playlists';
import { Settings as SettingsPage } from './pages/Settings';
import { PublicProfile } from './pages/PublicProfile';
import { WeeklyTrends } from './pages/WeeklyTrends';
import { PopularPlaylists } from './pages/PopularPlaylists';
import { ExploreShelf } from './components/ExploreShelf';
import { DawView } from './pages/DawView';
import { Sparkles, Flame, Music, Loader2, Plus, Trash2, AlertTriangle, X, Settings, RefreshCw, ListMusic, Image, ShieldAlert, LayoutGrid, List } from 'lucide-react';

import { API_URL, SERVER_URL } from './config';

// Rota protegida por autenticação
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { IsAuthenticated } = useAuth();
  return IsAuthenticated ? <>{children}</> : <Navigate to="/?showLogin=true" replace />;
};

// Página de Explorar (Home / Catálogo de Destaque)
const Explore: React.FC = () => {
  const { CurrentUser, Token, IsAuthenticated, openLoginModal } = useAuth();
  const { loadTrack, currentTrack } = usePlayer();
  const { openAddToPlaylist } = usePlaylists();
  const [tracks, setTracks] = useState<ITrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; track: ITrack } | null>(null);

  const [popularPlaylists, setPopularPlaylists] = useState<any[]>([]);
  const [loadingPopular, setLoadingPopular] = useState(true);

  const [layoutMode, setLayoutMode] = useState<'grid' | 'compact-list'>(
    () => (localStorage.getItem('mixer8:explore-layout-preference') as 'grid' | 'compact-list') || 'grid'
  );

  const handleLayoutToggle = (mode: 'grid' | 'compact-list') => {
    setLayoutMode(mode);
    localStorage.setItem('mixer8:explore-layout-preference', mode);
  };

  const fetchPopularPlaylists = async () => {
    try {
      const headers: Record<string, string> = {};
      if (Token) {
        headers['Authorization'] = `Bearer ${Token}`;
      }
      const res = await fetch(`${API_URL}/Explore/PopularPlaylists`, { headers });
      if (res.ok) {
        const data = await res.json();
        setPopularPlaylists(data);
      }
    } catch (err) {
      console.error('Erro ao buscar playlists populares:', err);
    } finally {
      setLoadingPopular(false);
    }
  };

  const handleToggleSavePlaylist = async (playlist: any) => {
    if (!IsAuthenticated || !Token) {
      openLoginModal();
      return;
    }
    const isSaved = playlist.IsSaved;
    const url = `${API_URL}/Playlists/${playlist.PlaylistId}/Save`;
    
    try {
      const res = await fetch(url, {
        method: isSaved ? 'DELETE' : 'POST',
        headers: {
          'Authorization': `Bearer ${Token}`
        }
      });
      if (res.ok) {
        setPopularPlaylists(prev => prev.map(p => {
          if (p.PlaylistId === playlist.PlaylistId) {
            return { ...p, IsSaved: !isSaved };
          }
          return p;
        }));
      }
    } catch (err) {
      console.error('Erro ao alternar salvamento de playlist:', err);
    }
  };

  const [trackToDelete, setTrackToDelete] = useState<ITrack | null>(null);
  const [trackToReview, setTrackToReview] = useState<ITrack | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState(3);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deletionReasonInput, setDeletionReasonInput] = useState('');


  // Estados para Edição de Músicas (Admin)
  const [trackToEdit, setTrackToEdit] = useState<ITrack | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState('');
  const [editCoverUrl, setEditCoverUrl] = useState('');
  const [stemsToDelete, setStemsToDelete] = useState<string[]>([]); // IDs das stems a deletar
  const [stemsToReplace, setStemsToReplace] = useState<Record<string, File>>({}); // ID -> Arquivo
  const [newStemsFiles, setNewStemsFiles] = useState<File[]>([]);
  const [editVisibility, setEditVisibility] = useState('Public');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (trackToEdit) {
      setEditTitle(trackToEdit.TrackTitle);
      setEditArtist(trackToEdit.ArtistName);
      setEditCoverFile(null);
      setEditCoverPreview(trackToEdit.CoverUrl ? (trackToEdit.CoverUrl.startsWith('http') ? trackToEdit.CoverUrl : `${SERVER_URL}${trackToEdit.CoverUrl}`) : '');
      setEditCoverUrl(trackToEdit.CoverUrl || '');
      setEditVisibility(trackToEdit.Visibility || 'Public');
      setStemsToDelete([]);
      setStemsToReplace({});
      setNewStemsFiles([]);
      setSaveError('');
      setIsSaving(false);
    }
  }, [trackToEdit]);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackToEdit || !Token) return;

    if (!editTitle.trim() || !editArtist.trim()) {
      setSaveError('Título e Artista são obrigatórios.');
      return;
    }

    setIsSaving(true);
    setSaveError('');

    try {
      const formData = new FormData();
      formData.append('TrackTitle', editTitle.trim());
      formData.append('ArtistName', editArtist.trim());
      formData.append('CoverUrl', editCoverUrl.trim());
      formData.append('Visibility', editVisibility);
      
      if (editCoverFile) {
        formData.append('CoverFile', editCoverFile);
      }

      if (stemsToDelete.length > 0) {
        formData.append('DeleteStemIds', stemsToDelete.join(','));
      }

      // Adiciona arquivos de substituição mapeados com "ReplaceStem_{stemId}"
      Object.entries(stemsToReplace).forEach(([stemId, file]) => {
        if (!stemsToDelete.includes(stemId)) {
          formData.append(`ReplaceStem_${stemId}`, file);
        }
      });

      // Adiciona novas stems avulsas ou ZIPs
      newStemsFiles.forEach((file) => {
        formData.append('Files', file);
      });

      const res = await fetch(`${API_URL}/Tracks/${trackToEdit.TrackId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${Token}`
        },
        body: formData
      });

      if (res.ok) {
        const updatedTrack = await res.json();
        
        // Se a música editada estiver ativamente carregada no player, recarrega
        if (currentTrack && currentTrack.TrackId === trackToEdit.TrackId) {
          loadTrack(updatedTrack);
        }

        setTrackToEdit(null);
        fetchTracks(); // Recarrega o grid da tela
      } else {
        const errorData = await res.json().catch(() => ({}));
        setSaveError(errorData.ErrorMessage || 'Falha ao salvar as alterações da música.');
      }
    } catch {
      setSaveError('Erro de conexão ao tentar salvar as alterações.');
    } finally {
      setIsSaving(false);
    }
  };

  // Fechar menu de contexto ao clicar fora
  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const fetchTracks = async () => {
    try {
      const headers: Record<string, string> = {};
      if (Token) {
        headers['Authorization'] = `Bearer ${Token}`;
      }
      const res = await fetch(`${API_URL}/Explore/WeeklyTrends`, { headers });
      if (res.ok) {
        const data = await res.json();
        // Exibe apenas as tracks com extração concluída ou em processamento
        setTracks(data.filter((t: ITrack) => t.ExtractionStatus === 'Pronto' || t.ExtractionStatus.startsWith('Processando')));
      }
    } catch (err) {
      console.error('Erro ao buscar tracks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracks();
    fetchPopularPlaylists();
  }, [Token]);

  // Gerenciador do timer de contagem regressiva para exclusão física
  useEffect(() => {
    if (!trackToDelete) return;
    
    setDeleteCountdown(3);
    setDeleteError('');
    setIsDeleting(false);
    setDeletionReasonInput('');

    const timer = setInterval(() => {
      setDeleteCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [trackToDelete]);

  const handleConfirmDelete = async () => {
    if (!trackToDelete || deleteCountdown > 0 || isDeleting) return;

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
        // Se a música deletada estiver tocando, limpa do player
        if (currentTrack && currentTrack.TrackId === trackToDelete.TrackId) {
          loadTrack(null);
        }
        setTrackToDelete(null);
        fetchTracks(); // recarrega a lista da tela
      } else {
        const errorData = await res.json().catch(() => ({}));
        setDeleteError(errorData.ErrorMessage || 'Falha ao excluir a música do sistema.');
      }
    } catch {
      setDeleteError('Erro de conexão ao tentar excluir a música.');
    } finally {
      setIsDeleting(false);
    }
  };


  
  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300">
      
      {/* Banner de Boas-vindas Premium */}
      <div className="bg-gradient-to-r from-brand-hover to-black border border-brand-hover p-8 rounded-lg shadow-xl relative overflow-hidden flex flex-col gap-3">
        <div className="flex items-center gap-2 text-brand-green text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-4 h-4" /> Bem-vindo ao Mixer8
        </div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight m-0 text-white leading-none">
          Música não é estática.{' '}
          <span className="text-brand-green">Sinta cada Stem.</span>
        </h1>
        <p className="text-sm text-brand-gray max-w-[600px] leading-relaxed">
          Isola a voz, remova a bateria, aumente o sintetizador e crie mixagens únicas. Cada música na biblioteca é uma fusão em tempo real de stems separadas por inteligência artificial.
        </p>
        
        {/* Nível do Usuário */}
        <div className="mt-2 self-start px-3 py-1 bg-brand-green/10 border border-brand-green/30 text-brand-green rounded text-xs font-semibold uppercase tracking-wider">
          Nível de Acesso: {CurrentUser?.UserRole}
        </div>
      </div>

      {/* Seletor de layout global para as estantes do Explorar */}
      <div className="flex justify-end items-center -mb-2">
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
            onClick={() => handleLayoutToggle('compact-list')}
            className={`p-1.5 rounded transition-all cursor-pointer ${
              layoutMode === 'compact-list' ? 'bg-brand-green text-black' : 'text-brand-gray hover:text-white'
            }`}
            title="Visualização em Lista Compacta"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tendências da Semana */}
      <ExploreShelf
        title="Tendências da Semana"
        icon={<Flame className="w-5 h-5 text-orange-500 fill-current" />}
        viewAllRoute="/weekly-trends"
        items={tracks}
        type="tracks"
        isLoading={loading}
        layoutMode={layoutMode}
        onTrackContextMenu={(e, track) => {
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            track
          });
        }}
      />

      {/* Playlists Populares */}
      <ExploreShelf
        title="Playlists Populares"
        icon={<ListMusic className="w-5 h-5 text-brand-green" />}
        viewAllRoute="/popular-playlists"
        items={popularPlaylists}
        type="playlists"
        isLoading={loadingPopular}
        layoutMode={layoutMode}
        onToggleSavePlaylist={handleToggleSavePlaylist}
        onPlaylistContextMenu={() => {}}
      />

      {/* MENU DE CONTEXTO EM EXPLORAR */}
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

          {(CurrentUser?.UserRole === 'Admin' || contextMenu.track.UploadedBy === CurrentUser?.UserId) && (
            <>
              <div className="h-[1px] bg-brand-hover my-1" />
              <button
                onClick={() => {
                  setTrackToEdit(contextMenu.track);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-2 rounded text-xs font-semibold hover:bg-brand-hover text-white transition-all cursor-pointer flex items-center gap-2 hover:text-brand-green"
              >
                <Settings className="w-4 h-4 text-brand-green shrink-0" />
                <span>Editar Música</span>
              </button>
              
              {/* Mini sessão de exclusão da plataforma separada por travessão */}
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



      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE MÚSICA (ADMIN) */}
      {trackToDelete && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
          <div className="bg-brand-card border border-brand-hover w-full max-w-md p-6 rounded shadow-2xl flex flex-col gap-4 relative animate-in zoom-in-95 duration-200">
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
                  {CurrentUser?.UserRole === 'Admin' ? 'Ação Destrutiva' : 'Solicitar Exclusão'}
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
                  Esta ação é <strong className="text-red-400">irreversível</strong>. A música será removida permanentemente do banco de dados, seus arquivos físicos de stems (áudio) e capa serão excluídos do servidor, e ela será desassociada de qualquer playlist existente.
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
                onClick={handleConfirmDelete}
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
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
          <div className="bg-brand-card border border-brand-hover w-full max-w-md p-6 rounded shadow-2xl flex flex-col gap-4 relative animate-in zoom-in-95 duration-200">
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
                        fetchTracks();
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

      {/* MODAL DE EDIÇÃO DE MÚSICA (ADMIN) */}
      {trackToEdit && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
          <form 
            onSubmit={handleSaveEdit}
            className="bg-brand-card border border-brand-hover w-full max-w-lg p-6 rounded shadow-2xl flex flex-col gap-4 relative animate-in zoom-in-95 duration-200"
          >
            <button 
              type="button"
              onClick={() => setTrackToEdit(null)}
              className="absolute top-4 right-4 text-brand-gray hover:text-white cursor-pointer"
              disabled={isSaving}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 pr-8">
              <Settings className="w-5 h-5 text-brand-green" />
              <div className="flex flex-col">
                <span className="text-[10px] text-brand-green font-bold uppercase tracking-wider">
                  {CurrentUser?.UserRole === 'Admin' ? 'Painel Administrativo' : 'Minha Música'}
                </span>
                <h3 className="text-sm font-bold text-white">
                  {CurrentUser?.UserRole === 'Admin' ? 'Editar Música e Stems' : 'Editar Metadados da Música'}
                </h3>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto pr-1 flex flex-col gap-4">
              
              {/* Nome e Artista */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">Título da Música</label>
                  <input 
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    required
                    disabled={isSaving}
                    className="w-full bg-black border border-brand-hover rounded p-2 text-xs text-white focus:outline-none focus:border-brand-green"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">Artista / Banda</label>
                  <input 
                    type="text"
                    value={editArtist}
                    onChange={e => setEditArtist(e.target.value)}
                    required
                    disabled={isSaving}
                    className="w-full bg-black border border-brand-hover rounded p-2 text-xs text-white focus:outline-none focus:border-brand-green"
                  />
                </div>
              </div>

              {/* Capa / Imagem */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">Capa da Música</label>
                <div className="flex items-center gap-4 bg-black/40 border border-brand-hover p-3 rounded">
                  <div className="w-16 h-16 bg-black rounded overflow-hidden flex items-center justify-center text-brand-green border border-brand-hover shrink-0">
                    {editCoverPreview ? (
                      <img 
                        src={editCoverPreview} 
                        alt="Capa" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Music className="w-6 h-6" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] text-brand-gray">Selecione um arquivo de imagem (PNG, JPG) para substituir a capa atual.</span>
                    <input 
                      type="file"
                      accept="image/*"
                      disabled={isSaving}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setEditCoverFile(file);
                          setEditCoverPreview(URL.createObjectURL(file));
                          setEditCoverUrl(''); // Limpa a URL se selecionou arquivo físico
                        }
                      }}
                      className="text-xs text-brand-gray file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-bold file:bg-brand-hover file:text-white hover:file:bg-brand-hover/80 file:cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* URL externa opcional */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-brand-gray font-bold uppercase tracking-wider" htmlFor="trackCoverUrl">
                  Ou URL Externa da Imagem
                </label>
                <div className="relative">
                  <input
                    id="trackCoverUrl"
                    type="text"
                    value={editCoverUrl}
                    disabled={isSaving}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditCoverUrl(val);
                      setEditCoverFile(null); // Limpa o arquivo físico se digitou URL
                      if (val) {
                        setEditCoverPreview(val.startsWith('http') || val.startsWith('/') ? (val.startsWith('http') ? val : `${SERVER_URL}${val}`) : val);
                      } else {
                        setEditCoverPreview('');
                      }
                    }}
                    className="w-full bg-black border border-brand-hover rounded py-1.5 px-2 pl-8 text-xs text-white focus:outline-none focus:border-brand-green transition-all"
                    placeholder="https://imagem.com/foto.jpg"
                  />
                  <Image className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-gray" />
                </div>
              </div>

              {/* Privacidade e Visibilidade */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">Visibilidade</label>
                <select
                  value={editVisibility}
                  onChange={e => setEditVisibility(e.target.value)}
                  disabled={isSaving}
                  className="w-full bg-black border border-brand-hover rounded p-2 text-xs text-white focus:outline-none focus:border-brand-green"
                >
                  <option value="Public">Pública</option>
                  <option value="Private">Privada</option>
                  <option value="Unlisted">Não Listada</option>
                </select>
              </div>

              {/* Gerenciamento das Stems Reais (Apenas Admin) */}
              {CurrentUser?.UserRole === 'Admin' && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">Canais de Stems Ativas</label>
                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto border border-brand-hover rounded p-2 bg-black/20">
                      {trackToEdit.Stems && trackToEdit.Stems.length > 0 ? (
                        [...trackToEdit.Stems]
                          .sort((a, b) => {
                            const order = [
                              'Voz',
                              'Vocal',
                              'Bateria',
                              'Baixo',
                              'Guitarra',
                              'Guitarra Solo',
                              'Guitarra Base',
                              'Sopro',
                              'Teclado',
                              'Piano',
                              'Cordas',
                              'Outros',
                              'Metrônomo'
                            ];
                            const indexA = order.indexOf(a.StemType);
                            const indexB = order.indexOf(b.StemType);
                            const valA = a.StemType === 'Vocais' ? 0 : (indexA === -1 ? 999 : indexA);
                            const valB = b.StemType === 'Vocais' ? 0 : (indexB === -1 ? 999 : indexB);
                            return valA - valB;
                          })
                          .map((stem) => {
                          const isDeleted = stemsToDelete.includes(stem.StemId);
                          const isReplaced = stemsToReplace[stem.StemId] !== undefined;

                          return (
                            <div 
                              key={stem.StemId} 
                              className={`flex items-center justify-between p-2 rounded border text-xs transition-colors ${
                                isDeleted 
                                  ? 'bg-red-950/20 border-red-500/30 text-red-300 line-through' 
                                  : isReplaced 
                                    ? 'bg-brand-green/10 border-brand-green/30 text-brand-green'
                                    : 'bg-black/40 border-brand-hover text-white'
                              }`}
                            >
                              <div className="flex flex-col truncate">
                                <span className="font-bold capitalize truncate">{stem.StemType}</span>
                                <span className="text-[10px] text-brand-gray truncate">
                                  {isReplaced ? `Substituindo por: ${stemsToReplace[stem.StemId].name}` : stem.AudioUrl.split('/').pop()}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {/* Substituir arquivo */}
                                {!isDeleted && (
                                  <label className="py-1 px-2 bg-brand-hover text-white font-bold rounded text-[9px] hover:bg-brand-hover/80 transition-colors cursor-pointer select-none">
                                    Substituir
                                    <input 
                                      type="file"
                                      accept="audio/*"
                                      disabled={isSaving}
                                      onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          setStemsToReplace(prev => ({ ...prev, [stem.StemId]: file }));
                                        }
                                      }}
                                      className="hidden"
                                    />
                                  </label>
                                )}

                                {/* Desfazer substituição */}
                                {isReplaced && !isDeleted && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setStemsToReplace(prev => {
                                        const copy = { ...prev };
                                        delete copy[stem.StemId];
                                        return copy;
                                      });
                                    }}
                                    className="py-1 px-2 border border-brand-hover text-brand-gray hover:text-white rounded text-[9px] cursor-pointer"
                                  >
                                    Desfazer
                                  </button>
                                )}

                                {/* Excluir/Restaurar */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isDeleted) {
                                      setStemsToDelete(prev => prev.filter(id => id !== stem.StemId));
                                    } else {
                                      setStemsToDelete(prev => [...prev, stem.StemId]);
                                    }
                                  }}
                                  className={`p-1 rounded cursor-pointer transition-colors ${
                                    isDeleted 
                                      ? 'bg-brand-hover text-brand-gray hover:text-white' 
                                      : 'hover:bg-red-950 hover:text-red-400 text-brand-gray'
                                  }`}
                                  title={isDeleted ? 'Restaurar Stem' : 'Deletar Stem'}
                                >
                                  {isDeleted ? <RefreshCw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-4 text-xs italic text-brand-gray">Nenhuma stem encontrada.</div>
                      )}
                    </div>
                  </div>

                  {/* Adicionar novas stems */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">Adicionar Novas Stems (Áudios ou ZIP)</label>
                    <div className="border border-dashed border-brand-hover rounded p-4 text-center bg-black/20 flex flex-col gap-2">
                      <input 
                        type="file"
                        accept="audio/*,.zip"
                        multiple
                        disabled={isSaving}
                        onChange={e => {
                          const files = Array.from(e.target.files || []);
                          if (files.length > 0) {
                            setNewStemsFiles(prev => [...prev, ...files]);
                          }
                        }}
                        className="text-xs text-brand-gray file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-bold file:bg-brand-hover file:text-white hover:file:bg-brand-hover/80 file:cursor-pointer"
                      />
                      <span className="text-[10px] text-brand-gray">Formatos suportados: MP3, WAV, FLAC, OGG, OPUS, ZIP</span>
                    </div>

                    {newStemsFiles.length > 0 && (
                      <div className="flex flex-col gap-1.5 border border-brand-hover rounded p-2 bg-black/40">
                        <span className="text-[9px] text-brand-green font-bold uppercase tracking-wider">Arquivos adicionais pendentes:</span>
                        <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
                          {newStemsFiles.map((file, idx) => (
                            <div key={idx} className="flex justify-between items-center bg-black p-1.5 rounded text-[10px]">
                              <span className="text-white truncate max-w-[250px]">{file.name}</span>
                              <button
                                type="button"
                                onClick={() => setNewStemsFiles(prev => prev.filter((_, i) => i !== idx))}
                                className="text-red-400 hover:underline text-[9px] font-bold cursor-pointer"
                              >
                                Remover
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {saveError && (
              <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded text-xs text-red-400">
                {saveError}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-2 pt-3 border-t border-brand-hover shrink-0">
              <button
                type="button"
                onClick={() => setTrackToEdit(null)}
                disabled={isSaving}
                className="py-2 px-3 border border-brand-hover rounded text-xs font-semibold text-brand-gray hover:text-white cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="py-2 px-4 bg-brand-green text-black font-bold rounded text-xs hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:hover:scale-100 disabled:active:scale-100"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Salvar Alterações</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

// Redirecionador de /playlist/:id para /playlists/:id para resiliência de links errados
const PlaylistRedirect: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/playlists/${id}`} replace />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <PlayerProvider>
        <PlaylistProvider>
          <Router>
            <PersistentLayout>
              <Routes>
                {/* Rotas Públicas */}
                
                <Route path="/" element={<Explore />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                <Route path="/upload-direto" element={<ProtectedRoute><UploadDireto /></ProtectedRoute>} />
                <Route path="/playlists/:id" element={<PlaylistDetail />} />
                <Route path="/playlists" element={<ProtectedRoute><Playlists /></ProtectedRoute>} />
                <Route path="/weekly-trends" element={<ProtectedRoute><WeeklyTrends /></ProtectedRoute>} />
                <Route path="/popular-playlists" element={<ProtectedRoute><PopularPlaylists /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                <Route path="/daw" element={<ProtectedRoute><DawView /></ProtectedRoute>} />
                <Route path="/playlist/:id" element={<PlaylistRedirect />} />
                
                {/* Perfil Público (ex: /@paiduser) */}
                <Route path="/:username" element={<PublicProfile />} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </PersistentLayout>
          </Router>
        </PlaylistProvider>
      </PlayerProvider>
    </AuthProvider>
  );
};

export default App;
