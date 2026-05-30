import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Sparkles, UploadCloud, CheckCircle, Disc, Music, 
  AlertTriangle, ArrowLeft, Layers, Loader2
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const UploadDireto: React.FC = () => {
  const { Token, CurrentUser } = useAuth();
  const navigate = useNavigate();

  const [trackTitle, setTrackTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Mapeamento automático de arquivo para o fader da DAW (UX Premium)
  const mapFileNameToStemType = (fileName: string): string => {
    const lower = fileName.toLowerCase();
    if (lower.includes('vocals') || lower.includes('vocais') || lower.includes('voz'))
      return 'Vocais 🎤';
    if (lower.includes('drums') || lower.includes('bateria') || lower.includes('percussion'))
      return 'Bateria 🥁';
    if (lower.includes('bass') || lower.includes('baixo'))
      return 'Baixo 🎸';
    if (lower.includes('guitar') || lower.includes('guitarra'))
      return 'Guitarra 🎸';
    if (lower.includes('keyboard') || lower.includes('teclado'))
      return 'Teclado 🎹';
    if (lower.includes('piano'))
      return 'Piano 🎹';
    if (lower.includes('sopro') || lower.includes('wind') || lower.includes('brass') || lower.includes('horns'))
      return 'Sopro 🎺';
    if (lower.includes('strings') || lower.includes('cordas') || lower.includes('violin') || lower.includes('cello'))
      return 'Cordas 🎻';
    if (lower.includes('metronome') || lower.includes('metronomo') || lower.includes('metrônomo') || lower.includes('click'))
      return 'Metrônomo ⏱️';
    
    return 'Outros 🎵';
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (ext !== '.jpg' && ext !== '.jpeg' && ext !== '.png') {
        setError('Apenas imagens JPG ou PNG são aceitas para a capa.');
        return;
      }
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      
      // Validação de tipo (Apenas MP3 ou ZIP)
      const invalidFiles = filesArray.filter(file => {
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        return ext !== '.mp3' && ext !== '.zip';
      });

      if (invalidFiles.length > 0) {
        setError('Apenas arquivos de áudio .mp3 ou pacotes compactados .zip são aceitos.');
        return;
      }

      setSelectedFiles(filesArray);
      setError('');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (isUploading) return;

    if (e.dataTransfer.files) {
      const filesArray = Array.from(e.dataTransfer.files);
      const invalidFiles = filesArray.filter(file => {
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        return ext !== '.mp3' && ext !== '.zip';
      });

      if (invalidFiles.length > 0) {
        setError('Apenas arquivos de áudio .mp3 ou pacotes compactados .zip são aceitos.');
        return;
      }

      setSelectedFiles(filesArray);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Token) return;

    if (!trackTitle.trim() || !artistName.trim()) {
      setError('Por favor, informe o título da música e o nome do artista.');
      return;
    }

    if (selectedFiles.length === 0) {
      setError('Por favor, selecione ao menos um arquivo de áudio (.mp3) ou pacote (.zip).');
      return;
    }

    setError('');
    setIsUploading(true);
    setUploadProgress('Preparando o envio das faixas...');

    const formData = new FormData();
    formData.append('TrackTitle', trackTitle.trim());
    formData.append('ArtistName', artistName.trim());
    
    if (coverFile) {
      formData.append('CoverFile', coverFile);
    }

    selectedFiles.forEach(file => {
      formData.append('Files', file);
    });

    try {
      setUploadProgress('Enviando dados e arquivos para o servidor principal...');
      const res = await fetch(`${API_URL}/Tracks/UploadDirect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Token}`
        },
        body: formData
      });

      if (res.ok) {
        setSuccess(true);
        setTrackTitle('');
        setArtistName('');
        setCoverFile(null);
        setCoverPreview(null);
        setSelectedFiles([]);
      } else {
        const data = await res.json();
        setError(data.ErrorMessage || 'Falha ao processar e salvar stems directas.');
      }
    } catch {
      setError('Erro de conexão ao tentar enviar stems ao servidor.');
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  if (CurrentUser?.UserRole !== 'Admin' && CurrentUser?.UserRole !== 'PaidUser') {
    return (
      <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-md flex flex-col gap-3 max-w-[500px] mx-auto mt-12 text-center items-center animate-in fade-in duration-200">
        <AlertTriangle className="w-12 h-12 text-red-500" />
        <h2 className="text-lg font-bold text-white">Acesso Negado (403)</h2>
        <p className="text-xs text-brand-gray">
          Apenas usuários com nível de acesso PaidUser (PRO) ou Admin podem enviar stems prontas para a mesa de som.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300 max-w-[900px] mx-auto select-none">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-brand-hover pb-5">
        <div className="flex flex-col gap-1">
          <button 
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-xs text-brand-gray hover:text-brand-green transition-colors mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar para Biblioteca
          </button>
          <h1 className="text-3xl font-black tracking-tight m-0 text-white flex items-center gap-2">
            <Layers className="w-8 h-8 text-brand-green" /> Upload Direto de Stems (ZIP/MP3)
          </h1>
          <p className="text-sm text-brand-gray">Envie suas faixas extraídas diretamente do Moises ou de sua DAW. Arquivos prontos pulam a fila do extrator.</p>
        </div>
      </div>

      {success && (
        <div className="bg-brand-green/10 border border-brand-green/30 p-6 rounded-md flex flex-col gap-4 text-center items-center animate-in zoom-in-95 duration-300">
          <CheckCircle className="w-14 h-14 text-brand-green animate-bounce" />
          <h2 className="text-lg font-bold text-white">Música Enviada com Sucesso!</h2>
          <p className="text-xs text-brand-gray max-w-[450px]">
            As faixas foram descompactadas, validadas e mapeadas com sucesso. A música já está disponível para mixagem e reprodução imediata na sua biblioteca.
          </p>
          <div className="flex gap-3">
            <button 
              onClick={() => setSuccess(false)}
              className="py-2 px-4 bg-brand-hover hover:bg-brand-hover/80 text-white text-xs font-bold rounded cursor-pointer transition-all"
            >
              Enviar Outra
            </button>
            <button 
              onClick={() => navigate('/dashboard')}
              className="py-2 px-4 bg-brand-green hover:scale-105 active:scale-95 text-black text-xs font-bold rounded cursor-pointer transition-all"
            >
              Ir para Minha Biblioteca
            </button>
          </div>
        </div>
      )}

      {!success && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Coluna da Esquerda: Metadados e Capa */}
          <div className="md:col-span-1 flex flex-col gap-5">
            <div className="bg-brand-card border border-brand-hover p-5 rounded-md flex flex-col gap-4 shadow-xl">
              <h2 className="text-sm font-bold text-white m-0 border-b border-brand-hover pb-2">Informações Gerais</h2>
              
              {/* Título */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-brand-gray">Nome da Música</label>
                <input 
                  type="text"
                  value={trackTitle}
                  onChange={(e) => setTrackTitle(e.target.value)}
                  placeholder="Ex: Bohemian Rhapsody"
                  disabled={isUploading}
                  required
                  className="bg-black border border-brand-hover rounded p-2.5 text-xs text-white focus:outline-none focus:border-brand-green"
                />
              </div>

              {/* Artista */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-brand-gray">Artista</label>
                <input 
                  type="text"
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  placeholder="Ex: Queen"
                  disabled={isUploading}
                  required
                  className="bg-black border border-brand-hover rounded p-2.5 text-xs text-white focus:outline-none focus:border-brand-green"
                />
              </div>

              {/* Capa */}
              <div className="flex flex-col gap-1.5 mt-2">
                <label className="text-xs font-bold text-brand-gray">Imagem de Capa (Opcional)</label>
                <div 
                  onClick={() => !isUploading && coverInputRef.current?.click()}
                  className="w-full aspect-square bg-black border border-dashed border-brand-hover rounded flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer hover:border-brand-green transition-all"
                >
                  {coverPreview ? (
                    <>
                      <img src={coverPreview} alt="Capa" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs font-bold text-white">
                        Alterar Imagem
                      </div>
                    </>
                  ) : (
                    <>
                      <Disc className="w-12 h-12 text-brand-gray/40 group-hover:text-brand-green/60 transition-colors animate-spin" style={{ animationDuration: '8s' }} />
                      <span className="text-[10px] text-brand-gray mt-2 text-center px-4">Carregar Capa JPG/PNG</span>
                    </>
                  )}
                </div>
                <input 
                  type="file"
                  ref={coverInputRef}
                  onChange={handleCoverChange}
                  accept=".jpg,.jpeg,.png"
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Coluna da Direita: Arquivos de Stems */}
          <div className="md:col-span-2 flex flex-col gap-5">
            <div className="bg-brand-card border border-brand-hover p-6 rounded-md flex flex-col gap-5 shadow-xl">
              
              <div className="flex justify-between items-center border-b border-brand-hover pb-3 m-0">
                <h2 className="text-sm font-bold text-white m-0">Arquivos e Faixas</h2>
                <span className="text-[10px] bg-brand-green/10 border border-brand-green/20 text-brand-green px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                  Estrito: .mp3 / .zip
                </span>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 p-3.5 rounded text-xs text-red-400 flex items-start gap-2 animate-in fade-in duration-250">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Drag and Drop Zone */}
              <div 
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className="w-full py-10 bg-black/40 border-2 border-dashed border-brand-hover rounded-md flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-brand-green hover:bg-black/60 transition-all select-none animate-in fade-in duration-300"
              >
                <UploadCloud className="w-12 h-12 text-brand-gray group-hover:text-brand-green transition-colors" />
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs font-bold text-white text-center">Arraste seus áudios ou clique para carregar</span>
                  <span className="text-[10px] text-brand-gray text-center max-w-[350px]">
                    Envie um arquivo <strong className="text-white">.zip</strong> com os arquivos extraídos do Moises, ou selecione múltiplos arquivos <strong className="text-white">.mp3</strong> correspondentes de forma individual.
                  </span>
                </div>
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFilesChange}
                  multiple
                  accept=".mp3,.zip"
                  className="hidden"
                />
              </div>

              {/* Lista de Arquivos Selecionados e Previsão de Fader (UX Premium) */}
              {selectedFiles.length > 0 && (
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">Faixas a serem importadas ({selectedFiles.length})</span>
                  
                  <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                    {selectedFiles.map((file, index) => {
                      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
                      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
                      const isZip = ext === '.zip';

                      return (
                        <div key={index} className="bg-black/40 border border-brand-hover p-3 rounded flex items-center justify-between gap-3 text-xs shadow-inner">
                          <div className="flex items-center gap-3 truncate">
                            <div className="w-8 h-8 rounded bg-brand-hover flex items-center justify-center shrink-0 text-brand-green">
                              {isZip ? <Layers className="w-4 h-4" /> : <Music className="w-4 h-4" />}
                            </div>
                            <div className="flex flex-col truncate">
                              <span className="font-bold text-white truncate">{file.name}</span>
                              <span className="text-[9px] text-brand-gray">
                                Tamanho: {sizeMb} MB
                              </span>
                            </div>
                          </div>
                          
                          {/* Previsão do fader correspondente */}
                          <div className="shrink-0 text-right">
                            <span className="text-[10px] px-2 py-0.5 bg-brand-hover border border-brand-hover text-brand-green rounded font-semibold">
                              {isZip ? '📦 Pacote Stems' : mapFileNameToStemType(file.name)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Botão de Envio com Concorrência e Progresso */}
              <div className="border-t border-brand-hover pt-4 flex flex-col gap-3 mt-2">
                
                {isUploading && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[10px] text-brand-gray font-bold uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-green" />
                        {uploadProgress}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-brand-hover rounded-full overflow-hidden">
                      <div className="h-full bg-brand-green rounded-full w-4/5 animate-pulse" />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isUploading}
                  className="py-3 px-4 bg-brand-green text-black font-bold text-sm rounded hover:scale-[1.02] active:scale-95 transition-all w-full flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed shadow-lg"
                >
                  {isUploading ? 'Processando Upload...' : 'Salvar Música e Disponibilizar Stems'}
                </button>
              </div>

            </div>
          </div>

        </form>
      )}

    </div>
  );
};
