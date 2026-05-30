import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Play, UploadCloud, CheckCircle, Clock, FileAudio, 
  Sparkles, ShieldAlert, Disc, AlertTriangle
} from 'lucide-react';

import { usePlayer } from '../context/PlayerContext';
import type { ITrack } from '../context/PlayerContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SERVER_URL = API_URL.replace('/api', '');

export const Dashboard: React.FC = () => {
  const { CurrentUser, Token } = useAuth();
  const { loadTrack } = usePlayer();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [tracks, setTracks] = useState<ITrack[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(true);
  const [error, setError] = useState('');

  // Controle de Upload de arquivos
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [songName, setSongName] = useState('');
  const [artistName, setArtistName] = useState('');
  const [newTrackId, setNewTrackId] = useState<string | null>(null);

  // Verifica se a URL contém ?action=upload para abrir o modal
  const showUploadSection = new URLSearchParams(location.search).get('action') === 'upload';

  // 1. Carrega as músicas reais do banco de dados PostgreSQL
  const fetchTracks = async () => {
    try {
      const res = await fetch(`${API_URL}/Tracks`);
      if (res.ok) {
        const data = await res.json();
        setTracks(data);
      }
    } catch {
      setError('Falha ao conectar com o banco de dados principal.');
    } finally {
      setIsLoadingTracks(false);
    }
  };

  useEffect(() => {
    fetchTracks();
  }, []);

  // 2. Pooling do progresso real da conversão do Worker na VPS
  useEffect(() => {
    let interval: any;

    if (newTrackId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_URL}/Tracks`);
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
            Minha Biblioteca
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
          Carregando músicas do PostgreSQL...
        </div>
      ) : tracks.length === 0 ? (
        <div className="text-xs text-brand-gray font-semibold">
          Nenhuma música disponível. Faça um upload para extrair as stems!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 select-none">
          {tracks.map((track) => (
            <div 
              key={track.TrackId} 
              className="bg-brand-card border border-brand-hover p-4 rounded-md hover:bg-brand-hover group transition-all relative"
            >
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
                  onClick={() => loadTrack(track)}
                  className="absolute w-12 h-12 rounded-full bg-brand-green text-black flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 hover:scale-105 transition-all shadow-lg duration-250 cursor-pointer disabled:opacity-30 disabled:scale-100"
                >
                  <Play className="w-6 h-6 fill-current translate-x-[1px]" />
                </button>
              </div>

              <div className="flex flex-col gap-1 mb-2">
                <span className="font-bold text-sm text-white truncate">{track.TrackTitle}</span>
                <span className="text-xs text-brand-gray truncate">{track.ArtistName}</span>
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

    </div>
  );
};
