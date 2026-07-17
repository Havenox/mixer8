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
    closeExportToast,
    abortExport
  } = usePlayer();

  const [countdown, setCountdown] = useState(10);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
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

  const handleCloseClick = () => {
    if (isExporting) {
      setShowConfirmModal(true);
    } else {
      closeExportToast();
    }
  };

  const handleConfirmCancel = () => {
    setShowConfirmModal(false);
    abortExport();
  };

  return (
    <>
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 md:left-auto md:right-8 md:bottom-28 md:translate-x-0 z-50 w-[340px] max-w-[calc(100%-2rem)] bg-[#181818]/95 backdrop-blur-md border border-white/15 rounded-xl shadow-2xl p-3 md:p-4 transition-all duration-300 animate-in slide-in-from-bottom-5 select-none">
        
        {/* Dynamic Header */}
        <div className="flex items-start justify-between gap-2.5 mb-2 md:mb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            
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
   
          {/* Close Button (Always visible on mobile & desktop) */}
          <button
            onClick={handleCloseClick}
            className="text-brand-gray hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            title={isExporting ? "Cancelar Exportação" : "Fechar Notificação"}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
   
        {/* Progress Bar & Status Text */}
        {isExporting && (
          <div className="space-y-1 md:space-y-1.5 mt-1.5 md:mt-2">
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
          <div className="mt-1 md:mt-1.5 flex items-center justify-between gap-2">
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

      {/* Confirmation Modal for Aborting Export */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#181818] border border-white/15 rounded-xl max-w-sm w-full p-5 shadow-2xl space-y-4 text-center animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">Cancelar exportação?</h3>
              <p className="text-xs text-brand-gray leading-relaxed">
                Tem certeza que deseja interromper a geração e o download do arquivo MP3?
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2 px-3 text-xs font-bold text-white bg-white/10 hover:bg-white/15 border border-white/15 rounded-lg transition-colors cursor-pointer"
              >
                Não, continuar
              </button>
              <button
                onClick={handleConfirmCancel}
                className="flex-1 py-2 px-3 text-xs font-bold text-red-400 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 rounded-lg transition-colors cursor-pointer"
              >
                Sim, cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
