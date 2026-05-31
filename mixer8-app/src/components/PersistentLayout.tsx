import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { MesaPlayer } from './MesaPlayer';
import { 
  Home, Library, PlusCircle, Shield, 
  LogOut, User, ChevronDown, Layers, ListMusic
} from 'lucide-react';
import type { UserRole } from '../types/Auth';

export const PersistentLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { IsAuthenticated, CurrentUser, Logout, UpdateRole } = useAuth();
  const { currentTrack } = usePlayer();
  const location = useLocation();
  const navigate = useNavigate();

  if (!IsAuthenticated || !CurrentUser) {
    return <>{children}</>; // Renderiza cru para telas de login/cadastro
  }

  const handleLogout = () => {
    Logout();
    navigate('/login');
  };

  const handleRoleToggle = (e: React.ChangeEvent<HTMLSelectElement>) => {
    UpdateRole(e.target.value as UserRole);
  };

  return (
    <div className={`flex h-screen bg-brand-black text-white overflow-hidden transition-all duration-300 ${currentTrack ? 'pb-24' : ''}`}>
      
      {/* 1. SIDEBAR (Estilo Mesa de Som) */}
      <div className="w-64 bg-black flex flex-col justify-between p-6 border-r border-brand-hover select-none shrink-0">
        <div className="flex flex-col gap-6">
          {/* Logo */}
          <div className="flex items-center px-2">
            <img src="/mixer8-logo.webp" alt="Mixer8 Logo" className="h-8 w-auto object-contain select-none" />
          </div>

          {/* Menus principais */}
          <nav className="flex flex-col gap-3 font-semibold text-sm text-brand-gray">
            <Link 
              to="/" 
              className={`flex items-center gap-4 py-2 px-3 rounded-md hover:text-white transition-colors ${
                location.pathname === '/' ? 'text-white bg-brand-hover' : ''
              }`}
            >
              <Home className="w-5 h-5" />
              <span>Explorar</span>
            </Link>
            <Link 
              to="/dashboard" 
              className={`flex items-center gap-4 py-2 px-3 rounded-md hover:text-white transition-colors ${
                location.pathname === '/dashboard' ? 'text-white bg-brand-hover' : ''
              }`}
            >
              <Library className="w-5 h-5" />
              <span>Minha Biblioteca</span>
            </Link>
            <Link 
              to="/playlists" 
              className={`flex items-center gap-4 py-2 px-3 rounded-md hover:text-white transition-colors ${
                location.pathname.startsWith('/playlists') ? 'text-white bg-brand-hover' : ''
              }`}
            >
              <ListMusic className="w-5 h-5 text-brand-green" />
              <span>Playlists</span>
            </Link>
          </nav>

          <div className="h-[1px] bg-brand-hover my-2" />

          {/* Menus de ação (Exclusivo PaidUser / Admin) */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] text-brand-gray font-bold uppercase tracking-wider px-3 mb-1">
              Ferramentas Stems
            </span>
            
            {/* Somente PaidUser ou Admin podem criar stems */}
            {(CurrentUser.UserRole === 'PaidUser' || CurrentUser.UserRole === 'Admin') ? (
              <>
                <Link 
                  to="/dashboard?action=upload" 
                  className="flex items-center gap-4 py-2 px-3 rounded-md font-semibold text-sm text-brand-gray hover:text-white hover:bg-brand-hover transition-all"
                >
                  <PlusCircle className="w-5 h-5 text-brand-green" />
                  <span>Upload e Separar</span>
                </Link>
                <Link 
                  to="/upload-direto" 
                  className={`flex items-center gap-4 py-2 px-3 rounded-md font-semibold text-sm text-brand-gray hover:text-white hover:bg-brand-hover transition-all ${
                    location.pathname === '/upload-direto' ? 'text-white bg-brand-hover' : ''
                  }`}
                >
                  <Layers className="w-5 h-5 text-brand-green" />
                  <span>Upload Direto (Mesa)</span>
                </Link>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between py-2 px-3 rounded-md font-semibold text-sm text-brand-gray/40 cursor-not-allowed select-none group relative">
                  <div className="flex items-center gap-4">
                    <PlusCircle className="w-5 h-5 text-brand-gray/40" />
                    <span>Upload e Separar</span>
                  </div>
                  <span className="text-[9px] bg-brand-hover text-brand-green border border-brand-green/20 px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    PRO
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-md font-semibold text-sm text-brand-gray/40 cursor-not-allowed select-none group relative">
                  <div className="flex items-center gap-4">
                    <Layers className="w-5 h-5 text-brand-gray/40" />
                    <span>Upload Direto (Mesa)</span>
                  </div>
                  <span className="text-[9px] bg-brand-hover text-brand-green border border-brand-green/20 px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    PRO
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Menus de Admin / Mod */}
          {(CurrentUser.UserRole === 'Admin' || CurrentUser.UserRole === 'Moderator') && (
            <div className="flex flex-col gap-1.5 mt-2">
              <span className="text-[10px] text-brand-gray font-bold uppercase tracking-wider px-3 mb-1">
                Administração
              </span>
              <Link 
                to="/admin" 
                className={`flex items-center gap-4 py-2 px-3 rounded-md font-semibold text-sm text-brand-gray hover:text-white hover:bg-brand-hover transition-all ${
                  location.pathname === '/admin' ? 'text-white bg-brand-hover' : ''
                }`}
              >
                <Shield className="w-5 h-5 text-brand-green" />
                <span>Painel Admin (CRM)</span>
              </Link>
            </div>
          )}
        </div>

        {/* Rodapé da Sidebar: Info do Usuário */}
        <div className="flex flex-col gap-4 border-t border-brand-hover pt-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-hover border border-brand-green/20 flex items-center justify-center text-brand-green">
              <User className="w-5 h-5" />
            </div>
            <div className="flex flex-col truncate">
              <span className="text-xs font-semibold text-white truncate">{CurrentUser.Email}</span>
              <span className="text-[10px] text-brand-green font-bold uppercase tracking-wider">
                {CurrentUser.UserRole}
              </span>
            </div>
          </div>

          {/* Simulador de Troca de Nível (Exclusivo Dev) */}
          <div className="flex flex-col gap-1.5 bg-brand-card border border-brand-hover p-2 rounded-md">
            <label className="text-[9px] text-brand-gray font-bold uppercase">
              🧪 Simulador de Perfis (RBAC)
            </label>
            <div className="relative">
              <select 
                value={CurrentUser.UserRole} 
                onChange={handleRoleToggle}
                className="w-full bg-brand-hover text-xs font-semibold text-white py-1 px-2 pr-6 rounded border border-brand-hover appearance-none cursor-pointer focus:outline-none"
              >
                <option value="Admin">Admin</option>
                <option value="Moderator">Moderator</option>
                <option value="PaidUser">PaidUser (PRO)</option>
                <option value="User">User (Gratuito)</option>
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-gray pointer-events-none" />
            </div>
          </div>

          <button 
            onClick={handleLogout}
            className="flex items-center gap-4 py-2 px-3 rounded-md font-semibold text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors w-full cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            <span>Sair da Conta</span>
          </button>
        </div>
      </div>

      {/* 2. CONTEÚDO PRINCIPAL (Mesa de Som com rolagem) */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-brand-dark">
        {/* Barra superior transparente */}
        <div className="h-16 flex items-center justify-end px-8 select-none shrink-0 border-b border-brand-hover">
          <div className="flex items-center gap-3 text-xs text-brand-gray">
            <span>Status do Extrator: </span>
            <span className="flex items-center gap-1.5 text-brand-green font-semibold">
              <span className="w-2 h-2 rounded-full bg-brand-green animate-ping" />
              SESSÃO ATIVA (Bot Pronto)
            </span>
          </div>
        </div>

        {/* Scroll Container para as Páginas */}
        <div className="flex-1 overflow-y-auto pb-28 px-8 py-6">
          {children}
        </div>
      </div>

      {/* 3. PERSISTENT AUDIO PLAYER */}
      <MesaPlayer />

    </div>
  );
};
