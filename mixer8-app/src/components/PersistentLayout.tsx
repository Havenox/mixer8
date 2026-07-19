import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePlayer } from '../context/PlayerContext';
import { MesaPlayer } from './MesaPlayer';
import { GlobalTopHeader } from './GlobalTopHeader';
import { LyricsChordsViewer } from './LyricsChordsViewer';
import { DawView } from '../pages/DawView';
import { MobileMixerOverlay } from './MobileMixerOverlay';
import { ExportToast } from './ExportToast';
import { 
  Home, Library, Shield, 
  LogOut, User, ListMusic,
  Settings, HelpCircle, CreditCard, Lock,
  ChevronLeft, ChevronRight, UploadCloud
} from 'lucide-react';

import { SERVER_URL, API_URL } from '../config';

export const PersistentLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { IsAuthenticated, CurrentUser, Logout, openLoginModal, Token } = useAuth();
  const { currentTrack, currentTime, activeOverlay, setActiveOverlay } = usePlayer();
  const location = useLocation();
  const navigate = useNavigate();

  // Envia as estatísticas de acesso de carregamento inicial para o backend
  useEffect(() => {
    const trackAccess = async () => {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (Token) {
          headers['Authorization'] = `Bearer ${Token}`;
        }

        await fetch(`${API_URL}/System/Access`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            UserAgent: navigator.userAgent,
            Language: navigator.language,
            Referrer: document.referrer || 'Direto',
            Url: window.location.href,
            ScreenResolution: `${window.screen.width}x${window.screen.height}`
          }),
        });
      } catch (error) {
        console.warn('Analytics tracking failed:', error);
      }
    };

    trackAccess();
  }, []);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('mixer8_sidebar_collapsed') === 'true';
  });
  const [isHovered, setIsHovered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Fecha o menu de contexto ao clicar fora dele
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Persiste a preferência da sidebar no localStorage
  useEffect(() => {
    localStorage.setItem('mixer8_sidebar_collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  // Auto-retratividade em telas menores ou ao redimensionar (Mono Celular / Telas Apertadas)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Se houver redirect com ?showLogin=true, abre o modal
  const showLogin = new URLSearchParams(location.search).get('showLogin');
  useEffect(() => {
    if (showLogin === 'true' && !IsAuthenticated) {
      openLoginModal();
      // Limpa a query string para não ficar abrindo toda hora ao navegar de volta
      navigate(location.pathname, { replace: true });
    }
  }, [showLogin, IsAuthenticated]);

  // Fecha o overlay automaticamente quando a rota/caminho muda
  useEffect(() => {
    setActiveOverlay('none');
  }, [location.pathname, setActiveOverlay]);



  const handleLogout = () => {
    Logout();
    setIsMenuOpen(false);
    navigate('/');
  };

  const displayName = CurrentUser?.FirstName?.trim() 
    ? CurrentUser.FirstName 
    : (CurrentUser?.UserName?.trim() ? `@${CurrentUser.UserName}` : CurrentUser?.Email || '');

  return (
    <div className={`flex h-screen bg-brand-black text-white overflow-hidden transition-all duration-300 ${currentTrack ? 'pb-16 md:pb-24' : ''}`}>
      
      {/* Header Superior Mobile */}
      <div className="fixed top-0 left-0 right-0 h-16 bg-black/90 backdrop-blur-md border-b border-brand-hover flex items-center justify-between px-4 z-40 md:hidden">
        <Link to="/" onClick={() => setIsMobileMenuOpen(false)}>
          <img src="/mixer8-logo.webp" alt="Mixer8 Logo" className="h-6 w-auto object-contain" />
        </Link>
        
        {/* Container agrupando navegação e avatar na direita */}
        <div className="flex items-center gap-5">
          {/* Navegação Rápida no Mobile */}
          <div className="flex items-center gap-3.5 sm:gap-4.5">
            <Link to="/" className={`hover:text-brand-green ${location.pathname === '/' ? 'text-brand-green' : 'text-white'}`} onClick={() => setIsMobileMenuOpen(false)} title="Explorar">
              <Home className="w-5 h-5" />
            </Link>
            {IsAuthenticated && (
              <>
                <Link to="/library" className={`hover:text-brand-green ${location.pathname === '/library' && !location.search.includes('action=upload') ? 'text-brand-green' : 'text-white'}`} onClick={() => setIsMobileMenuOpen(false)} title="Biblioteca">
                  <Library className="w-5 h-5" />
                </Link>
                <Link to="/playlists" className={`hover:text-brand-green ${location.pathname.startsWith('/playlists') ? 'text-brand-green' : 'text-white'}`} onClick={() => setIsMobileMenuOpen(false)} title="Playlists">
                  <ListMusic className="w-5 h-5 shrink-0" />
                </Link>
              </>
            )}

            {/* Divisor entre navegação principal e ferramentas/admin */}
            {IsAuthenticated && CurrentUser && (CurrentUser.UserRole === 'PaidUser' || CurrentUser.UserRole === 'Admin' || CurrentUser.UserRole === 'Moderator') && (
              <div className="w-[1px] h-4 bg-brand-hover opacity-60 shrink-0" />
            )}

            {IsAuthenticated && CurrentUser && (CurrentUser.UserRole === 'PaidUser' || CurrentUser.UserRole === 'Admin') && (
              <Link to="/library?action=upload" className={`hover:text-brand-green ${location.search.includes('action=upload') ? 'text-brand-green' : 'text-white'}`} onClick={() => setIsMobileMenuOpen(false)} title="Adicionar nova música">
                <UploadCloud className="w-5 h-5 shrink-0" />
              </Link>
            )}
            {IsAuthenticated && CurrentUser && (CurrentUser.UserRole === 'Admin' || CurrentUser.UserRole === 'Moderator') && (
              <Link to="/admin" className={`hover:text-brand-green ${location.pathname === '/admin' ? 'text-brand-green' : 'text-white'}`} onClick={() => setIsMobileMenuOpen(false)} title="Painel de Controle">
                <Shield className="w-5 h-5 shrink-0" />
              </Link>
            )}
          </div>

          {/* Divisor vertical sutil */}
          {IsAuthenticated && <div className="w-[1px] h-5 bg-brand-hover" />}

          {/* Avatar do Usuário com Menu Mobile */}
          {IsAuthenticated && CurrentUser ? (
            <div className="relative" ref={mobileMenuRef}>
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="focus:outline-none flex items-center justify-center cursor-pointer">
                {CurrentUser.AvatarUrl ? (
                  <img src={CurrentUser.AvatarUrl.startsWith('http') ? CurrentUser.AvatarUrl : `${SERVER_URL}${CurrentUser.AvatarUrl}`} className="w-8 h-8 rounded-full object-cover border border-brand-green/20" alt="Avatar" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-brand-hover flex items-center justify-center text-brand-green border border-brand-green/20">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </button>
              
              {/* Menu Dropdown Suspenso no Mobile */}
              {isMobileMenuOpen && (
                <div className="absolute right-0 mt-2 bg-brand-card border border-brand-hover rounded-md shadow-2xl p-2 z-50 flex flex-col gap-1 w-52 animate-in slide-in-from-top-2 duration-200">
                  {IsAuthenticated && CurrentUser && (CurrentUser.UserRole === 'PaidUser' || CurrentUser.UserRole === 'Admin') && (
                    <button onClick={() => { navigate('/library?action=upload'); setIsMobileMenuOpen(false); }} className="flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded text-white hover:bg-brand-hover hover:text-brand-green w-full text-left cursor-pointer">
                      <UploadCloud className="w-4 h-4 text-brand-green" />
                      <span>Adicionar nova música</span>
                    </button>
                  )}
                  {IsAuthenticated && CurrentUser && (CurrentUser.UserRole === 'Admin' || CurrentUser.UserRole === 'Moderator') && (
                    <button onClick={() => { navigate('/admin'); setIsMobileMenuOpen(false); }} className="flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded text-white hover:bg-brand-hover hover:text-brand-green w-full text-left cursor-pointer">
                      <Shield className="w-4 h-4 text-brand-green" />
                      <span>Painel de Controle</span>
                    </button>
                  )}
                  {(CurrentUser.UserRole === 'PaidUser' || CurrentUser.UserRole === 'Admin' || CurrentUser.UserRole === 'Moderator') && <div className="h-[1px] bg-brand-hover my-1" />}
                  <button onClick={() => { navigate('/settings'); setIsMobileMenuOpen(false); }} className="flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded text-white hover:bg-brand-hover hover:text-brand-green w-full text-left cursor-pointer">
                    <Settings className="w-4 h-4 text-brand-green" />
                    <span>Configurações</span>
                  </button>
                  <button onClick={() => { navigate(`/@${CurrentUser.UserName}`); setIsMobileMenuOpen(false); }} className="flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded text-white hover:bg-brand-hover hover:text-brand-green w-full text-left cursor-pointer">
                    <User className="w-4 h-4 text-brand-green" />
                    <span>Meu Perfil</span>
                  </button>
                  <div className="h-[1px] bg-brand-hover my-1" />
                  <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded text-red-400 hover:bg-red-500/10 w-full text-left cursor-pointer">
                    <LogOut className="w-4 h-4" />
                    <span>Sair</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button 
              onClick={openLoginModal} 
              className="py-1 px-3 bg-brand-green text-black font-bold rounded text-xs cursor-pointer"
            >
              Entrar
            </button>
          )}
        </div>
      </div>

      {/* 1. SIDEBAR (Estilo Mesa de Som Retrátil) */}
      <div 
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`bg-black flex flex-col justify-between border-r border-brand-hover select-none shrink-0 transition-all duration-300 hidden md:flex ${
          isSidebarCollapsed ? 'w-14 p-1 py-6 items-center' : 'w-64 p-6'
        }`}
      >
        <div className="flex flex-col gap-6 w-full">
          {/* Cabeçalho: Logo + Botão de Retração */}
          <div className={`flex items-center justify-between w-full ${isSidebarCollapsed ? 'flex-col gap-4' : 'px-2'}`}>
            {!isSidebarCollapsed && (
              <img src="/mixer8-logo.webp" alt="Mixer8 Logo" className="h-8 w-auto object-contain select-none" />
            )}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className={`p-1.5 rounded text-brand-gray hover:text-white hover:bg-brand-hover/40 cursor-pointer shadow-sm transition-all duration-300 ${
                isSidebarCollapsed 
                  ? 'opacity-100 pointer-events-auto' 
                  : `opacity-100 pointer-events-auto md:${isHovered ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`
              }`}
              title={isSidebarCollapsed ? "Expandir Navegação" : "Recolher Navegação"}
            >
              {isSidebarCollapsed ? <ChevronRight className="w-4.5 h-4.5" /> : <ChevronLeft className="w-4.5 h-4.5" />}
            </button>
          </div>

          {/* Menus principais */}
          <nav className="flex flex-col gap-3 text-sm font-semibold w-full">
            {(() => {
              const isExplorarActive = location.pathname === '/';
              return (
                <Link 
                  to="/" 
                  className={`flex items-center rounded-md transition-all text-sm ${
                    isSidebarCollapsed ? 'justify-center p-2.5 w-12 h-12 self-center' : 'gap-4 py-2 px-3 w-full'
                  } ${isExplorarActive ? 'bg-[#242424] text-white font-bold' : 'text-white font-semibold hover:bg-brand-hover/50'}`}
                  title={isSidebarCollapsed ? "Explorar" : undefined}
                >
                  <Home className={`w-5 h-5 shrink-0 ${isExplorarActive ? 'text-brand-green' : 'text-white'}`} />
                  {!isSidebarCollapsed && <span className="truncate">Explorar</span>}
                </Link>
              );
            })()}
            
            {IsAuthenticated ? (
              (() => {
                const isLibraryActive = location.pathname === '/library' && !location.search.includes('action=upload');
                return (
                  <Link 
                    to="/library" 
                    className={`flex items-center rounded-md transition-all text-sm ${
                      isSidebarCollapsed ? 'justify-center p-2.5 w-12 h-12 self-center' : 'gap-4 py-2 px-3 w-full'
                    } ${isLibraryActive ? 'bg-[#242424] text-white font-bold' : 'text-white font-semibold hover:bg-brand-hover/50'}`}
                    title={isSidebarCollapsed ? "Biblioteca" : undefined}
                  >
                    <Library className={`w-5 h-5 shrink-0 ${isLibraryActive ? 'text-brand-green' : 'text-white'}`} />
                    {!isSidebarCollapsed && <span className="truncate">Biblioteca</span>}
                  </Link>
                );
              })()
            ) : (
              <div 
                onClick={openLoginModal}
                className={`flex items-center justify-between rounded-md text-sm font-semibold text-white/50 cursor-pointer hover:text-white transition-all group ${
                  isSidebarCollapsed ? 'justify-center p-2.5 w-12 h-12 self-center' : 'py-2 px-3 w-full'
                }`}
                title={isSidebarCollapsed ? "Biblioteca (Requer Login)" : undefined}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <Library className="w-5 h-5 shrink-0 text-white" />
                  {!isSidebarCollapsed && <span className="truncate">Biblioteca</span>}
                </div>
                {!isSidebarCollapsed && <Lock className="w-3.5 h-3.5 text-white/40 group-hover:text-brand-green shrink-0" />}
              </div>
            )}

            {IsAuthenticated ? (
              (() => {
                const isPlaylistsActive = location.pathname.startsWith('/playlists');
                return (
                  <Link 
                    to="/playlists" 
                    className={`flex items-center rounded-md transition-all text-sm ${
                      isSidebarCollapsed ? 'justify-center p-2.5 w-12 h-12 self-center' : 'gap-4 py-2 px-3 w-full'
                    } ${isPlaylistsActive ? 'bg-[#242424] text-white font-bold' : 'text-white font-semibold hover:bg-brand-hover/50'}`}
                    title={isSidebarCollapsed ? "Playlists" : undefined}
                  >
                    <ListMusic className={`w-5 h-5 shrink-0 ${isPlaylistsActive ? 'text-brand-green' : 'text-white'}`} />
                    {!isSidebarCollapsed && <span className="truncate">Playlists</span>}
                  </Link>
                );
              })()
            ) : (
              <div 
                onClick={openLoginModal}
                className={`flex items-center justify-between rounded-md text-sm font-semibold text-white/50 cursor-pointer hover:text-white transition-all group ${
                  isSidebarCollapsed ? 'justify-center p-2.5 w-12 h-12 self-center' : 'py-2 px-3 w-full'
                }`}
                title={isSidebarCollapsed ? "Playlists (Requer Login)" : undefined}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <ListMusic className="w-5 h-5 text-white shrink-0" />
                  {!isSidebarCollapsed && <span className="truncate">Playlists</span>}
                </div>
                {!isSidebarCollapsed && <Lock className="w-3.5 h-3.5 text-white/40 group-hover:text-brand-green shrink-0" />}
              </div>
            )}
          </nav>

          <div className="h-[1px] bg-brand-hover my-1 w-full" />

          {/* Menus de ação (Exclusivo PaidUser / Admin) */}
          <div className="flex flex-col gap-1.5 text-sm font-semibold w-full">
            {!isSidebarCollapsed && (
              <span className="text-[10px] text-brand-gray font-bold uppercase tracking-wider px-3 mb-1 block">
                Ferramentas Stems
              </span>
            )}
            
            {IsAuthenticated && CurrentUser ? (
              (CurrentUser.UserRole === 'PaidUser' || CurrentUser.UserRole === 'Admin') ? (
                (() => {
                  const isUploadActive = location.search.includes('action=upload');
                  return (
                    <Link 
                      to="/library?action=upload" 
                      className={`flex items-center rounded-md transition-all text-sm ${
                        isSidebarCollapsed ? 'justify-center p-2.5 w-12 h-12 self-center' : 'gap-4 py-2 px-3 w-full'
                      } ${isUploadActive ? 'bg-[#242424] text-white font-bold' : 'text-white font-semibold hover:bg-brand-hover/50'}`}
                      title={isSidebarCollapsed ? "Adicionar nova música" : undefined}
                    >
                      <UploadCloud className={`w-5 h-5 shrink-0 ${isUploadActive ? 'text-brand-green' : 'text-white'}`} />
                      {!isSidebarCollapsed && <span className="truncate">Adicionar nova música</span>}
                    </Link>
                  );
                })()
              ) : (
                <div 
                  className={`flex items-center justify-between rounded-md text-sm font-semibold text-white/40 cursor-not-allowed select-none group relative ${
                    isSidebarCollapsed ? 'justify-center p-2.5 w-12 h-12 self-center' : 'py-2 px-3 w-full'
                  }`}
                  title={isSidebarCollapsed ? "Adicionar nova música (Premium)" : undefined}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <UploadCloud className="w-5 h-5 text-white/40 shrink-0" />
                    {!isSidebarCollapsed && <span className="truncate">Adicionar nova música</span>}
                  </div>
                  {!isSidebarCollapsed && (
                    <span className="text-[9px] bg-brand-hover text-brand-green border border-brand-green/20 px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      PRO
                    </span>
                  )}
                </div>
              )
            ) : (
              <div 
                onClick={openLoginModal}
                className={`flex items-center justify-between rounded-md text-sm font-semibold text-white/50 cursor-pointer hover:text-white transition-all group ${
                  isSidebarCollapsed ? 'justify-center p-2.5 w-12 h-12 self-center' : 'py-2 px-3 w-full'
                }`}
                title={isSidebarCollapsed ? "Adicionar nova música (Requer Login)" : undefined}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <UploadCloud className="w-5 h-5 text-white/50 shrink-0" />
                  {!isSidebarCollapsed && <span className="truncate">Adicionar nova música</span>}
                </div>
                {!isSidebarCollapsed && <Lock className="w-3.5 h-3.5 text-white/40 group-hover:text-brand-green shrink-0" />}
              </div>
            )}
          </div>

          {/* Menus de Admin / Mod */}
          {IsAuthenticated && CurrentUser && (CurrentUser.UserRole === 'Admin' || CurrentUser.UserRole === 'Moderator') && (
            <div className="flex flex-col gap-1.5 text-sm font-semibold w-full">
              {!isSidebarCollapsed && (
                <span className="text-[10px] text-brand-gray font-bold uppercase tracking-wider px-3 mb-1 block">
                  Administração
                </span>
              )}
              {(() => {
                const isAdminActive = location.pathname === '/admin';
                return (
                  <Link 
                    to="/admin" 
                    className={`flex items-center rounded-md transition-all text-sm ${
                      isSidebarCollapsed ? 'justify-center p-2.5 w-12 h-12 self-center' : 'gap-4 py-2 px-3 w-full'
                    } ${isAdminActive ? 'bg-[#242424] text-white font-bold' : 'text-white font-semibold hover:bg-brand-hover/50'}`}
                    title={isSidebarCollapsed ? "Painel de Controle" : undefined}
                  >
                    <Shield className={`w-5 h-5 shrink-0 ${isAdminActive ? 'text-brand-green' : 'text-white'}`} />
                    {!isSidebarCollapsed && <span className="truncate">Painel de Controle</span>}
                  </Link>
                );
              })()}
            </div>
          )}
        </div>

        {/* Rodapé da Sidebar: Info do Usuário */}
        <div className="relative border-t border-brand-hover pt-4 animate-in fade-in duration-300 w-full flex justify-center" ref={menuRef}>
          {IsAuthenticated && CurrentUser ? (
            <>
              {/* Menu de Contexto do Perfil */}
              {isMenuOpen && (
                <div className={`absolute bottom-16 bg-brand-card border border-brand-hover rounded-md shadow-2xl p-2 z-50 flex flex-col gap-1 animate-in slide-in-from-bottom-2 fade-in duration-200 ${
                  isSidebarCollapsed ? 'left-16 w-48' : 'left-0 w-52'
                }`}>
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
                  <button 
                    onClick={() => { navigate(`/@${CurrentUser.UserName}`); setIsMenuOpen(false); }}
                    className="flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded text-white hover:bg-brand-hover hover:text-brand-green transition-colors text-left w-full cursor-pointer"
                  >
                    <User className="w-4 h-4 text-brand-green" />
                    <span>Meu Perfil</span>
                  </button>
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
                className={`flex items-center justify-between rounded-md hover:bg-brand-hover/50 cursor-pointer select-none transition-all ${
                  isMenuOpen ? 'bg-brand-hover/40' : ''
                } ${isSidebarCollapsed ? 'p-1' : 'p-2 w-full'}`}
                title={isSidebarCollapsed ? displayName : undefined}
              >
                <div className="flex items-center gap-3 truncate w-full justify-center">
                  {CurrentUser.AvatarUrl ? (
                    <img 
                      src={CurrentUser.AvatarUrl.startsWith('http') ? CurrentUser.AvatarUrl : `${SERVER_URL}${CurrentUser.AvatarUrl}`} 
                      className="w-9 h-9 rounded-full object-cover border border-brand-green/20 shrink-0" 
                      alt="Avatar" 
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-brand-hover border border-brand-green/20 flex items-center justify-center text-brand-green shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                  {!isSidebarCollapsed && (
                    <div className="flex flex-col truncate flex-1">
                      <span className="text-xs font-semibold text-white truncate">{displayName}</span>
                      <span className="text-[9px] text-brand-green font-bold uppercase tracking-wider">
                        {CurrentUser.UserRole}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <button 
              onClick={openLoginModal}
              className={`flex items-center justify-center bg-brand-green text-black font-bold rounded hover:scale-105 active:scale-95 transition-all shadow select-none duration-200 cursor-pointer ${
                isSidebarCollapsed ? 'w-10 h-10 rounded-full' : 'w-full py-2.5 px-4 text-xs'
              }`}
              title="Entrar / Criar Conta"
            >
              {isSidebarCollapsed ? (
                <LogOut className="w-4 h-4 rotate-180" />
              ) : (
                <span>Entrar / Criar Conta</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 2. CONTEÚDO PRINCIPAL (Mesa de Som com rolagem) */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-brand-dark pt-16 md:pt-0">
        {/* Cabeçalho Fixo Global (Aparece em todas as páginas se houver música na agulha) */}
        {currentTrack && <GlobalTopHeader />}

        {/* Wrapper de overlays relativos para preservar o scroll da biblioteca no fundo */}
        <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
          {/* 1. Conteúdo de Rotas Tradicionais (Dashboard, Explora, Settings, etc.) */}
          <div className={`flex-1 overflow-y-auto px-4 md:px-8 pt-4 pb-24 md:pb-28 ${activeOverlay !== 'none' ? 'hidden' : 'block'}`}>
            {children}
          </div>

          {/* 2. Overlay de Estúdio DAW */}
          {activeOverlay === 'daw' && currentTrack && (
            <div className="absolute top-0 left-0 right-0 bottom-16 md:bottom-24 flex flex-col bg-brand-dark overflow-hidden animate-in fade-in duration-200">
              <DawView />
            </div>
          )}

          {/* 3. Overlay de Letras & Cifras */}
          {activeOverlay === 'lyrics' && currentTrack && (
            <div className="absolute top-0 left-0 right-0 bottom-16 md:bottom-24 flex flex-col bg-brand-dark overflow-hidden animate-in fade-in duration-200">
              <LyricsChordsViewer 
                TrackId={currentTrack.TrackId} 
                CurrentTime={currentTime} 
                OnClose={() => setActiveOverlay('none')} 
              />
            </div>
          )}

          {/* 4. Overlay de Mixer de Som (Mobile) */}
          {activeOverlay === 'mixer' && currentTrack && (
            <div className="absolute top-0 left-0 right-0 bottom-16 md:bottom-24 flex flex-col bg-brand-dark overflow-hidden animate-in fade-in duration-200">
              <MobileMixerOverlay />
            </div>
          )}
        </div>
      </div>

      {/* 3. NOTIFICAÇÃO TOAST FLUTUANTE DE EXPORTAÇÃO */}
      <ExportToast />

      {/* 4. PERSISTENT AUDIO PLAYER */}
      <MesaPlayer />

    </div>
  );
};
