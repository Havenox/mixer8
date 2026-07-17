import React from 'react';
import { usePlayer } from '../context/PlayerContext';
import { CheckCircle2, AlertTriangle, X, Loader2 } from 'lucide-react';

export const ExportToast: React.FC = () => {
  const {
    isExporting,
    exportProgress,
    exportStatusMessage,
    exportFileName,
    exportError,
    exportSuccess,
    closeExportToast
  } = usePlayer();

  if (!isExporting && !exportSuccess && !exportError) {
    return null;
  }

  return (
    <div className="fixed bottom-24 right-4 md:bottom-28 md:right-8 z-50 max-w-sm w-full bg-[#181818]/95 backdrop-blur-md border border-white/15 rounded-xl shadow-2xl p-4 transition-all animate-in slide-in-from-bottom-5 duration-300 select-none">
      
      {/* Dynamic Header */}
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          {isExporting && (
            <div className="w-8 h-8 rounded-lg bg-brand-green/10 border border-brand-green/30 flex items-center justify-center text-brand-green shrink-0">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          )}
          {exportSuccess && (
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          )}
          {exportError && (
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
              <AlertTriangle className="w-4 h-4" />
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

      {/* Success Message */}
      {exportSuccess && (
        <p className="text-[11px] text-emerald-400 font-medium mt-1">
          O download do arquivo foi iniciado automaticamente pelo seu navegador.
        </p>
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
