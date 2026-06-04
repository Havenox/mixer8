import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Play, UploadCloud, CheckCircle, Clock, FileAudio, 
  Sparkles, ShieldAlert, Disc, AlertTriangle, Plus, Trash2, X, Music, Loader2, Settings, RefreshCw, Image, Info
} from 'lucide-react';

import { usePlayer } from '../context/PlayerContext';
import { usePlaylists } from '../context/PlaylistContext';
import type { ITrack } from '../context/PlayerContext';

import { API_URL, SERVER_URL } from '../config';

export const Dashboard: React.FC = () => {
  const { CurrentUser, Token } = useAuth();
  const { loadTrack, currentTrack } = usePlayer();
  const { openAddToPlaylist } = usePlaylists();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [tracks, setTracks] = useState<ITrack[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(true);
  const [error, setError] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; track: ITrack } | null>(null);

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
        fetchTracks(true); // Recarrega o grid da tela
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

  // Gerenciador do timer de contagem regressiva para exclusão física (Admin)
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
        fetchTracks(true); // recarrega a lista da tela
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


  // Controle de Upload de arquivos
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [songName, setSongName] = useState('');
  const [artistName, setArtistName] = useState('');
  const [newTrackId, setNewTrackId] = useState<string | null>(null);

  // Verifica se a URL contém ?action=upload para abrir o modal
  const showUploadSection = new URLSearchParams(location.search).get('action') === 'upload';

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  // 1. Carrega as músicas reais do banco de dados PostgreSQL com paginação 10-por-10
  const fetchTracks = async (resetPage = false) => {
    const targetPage = resetPage ? 1 : page;
    if (resetPage) {
      setIsLoadingTracks(true);
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
      const res = await fetch(`${API_URL}/Tracks?page=${targetPage}&limit=10`, { headers });
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
      setIsLoadingTracks(false);
      setIsFetchingMore(false);
    }
  };

  useEffect(() => {
    fetchTracks(true);
  }, [Token]);

  // Monitora o scroll do container de PersistentLayout (.overflow-y-auto) para scroll infinito
  useEffect(() => {
    const handleScroll = () => {
      const scrollContainer = document.querySelector('.overflow-y-auto');
      if (!scrollContainer) return;

      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      if (scrollHeight - scrollTop - clientHeight < 100 && hasMore && !isFetchingMore && !isLoadingTracks) {
        fetchTracks(false);
      }
    };

    const scrollContainer = document.querySelector('.overflow-y-auto');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, [hasMore, isFetchingMore, isLoadingTracks, page]);

  // Preenche a tela automaticamente caso a resolução seja grande e não gere scrollbar
  useEffect(() => {
    if (!hasMore || isFetchingMore || isLoadingTracks) return;

    const checkAndFillPage = () => {
      const scrollContainer = document.querySelector('.overflow-y-auto');
      if (!scrollContainer) return;

      const { scrollHeight, clientHeight } = scrollContainer;
      if (scrollHeight > 0 && scrollHeight <= clientHeight + 50) {
        fetchTracks(false);
      }
    };

    // Delay de 300ms para permitir render completo do grid e imagens
    const timer = setTimeout(checkAndFillPage, 300);

    // Adiciona listener de redimensionamento da janela
    window.addEventListener('resize', checkAndFillPage);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkAndFillPage);
    };
  }, [tracks, hasMore, isFetchingMore, isLoadingTracks]);

  // 2. Pooling do progresso real da conversão do Worker na VPS
  useEffect(() => {
    let interval: any;

    if (newTrackId) {
      interval = setInterval(async () => {
        try {
          const headers: Record<string, string> = {};
          if (Token) {
            headers['Authorization'] = `Bearer ${Token}`;
          }
          const res = await fetch(`${API_URL}/Tracks`, { headers });
          if (res.ok) {
            const data: ITrack[] = await res.json();
            setTracks(data);

            const uploadedTrack = data.find(t => t.TrackId === newTrackId);
            if (uploadedTrack) {
              // Adiciona atualização do log se o status mudou
              setUploadProgress(prev => {
                const currentStatus = `[WORKER STATUS] ${uploadedTrack.ExtractionStatus}`;
                if (prev.length === 0 || prev[prev.length - 1] !== currentStatus) {
                  return [...prev, currentStatus];
                }
                return prev;
              });

              if (uploadedTrack.ExtractionStatus === 'Pronto') {
                setUploadProgress(prev => [...prev, `🟢 [SUCESSO] Extrator finalizou o processamento de stems! Pronta para mixar.`]);
                setTimeout(() => {
                  setIsUploading(false);
                  setSelectedFile(null);
                  setSongName('');
                  setArtistName('');
                  setNewTrackId(null);
                  navigate('/dashboard'); // Fecha o modal
                }, 3000);
              } else if (uploadedTrack.ExtractionStatus === 'Falhou') {
                setUploadProgress(prev => [...prev, `🔴 [ERRO] Ocorreu uma falha no processamento do Bot na VPS.`]);
                setTimeout(() => {
                  setIsUploading(false);
                  setNewTrackId(null);
                }, 4000);
              }
            }
          }
        } catch {
          // Mantém conexão silenciosa
        }
      }, 3000); // Poll a cada 3 segundos
    }

    return () => clearInterval(interval);
  }, [newTrackId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      const parts = nameWithoutExt.split('-');
      if (parts.length > 1) {
        setArtistName(parts[0].trim());
        setSongName(parts[1].trim());
      } else {
        setSongName(nameWithoutExt);
      }
    }
  };

  // 3. Envia o arquivo real multipart para a API C#
  const startExtraction = async () => {
    if (!selectedFile || !Token) return;

    setIsUploading(true);
    setUploadProgress([`[API] Enviando arquivo físico de áudio para a API do Mixer8...`]);

    const formData = new FormData();
    formData.append('File', selectedFile);
    formData.append('TrackTitle', songName || 'Sem Título');
    formData.append('ArtistName', artistName || 'Desconhecido');

    try {
      const res = await fetch(`${API_URL}/Tracks/Upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Token}`
        },
        body: formData
      });

      if (res.ok) {
        const createdTrack: ITrack = await res.json();
        setNewTrackId(createdTrack.TrackId);
        setUploadProgress(prev => [
          ...prev, 
          `[API OK] Arquivo gravado no disco com ID: ${createdTrack.TrackId}`,
          `[FILA] Música adicionada na fila de processamento PostgreSQL.`,
          `[FILA] Aguardando o bot na VPS Linux capturar a tarefa ( SKIP LOCKED )...`
        ]);
      } else {
        const errorData = await res.json();
        setUploadProgress(prev => [...prev, `[ERRO API] Falha ao realizar upload: ${errorData.ErrorMessage || 'Erro Desconhecido'}`]);
        setTimeout(() => setIsUploading(false), 4000);
      }
    } catch {
      setUploadProgress(prev => [...prev, `[ERRO DE CONEXÃO] Não foi possível conectar com o servidor API.`]);
      setTimeout(() => setIsUploading(false), 4000);
    }
  };

  const hasAccessToUpload = CurrentUser?.UserRole === 'PaidUser' || CurrentUser?.UserRole === 'Admin';

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300">
      
      {/* Header do Dashboard */}
      <div className="flex items-center justify-between border-b border-brand-hover pb-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight m-0 text-white flex items-center gap-2">
            Biblioteca
          </h1>
          <p className="text-sm text-brand-gray">Escolha um áudio completo para ouvir ou gerencie as stems mixáveis.</p>
        </div>
        
        {hasAccessToUpload && (
          <button 
            onClick={() => navigate('/dashboard?action=upload')}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-green text-black font-bold text-sm rounded-full hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer"
          >
            <UploadCloud className="w-5 h-5" />
            Nova Extração de Stems
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded text-xs text-red-400 flex items-start gap-2 max-w-[500px]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid de Tracks */}
      {isLoadingTracks ? (
        <div className="text-xs text-brand-gray animate-pulse font-semibold">
          Carregando...
        </div>
      ) : tracks.length === 0 ? (
        <div className="text-xs text-brand-gray font-semibold">
          Nenhuma música disponível. Faça um upload para extrair as stems!
        </div>
      ) : (
        <div className="flex flex-col gap-6 select-none w-full animate-in fade-in duration-300">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,220px))] gap-4">
            {tracks.map((track) => (
              <div 
                key={track.TrackId} 
                className="bg-brand-card border border-brand-hover p-4 rounded-md hover:bg-brand-hover group transition-all relative cursor-pointer"
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    track
                  });
                }}
              >
                {/* Botão rápido de adicionar à playlist no hover */}
                {track.ExtractionStatus === 'Pronto' && (
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
                    <Disc className="w-16 h-16 text-brand-green/20 group-hover:text-brand-green/40 transition-colors" />
                  )}
                  <button 
                    disabled={track.ExtractionStatus !== 'Pronto'}
                    onClick={() => loadTrack(track, undefined, undefined, tracks)}
                    className="absolute w-12 h-12 rounded-full bg-brand-green text-black flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 hover:scale-105 transition-all shadow-lg duration-250 cursor-pointer disabled:opacity-30 disabled:scale-100"
                  >
                    <Play className="w-6 h-6 fill-current translate-x-[1px]" />
                  </button>
                </div>

                <div className="flex flex-col gap-1 mb-2">
                  <span className="font-bold text-sm text-white truncate">{track.TrackTitle}</span>
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="text-xs text-brand-gray truncate">{track.ArtistName}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {track.DeletionPending && (
                        <div className="relative group/tooltip flex items-center gap-1 select-none">
                          <span className="text-[8px] bg-red-950/60 text-red-400 border border-red-900/50 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">
                            Marcado pra Excluir
                          </span>
                          {CurrentUser?.UserRole === 'Admin' && track.DeletionReason && (
                            <>
                              <Info className="w-3.5 h-3.5 text-red-400/80 hover:text-red-400 cursor-pointer shrink-0" />
                              <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-brand-card border border-brand-hover text-[10px] text-brand-gray rounded shadow-2xl invisible group-hover/tooltip:visible opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 z-50 pointer-events-none leading-relaxed normal-case text-left font-normal">
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
                          <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-brand-card border border-brand-hover text-[10px] text-brand-gray rounded shadow-2xl invisible group-hover/tooltip:visible opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 z-50 pointer-events-none leading-relaxed font-normal normal-case text-left font-normal">
                            Essa musica é privada e só aparece para quem fez o upload dela.
                          </div>
                        </div>
                      )}
                      {track.Visibility === 'Unlisted' && (
                        <div className="relative group/tooltip flex items-center gap-1 select-none">
                          <span className="text-[8px] bg-yellow-950/40 text-yellow-500 border border-yellow-900/30 px-1 py-0.5 rounded font-bold uppercase tracking-wider">
                            Não Listada
                          </span>
                          <Info className="w-3 h-3 text-yellow-500/80 hover:text-yellow-500 cursor-pointer shrink-0" />
                          <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-brand-card border border-brand-hover text-[10px] text-brand-gray rounded shadow-2xl invisible group-hover/tooltip:visible opacity-0 group-hover/tooltip:opacity-100 transition-all duration-200 z-50 pointer-events-none leading-relaxed font-normal normal-case text-left font-normal">
                            Essa musica só aparece para quem fez o upload dela, pra quem é dono da playlist e pra quem é colaborador da playlist, e nao aparecerá pro resto do publico.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-brand-hover text-[10px] font-bold">
                  <span className="text-brand-gray uppercase">Stems: {track.Stems?.length || 0} faixas</span>
                  
                  {track.ExtractionStatus === 'Pronto' ? (
                    <span className="text-brand-green flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> MIX PRONTO
                    </span>
                  ) : track.ExtractionStatus.startsWith('Processando') ? (
                    <span className="text-yellow-500 flex items-center gap-1 animate-pulse">
                      <Clock className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} /> EXTRAINDO
                    </span>
                  ) : track.ExtractionStatus === 'Falhou' ? (
                    <span className="text-red-400">FALHOU</span>
                  ) : (
                    <span className="text-brand-gray flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> AGUARDANDO
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {isFetchingMore && (
            <div className="flex items-center justify-center gap-2 text-xs text-brand-gray py-4">
              <Loader2 className="w-5 h-5 animate-spin text-brand-green animate-infinite" />
              <span>Carregando mais faixas...</span>
            </div>
          )}
        </div>
      )}

      {/* MODAL DE UPLOAD / SIMULADOR DO PLAYWRIGHT Headless */}
      {showUploadSection && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 select-none animate-in fade-in duration-200">
          
          <div className="w-full max-w-[650px] bg-brand-card border border-brand-hover rounded-lg shadow-2xl p-6 md:p-8 flex flex-col gap-6 relative max-h-[90vh] overflow-y-auto">
            
            <button 
              onClick={() => { if (!isUploading) navigate('/dashboard'); }}
              className="absolute right-4 top-4 text-brand-gray hover:text-white transition-colors font-bold text-sm cursor-pointer disabled:opacity-30"
              disabled={isUploading}
            >
              Fechar
            </button>

            <div className="flex flex-col gap-1 border-b border-brand-hover pb-4">
              <div className="flex items-center gap-2 text-brand-green">
                <Sparkles className="w-6 h-6" />
                <h2 className="text-lg font-black text-white m-0">Separador de Stems Inteligente</h2>
              </div>
              <p className="text-xs text-brand-gray">
                Faça o upload do seu áudio. O nosso robô headless do .NET 10 logará de forma autônoma na plataforma de stems via cookies, enviará o arquivo, processará a separação de 5 faixas e salvará na VPS.
              </p>
            </div>

            {!isUploading ? (
              <div className="flex flex-col gap-4">
                <div className="border border-dashed border-brand-hover hover:border-brand-green bg-black rounded-lg p-8 flex flex-col items-center justify-center gap-3 transition-colors relative group">
                  <UploadCloud className="w-12 h-12 text-brand-gray group-hover:text-brand-green transition-colors" />
                  <div className="text-center flex flex-col gap-1">
                    <span className="text-sm font-semibold text-white">Arraste seu arquivo de áudio</span>
                    <span className="text-xs text-brand-gray">Suporta MP3, WAV ou M4A (Max: 50MB)</span>
                  </div>
                  
                  <input 
                    type="file" 
                    accept="audio/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>

                {selectedFile && (
                  <div className="bg-brand-hover/40 border border-brand-hover p-4 rounded flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileAudio className="w-8 h-8 text-brand-green" />
                      <div className="flex flex-col text-xs text-brand-gray">
                        <span className="font-bold text-white truncate max-w-[280px]">{selectedFile.name}</span>
                        <span>{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => setSelectedFile(null)}
                      className="text-xs text-red-400 hover:underline cursor-pointer"
                    >
                      Remover
                    </button>
                  </div>
                )}

                {selectedFile && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1 text-xs">
                      <label className="font-semibold text-brand-gray">Nome da Música</label>
                      <input 
                        type="text" 
                        value={songName}
                        onChange={(e) => setSongName(e.target.value)}
                        className="bg-black border border-brand-hover rounded p-2 text-white focus:outline-none focus:border-brand-green"
                      />
                    </div>
                    <div className="flex flex-col gap-1 text-xs">
                      <label className="font-semibold text-brand-gray">Nome do Artista</label>
                      <input 
                        type="text" 
                        value={artistName}
                        onChange={(e) => setArtistName(e.target.value)}
                        className="bg-black border border-brand-hover rounded p-2 text-white focus:outline-none focus:border-brand-green"
                      />
                    </div>
                  </div>
                )}

                <button 
                  onClick={startExtraction}
                  disabled={!selectedFile}
                  className="w-full py-3 bg-brand-green text-black font-bold text-sm rounded hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed transition-all mt-2 cursor-pointer"
                >
                  Iniciar Extração Headless (5 Stems)
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-ping" />
                    Robô Executando Fluxo de Navegação...
                  </span>
                  <span className="text-brand-gray">
                    Extração em Andamento
                  </span>
                </div>

                <div className="bg-black border border-brand-hover rounded p-4 font-mono text-[10px] text-brand-gray h-64 overflow-y-auto flex flex-col gap-1 shadow-inner">
                  {uploadProgress.map((log, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <span className="text-brand-green select-none">❯</span>
                      <span className={log.startsWith('[API OK]') || log.startsWith('🟢') ? 'text-brand-green font-bold' : log.startsWith('🔴') ? 'text-red-400 font-bold' : 'text-spotify-gray/90'}>
                        {log}
                      </span>
                    </div>
                  ))}
                  {!uploadProgress.some(l => l.includes('🟢') || l.includes('🔴')) && (
                    <div className="flex gap-2 items-center text-white font-bold animate-pulse mt-1">
                      <span className="text-brand-green select-none">❯</span>
                      <span>Aguardando próxima atualização do Banco de Dados...</span>
                    </div>
                  )}
                </div>

                <div className="bg-brand-hover/20 border border-brand-hover p-3 rounded text-[10px] text-brand-gray flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-brand-green shrink-0" />
                  <span>Não feche esta página. O processo de separação é persistido no PostgreSQL e processado pelo worker.</span>
                </div>
              </div>
            )}

          </div>

        </div>
      )}

      {/* MENU DE CONTEXTO PREMIUM (Botão Direito) */}
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
                        fetchTracks(true);
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
