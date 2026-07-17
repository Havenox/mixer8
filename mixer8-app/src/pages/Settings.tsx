import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  User, Mail, Lock, Phone, FileText, 
  Image, Save, AlertTriangle, CheckCircle,
  Upload, Loader2
} from 'lucide-react';

import { API_URL, SERVER_URL } from '../config';

export const Settings: React.FC = () => {
  const { CurrentUser, Token, UpdateCurrentUser } = useAuth();

  // Estados dos Campos
  const [email, setEmail] = useState(CurrentUser?.Email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [userName, setUserName] = useState(CurrentUser?.UserName || '');
  const [firstName, setFirstName] = useState(CurrentUser?.FirstName || '');
  const [lastName, setLastName] = useState(CurrentUser?.LastName || '');
  const [phone, setPhone] = useState(CurrentUser?.Phone || '');
  const [bio, setBio] = useState(CurrentUser?.Bio || '');
  const [avatarUrl, setAvatarUrl] = useState(CurrentUser?.AvatarUrl || '');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Validação do UserName
  const [userNameStatus, setUserNameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');

  // Controle de Feedbacks e Requisição
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccess('');
    setIsUploadingAvatar(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL}/Auth/Profile/Avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Token}`
        },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setAvatarUrl(data.AvatarUrl);

        // Atualizar o usuário logado
        const meRes = await fetch(`${API_URL}/Auth/Me`, {
          headers: {
            'Authorization': `Bearer ${Token}`
          }
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          UpdateCurrentUser(meData);
        }

        setSuccess('Imagem de perfil enviada e atualizada com sucesso!');
      } else {
        const errData = await res.json();
        setError(errData.ErrorMessage || 'Erro ao enviar imagem de perfil.');
      }
    } catch {
      setError('Erro de conexão ao enviar a imagem de perfil.');
    } finally {
      setIsUploadingAvatar(false);
      e.target.value = '';
    }
  };

  // Checagem em tempo real do UserName com debounce
  useEffect(() => {
    // Se for o mesmo UserName atual do usuário logado, considera disponível
    if (userName.trim().toLowerCase() === CurrentUser?.UserName?.toLowerCase()) {
      setUserNameStatus('available');
      return;
    }

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
  }, [userName, CurrentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !userName) {
      setError('E-mail e Nome de Usuário são campos obrigatórios.');
      return;
    }

    if (userNameStatus !== 'available') {
      setError('Por favor, defina um Nome de Usuário válido e disponível.');
      return;
    }

    if (password) {
      if (!currentPassword) {
        setError('Por favor, informe a sua senha atual para confirmar a alteração.');
        return;
      }
      if (password.length < 6) {
        setError('A nova senha deve possuir no mínimo 6 caracteres.');
        return;
      }
      if (password === currentPassword) {
        setError('A nova senha não pode ser igual à senha atual.');
        return;
      }
      if (password !== confirmPassword) {
        setError('As senhas não coincidem.');
        return;
      }
    }

    setIsPending(true);

    try {
      const res = await fetch(`${API_URL}/Auth/Profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Token}`
        },
        body: JSON.stringify({
          Email: email,
          Password: password || null,
          CurrentPassword: currentPassword || null,
          UserName: userName,
          FirstName: firstName || null,
          LastName: lastName || null,
          Phone: phone || null,
          Bio: bio || null,
          AvatarUrl: avatarUrl || null,
          AudioEngineMode: 'Power'
        })
      });

      if (res.ok) {
        const data = await res.json();
        // Atualiza o token no localStorage
        localStorage.setItem('mixer8_token', data.Token);

        // Busca dados atualizados completos do Me
        const meRes = await fetch(`${API_URL}/Auth/Me`, {
          headers: {
            'Authorization': `Bearer ${data.Token}`
          }
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          UpdateCurrentUser(meData);
        }

        setSuccess('Configurações atualizadas com sucesso!');
        setPassword('');
        setConfirmPassword('');
        setCurrentPassword('');
      } else {
        const errData = await res.json();
        if (errData.ErrorMessage === 'USERNAME_ALREADY_IN_USE') {
          setError('Nome de usuário não está disponível.');
        } else if (errData.ErrorMessage === 'EMAIL_ALREADY_IN_USE') {
          setError('E-mail já está em uso por outra conta.');
        } else if (errData.ErrorMessage === 'CURRENT_PASSWORD_REQUIRED') {
          setError('A senha atual é necessária para confirmar a alteração de senha.');
        } else if (errData.ErrorMessage === 'CURRENT_PASSWORD_INVALID') {
          setError('A senha atual informada é inválida.');
        } else {
          setError(errData.ErrorMessage || 'Erro ao atualizar perfil.');
        }
      }
    } catch {
      setError('Erro ao se conectar ao servidor.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações de Conta</h1>
        <p className="text-xs text-brand-gray mt-1">Gerencie suas informações pessoais, detalhes de perfil público e segurança.</p>
      </div>

      {/* Alertas */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded text-sm text-red-400 flex items-start gap-2 animate-in fade-in duration-250">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-brand-green/10 border border-brand-green/30 p-4 rounded text-sm text-brand-green flex items-start gap-2 animate-in fade-in duration-250">
          <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Formulário Principal */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        
        {/* Bloco 1: Informações Públicas (Grid lateral com Avatar) */}
        <div className="bg-brand-card border border-brand-hover p-6 rounded-md flex flex-col md:flex-row gap-8 items-start">
          
          {/* Coluna Esquerda: Form de Perfil */}
          <div className="flex-1 flex flex-col gap-4 w-full">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-brand-hover pb-2">
              Perfil Público
            </h2>

            {/* UserName (Handle) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-brand-gray" htmlFor="username">
                Nome de Usuário (Link de Perfil)
              </label>
              <div className="relative">
                <input
                  id="username"
                  type="text"
                  value={userName}
                  disabled={isPending}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full bg-brand-black border border-brand-hover rounded py-2 px-3 pl-10 pr-10 text-sm text-white placeholder-brand-gray/50 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
                  placeholder="seu-usuario"
                />
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray" />
                
                {userNameStatus === 'checking' && (
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-brand-green/30 border-t-brand-green animate-spin" />
                )}
                {userNameStatus === 'available' && (
                  <CheckCircle className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-green" />
                )}
                {(userNameStatus === 'taken' || userNameStatus === 'invalid') && (
                  <AlertTriangle className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-brand-gray">
                  Seu link de acesso será: <span className="text-brand-green font-mono">mixer8.com.br/@{userName || 'seu-usuario'}</span>
                </span>
                {userNameStatus === 'checking' && <span className="text-[10px] text-brand-gray animate-pulse">Verificando...</span>}
                {userNameStatus === 'available' && <span className="text-[10px] text-brand-green font-medium">Nome de usuário disponível</span>}
                {userNameStatus === 'taken' && <span className="text-[10px] text-red-500 font-medium">Nome de usuário não está disponível</span>}
                {userNameStatus === 'invalid' && <span className="text-[10px] text-red-500 font-medium">Use apenas letras, números, '.' e '_' (mín. 3 caracteres)</span>}
              </div>
            </div>

            {/* Nome / Sobrenome (Grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-brand-gray" htmlFor="firstName">
                  Nome
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  disabled={isPending}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="bg-brand-black border border-brand-hover rounded py-2 px-3 text-sm text-white focus:outline-none focus:border-brand-green transition-all"
                  placeholder="Seu primeiro nome"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-brand-gray" htmlFor="lastName">
                  Sobrenome
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  disabled={isPending}
                  onChange={(e) => setLastName(e.target.value)}
                  className="bg-brand-black border border-brand-hover rounded py-2 px-3 text-sm text-white focus:outline-none focus:border-brand-green transition-all"
                  placeholder="Seu sobrenome"
                />
              </div>
            </div>

            {/* Bio */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-brand-gray" htmlFor="bio">
                Biografia / Descrição
              </label>
              <div className="relative">
                <textarea
                  id="bio"
                  value={bio}
                  disabled={isPending}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="w-full bg-brand-black border border-brand-hover rounded py-2 px-3 pl-10 text-sm text-white placeholder-brand-gray/50 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all resize-none"
                  placeholder="Fale algo sobre você..."
                />
                <FileText className="absolute left-3.5 top-3.5 w-4 h-4 text-brand-gray" />
              </div>
            </div>
          </div>

          {/* Coluna Direita: Preview e Upload de Avatar */}
          <div className="w-full md:w-52 flex flex-col items-center gap-4 border border-brand-hover bg-brand-black/30 p-4 rounded-md shrink-0 select-none">
            <span className="text-xs font-bold text-brand-gray uppercase tracking-wider">Avatar</span>
            
            <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-brand-green flex items-center justify-center bg-brand-hover relative group shadow-2xl">
              {avatarUrl ? (
                <img 
                  src={avatarUrl.startsWith('http') ? avatarUrl : `${SERVER_URL}${avatarUrl}`} 
                  className="w-full h-full object-cover" 
                  alt="Avatar Preview" 
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <User className="w-12 h-12 text-brand-green/45" />
              )}

              {isUploadingAvatar && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-brand-green" />
                </div>
              )}
            </div>

            {/* Input de arquivo físico estilo Spotify */}
            <div className="w-full flex flex-col gap-2">
              <input
                id="avatar-file-input"
                type="file"
                accept="image/png, image/jpeg, image/jpg, image/webp"
                disabled={isPending || isUploadingAvatar}
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <label
                htmlFor="avatar-file-input"
                className={`w-full py-2 px-3 bg-brand-green hover:bg-brand-green/90 text-black text-xs font-bold rounded cursor-pointer transition-all flex items-center justify-center gap-2 hover:scale-105 active:scale-95 duration-200 select-none ${
                  (isPending || isUploadingAvatar) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isUploadingAvatar ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Foto</span>
                  </>
                )}
              </label>
            </div>

            <div className="w-full h-[1px] bg-brand-hover my-1" />

            {/* URL externa opcional */}
            <div className="w-full flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-brand-gray" htmlFor="avatarUrl">
                Ou URL Externa da Imagem
              </label>
              <div className="relative">
                <input
                  id="avatarUrl"
                  type="text"
                  value={avatarUrl}
                  disabled={isPending || isUploadingAvatar}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="w-full bg-brand-black border border-brand-hover rounded py-1.5 px-2 pl-8 text-[11px] text-white focus:outline-none focus:border-brand-green transition-all"
                  placeholder="https://imagem.com/foto.jpg"
                />
                <Image className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-gray" />
              </div>
            </div>
          </div>

        </div>

        {/* Bloco 2: Informações de Conta */}
        <div className="bg-brand-card border border-brand-hover p-6 rounded-md flex flex-col gap-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-brand-hover pb-2">
            Configurações da Conta
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* E-mail */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-brand-gray" htmlFor="email">
                Endereço de E-mail
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  disabled={isPending}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-brand-black border border-brand-hover rounded py-2 px-3 pl-10 text-sm text-white placeholder-brand-gray/50 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
                  placeholder="nome@exemplo.com"
                />
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray" />
              </div>
            </div>

            {/* Telefone */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-brand-gray" htmlFor="phone">
                Telefone de Contato
              </label>
              <div className="relative">
                <input
                  id="phone"
                  type="text"
                  value={phone}
                  disabled={isPending}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-brand-black border border-brand-hover rounded py-2 px-3 pl-10 text-sm text-white placeholder-brand-gray/50 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
                  placeholder="(00) 00000-0000"
                />
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray" />
              </div>
            </div>
          </div>
        </div>

        {/* Bloco 3: Segurança (Senha) */}
        <div className="bg-brand-card border border-brand-hover p-6 rounded-md flex flex-col gap-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-brand-hover pb-2">
            Segurança da Conta (Alterar Senha)
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Senha Atual */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-brand-gray" htmlFor="currentPassword">
                Senha Atual
              </label>
              <div className="relative">
                <input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  disabled={isPending}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-brand-black border border-brand-hover rounded py-2 px-3 pl-10 text-sm text-white placeholder-brand-gray/50 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
                  placeholder="Digite sua senha atual"
                />
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray" />
              </div>
            </div>

            {/* Nova Senha */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-brand-gray" htmlFor="newPassword">
                Nova Senha (Mínimo 6 caracteres)
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type="password"
                  value={password}
                  disabled={isPending}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-brand-black border border-brand-hover rounded py-2 px-3 pl-10 text-sm text-white placeholder-brand-gray/50 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
                  placeholder="Digite nova senha segura"
                />
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray" />
              </div>
            </div>

            {/* Confirmar Senha */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-brand-gray" htmlFor="confirmPassword">
                Confirmar Nova Senha
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  disabled={isPending}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-brand-black border border-brand-hover rounded py-2 px-3 pl-10 text-sm text-white placeholder-brand-gray/50 focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green transition-all"
                  placeholder="Confirme a nova senha"
                />
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray" />
              </div>
            </div>
          </div>
        </div>

        {/* Botão de Gravação */}
        <div className="flex justify-end mt-2">
          <button
            type="submit"
            disabled={isPending || userNameStatus !== 'available'}
            className="flex items-center gap-2 bg-brand-green hover:bg-brand-green/90 text-black font-bold py-2.5 px-6 rounded text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed cursor-pointer"
          >
            {isPending ? 'Salvando...' : 'Salvar Alterações'}
            {!isPending && <Save className="w-4 h-4" />}
          </button>
        </div>

      </form>
    </div>
  );
};
