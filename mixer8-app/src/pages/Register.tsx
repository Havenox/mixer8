import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, ArrowRight, AlertTriangle, User, Check, X } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const Register: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [userNameStatus, setUserNameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);
  
  const { Register: authRegister } = useAuth();
  const navigate = useNavigate();

  // Validação e checagem em tempo real do UserName com debounce
  useEffect(() => {
    if (!userName) {
      setUserNameStatus('idle');
      return;
    }

    const regex = /^[a-zA-Z0-9_.]+$/;
    if (userName.length < 3 || !regex.test(userName)) {
      setUserNameStatus('invalid');
      return;
    }

    setUserNameStatus('checking');

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/Auth/CheckUsername?UserName=${encodeURIComponent(userName)}`, {
          signal: controller.signal
        });
        if (res.ok) {
          const data = await res.json();
          // PascalCase contract check (IsAvailable)
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
  }, [userName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !userName) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    if (userNameStatus !== 'available') {
      setError('Por favor, escolha um nome de usuário válido e disponível.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setError('');
    setIsPending(true);

    try {
      const result = await authRegister(email, password, userName);
      if (result.success) {
        navigate('/');
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
    <div className="min-h-screen bg-brand-black flex flex-col justify-center items-center px-4 py-12 select-none">
      
      {/* Container de Cadastro */}
      <div className="w-full max-w-[450px] bg-brand-card border border-brand-hover p-8 md:p-10 rounded-md shadow-2xl flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="flex items-center">
            <img src="/mixer8-logo.webp" alt="Mixer8 Logo" className="h-10 w-auto object-contain select-none" />
          </div>
          <h2 className="text-xl font-bold text-white mt-2">Comece a mixar suas Stems</h2>
          <p className="text-xs text-brand-gray">Crie sua conta para desfrutar de streaming com multi-stems</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 p-3 rounded text-xs text-red-400 flex items-start gap-2 animate-in fade-in duration-250">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Nome de Usuário */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-brand-gray" htmlFor="username">
              Nome de Usuário
            </label>
            <div className="relative">
              <input 
                id="username"
                type="text"
                placeholder="seu-usuario"
                value={userName}
                disabled={isPending}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full bg-brand-black border border-brand-hover rounded py-2 px-3 pl-10 pr-10 text-sm text-white placeholder-brand-gray/50 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
              />
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray" />
              
              {/* Indicadores Visuais da Checagem */}
              {userNameStatus === 'checking' && (
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-brand-green/30 border-t-brand-green animate-spin" />
              )}
              {userNameStatus === 'available' && (
                <Check className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-green animate-in zoom-in-50 duration-200" />
              )}
              {(userNameStatus === 'taken' || userNameStatus === 'invalid') && (
                <X className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500 animate-in zoom-in-50 duration-200" />
              )}
            </div>

            {/* Helper de Link e Mensagens de Feedback */}
            <div className="flex flex-col gap-0.5 mt-0.5">
              <span className="text-[10px] text-brand-gray select-none">
                Link de acesso: <span className="text-brand-green font-mono">mixer8.com.br/@{userName || 'seu-usuario'}</span>
              </span>
              
              {userNameStatus === 'checking' && (
                <span className="text-[10px] text-brand-gray/80 animate-pulse mt-0.5">Verificando disponibilidade...</span>
              )}
              {userNameStatus === 'available' && (
                <span className="text-[10px] text-brand-green font-medium mt-0.5">Nome de usuário disponível</span>
              )}
              {userNameStatus === 'taken' && (
                <span className="text-[10px] text-red-500 font-medium mt-0.5">Nome de usuário não está disponível</span>
              )}
              {userNameStatus === 'invalid' && (
                <span className="text-[10px] text-red-500 font-medium mt-0.5">Mínimo 3 caracteres; use apenas letras, números, '.' e '_'</span>
              )}
            </div>
          </div>

          {/* E-mail */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-brand-gray" htmlFor="email">
              Endereço de E-mail
            </label>
            <div className="relative">
              <input 
                id="email"
                type="email"
                placeholder="nome@exemplo.com"
                value={email}
                disabled={isPending}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-brand-black border border-brand-hover rounded py-2 px-3 pl-10 text-sm text-white placeholder-brand-gray/50 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
              />
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray" />
            </div>
          </div>

          {/* Senha */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-brand-gray" htmlFor="password">
              Senha de Acesso (Mín. 6 dígitos)
            </label>
            <div className="relative">
              <input 
                id="password"
                type="password"
                placeholder="Crie sua senha segura"
                value={password}
                disabled={isPending}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-brand-black border border-brand-hover rounded py-2 px-3 pl-10 text-sm text-white placeholder-brand-gray/50 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
              />
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray" />
            </div>
          </div>

          {/* Botão de Envio */}
          <button 
            type="submit"
            disabled={isPending || userNameStatus !== 'available'}
            className="w-full py-2.5 bg-brand-green text-black font-bold text-sm rounded hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed transition-all mt-2 flex items-center justify-center gap-2 cursor-pointer animate-in fade-in duration-200"
          >
            {isPending ? 'Criando Conta...' : 'Cadastrar e Entrar'}
            {!isPending && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        {/* Login */}
        <div className="text-center text-xs text-brand-gray border-t border-brand-hover pt-4">
          Já possui uma conta?{' '}
          <Link to="/login" className="text-brand-green font-semibold hover:underline">
            Faça login
          </Link>
        </div>

      </div>
    </div>
  );
};
