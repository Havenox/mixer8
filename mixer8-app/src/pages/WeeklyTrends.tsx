import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ITrack } from '../context/PlayerContext';
import { usePlaylists } from '../context/PlaylistContext';
import { 
  Flame, LayoutGrid, List, ArrowLeft, AlertTriangle, Plus, Settings, Trash2, X, Music, ShieldAlert
} from 'lucide-react';
import { TrackListing } from '../components/TrackListing';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { API_URL, SERVER_URL } from '../config';

export const WeeklyTrends: React.FC = () => {
  const { CurrentUser, Token } = useAuth();
  const { openAddToPlaylist } = usePlaylists();
  const navigate = useNavigate();

  const [tracks, setTracks] = useState<ITrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>(
    () => (localStorage.getItem('mixer8:layout-preference') as 'grid' | 'list') || 'grid'
  );

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; track: ITrack } | null>(null);

  // Modais de exclusão e edição
  const [trackToDelete, setTrackToDelete] = useState<ITrack | null>(null);
  const [trackToReview, setTrackToReview] = useState<ITrack | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState(3);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deletionReasonInput, setDeletionReasonInput] = useState('');

  // Edição
  const [trackToEdit, setTrackToEdit] = useState<ITrack | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverUrl, setEditCoverUrl] = useState('');
  const [editVisibility, setEditVisibility] = useState('Public');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Fechar menu de contexto
  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const handleLayoutToggle = (mode: 'grid' | 'list') => {
    setLayoutMode(mode);
    localStorage.setItem('mixer8:layout-preference', mode);
  };

  const fetchTrends = async (resetPage = false) => {
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
      const res = await fetch(`${API_URL}/Tracks/WeeklyTrends?page=${targetPage}&limit=10`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (resetPage) {
          setTracks(data);
        } else {
          setTracks(prev => {
            const existingIds = new Set(prev.map(t => t.TrackId));
            const newTracks = data.filter((t: any) => !existingIds.has(t.TrackId));
            return [...prev, ...newTracks];
          });
        }

        if (data.length < 10) {
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
    fetchTrends(true);
  }, [Token]);

  // Hook de Infinite Scroll reutilizável
  useInfiniteScroll(hasMore, isFetchingMore, isLoading, () => fetchTrends(false));

  // CRUD e Moderação Lógicas
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
        headers: { 'Authorization': `Bearer ${Token}` }
      });

      if (res.ok) {
        setTrackToDelete(null);
        fetchTrends(true);
      } else {
        const errorData = await res.json().catch(() => ({}));
        setDeleteError(errorData.ErrorMessage || 'Falha ao excluir a música.');
      }
    } catch {
      setDeleteError('Erro de conexão ao tentar excluir.');
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (trackToEdit) {
      setEditTitle(trackToEdit.TrackTitle);
      setEditArtist(trackToEdit.ArtistName);
      setEditCoverFile(null);
      setEditCoverUrl(trackToEdit.CoverUrl || '');
      setEditVisibility(trackToEdit.Visibility || 'Public');
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

      const res = await fetch(`${API_URL}/Tracks/${trackToEdit.TrackId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${Token}` },
        body: formData
      });

      if (res.ok) {
        setTrackToEdit(null);
        fetchTrends(true);
      } else {
        const errorData = await res.json().catch(() => ({}));
        setSaveError(errorData.ErrorMessage || 'Falha ao salvar as alterações da música.');
      }
    } catch {
      setSaveError('Erro de conexão ao tentar salvar.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 select-none animate-in fade-in duration-300">
      
      {/* Cabeçalho */}
      <div className="flex justify-between items-center border-b border-brand-hover pb-5">
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
              <Flame className="w-8 h-8 text-orange-500 fill-current" /> Tendências da Semana
            </h1>
            <p className="text-sm text-brand-gray">As faixas mais executadas no Mixer8 nos últimos 7 dias.</p>
          </div>
        </div>

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
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded text-xs text-red-400 flex items-start gap-2 max-w-[500px]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Renderizador de Listagem */}
      <TrackListing 
        tracks={tracks}
        layoutMode={layoutMode}
        isLoading={isLoading}
        isFetchingMore={isFetchingMore}
        showUploaderInfo={CurrentUser?.UserRole === 'Admin'}
        onTrackContextMenu={(e, track) => {
          setContextMenu({ x: e.clientX, y: e.clientY, track });
        }}
      />

      {/* MENU DE CONTEXTO */}
      {contextMenu && (
        <div 
          className="fixed bg-brand-card border border-brand-hover p-1 rounded shadow-2xl z-[90] flex flex-col min-w-[170px] animate-in fade-in duration-100"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={e => e.stopPropagation()}
        >
          {contextMenu.track.ExtractionStatus === 'Pronto' && (
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
          )}

          {(CurrentUser?.UserRole === 'Admin' || contextMenu.track.UploadedBy === CurrentUser?.UserId) && (
            <>
              {contextMenu.track.ExtractionStatus === 'Pronto' && (
                <div className="h-[1px] bg-brand-hover my-1" />
              )}
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

      {/* MODAIS (EDITAR/EXCLUIR/REVISAR) */}
      {trackToDelete && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
          <div className="bg-brand-card border border-brand-hover w-full max-w-md p-6 rounded shadow-2xl flex flex-col gap-4 relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setTrackToDelete(null)} className="absolute top-4 right-4 text-brand-gray hover:text-white cursor-pointer">
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
                  <img src={trackToDelete.CoverUrl.startsWith('http') ? trackToDelete.CoverUrl : `${SERVER_URL}${trackToDelete.CoverUrl}`} alt="Capa" className="w-full h-full object-cover" />
                ) : <Music className="w-5 h-5" />}
              </div>
              <div className="flex flex-col truncate">
                <span className="font-bold text-white text-sm truncate">{trackToDelete.TrackTitle}</span>
                <span className="text-xs text-brand-gray truncate">{trackToDelete.ArtistName}</span>
              </div>
            </div>
            {CurrentUser?.UserRole !== 'Admin' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">Motivo da Exclusão</label>
                <textarea value={deletionReasonInput} onChange={e => setDeletionReasonInput(e.target.value)} placeholder="Ex: Direitos autorais..." className="w-full bg-black border border-brand-hover rounded p-2 text-xs text-white focus:outline-none focus:border-brand-green h-16 resize-none" />
              </div>
            )}
            {deleteError && <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded text-xs text-red-400">{deleteError}</div>}
            <div className="flex justify-end gap-3 mt-2 pt-3 border-t border-brand-hover">
              <button onClick={() => setTrackToDelete(null)} className="py-2 px-3 border border-brand-hover rounded text-xs font-semibold text-brand-gray hover:text-white cursor-pointer">Cancelar</button>
              <button onClick={handleConfirmDelete} disabled={deleteCountdown > 0 || isDeleting} className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded text-xs hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50">
                {isDeleting ? 'Processando...' : deleteCountdown > 0 ? `Confirmar (${deleteCountdown}s)` : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {trackToReview && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
          <div className="bg-brand-card border border-brand-hover w-full max-w-md p-6 rounded shadow-2xl flex flex-col gap-4 relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setTrackToReview(null)} className="absolute top-4 right-4 text-brand-gray hover:text-white cursor-pointer">
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
                  <img src={trackToReview.CoverUrl.startsWith('http') ? trackToReview.CoverUrl : `${SERVER_URL}${trackToReview.CoverUrl}`} alt="Capa" className="w-full h-full object-cover" />
                ) : <Music className="w-5 h-5" />}
              </div>
              <div className="flex flex-col truncate">
                <span className="font-bold text-white text-sm truncate">{trackToReview.TrackTitle}</span>
                <span className="text-xs text-brand-gray truncate">{trackToReview.ArtistName}</span>
                {(trackToReview.UploadedByUserName || trackToReview.UploadedByEmail) && (
                  <span className="text-[10px] text-brand-gray/70 truncate mt-0.5">
                    Uploader: {trackToReview.UploadedByUserName ? `@${trackToReview.UploadedByUserName}` : ''} {trackToReview.UploadedByEmail ? `(${trackToReview.UploadedByEmail})` : ''}
                  </span>
                )}
              </div>
            </div>
            <div className="bg-red-950/20 border border-red-900/30 p-4 rounded flex flex-col gap-1.5">
              <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Justificativa do Solicitante</span>
              <p className="text-xs text-white leading-relaxed m-0 italic">"{trackToReview.DeletionReason || "Nenhum motivo informado pelo usuário."}"</p>
            </div>
            {deleteError && <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded text-xs text-red-400">{deleteError}</div>}
            <div className="flex justify-between gap-3 mt-2 pt-3 border-t border-brand-hover">
              <button onClick={() => setTrackToReview(null)} className="py-2 px-3 border border-brand-hover rounded text-xs font-semibold text-brand-gray hover:text-white cursor-pointer">Voltar</button>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      const res = await fetch(`${API_URL}/Tracks/${trackToReview.TrackId}/Restore`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${Token}` }
                      });
                      if (res.ok) {
                        setTrackToReview(null);
                        fetchTrends(true);
                      }
                    } catch {
                      setError('Erro de conexão.');
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                  className="py-2 px-3 bg-brand-green text-black font-bold rounded text-xs cursor-pointer hover:scale-105 active:scale-95 transition-all"
                >
                  Manter Ativa (Restaurar)
                </button>
                <button
                  onClick={() => {
                    setTrackToDelete(trackToReview);
                    setTrackToReview(null);
                  }}
                  className="py-2 px-3 bg-red-600 text-white font-bold rounded text-xs cursor-pointer hover:bg-red-700 hover:scale-105 active:scale-95 transition-all"
                >
                  Confirmar Exclusão
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {trackToEdit && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
          <form onSubmit={handleSaveEdit} className="bg-brand-card border border-brand-hover w-full max-w-lg p-6 rounded shadow-2xl flex flex-col gap-4 relative animate-in zoom-in-95 duration-200">
            <button type="button" onClick={() => setTrackToEdit(null)} className="absolute top-4 right-4 text-brand-gray hover:text-white cursor-pointer">
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-brand-green" />
              <h3 className="text-sm font-bold text-white">Editar Música</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">Título da Música</label>
                <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} required className="w-full bg-black border border-brand-hover rounded p-2 text-xs text-white focus:outline-none focus:border-brand-green" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">Artista / Banda</label>
                <input type="text" value={editArtist} onChange={e => setEditArtist(e.target.value)} required className="w-full bg-black border border-brand-hover rounded p-2 text-xs text-white focus:outline-none focus:border-brand-green" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">URL Externa da Capa</label>
              <input type="text" value={editCoverUrl} onChange={e => setEditCoverUrl(e.target.value)} className="w-full bg-black border border-brand-hover rounded p-2 text-xs text-white focus:outline-none focus:border-brand-green" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">Visibilidade</label>
              <select value={editVisibility} onChange={e => setEditVisibility(e.target.value)} className="w-full bg-black border border-brand-hover rounded p-2 text-xs text-white focus:outline-none focus:border-brand-green">
                <option value="Public">Pública</option>
                <option value="Private">Privada</option>
                <option value="Unlisted">Não Listada</option>
              </select>
            </div>
            {saveError && <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded text-xs text-red-400">{saveError}</div>}
            <div className="flex justify-end gap-3 mt-2">
              <button type="button" onClick={() => setTrackToEdit(null)} className="py-2 px-3 border border-brand-hover rounded text-xs text-brand-gray hover:text-white cursor-pointer">Cancelar</button>
              <button type="submit" disabled={isSaving} className="py-2 px-4 bg-brand-green text-black font-bold rounded text-xs hover:scale-105 active:scale-95 transition-all cursor-pointer">
                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
