import React, { useState, useEffect, useRef } from 'react';
import { usePlayer } from '../context/PlayerContext';
import { CheckCircle2, AlertTriangle, X, Disc } from 'lucide-react';
import { SERVER_URL } from '../config';

interface IVinylRecordProps {
  coverUrl?: string;
  isSpinning: boolean;
}

export const VinylRecord: React.FC<IVinylRecordProps> = ({ coverUrl, isSpinning }) => {
  const fullCoverUrl = coverUrl
    ? (coverUrl.startsWith('http') ? coverUrl : `${SERVER_URL}${coverUrl}`)
    : null;

  return (
    <div
      className={`relative w-10 h-10 rounded-full bg-[#111111] border border-white/20 shadow-md flex items-center justify-center shrink-0 overflow-hidden ${
        isSpinning ? 'animate-[spin_3s_linear_infinite]' : ''
      }`}
      title="Disco de Vinil (Exportação da Mix)"
    >
      {/* Vinyl Groove Rings */}
      <div className="absolute inset-0 rounded-full border border-white/10 opacity-60 pointer-events-none" />
      <div className="absolute inset-[3px] rounded-full border border-white/5 opacity-50 pointer-events-none" />
      <div className="absolute inset-[6px] rounded-full border border-white/10 opacity-60 pointer-events-none" />
      
      {/* Vinyl Center Cover Label */}
      {fullCoverUrl ? (
        <img
          src={fullCoverUrl}
          alt="Capa do Vinil"
          className="w-5 h-5 rounded-full object-cover border border-black/80 shadow-inner"
        />
      ) : (
        <div className="w-5 h-5 rounded-full bg-brand-green/20 border border-brand-green/40 flex items-center justify-center text-brand-green">
          <Disc className="w-3 h-3" />
        </div>
      )}

      {/* Center Spindle Hole */}
      <div className="absolute w-1.5 h-1.5 rounded-full bg-[#111111] border border-white/40 shadow-sm" />
    </div>
  );
};

export const ExportToast: React.FC = () => {
  const {
    currentTrack,
    isExporting,
    exportProgress,
    exportStatusMessage,
    exportFileName,
    exportCoverUrl,
    exportError,
    exportSuccess,
    closeExportToast
  } = usePlayer();

  const [countdown, setCountdown] = useState(10);
  const closeExportToastRef = useRef(closeExportToast);

  useEffect(() => {
    closeExportToastRef.current = closeExportToast;
  }, [closeExportToast]);

  // Contador regressivo de 10 segundos totalmente desacoplado da reprodução de áudio e re-renders
  useEffect(() => {
    if (!exportSuccess) {
      setCountdown(10);
      return;
    }

    setCountdown(10);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          closeExportToastRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [exportSuccess]);

  if (!isExporting && !exportSuccess && !exportError) {
    return null;
  }

  // Usa a capa preservada da exportação ou faz fallback para a capa atual da faixa
  const targetCoverUrl = exportCoverUrl || currentTrack?.CoverUrl;

  return (
    <div className="fixed bottom-24 right-4 md:bottom-28 md:right-8 z-50 max-w-sm w-full bg-[#181818]/95 backdrop-blur-md border border-white/15 rounded-xl shadow-2xl p-4 transition-all animate-in slide-in-from-bottom-5 duration-300 select-none">
      
      {/* Dynamic Header */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-3 min-w-0">
          
          {/* Vinyl Record Icon for exporting / success */}
          {!exportError ? (
            <div className="relative shrink-0">
              <VinylRecord
                coverUrl={targetCoverUrl}
                isSpinning={isExporting}
              />
              {exportSuccess && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-md animate-in zoom-in duration-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          )}

          <div className="flex flex-col min-w-0">
            <span className="text-xs font-extrabold text-white tracking-wide truncate">
              {isExporting ? 'Exportando MIX...' : exportSuccess ? 'Exportação Concluída!' : 'Erro na Exportação'}
            </span>
            <span className="text-[11px] text-brand-gray truncate">
              {exportFileName || 'Gerando áudio MP3 192kbps 48kHz...'}
            </span>
          </div>
        </div>

        {/* Close Button (only when finished or failed) */}
        {!isExporting && (
          <button
            onClick={closeExportToast}
            className="text-brand-gray hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            title="Fechar Notificação"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Progress Bar & Status Text */}
      {isExporting && (
        <div className="space-y-1.5 mt-2">
          <div className="flex justify-between items-center text-[10px] font-semibold">
            <span className="text-brand-gray truncate max-w-[220px]">{exportStatusMessage}</span>
            <span className="text-brand-green font-mono font-black">{Math.round(exportProgress)}%</span>
          </div>
          <div className="w-full h-1.5 bg-black/40 border border-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-green to-emerald-400 transition-all duration-150 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]"
              style={{ width: `${Math.min(100, Math.max(0, exportProgress))}%` }}
            />
          </div>
        </div>
      )}

      {/* Success Message with Auto-dismiss countdown */}
      {exportSuccess && (
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <p className="text-[11px] text-emerald-400 font-medium leading-tight">
            O MP3 com capa e metadados ID3v2 foi baixado automaticamente.
          </p>
          <span className="text-[10px] text-brand-gray/80 font-mono font-bold shrink-0 whitespace-nowrap bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
            {countdown}s
          </span>
        </div>
      )}

      {/* Error Message */}
      {exportError && (
        <p className="text-[11px] text-red-400 font-medium mt-1">
          {exportError}
        </p>
      )}

    </div>
  );
};
