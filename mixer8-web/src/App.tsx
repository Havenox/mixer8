import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PersistentLayout } from './components/PersistentLayout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Admin } from './pages/Admin';
import { Play, Sparkles, Disc, Flame, Music, Radio, Star } from 'lucide-react';

// Rota protegida por autenticação
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { IsAuthenticated } = useAuth();
  return IsAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// Página de Explorar (Home / Catálogo de Destaque)
const Explore: React.FC = () => {
  const { CurrentUser } = useAuth();
  
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
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Card 1 */}
          <div className="bg-brand-card border border-brand-hover p-5 rounded-md hover:bg-brand-hover transition-all flex items-center justify-between group shadow-lg">
            <div className="flex items-center gap-4 truncate">
              <div className="w-12 h-12 bg-black border border-brand-hover rounded flex items-center justify-center text-brand-green shadow-md shrink-0">
                <Disc className="w-6 h-6 animate-spin" style={{ animationDuration: '6s' }} />
              </div>
              <div className="flex flex-col truncate">
                <span className="font-bold text-sm text-white truncate">Bohemian Rhapsody</span>
                <span className="text-xs text-brand-gray truncate">Queen</span>
              </div>
            </div>
            <button className="w-9 h-9 rounded-full bg-brand-green text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 hover:scale-105 shadow-md cursor-pointer shrink-0">
              <Play className="w-4 h-4 fill-current translate-x-[0.5px]" />
            </button>
          </div>

          {/* Card 2 */}
          <div className="bg-brand-card border border-brand-hover p-5 rounded-md hover:bg-brand-hover transition-all flex items-center justify-between group shadow-lg">
            <div className="flex items-center gap-4 truncate">
              <div className="w-12 h-12 bg-black border border-brand-hover rounded flex items-center justify-center text-brand-green shadow-md shrink-0">
                <Music className="w-6 h-6" />
              </div>
              <div className="flex flex-col truncate">
                <span className="font-bold text-sm text-white truncate">Smooth (1999)</span>
                <span className="text-xs text-brand-gray truncate">Santana ft. Rob Thomas</span>
              </div>
            </div>
            <button className="w-9 h-9 rounded-full bg-brand-green text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 hover:scale-105 shadow-md cursor-pointer shrink-0">
              <Play className="w-4 h-4 fill-current translate-x-[0.5px]" />
            </button>
          </div>

          {/* Card 3 */}
          <div className="bg-brand-card border border-brand-hover p-5 rounded-md hover:bg-brand-hover transition-all flex items-center justify-between group shadow-lg">
            <div className="flex items-center gap-4 truncate">
              <div className="w-12 h-12 bg-black border border-brand-hover rounded flex items-center justify-center text-brand-green shadow-md shrink-0">
                <Radio className="w-6 h-6" />
              </div>
              <div className="flex flex-col truncate">
                <span className="font-bold text-sm text-white truncate">Hotel California</span>
                <span className="text-xs text-brand-gray truncate">Eagles</span>
              </div>
            </div>
            <button className="w-9 h-9 rounded-full bg-brand-green text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 hover:scale-105 shadow-md cursor-pointer shrink-0">
              <Play className="w-4 h-4 fill-current translate-x-[0.5px]" />
            </button>
          </div>

        </div>
      </div>

      {/* Grid de Gêneros / Vibe */}
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

    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
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
    </AuthProvider>
  );
};

export default App;
