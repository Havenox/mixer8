import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../context/PlayerContext';
import { LyricsChordsViewer } from '../components/LyricsChordsViewer';
import { Music4 } from 'lucide-react';

export const LyricsView: React.FC = () => {
  const navigate = useNavigate();
  const { currentTrack, currentTime } = usePlayer();

  if (!currentTrack) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 min-h-[75vh] gap-5 bg-brand-dark rounded-xl border border-brand-hover select-none animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-full bg-brand-hover border border-brand-hover flex items-center justify-center text-brand-green">
          <Music4 className="w-8 h-8" />
        </div>
        <div className="flex flex-col gap-2 max-w-[360px]">
          <h2 className="text-lg font-black text-white uppercase tracking-wider">Letras & Cifras Vazias</h2>
          <p className="text-xs text-brand-gray leading-relaxed">
            Nenhuma música está sendo reproduzida no momento. Escolha uma música na biblioteca para visualizar suas letras e acordes em tempo real.
          </p>
        </div>
        <button 
          onClick={() => navigate('/dashboard')}
          className="py-2 px-5 bg-brand-green text-black rounded font-black text-xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          Escolher uma Música
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <LyricsChordsViewer 
        TrackId={currentTrack.TrackId}
        CurrentTime={currentTime}
        OnClose={() => navigate(-1)}
      />
    </div>
  );
};
