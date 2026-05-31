import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { MesaPlayer } from './MesaPlayer';
import { 
  Home, Library, PlusCircle, Shield, 
  LogOut, User, Layers, ListMusic,
  Settings, HelpCircle, CreditCard
} from 'lucide-react';

export const PersistentLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { IsAuthenticated, CurrentUser, Logout } = useAuth();
  const { currentTrack } = usePlayer();
  const location = useLocation();
  const navigate = useNavigate();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fecha o menu de contexto ao clicar fora dele
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!IsAuthenticated || !CurrentUser) {
    return <>{children}</>; // Renderiza cru para telas de login/cadastro
  }

  const handleLogout = () => {
    Logout();
    setIsMenuOpen(false);
    navigate('/login');
  };

  const displayName = CurrentUser.FirstName?.trim() 
    ? CurrentUser.FirstName 
    : (CurrentUser.UserName?.trim() ? `@${CurrentUser.UserName}` : CurrentUser.Email);

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
              <span>Biblioteca</span>
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
        <div className="relative border-t border-brand-hover pt-4" ref={menuRef}>
          {/* Menu de Contexto do Perfil */}
          {isMenuOpen && (
            <div className="absolute bottom-16 left-0 w-52 bg-brand-card border border-brand-hover rounded-md shadow-2xl p-2 z-50 flex flex-col gap-1 animate-in slide-in-from-bottom-2 fade-in duration-200">
              <div className="px-3 py-1.5 text-[10px] text-brand-gray font-bold uppercase tracking-wider select-none">
                Conta e Perfil
              </div>
              <button 
                onClick={() => { navigate('/settings'); setIsMenuOpen(false); }}
                className="flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded text-white hover:bg-brand-hover hover:text-brand-green transition-colors text-left w-full cursor-pointer"
              >
                <Settings className="w-4 h-4 text-brand-green" />
                <span>Configurações</span>
              </button>
              <div className="flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded text-white/40 cursor-not-allowed select-none text-left w-full">
                <User className="w-4 h-4 text-white/20" />
                <span>Meu Perfil</span>
              </div>
              <div className="flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded text-white/40 cursor-not-allowed select-none text-left w-full">
                <CreditCard className="w-4 h-4 text-white/20" />
                <span>Minha Assinatura</span>
              </div>
              <div className="flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded text-white/40 cursor-not-allowed select-none text-left w-full">
                <HelpCircle className="w-4 h-4 text-white/20" />
                <span>Ajuda</span>
              </div>
              
              <div className="h-[1px] bg-brand-hover my-1" />
              
              <button 
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded text-red-400 hover:bg-red-500/10 transition-colors text-left w-full cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair</span>
              </button>
            </div>
          )}

          {/* Bloco de Informações do Usuário (Clique abre o menu) */}
          <div 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`flex items-center justify-between p-2 rounded-md hover:bg-brand-hover/50 cursor-pointer select-none transition-all ${
              isMenuOpen ? 'bg-brand-hover/40' : ''
            }`}
          >
            <div className="flex items-center gap-3 truncate w-full">
              {CurrentUser.AvatarUrl ? (
                <img 
                  src={CurrentUser.AvatarUrl} 
                  className="w-9 h-9 rounded-full object-cover border border-brand-green/20" 
                  alt="Avatar" 
                  onError={(e) => {
                    // Fallback em caso de URL quebrada
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-brand-hover border border-brand-green/20 flex items-center justify-center text-brand-green">
                  <User className="w-4 h-4" />
                </div>
              )}
              <div className="flex flex-col truncate">
                <span className="text-xs font-semibold text-white truncate">{displayName}</span>
                <span className="text-[9px] text-brand-green font-bold uppercase tracking-wider">
                  {CurrentUser.UserRole}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. CONTEÚDO PRINCIPAL (Mesa de Som com rolagem) */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-brand-dark">
        {/* Barra superior transparente */}
        <div className="h-16 flex items-center justify-end px-8 select-none shrink-0 border-b border-brand-hover">
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
