import React from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';

interface TrackStatusBadgeProps {
  status: string;
  showMixLabel?: boolean;
}

export const getCompactStatusText = (status: string): string => {
  if (!status) return 'FILA';
  if (status === 'Pronto') return 'PRONTO';
  if (status === 'Falhou') return 'FALHOU';
  
  if (status === 'Aguardando' || status === 'AguardandoDownload') {
    return 'FILA';
  }
  
  if (status.startsWith('Processando')) {
    const detail = status.includes(':') ? status.split(':')[1].trim() : status;
    const lower = detail.toLowerCase();
    
    if (lower.includes('separação') || lower.includes('daw')) return 'SEPARANDO';
    if (lower.includes('baixando mídia') || lower.includes('download')) return 'BAIXANDO';
    if (lower.includes('aguardando extração') || lower.includes('extração')) return 'FILA';
    if (lower.includes('extraindo')) return 'EXTRAINDO';
    if (lower.includes('localizando') || lower.includes('áudio') || lower.includes('divisão')) return 'PREPARANDO';
    if (lower.includes('login') || lower.includes('autenticando')) return 'CONECTANDO';
    if (lower.includes('upload') || lower.includes('enviando')) {
      if (lower.includes('stems')) return 'SALVANDO';
      return 'ENVIANDO';
    }
    if (lower.includes('exportando')) return 'EXPORTANDO';
    if (lower.includes('retorno') || lower.includes('identificando') || lower.includes('biblioteca')) return 'PROCESSANDO';
    if (lower.includes('inicializando') || lower.includes('playwright')) return 'INICIANDO';
    
    return 'PROCESSANDO';
  }
  
  return status.toUpperCase();
};

export const TrackStatusBadge: React.FC<TrackStatusBadgeProps> = ({ status, showMixLabel = false }) => {
  if (status === 'Pronto') {
    return (
      <span className="text-brand-green flex items-center gap-1 shrink-0 select-none">
        <CheckCircle className="w-3.5 h-3.5" /> {showMixLabel ? 'MIX PRONTO' : 'PRONTO'}
      </span>
    );
  }
  
  if (status === 'Falhou') {
    return (
      <span className="text-red-400 flex items-center gap-1 shrink-0 select-none">
        <AlertTriangle className="w-3.5 h-3.5" /> FALHOU
      </span>
    );
  }
  
  const text = getCompactStatusText(status);
  
  return (
    <span className="text-yellow-500 flex items-center gap-1.5 shrink-0 select-none animate-pulse">
      <div className="w-3 h-3 border-2 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin" />
      <span>{text}</span>
    </span>
  );
};
