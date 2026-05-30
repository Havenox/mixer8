import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Mail, Lock, ArrowRight, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { UserRole } from '../types/Auth';

export const Register: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('PaidUser'); // Default to PRO to let them test DAW features easily!
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);
  
  const { Register: authRegister } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setError('');
    setIsPending(true);

    try {
      const success = await authRegister(email, password, role);
      if (success) {
        navigate('/');
      } else {
        setError('Erro ao criar conta. Tente outro e-mail.');
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
          <div className="flex items-center gap-2">
            <Sparkles className="w-9 h-9 text-brand-green animate-pulse" />
            <span className="font-black text-2xl tracking-tighter uppercase text-white">
              Mixer<span className="text-brand-green">8</span>
            </span>
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

          {/* Tipo de Assinatura */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-brand-gray" htmlFor="role">
              Tipo de Assinatura (Simulado)
            </label>
            <div className="relative">
              <select 
                id="role"
                value={role}
                disabled={isPending}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full bg-brand-black border border-brand-hover rounded py-2 px-3 pl-10 text-sm text-white focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all appearance-none cursor-pointer"
              >
                <option value="PaidUser">PaidUser (Acesso ao Mixer PRO e Upload)</option>
                <option value="User">User (Acesso apenas à Escuta Standard)</option>
                <option value="Admin">Admin (Controle total do Sistema)</option>
              </select>
              <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray" />
            </div>
          </div>

          {/* Botão de Envio */}
          <button 
            type="submit"
            disabled={isPending}
            className="w-full py-2.5 bg-brand-green text-black font-bold text-sm rounded hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed transition-all mt-2 flex items-center justify-center gap-2 cursor-pointer"
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
