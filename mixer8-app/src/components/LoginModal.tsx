import React, { useState, useEffect } from 'react';
import { Mail, Lock, X, AlertTriangle, User as UserIcon, Check, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config';

interface LoginModalProps {
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onClose }) => {
  const { Login: authLogin, Register: authRegister } = useAuth();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
  // Login States
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Register States
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regUserName, setRegUserName] = useState('');
  const [userNameStatus, setUserNameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');

  // Common States
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);

  // Username validation check
  useEffect(() => {
    if (!regUserName) {
      setUserNameStatus('idle');
      return;
    }

    const regex = /^[a-zA-Z0-9_.]+$/;
    if (regUserName.length < 3 || !regex.test(regUserName)) {
      setUserNameStatus('invalid');
      return;
    }

    setUserNameStatus('checking');

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/Auth/CheckUsername?UserName=${encodeURIComponent(regUserName)}`, {
          signal: controller.signal
        });
        if (res.ok) {
          const data = await res.json();
          if (data.IsAvailable) {
            setUserNameStatus('available');
          } else {
            setUserNameStatus('taken');
          }
        } else {
          setUserNameStatus('idle');
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setUserNameStatus('idle');
        }
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [regUserName]);

  // Clean error when switching tabs
  const handleTabChange = (tab: 'login' | 'register') => {
    setActiveTab(tab);
    setError('');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    setError('');
    setIsPending(true);

    try {
      const success = await authLogin(loginEmail, loginPassword);
      if (success) {
        onClose();
      } else {
        setError('Credenciais inválidas. Verifique os dados informados.');
      }
    } catch {
      setError('Erro ao autenticar. Tente novamente.');
    } finally {
      setIsPending(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regEmail || !regPassword || !regUserName) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    if (userNameStatus !== 'available') {
      setError('Por favor, escolha um nome de usuário válido e disponível.');
      return;
    }

    if (regPassword.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setError('');
    setIsPending(true);

    try {
      const result = await authRegister(regEmail, regPassword, regUserName);
      if (result.success) {
        onClose();
      } else {
        if (result.error === 'USERNAME_ALREADY_IN_USE') {
          setError('Nome de usuário não está disponível');
        } else if (result.error === 'USER_ALREADY_EXISTS') {
          setError('Erro ao criar conta. Tente outro e-mail.');
        } else {
          setError(result.error || 'Erro no cadastro. Tente novamente.');
        }
      }
    } catch {
      setError('Erro no cadastro. Tente novamente.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div 
        className="w-full max-w-[420px] bg-brand-card border border-brand-hover p-6 rounded-md shadow-2xl flex flex-col gap-5 relative animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-brand-gray hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Logo and Greeting */}
        <div className="flex flex-col items-center text-center gap-1">
          <img src="/mixer8-logo.webp" alt="Mixer8 Logo" className="h-8 w-auto object-contain select-none" />
          <h2 className="text-base font-bold text-white mt-1">Conecte-se para Interagir</h2>
          <p className="text-[11px] text-brand-gray">Para curtir, salvar ou criar playlists, você precisa fazer parte da comunidade.</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-brand-hover">
          <button
            onClick={() => handleTabChange('login')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 cursor-pointer ${
              activeTab === 'login' 
                ? 'border-brand-green text-brand-green' 
                : 'border-transparent text-brand-gray hover:text-white'
            }`}
          >
            Entrar
          </button>
          <button
            onClick={() => handleTabChange('register')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 cursor-pointer ${
              activeTab === 'register' 
                ? 'border-brand-green text-brand-green' 
                : 'border-transparent text-brand-gray hover:text-white'
            }`}
          >
            Cadastrar
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded text-[11px] text-red-400 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Forms */}
        {activeTab === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-brand-gray" htmlFor="modal-email">
                Endereço de E-mail
              </label>
              <div className="relative">
                <input 
                  id="modal-email"
                  type="email"
                  placeholder="nome@exemplo.com"
                  value={loginEmail}
                  disabled={isPending}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-brand-black border border-brand-hover rounded py-2 px-3 pl-9 text-xs text-white placeholder-brand-gray/50 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
                />
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-gray" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-brand-gray" htmlFor="modal-password">
                Senha de Acesso
              </label>
              <div className="relative">
                <input 
                  id="modal-password"
                  type="password"
                  placeholder="Sua senha secreta"
                  value={loginPassword}
                  disabled={isPending}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-brand-black border border-brand-hover rounded py-2 px-3 pl-9 text-xs text-white placeholder-brand-gray/50 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-gray" />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isPending}
              className="w-full py-2 bg-brand-green text-black font-black text-xs uppercase tracking-wider rounded hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed transition-all mt-2 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isPending ? 'Verificando...' : 'Entrar na Conta'}
              {!isPending && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-brand-gray" htmlFor="modal-reg-username">
                Nome de Usuário
              </label>
              <div className="relative">
                <input 
                  id="modal-reg-username"
                  type="text"
                  placeholder="seu-usuario"
                  value={regUserName}
                  disabled={isPending}
                  onChange={(e) => setRegUserName(e.target.value)}
                  className="w-full bg-brand-black border border-brand-hover rounded py-2 px-3 pl-9 pr-9 text-xs text-white placeholder-brand-gray/50 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
                />
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-gray" />
                
                {userNameStatus === 'checking' && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-brand-green/30 border-t-brand-green animate-spin" />
                )}
                {userNameStatus === 'available' && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-green" />
                )}
                {(userNameStatus === 'taken' || userNameStatus === 'invalid') && (
                  <X className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-red-500" />
                )}
              </div>
              
              {userNameStatus === 'taken' && (
                <span className="text-[9px] text-red-500 font-medium">Nome de usuário indisponível</span>
              )}
              {userNameStatus === 'invalid' && (
                <span className="text-[9px] text-red-500 font-medium">Mín. 3 caracteres (a-z, 0-9, _, .)</span>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-brand-gray" htmlFor="modal-reg-email">
                Endereço de E-mail
              </label>
              <div className="relative">
                <input 
                  id="modal-reg-email"
                  type="email"
                  placeholder="nome@exemplo.com"
                  value={regEmail}
                  disabled={isPending}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="w-full bg-brand-black border border-brand-hover rounded py-2 px-3 pl-9 text-xs text-white placeholder-brand-gray/50 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
                />
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-gray" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-brand-gray" htmlFor="modal-reg-password">
                Senha de Acesso (Mín. 6 dígitos)
              </label>
              <div className="relative">
                <input 
                  id="modal-reg-password"
                  type="password"
                  placeholder="Crie sua senha segura"
                  value={regPassword}
                  disabled={isPending}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full bg-brand-black border border-brand-hover rounded py-2 px-3 pl-9 text-xs text-white placeholder-brand-gray/50 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-gray" />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isPending || userNameStatus !== 'available'}
              className="w-full py-2 bg-brand-green text-black font-black text-xs uppercase tracking-wider rounded hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed transition-all mt-2 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isPending ? 'Criando Conta...' : 'Cadastrar e Entrar'}
              {!isPending && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
