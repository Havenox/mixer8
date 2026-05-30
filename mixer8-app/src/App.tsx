import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import type { ITrack } from './context/PlayerContext';
import { PersistentLayout } from './components/PersistentLayout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Admin } from './pages/Admin';
import { Play, Sparkles, Disc, Flame, Music, Radio, Star, Loader2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Rota protegida por autenticação
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { IsAuthenticated } = useAuth();
  return IsAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// Página de Explorar (Home / Catálogo de Destaque)
const Explore: React.FC = () => {
  const { CurrentUser } = useAuth();
  const { loadTrack } = usePlayer();
  const [tracks, setTracks] = useState<ITrack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTracks = async () => {
      try {
        const res = await fetch(`${API_URL}/Tracks`);
        if (res.ok) {
          const data = await res.json();
          // Exibe apenas as tracks com extração concluída
          setTracks(data.filter((t: ITrack) => t.ExtractionStatus === 'Pronto'));
        }
      } catch (err) {
        console.error('Erro ao buscar tracks:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTracks();
  }, []);
  
  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300">
      
      {/* Banner de Boas-vindas Premium */}
      <div className="bg-gradient-to-r from-brand-hover to-black border border-brand-hover p-8 rounded-lg shadow-xl relative overflow-hidden flex flex-col gap-3">
        <div className="flex items-center gap-2 text-brand-green text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-4 h-4" /> Bem-vindo ao Mixer8
        </div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight m-0 text-white leading-none">
          Música não é estática.{' '}
          <span className="text-brand-green">Sinta cada Stem.</span>
        </h1>
        <p className="text-sm text-brand-gray max-w-[600px] leading-relaxed">
          Isola a voz, remova a bateria, aumente o sintetizador e crie mixagens únicas. Cada música na biblioteca é uma fusão em tempo real de stems separadas por inteligência artificial.
        </p>
        
        {/* Nível do Usuário */}
        <div className="mt-2 self-start px-3 py-1 bg-brand-green/10 border border-brand-green/30 text-brand-green rounded text-xs font-semibold uppercase tracking-wider">
          Nível de Acesso: {CurrentUser?.UserRole}
        </div>
      </div>

      {/* Destaques Semanais */}
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-bold text-white m-0 flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500 fill-current" /> Tendências Semanais
        </h2>
        
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-brand-gray font-semibold py-4">
            <Loader2 className="w-4 h-4 animate-spin text-brand-green" />
            Carregando catálogo de músicas...
          </div>
        ) : tracks.length === 0 ? (
          <div className="text-sm text-brand-gray bg-brand-card border border-brand-hover p-6 rounded-md text-center font-semibold shadow-lg">
            Nenhuma música disponível no momento. Faça upload na sua biblioteca!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tracks.slice(0, 3).map((track, idx) => (
              <div key={track.TrackId} className="bg-brand-card border border-brand-hover p-5 rounded-md hover:bg-brand-hover transition-all flex items-center justify-between group shadow-lg">
                <div className="flex items-center gap-4 truncate">
                  <div className="w-12 h-12 bg-black border border-brand-hover rounded flex items-center justify-center text-brand-green shadow-md shrink-0">
                    {idx === 0 ? (
                      <Disc className="w-6 h-6 animate-spin" style={{ animationDuration: '6s' }} />
                    ) : idx === 1 ? (
                      <Music className="w-6 h-6" />
                    ) : (
                      <Radio className="w-6 h-6" />
                    )}
                  </div>
                  <div className="flex flex-col truncate">
                    <span className="font-bold text-sm text-white truncate">{track.TrackTitle}</span>
                    <span className="text-xs text-brand-gray truncate">{track.ArtistName}</span>
                  </div>
                </div>
                <button 
                  onClick={() => loadTrack(track)}
                  className="w-9 h-9 rounded-full bg-brand-green text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 hover:scale-105 shadow-md cursor-pointer shrink-0 animate-in fade-in duration-200"
                >
                  <Play className="w-4 h-4 fill-current translate-x-[0.5px]" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Grid de Gêneros / Vibe */}
      {!loading && tracks.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-bold text-white m-0 flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500 fill-current" /> Gêneros Populares
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-purple-950/20 border border-purple-500/20 hover:border-purple-500/50 p-6 rounded-md text-center hover:scale-[1.02] transition-all cursor-pointer">
              <span className="font-bold text-sm text-purple-300">Rock / Classic</span>
            </div>
            <div className="bg-emerald-950/20 border border-emerald-500/20 hover:border-emerald-500/50 p-6 rounded-md text-center hover:scale-[1.02] transition-all cursor-pointer">
              <span className="font-bold text-sm text-emerald-300">Pop / Modern</span>
            </div>
            <div className="bg-blue-950/20 border border-blue-500/20 hover:border-blue-500/50 p-6 rounded-md text-center hover:scale-[1.02] transition-all cursor-pointer">
              <span className="font-bold text-sm text-blue-300">Jazz / Blues</span>
            </div>
            <div className="bg-orange-950/20 border border-orange-500/20 hover:border-orange-500/50 p-6 rounded-md text-center hover:scale-[1.02] transition-all cursor-pointer">
              <span className="font-bold text-sm text-orange-300">Acoustic / Folk</span>
            </div>
            <div className="bg-red-950/20 border border-red-500/20 hover:border-red-500/50 p-6 rounded-md text-center hover:scale-[1.02] transition-all cursor-pointer">
              <span className="font-bold text-sm text-red-300">Electronic / EDM</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <PlayerProvider>
        <Router>
          <PersistentLayout>
            <Routes>
              {/* Rotas Públicas */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              {/* Rotas Protegidas */}
              <Route path="/" element={<ProtectedRoute><Explore /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
              
              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </PersistentLayout>
        </Router>
      </PlayerProvider>
    </AuthProvider>
  );
};

export default App;
