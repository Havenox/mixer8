import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, AlertTriangle } from 'lucide-react';

import { API_URL } from '../config';

export const Admin: React.FC = () => {
  const { CurrentUser, Token } = useAuth();
  
  // Estado dos usuários cadastrados no banco de dados
  const [users, setUsers] = useState<{ UserId: string; Email: string; UserRole: string; CreatedAt: string }[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  // Controle de configurações de recursos premium
  const [offlineRoles, setOfflineRoles] = useState<Record<string, boolean>>({
    admin: true,
    moderator: true,
    paiduser: true,
    user: false,
    anonymous: false
  });
  const [customRolesText, setCustomRolesText] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [settingsError, setSettingsError] = useState('');

  const fetchUsers = async () => {
    if (!Token) return;
    setIsLoadingUsers(true);
    try {
      const res = await fetch(`${API_URL}/Users`, {
        headers: {
          'Authorization': `Bearer ${Token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch {
      // Ignora falha silenciosa
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const fetchSystemSettings = async () => {
    if (!Token) return;
    try {
      const res = await fetch(`${API_URL}/SystemSettings`);
      if (res.ok) {
        const data = await res.json();
        const allowedRolesStr = data.PremiumFeature_DownloadOffline || 'Admin,Moderator,PaidUser';
        const allowedRoles = allowedRolesStr.split(',').map((r: string) => r.trim().toLowerCase());
        
        const standardRoles = ['admin', 'moderator', 'paiduser', 'user', 'anonymous'];
        const standardMap: Record<string, boolean> = {
          admin: false,
          moderator: false,
          paiduser: false,
          user: false,
          anonymous: false
        };
        const custom: string[] = [];
        
        allowedRoles.forEach((role: string) => {
          if (standardRoles.includes(role)) {
            standardMap[role] = true;
          } else if (role) {
            custom.push(role);
          }
        });
        
        setOfflineRoles(standardMap);
        setCustomRolesText(custom.join(', '));
      }
    } catch {
      // Ignora falha silenciosa
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchSystemSettings();
  }, []);

  if (CurrentUser?.UserRole !== 'Admin' && CurrentUser?.UserRole !== 'Moderator') {
    return (
      <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-md flex flex-col gap-3 max-w-[500px] mx-auto mt-12 text-center items-center animate-in fade-in duration-200">
        <AlertTriangle className="w-12 h-12 text-red-500" />
        <h2 className="text-lg font-bold text-white">Acesso Negado (403)</h2>
        <p className="text-xs text-brand-gray">
          Seu perfil atual ({CurrentUser?.UserRole}) não tem privilégios de Administrador. Entre em contato com o suporte ou utilize um login adequado.
        </p>
      </div>
    );
  }

  const handleSaveSettings = async () => {
    if (!Token) return;
    setIsSavingSettings(true);
    setSettingsError('');
    setSettingsSuccess(false);

    try {
      // Reconstrói a string de roles
      const roles: string[] = [];
      Object.entries(offlineRoles).forEach(([role, enabled]) => {
        if (enabled) {
          // Salva com casing correto esperado
          const properCase = role === 'paiduser' ? 'PaidUser' : role.charAt(0).toUpperCase() + role.slice(1);
          roles.push(properCase);
        }
      });

      if (customRolesText) {
        customRolesText.split(',').forEach(r => {
          const trimmed = r.trim();
          if (trimmed && !roles.includes(trimmed)) {
            roles.push(trimmed);
          }
        });
      }

      const value = roles.join(',');
      const res = await fetch(`${API_URL}/SystemSettings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Token}`
        },
        body: JSON.stringify({ PremiumFeature_DownloadOffline: value })
      });

      if (res.ok) {
        setSettingsSuccess(true);
        // Dispara evento customizado para notificar outras partes do app (como o PlayerContext)
        window.dispatchEvent(new CustomEvent('system-settings-changed'));
        setTimeout(() => setSettingsSuccess(false), 3000);
      } else {
        const errorData = await res.json();
        setSettingsError(errorData.ErrorMessage || 'Falha ao salvar configurações.');
      }
    } catch {
      setSettingsError('Erro de conexão ao tentar salvar configurações do sistema.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300 select-none">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-brand-hover pb-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight m-0 text-white flex items-center gap-2">
            <Shield className="w-8 h-8 text-brand-green" /> Painel de Controle CRM
          </h1>
          <p className="text-sm text-brand-gray">Administre usuários e parametrize as configurações globais de acesso aos recursos premium do sistema.</p>
        </div>
      </div>

      {/* Seção Central de 2 Colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Caixa de Parametrização de Recursos Premium (Global Settings) */}
          <div className="bg-brand-card border border-brand-hover p-6 rounded-md flex flex-col gap-4 shadow-xl">
            <div className="flex flex-col gap-1 border-b border-brand-hover pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2 m-0">
                ⚙️ Configurações Globais (Recursos Premium)
              </h2>
              <p className="text-xs text-brand-gray">
                Gerencie quais papéis (Roles) possuem acesso a funcionalidades específicas, como download offline.
              </p>
            </div>

            {settingsError && (
              <div className="bg-red-500/10 border border-red-500/30 p-3 rounded text-xs text-red-400">
                {settingsError}
              </div>
            )}

            {/* Feature 1: Download Offline */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                📥 Permissões para Download Offline
              </span>
              <p className="text-[11px] text-brand-gray -mt-1 leading-normal">
                Determine quais níveis de acesso têm permissão de salvar músicas localmente. Visitantes não autenticados são mapeados como <strong>Anonymous</strong>.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-1">
                {[
                  { id: 'admin', label: 'Administrador' },
                  { id: 'moderator', label: 'Moderador' },
                  { id: 'paiduser', label: 'Paid PRO' },
                  { id: 'user', label: 'Free Tier' },
                  { id: 'anonymous', label: 'Anônimo (Não Logado)' }
                ].map(item => (
                  <label key={item.id} className="flex items-center gap-2 text-xs text-white cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={offlineRoles[item.id] || false}
                      onChange={(e) => setOfflineRoles(prev => ({ ...prev, [item.id]: e.target.checked }))}
                      className="accent-brand-green w-4 h-4 cursor-pointer"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>

              {/* Roles customizadas */}
              <div className="flex flex-col gap-1.5 mt-2">
                <label className="text-xs font-semibold text-brand-gray">Funções Customizadas Adicionais (separadas por vírgula)</label>
                <input 
                  type="text"
                  value={customRolesText}
                  onChange={(e) => setCustomRolesText(e.target.value)}
                  placeholder="ex: premium1, premium2"
                  disabled={isSavingSettings}
                  className="w-full bg-black border border-brand-hover rounded p-2.5 text-brand-green focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green"
                />
              </div>
            </div>

            {/* Botão Salvar */}
            <button 
              onClick={handleSaveSettings}
              disabled={isSavingSettings}
              className="py-2.5 px-4 bg-brand-green text-black font-bold text-sm rounded hover:scale-105 active:scale-95 transition-all self-start flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:scale-100 mt-2"
            >
              {isSavingSettings ? 'Salvando Configurações...' : 'Salvar Configurações'}
              {settingsSuccess && <span className="text-xs text-black font-normal bg-white px-2 py-0.5 rounded ml-2 animate-bounce">Salvo!</span>}
            </button>

          </div>
        </div>

        {/* Coluna Direita: CRM Lista de Usuários */}
        <div className="flex flex-col gap-6">
          <div className="bg-brand-card border border-brand-hover p-6 rounded-md flex flex-col gap-4 shadow-xl">
            <div className="flex flex-col gap-1 border-b border-brand-hover pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2 m-0">
                👥 Usuários Ativos (CRM)
              </h2>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              {isLoadingUsers ? (
                <div className="text-xs text-brand-gray animate-pulse font-semibold">
                  Carregando usuários do CRM...
                </div>
              ) : users.length === 0 ? (
                <div className="text-xs text-brand-gray font-semibold">
                  Nenhum usuário cadastrado no banco.
                </div>
              ) : (
                users.map(user => (
                  <div key={user.UserId} className="flex items-center justify-between border-b border-brand-hover pb-2">
                    <div className="flex flex-col">
                      <span className="font-bold text-white">{user.Email}</span>
                      <span className={`text-[10px] font-semibold ${user.UserRole === 'Admin' ? 'text-brand-green' : user.UserRole === 'Moderator' ? 'text-blue-400' : 'text-brand-gray'}`}>
                        {user.UserRole === 'Admin' ? 'ADMINISTRADOR' : user.UserRole === 'Moderator' ? 'MODERADOR' : user.UserRole === 'PaidUser' ? 'USUÁRIO PREMIUM' : 'USUÁRIO COMUM'}
                      </span>
                    </div>
                    <span className="text-[10px] bg-brand-hover text-white px-2 py-0.5 rounded border border-brand-hover">
                      {user.UserRole === 'PaidUser' || user.UserRole === 'Admin' ? 'Paid PRO' : 'Free Tier'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
