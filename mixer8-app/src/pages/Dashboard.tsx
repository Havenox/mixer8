import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Play, UploadCloud, CheckCircle, Clock, FileAudio, 
  Sparkles, Layers, Volume2, ShieldAlert, Check, Music, Disc
} from 'lucide-react';

interface IMockTrack {
  TrackId: string;
  TrackTitle: string;
  ArtistName: string;
  StemsCount: number;
  Status: 'Ready' | 'Processing' | 'Pending';
  Duration: string;
}

const INITIAL_TRACKS: IMockTrack[] = [
  { TrackId: '1', TrackTitle: 'Bohemian Rhapsody', ArtistName: 'Queen', StemsCount: 5, Status: 'Ready', Duration: '4:56' },
  { TrackId: '2', TrackTitle: 'Smooth', ArtistName: 'Santana ft. Rob Thomas', StemsCount: 5, Status: 'Ready', Duration: '3:58' },
  { TrackId: '3', TrackTitle: 'Hotel California', ArtistName: 'Eagles', StemsCount: 5, Status: 'Ready', Duration: '6:30' },
  { TrackId: '4', TrackTitle: 'Billie Jean (Processing Mock)', ArtistName: 'Michael Jackson', StemsCount: 5, Status: 'Processing', Duration: '4:54' }
];

export const Dashboard: React.FC = () => {
  const { CurrentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [tracks, setTracks] = useState<IMockTrack[]>(INITIAL_TRACKS);
  
  // Controle de Upload de arquivos
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [songName, setSongName] = useState('');
  const [artistName, setArtistName] = useState('');

  // Verifica se a URL contém ?action=upload para abrir o modal
  const showUploadSection = new URLSearchParams(location.search).get('action') === 'upload';

  // Simula as etapas de extração do bot do extrator
  const extractionSteps = [
    'Salvando arquivo original de áudio na API...',
    'Inicializando container do Bot Headless no Docker (Playwright)...',
    'Importando cookies seguros (auth.json) e abrindo sessão na plataforma de stems...',
    'Realizando upload do arquivo para o extrator inteligente...',
    'Separando stems (Voz, Baixo, Bateria, Teclado, Outros)...',
    'Acessando player DAW do extrator inteligente Headless...',
    'Baixando ZIP de stems exportadas da plataforma...',
    'Extraindo ZIP e salvando as 5 stems locais em downloads/...',
    'Registro no Banco PostgreSQL concluído e stems ativas!'
  ];

  useEffect(() => {
    if (isUploading && currentStep < extractionSteps.length) {
      const delay = currentStep === 4 ? 6000 : 2500; // Demora mais na parte de "separação"
      const timer = setTimeout(() => {
        setUploadProgress(prev => [...prev, `[OK] ${extractionSteps[currentStep]}`]);
        setCurrentStep(prev => prev + 1);
      }, delay);
      return () => clearTimeout(timer);
    } else if (isUploading && currentStep === extractionSteps.length) {
      // Concluiu
      const newTrack: IMockTrack = {
        TrackId: crypto.randomUUID(),
        TrackTitle: songName || 'Nova Música Extraída',
        ArtistName: artistName || 'Artista Desconhecido',
        StemsCount: 5,
        Status: 'Ready',
        Duration: '3:45'
      };
      setTracks(prev => [newTrack, ...prev]);
      setIsUploading(false);
      setSelectedFile(null);
      setSongName('');
      setArtistName('');
      setCurrentStep(0);
      navigate('/dashboard'); // Fecha o modal de upload
    }
  }, [isUploading, currentStep]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      // Extrai informações básicas do nome do arquivo
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

  const startExtraction = () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadProgress([]);
    setCurrentStep(0);
    setUploadProgress([`[INÍCIO] Iniciando fila de extração automatizada de stems...`]);
  };

  // Se o usuário tentar acessar e não for PaidUser ou Admin
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

      {/* Grid de Tracks */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 select-none">
        {tracks.map((track) => (
          <div 
            key={track.TrackId} 
            className="bg-brand-card border border-brand-hover p-4 rounded-md hover:bg-brand-hover group transition-all relative"
          >
            {/* Capa fictícia */}
            <div className="w-full aspect-square bg-black border border-brand-hover rounded mb-4 flex items-center justify-center relative overflow-hidden group shadow-md">
              <Disc className="w-16 h-16 text-brand-green/20 group-hover:text-brand-green/40 transition-colors" />
              <button 
                disabled={track.Status !== 'Ready'}
                className="absolute w-12 G-12 rounded-full bg-brand-green text-black flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 hover:scale-105 transition-all shadow-lg duration-250 cursor-pointer disabled:opacity-30 disabled:scale-100"
              >
                <Play className="w-6 h-6 fill-current translate-x-[1px]" />
              </button>
            </div>

            {/* Metadados */}
            <div className="flex flex-col gap-1 mb-2">
              <span className="font-bold text-sm text-white truncate">{track.TrackTitle}</span>
              <span className="text-xs text-brand-gray truncate">{track.ArtistName}</span>
            </div>

            {/* Status do Stems */}
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-brand-hover text-[10px] font-bold">
              <span className="text-brand-gray uppercase">Stems: {track.StemsCount} faixas</span>
              
              {track.Status === 'Ready' && (
                <span className="text-brand-green flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> MIX PRONTO
                </span>
              )}
              {track.Status === 'Processing' && (
                <span className="text-yellow-500 flex items-center gap-1 animate-pulse">
                  <Clock className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} /> EXTRAINDO BOT
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* MODAL DE UPLOAD / SIMULADOR DO PLAYWRIGHT Headless */}
      {showUploadSection && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 select-none animate-in fade-in duration-200">
          
          <div className="w-full max-w-[650px] bg-brand-card border border-brand-hover rounded-lg shadow-2xl p-6 md:p-8 flex flex-col gap-6 relative max-h-[90vh] overflow-y-auto">
            
            {/* Fechar */}
            <button 
              onClick={() => { if (!isUploading) navigate('/dashboard'); }}
              className="absolute right-4 top-4 text-brand-gray hover:text-white transition-colors font-bold text-sm cursor-pointer disabled:opacity-30"
              disabled={isUploading}
            >
              Fechar
            </button>

            {/* Header */}
            <div className="flex flex-col gap-1 border-b border-brand-hover pb-4">
              <div className="flex items-center gap-2 text-brand-green">
                <Sparkles className="w-6 h-6" />
                <h2 className="text-lg font-black text-white m-0">Separador de Stems Inteligente</h2>
              </div>
              <p className="text-xs text-brand-gray">
                Faça o upload do seu áudio. O nosso robô headless do .NET 10 logará de forma autônoma na plataforma de stems via cookies, enviará o arquivo, processará a separação de 5 faixas e salvará na VPS.
              </p>
            </div>

            {/* Upload Area */}
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
              // SIMULAÇÃO DO CONSOLE DO BOT PLAYWRIGHT
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-ping" />
                    Robô Executando Fluxo de Navegação...
                  </span>
                  <span className="text-brand-gray">
                    Etapa {currentStep + 1} de {extractionSteps.length}
                  </span>
                </div>

                {/* Console */}
                <div className="bg-black border border-brand-hover rounded p-4 font-mono text-[10px] text-brand-gray h-64 overflow-y-auto flex flex-col gap-1 shadow-inner">
                  {uploadProgress.map((log, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <span className="text-brand-green select-none">❯</span>
                      <span className={log.startsWith('[INÍCIO]') ? 'text-white font-bold' : 'text-brand-gray/90'}>
                        {log}
                      </span>
                    </div>
                  ))}
                  {currentStep < extractionSteps.length && (
                    <div className="flex gap-2 items-center text-white font-bold animate-pulse mt-1">
                      <span className="text-brand-green select-none">❯</span>
                      <span>[PROCESSANDO] {extractionSteps[currentStep]}</span>
                    </div>
                  )}
                </div>

                {/* Barra de Progresso */}
                <div className="w-full h-1.5 bg-black rounded-full overflow-hidden relative border border-brand-hover">
                  <div 
                    className="h-full bg-brand-green rounded-full transition-all duration-500"
                    style={{ width: `${((currentStep) / extractionSteps.length) * 100}%` }}
                  />
                </div>

                <div className="bg-brand-hover/20 border border-brand-hover p-3 rounded text-[10px] text-brand-gray flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-brand-green shrink-0" />
                  <span>Não feche o navegador. O processo de separação é rodado de forma atômica no Docker na VPS Linux.</span>
                </div>
              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
};
