import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, ArrowRight, AlertTriangle } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);
  
  const { Login: authLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    setError('');
    setIsPending(true);

    try {
      const success = await authLogin(email, password);
      if (success) {
        navigate('/');
      } else {
        setError('Credenciais inválidas. Verifique os dados informados.');
      }
    } catch {
      setError('Erro ao autenticar. Tente novamente.');
    } finally {
      setIsPending(false);
    }
  };

  // Login rápido para testar
  return (
    <div className="min-h-screen bg-brand-black flex flex-col justify-center items-center px-4 py-12 select-none">
      
      {/* Container de Login */}
      <div className="w-full max-w-[450px] bg-brand-card border border-brand-hover p-8 md:p-10 rounded-md shadow-2xl flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="flex items-center">
            <img src="/mixer8-logo.webp" alt="Mixer8 Logo" className="h-10 w-auto object-contain select-none" />
          </div>
          <h2 className="text-xl font-bold text-white mt-2">Seja bem-vindo de volta</h2>
          <p className="text-xs text-brand-gray">Acesse sua conta para curtir e mixar suas stems</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 p-3 rounded text-xs text-red-400 flex items-start gap-2 animate-in fade-in duration-250">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              Senha de Acesso
            </label>
            <div className="relative">
              <input 
                id="password"
                type="password"
                placeholder="Sua senha secreta"
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
            disabled={isPending}
            className="w-full py-2.5 bg-brand-green text-black font-bold text-sm rounded hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed transition-all mt-2 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isPending ? 'Verificando...' : 'Entrar na Conta'}
            {!isPending && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        {/* Cadastro */}
        <div className="text-center text-xs text-brand-gray border-t border-brand-hover pt-4">
          Não tem uma conta ainda?{' '}
          <Link to="/register" className="text-brand-green font-semibold hover:underline">
            Crie sua conta
          </Link>
        </div>

      </div>
    </div>
  );
};
