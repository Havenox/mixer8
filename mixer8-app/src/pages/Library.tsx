import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  UploadCloud, FileAudio, 
  ShieldAlert, AlertTriangle, Plus, Trash2, X, Music, Loader2, Settings, RefreshCw, Image,
  LayoutGrid, List, ArrowLeftRight, Search, Check
} from 'lucide-react';

import { usePlayer } from '../context/PlayerContext';
import { usePlaylists } from '../context/PlaylistContext';
import type { ITrack } from '../context/PlayerContext';
import { TrackListing } from '../components/TrackListing';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

import { API_URL, SERVER_URL } from '../config';
import { createLibraryQueueProvider } from '../utils/queueProviders';

export const Library: React.FC = () => {
  const { CurrentUser, Token } = useAuth();
  const { loadTrack, currentTrack } = usePlayer();
  const { openAddToPlaylist } = usePlaylists();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [tracks, setTracks] = useState<ITrack[]>([]);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>(
    () => (localStorage.getItem('mixer8:layout-preference') as 'grid' | 'list') || 'grid'
  );
  const [isLoadingTracks, setIsLoadingTracks] = useState(true);
  const [error, setError] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; track: ITrack } | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  type VisibilityFilterType = 'all' | 'public' | 'private' | 'unlisted';
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilterType>(() => {
    const saved = localStorage.getItem('mixer8_visibility_filter_library');
    if (saved === 'all' || saved === 'public' || saved === 'private' || saved === 'unlisted') {
      return saved as VisibilityFilterType;
    }
    return 'public';
  });

  const changeVisibilityFilter = (newFilter: VisibilityFilterType) => {
    setVisibilityFilter(newFilter);
    localStorage.setItem('mixer8_visibility_filter_library', newFilter);
  };

  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

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

  const handleRetryExtraction = async (track: ITrack) => {
    try {
      const res = await fetch(`${API_URL}/Tracks/${track.TrackId}/Retry`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Token}`
        }
      });
      if (res.ok) {
        setToastType('success');
        setToastMessage(`Extração da música "${track.TrackTitle}" reiniciada com sucesso!`);
        setShowToast(true);
        fetchTracks(true); // recarrega a lista
      } else {
        const errorData = await res.json().catch(() => ({}));
        setToastType('error');
        setToastMessage(`Falha ao reiniciar extração: ${errorData.ErrorMessage || 'Erro Desconhecido'}`);
        setShowToast(true);
      }
    } catch {
      setToastType('error');
      setToastMessage('Não foi possível conectar com o servidor.');
      setShowToast(true);
    }
  };


  // Controle de Upload de arquivos
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [uploadTab, setUploadTab] = useState<'file' | 'link'>('file');
  const [songName, setSongName] = useState('');
  const [artistName, setArtistName] = useState('');
  const [newTrackId, setNewTrackId] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'warning' | 'error'>('warning');

  // Busca metadados do YouTube/URL automaticamente ao colar o link (com debounce)
  useEffect(() => {
    if (!downloadUrl.trim()) return;

    const isYouTube = downloadUrl.includes('youtube.com') || downloadUrl.includes('youtu.be');
    if (!isYouTube) return;

    const fetchMetadata = async () => {
      try {
        const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(downloadUrl.trim())}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.title) {
            const title = data.title;
            
            // Limpa termos comuns de títulos do YouTube para focar na música/artista
            const cleanTitle = title
              .replace(/\s*[\(\[][Oo]fficial\s*[Vv]ideo[\)\]]/g, '')
              .replace(/\s*[\(\[][Oo]fficial\s*[Aa]udio[\)\]]/g, '')
              .replace(/\s*[\(\[][Oo]fficial\s*[Mm]usic\s*[Vv]ideo[\)\]]/g, '')
              .replace(/\s*[\(\[][Oo]fficial\s*[Ll]yric\s*[Vv]ideo[\)\]]/g, '')
              .replace(/\s*[\(\[][Ll]yric\s*[Vv]ideo[\)\]]/g, '')
              .replace(/\s*[\(\[][Vv]ídeo\s*[Oo]ficial[\)\]]/g, '')
              .replace(/\s*[\(\[][Cc]lipe\s*[Oo]ficial[\)\]]/g, '')
              .replace(/\s*[\(\[][Aa]udio\s*[Oo]ficial[\)\]]/g, '')
              .replace(/\s*[\(\[][Ll]ive[\)\]]/g, '')
              .replace(/\s*[\(\[]HD[\)\]]/g, '')
              .replace(/\s*[\(\[]4[Kk][\)\]]/g, '')
              .trim();
            
            const separators = [' - ', ' – ', ' — ', ' | ', ' |'];
            let parsedArtist = '';
            let parsedSong = '';
            
            for (const sep of separators) {
              if (cleanTitle.includes(sep)) {
                const parts = cleanTitle.split(sep);
                if (parts.length >= 2) {
                  parsedArtist = parts[0].trim();
                  parsedSong = parts.slice(1).join(sep).trim();
                  break;
                }
              }
            }
            
            if (!parsedArtist && !parsedSong) {
              parsedSong = cleanTitle;
              parsedArtist = data.author_name || '';
            }
            
            // Apenas preenche se os inputs correspondentes estiverem vazios (UX amigável)
            if (!songName.trim()) setSongName(parsedSong);
            if (!artistName.trim()) setArtistName(parsedArtist);
          }
        }
      } catch (err) {
        console.error('Falha ao buscar metadados do YouTube:', err);
      }
    };

    const timer = setTimeout(fetchMetadata, 500);
    return () => clearTimeout(timer);
  }, [downloadUrl]);

  const swapSongAndArtist = () => {
    const temp = songName;
    setSongName(artistName);
    setArtistName(temp);
  };


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
      const searchParam = debouncedSearch.trim() ? `&search=${encodeURIComponent(debouncedSearch.trim())}` : '';
      let showAllParam = '&showAll=true';
      let visibilityParam = '';
      if (visibilityFilter === 'public') {
        showAllParam = '&showAll=false';
        visibilityParam = '&visibility=Public';
      } else if (visibilityFilter === 'private') {
        visibilityParam = '&visibility=Private';
      } else if (visibilityFilter === 'unlisted') {
        visibilityParam = '&visibility=Unlisted';
      }
      const res = await fetch(`${API_URL}/Tracks?page=${targetPage}&limit=20${searchParam}${showAllParam}${visibilityParam}`, { headers });
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

        if (data.length < 20) {
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
  }, [Token, debouncedSearch, visibilityFilter]);

  const handleLayoutToggle = (mode: 'grid' | 'list') => {
    setLayoutMode(mode);
    localStorage.setItem('mixer8:layout-preference', mode);
  };

  // Hook de Infinite Scroll reutilizável
  useInfiniteScroll(hasMore, isFetchingMore, isLoadingTracks, () => fetchTracks(false));

  const processingIdsStr = useMemo(() => {
    const idsSet = new Set<string>();
    
    tracks.forEach(t => {
      if (
        t.ExtractionStatus === 'AguardandoDownload' ||
        t.ExtractionStatus.startsWith('Processando')
      ) {
        idsSet.add(t.TrackId);
      }
    });

    if (newTrackId) {
      idsSet.add(newTrackId);
    }

    return Array.from(idsSet).sort().join(',');
  }, [tracks, newTrackId]);

  // 2. Polling do progresso real da conversão do Worker na VPS em segundo plano
  useEffect(() => {
    let interval: any;

    if (processingIdsStr) {
      interval = setInterval(async () => {
        try {
          const headers: Record<string, string> = {};
          if (Token) {
            headers['Authorization'] = `Bearer ${Token}`;
          }
          const res = await fetch(`${API_URL}/Tracks/Status?ids=${processingIdsStr}`, { headers });
          if (res.ok) {
            const data: ITrack[] = await res.json();
            
            setTracks(prev => {
              return prev.map(t => {
                const updated = data.find(ut => ut.TrackId === t.TrackId);
                return updated ? updated : t;
              });
            });
          }
        } catch {
          // Mantém conexão silenciosa
        }
      }, 5000); // Poll a cada 5 segundos
    }

    return () => clearInterval(interval);
  }, [processingIdsStr, Token]);

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
        setTracks(prev => {
          if (prev.some(t => t.TrackId === createdTrack.TrackId)) return prev;
          return [createdTrack, ...prev];
        });
        
        setToastType('success');
        setToastMessage(`Música "${createdTrack.TrackTitle}" enviada com sucesso! O processamento foi iniciado.`);
        setShowToast(true);

        setSelectedFile(null);
        setSongName('');
        setArtistName('');
        setNewTrackId(null);
        setIsUploading(false);
        navigate('/library'); // Fecha o modal imediatamente
      } else {
        const errorData = await res.json();
        setToastType('error');
        setToastMessage(`Falha ao realizar upload: ${errorData.ErrorMessage || 'Erro Desconhecido'}`);
        setShowToast(true);
        setIsUploading(false);
      }
    } catch {
      setToastType('error');
      setToastMessage('Não foi possível conectar com o servidor API.');
      setShowToast(true);
      setIsUploading(false);
    }
  };

  const startUrlImport = async () => {
    if (!downloadUrl.trim() || !Token) return;

    setIsUploading(true);

    try {
      const res = await fetch(`${API_URL}/Tracks/ImportUrl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Token}`
        },
        body: JSON.stringify({
          DownloadUrl: downloadUrl.trim(),
          TrackTitle: songName || 'Sem Título',
          ArtistName: artistName || 'Desconhecido'
        })
      });

      if (res.ok) {
        const createdTrack: ITrack = await res.json();
        setTracks(prev => {
          if (prev.some(t => t.TrackId === createdTrack.TrackId)) return prev;
          return [createdTrack, ...prev];
        });

        setToastType('success');
        setToastMessage(`Solicitação da música "${createdTrack.TrackTitle}" recebida! O download foi enfileirado.`);
        setShowToast(true);

        setDownloadUrl('');
        setSongName('');
        setArtistName('');
        setIsUploading(false);
        navigate('/library'); // Fecha o modal
      } else {
        const errorData = await res.json();
        if (res.status === 409 || errorData.ErrorMessage === 'TRACK_ALREADY_EXISTS') {
          const trackTitle = errorData.TrackTitle || 'Música existente';
          setToastType('warning');
          setToastMessage(`A música "${trackTitle}" já existe na plataforma! Redirecionando para a busca...`);
          setShowToast(true);

          setDownloadUrl('');
          setSongName('');
          setArtistName('');
          setIsUploading(false);
          navigate('/library'); // Fecha o modal de upload

          setSearchInput(downloadUrl.trim());
          setDebouncedSearch(downloadUrl.trim());
        } else {
          setToastType('error');
          setToastMessage(`Falha ao importar link: ${errorData.ErrorMessage || 'Erro Desconhecido'}`);
          setShowToast(true);
          setIsUploading(false);
        }
      }
    } catch {
      setToastType('error');
      setToastMessage('Não foi possível conectar com o servidor API.');
      setShowToast(true);
      setIsUploading(false);
    }
  };

  const libraryQueueProvider = useMemo(() => {
    return createLibraryQueueProvider(API_URL, Token, debouncedSearch, visibilityFilter);
  }, [Token, debouncedSearch, visibilityFilter]);

  const hasAccessToUpload = CurrentUser?.UserRole === 'PaidUser' || CurrentUser?.UserRole === 'Admin';

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300">
      
      {/* Header do Dashboard */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-hover pb-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight m-0 text-white flex items-center gap-2">
            Biblioteca
          </h1>
          <p className="text-sm text-brand-gray">Escolha um áudio completo para ouvir ou gerencie as stems mixáveis.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
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

          {hasAccessToUpload && (
            <button 
              onClick={() => navigate('/library?action=upload')}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-green text-black font-bold text-sm rounded-full hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer shrink-0"
            >
              <UploadCloud className="w-5 h-5" />
              Adicionar Nova Música
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded text-xs text-red-400 flex items-start gap-2 max-w-[500px]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
        {/* Campo de Busca */}
        <div className="relative w-full sm:w-48">
          <input
            type="text"
            placeholder="Buscar..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full bg-transparent border-b border-white/10 focus:border-brand-green/60 py-1 pl-7 pr-6 text-xs text-white placeholder-brand-gray/40 focus:outline-none transition-all"
          />
          <Search className="absolute left-1 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-gray/60" />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-brand-gray hover:text-white cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Filtros de Visibilidade */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: 'public', label: 'Públicas' },
            { id: 'all', label: 'Todas' },
            { id: 'private', label: 'Privadas' },
            { id: 'unlisted', label: 'Não-Listadas' },
          ].map((filter) => {
            const isActive = visibilityFilter === filter.id;
            return (
              <button
                key={filter.id}
                onClick={() => changeVisibilityFilter(filter.id as VisibilityFilterType)}
                className={`py-0.5 px-2.5 rounded-full text-[10px] font-bold transition-all border cursor-pointer select-none ${
                  isActive 
                    ? 'bg-brand-green/10 text-brand-green border-brand-green/30 shadow-md shadow-brand-green/5' 
                    : 'bg-transparent border-white/10 text-brand-gray hover:text-white hover:border-white/25'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Renderizador de Listagem */}
      {tracks.length === 0 && !isLoadingTracks ? (
        <div className="text-xs text-brand-gray font-semibold py-12 text-center bg-brand-card/10 border border-brand-hover border-dashed rounded-lg flex flex-col items-center justify-center gap-3">
          <Music className="w-10 h-10 text-brand-gray/30" />
          <span className="text-white font-bold text-sm">Nenhuma música encontrada</span>
          <span>Tente ajustar seus filtros ou faça uma nova busca.</span>
        </div>
      ) : (
        <TrackListing 
          tracks={tracks}
          layoutMode={layoutMode}
          isLoading={isLoadingTracks}
          isFetchingMore={isFetchingMore}
          showUploaderInfo={CurrentUser?.UserRole === 'Admin'}
          onTrackContextMenu={(e, track) => {
            setContextMenu({ x: e.clientX, y: e.clientY, track });
          }}
          tracksQueue={tracks}
          queueProvider={libraryQueueProvider}
        />
      )}

      {/* MODAL DE UPLOAD */}
      {showUploadSection && (
        <div 
          onClick={() => { if (!isUploading) navigate('/library'); }}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 select-none animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[650px] bg-brand-card border border-brand-hover rounded-lg shadow-2xl p-6 md:p-8 flex flex-col gap-6 relative max-h-[90vh] overflow-y-auto"
          >
            <button 
              onClick={() => { if (!isUploading) navigate('/library'); }}
              className="absolute right-4 top-4 text-brand-gray hover:text-white transition-all cursor-pointer disabled:opacity-30 active:scale-95 flex items-center justify-center w-8 h-8 rounded-full hover:bg-brand-hover/40"
              disabled={isUploading}
              title="Fechar"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            <div className="flex flex-col gap-1 border-b border-brand-hover pb-4">
              <div className="flex items-center gap-2 text-brand-green">
                <UploadCloud className="w-6 h-6" />
                <h2 className="text-lg font-black text-white m-0">Adicionar Nova Música</h2>
              </div>
              <p className="text-xs text-brand-gray">
                Faça o upload do seu áudio ou insira o link da música diretamente do youtube ou youtube músic. Prefira adicionar músicas do tipo "Topic" para maior fidelidade e qualidade de audio.
              </p>
            </div>

            {true ? (
              <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                <div className="flex border-b border-brand-hover">
                  <button
                    disabled={isUploading}
                    onClick={() => {
                      setUploadTab('file');
                      setSongName('');
                      setArtistName('');
                    }}
                    className={`flex-1 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      uploadTab === 'file'
                        ? 'border-brand-green text-white'
                        : 'border-transparent text-brand-gray hover:text-white'
                    }`}
                  >
                    Upload de Arquivo
                  </button>
                  <button
                    disabled={isUploading}
                    onClick={() => {
                      setUploadTab('link');
                      setSongName('');
                      setArtistName('');
                      setDownloadUrl('');
                    }}
                    className={`flex-1 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      uploadTab === 'link'
                        ? 'border-brand-green text-white'
                        : 'border-transparent text-brand-gray hover:text-white'
                    }`}
                  >
                    Link de Mídia (URL)
                  </button>
                </div>

                {uploadTab === 'file' && (
                  <div className="flex flex-col gap-4 animate-in fade-in duration-150">
                    <div className={`border border-dashed border-brand-hover hover:border-brand-green bg-black rounded-lg p-8 flex flex-col items-center justify-center gap-3 transition-colors relative group ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <UploadCloud className="w-12 h-12 text-brand-gray group-hover:text-brand-green transition-colors" />
                      <div className="text-center flex flex-col gap-1">
                        <span className="text-sm font-semibold text-white">Arraste seu arquivo de áudio</span>
                        <span className="text-xs text-brand-gray">Suporta MP3, WAV ou M4A (Max: 50MB)</span>
                      </div>
                      
                      <input 
                        type="file" 
                        accept="audio/*"
                        onChange={handleFileChange}
                        disabled={isUploading}
                        className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
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
                          disabled={isUploading}
                          className="text-xs text-red-400 hover:underline cursor-pointer disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
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
                            disabled={isUploading}
                            className="bg-black border border-brand-hover rounded p-2 text-white focus:outline-none focus:border-brand-green disabled:opacity-50"
                          />
                        </div>
                        <div className="flex flex-col gap-1 text-xs">
                          <label className="font-semibold text-brand-gray">Nome do Artista</label>
                          <input 
                            type="text" 
                            value={artistName}
                            onChange={(e) => setArtistName(e.target.value)}
                            disabled={isUploading}
                            className="bg-black border border-brand-hover rounded p-2 text-white focus:outline-none focus:border-brand-green disabled:opacity-50"
                          />
                        </div>
                      </div>
                    )}

                    <button 
                      onClick={startExtraction}
                      disabled={!selectedFile || isUploading}
                      className="w-full py-3 bg-brand-green text-black font-bold text-sm rounded hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed transition-all mt-2 cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Enviando áudio...</span>
                        </>
                      ) : (
                        <span>Realizar Upload</span>
                      )}
                    </button>
                  </div>
                )}

                {uploadTab === 'link' && (
                  <div className="flex flex-col gap-4 animate-in fade-in duration-150">
                    <div className="flex flex-col gap-1 text-xs">
                      <label className="font-semibold text-brand-gray">Link de Mídia (Youtube ou Youtube Music)</label>
                      <input 
                        type="text" 
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={downloadUrl}
                        onChange={(e) => setDownloadUrl(e.target.value)}
                        disabled={isUploading}
                        className="bg-black border border-brand-hover rounded p-2 text-white focus:outline-none focus:border-brand-green w-full disabled:opacity-50"
                      />
                    </div>

                    <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                      <div className="flex flex-col gap-1 text-xs">
                        <label className="font-semibold text-brand-gray">Nome da Música</label>
                        <input 
                          type="text" 
                          placeholder="Ex: Yesterday"
                          value={songName}
                          onChange={(e) => setSongName(e.target.value)}
                          disabled={isUploading}
                          className="bg-black border border-brand-hover rounded p-2 text-white focus:outline-none focus:border-brand-green w-full disabled:opacity-50"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={swapSongAndArtist}
                        disabled={isUploading}
                        className="p-2 bg-brand-card hover:bg-brand-hover text-brand-gray hover:text-white rounded border border-brand-hover hover:border-brand-green flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer h-[38px] disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Inverter Música e Artista"
                      >
                        <ArrowLeftRight className="w-4 h-4" />
                      </button>
                      <div className="flex flex-col gap-1 text-xs">
                        <label className="font-semibold text-brand-gray">Nome do Artista</label>
                        <input 
                          type="text" 
                          placeholder="Ex: The Beatles"
                          value={artistName}
                          onChange={(e) => setArtistName(e.target.value)}
                          disabled={isUploading}
                          className="bg-black border border-brand-hover rounded p-2 text-white focus:outline-none focus:border-brand-green w-full disabled:opacity-50"
                        />
                      </div>
                    </div>

                    <button 
                      onClick={startUrlImport}
                      disabled={!downloadUrl.trim() || !songName.trim() || !artistName.trim() || isUploading}
                      className="w-full py-3 bg-brand-green text-black font-bold text-sm rounded hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed transition-all mt-2 cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Processando solicitação...</span>
                        </>
                      ) : (
                        <span>Solicitar Download</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ) : null}

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
          {CurrentUser?.UserRole === 'Admin' && contextMenu.track.ExtractionStatus === 'Falhou' && (
            <>
              <button
                onClick={() => {
                  handleRetryExtraction(contextMenu.track);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-2 rounded text-xs font-semibold hover:bg-brand-hover text-white transition-all cursor-pointer flex items-center gap-2 hover:text-brand-green"
              >
                <RefreshCw className="w-4 h-4 text-brand-green shrink-0" />
                <span>Reprocessar Extração</span>
              </button>
              <div className="h-[1px] bg-brand-hover my-1" />
            </>
          )}

          {(contextMenu.track.ExtractionStatus === 'Pronto' || contextMenu.track.ExtractionStatus.startsWith('Processando') || contextMenu.track.ExtractionStatus === 'Falhou') && (
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
              {(contextMenu.track.ExtractionStatus === 'Pronto' || contextMenu.track.ExtractionStatus.startsWith('Processando') || contextMenu.track.ExtractionStatus === 'Falhou') && (
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
        <div 
          onClick={() => { if (!isDeleting) setTrackToDelete(null); }}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200"
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="bg-brand-card border border-brand-hover w-full max-w-md p-6 rounded shadow-2xl flex flex-col gap-4 relative animate-in zoom-in-95 duration-200"
          >
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
        <div 
          onClick={() => { if (!isSaving) setTrackToEdit(null); }}
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200"
        >
          <form 
            onClick={e => e.stopPropagation()}
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

      {/* Toast Notificação */}
      {showToast && (
        <div 
          className={`fixed bottom-20 md:bottom-28 right-4 md:right-8 px-4.5 py-3 rounded-lg shadow-2xl flex items-center gap-2.5 font-bold text-xs z-[200] animate-in slide-in-from-bottom duration-300 select-none border ${
            toastType === 'success' 
              ? 'bg-brand-green text-black border-brand-green/20' 
              : toastType === 'error'
              ? 'bg-red-500 text-white border-red-600/20'
              : 'bg-amber-400 text-black border-amber-500/20'
          }`}
        >
          {toastType === 'success' && <Check className="w-4 h-4 shrink-0" />}
          {toastType === 'error' && <AlertTriangle className="w-4 h-4 shrink-0" />}
          {toastType === 'warning' && <ShieldAlert className="w-4 h-4 shrink-0" />}
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
};
