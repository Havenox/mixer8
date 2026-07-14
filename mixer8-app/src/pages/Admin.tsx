import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Shield, 
  AlertTriangle, 
  Settings, 
  Users, 
  ClipboardList, 
  Search, 
  ArrowUpDown, 
  Database
} from 'lucide-react';

import { API_URL } from '../config';

export const Admin: React.FC = () => {
  const { CurrentUser, Token } = useAuth();
  
  // Controle de abas
  const [activeTab, setActiveTab] = useState<'settings' | 'users' | 'logs'>('settings');

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

  // Estados dos logs de sistema
  const [logs, setLogs] = useState<any[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [level, setLevel] = useState('');
  const [sortDescending, setSortDescending] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Ref para o elemento de scroll infinito
  const observerRef = useRef<HTMLDivElement | null>(null);

  // Debounce do campo de busca
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 450);
    return () => clearTimeout(timer);
  }, [search]);

  // Resetar lista de logs e carregar página 1 quando mudar filtros/busca/ordem
  useEffect(() => {
    if (activeTab === 'logs') {
      setPage(1);
      setHasMore(true);
      fetchLogs(1, false);
    }
  }, [debouncedSearch, category, level, sortDescending, activeTab]);

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

  const fetchLogs = async (pageNum: number, isAppend: boolean) => {
    if (!Token) return;
    setIsLoadingLogs(true);
    try {
      const queryParams = new URLSearchParams({
        page: pageNum.toString(),
        pageSize: '20',
        search: debouncedSearch,
        category: category,
        level: level,
        sortBy: 'timestamp',
        sortDescending: sortDescending.toString()
      });
      const res = await fetch(`${API_URL}/SystemEvents?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${Token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (isAppend) {
          setLogs(prev => {
            // Evitar itens duplicados por causa do React StrictMode
            const existingIds = new Set(prev.map(item => item.EventId));
            const newItems = data.Items.filter((item: any) => !existingIds.has(item.EventId));
            return [...prev, ...newItems];
          });
        } else {
          setLogs(data.Items);
        }
        setTotalLogs(data.TotalCount);
        setHasMore(pageNum < data.TotalPages);
      }
    } catch {
      // Ignora falha silenciosa
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const loadMoreLogs = () => {
    if (isLoadingLogs || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchLogs(nextPage, true);
  };

  // Setup do IntersectionObserver para scroll infinito
  useEffect(() => {
    if (activeTab !== 'logs' || !hasMore || isLoadingLogs) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreLogs();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    const currentRef = observerRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [page, hasMore, isLoadingLogs, activeTab]);

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
      const roles: string[] = [];
      Object.entries(offlineRoles).forEach(([role, enabled]) => {
        if (enabled) {
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

  const getLevelBadgeStyle = (level: string) => {
    switch (level) {
      case 'Success':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'Error':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'Warning':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20';
    }
  };

  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('pt-BR');
    } catch {
      return isoString;
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300 select-none">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-hover pb-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black tracking-tight m-0 text-white flex items-center gap-2">
            <Shield className="w-8 h-8 text-brand-green" /> Painel de Controle CRM
          </h1>
          <p className="text-sm text-brand-gray">Gerencie usuários, configurações e consulte logs de auditoria do sistema Mixer8.</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-brand-hover gap-1">
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'settings'
              ? 'border-brand-green text-brand-green bg-brand-hover/10 font-black'
              : 'border-transparent text-brand-gray hover:text-white hover:bg-brand-hover/5'
          }`}
        >
          <Settings className="w-4 h-4" /> Configurações
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'users'
              ? 'border-brand-green text-brand-green bg-brand-hover/10 font-black'
              : 'border-transparent text-brand-gray hover:text-white hover:bg-brand-hover/5'
          }`}
        >
          <Users className="w-4 h-4" /> Usuários Ativos
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'logs'
              ? 'border-brand-green text-brand-green bg-brand-hover/10 font-black'
              : 'border-transparent text-brand-gray hover:text-white hover:bg-brand-hover/5'
          }`}
        >
          <ClipboardList className="w-4 h-4" /> Logs do Sistema
        </button>
      </div>

      {/* Conteúdo da Aba Ativa */}
      <div className="animate-in fade-in duration-300">
        
        {activeTab === 'settings' && (
          <div className="bg-brand-card border border-brand-hover p-6 rounded-md flex flex-col gap-4 shadow-xl max-w-[800px]">
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

            <button 
              onClick={handleSaveSettings}
              disabled={isSavingSettings}
              className="py-2.5 px-4 bg-brand-green text-black font-bold text-sm rounded hover:scale-105 active:scale-95 transition-all self-start flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:scale-100 mt-2"
            >
              {isSavingSettings ? 'Salvando Configurações...' : 'Salvar Configurações'}
              {settingsSuccess && <span className="text-xs text-black font-normal bg-white px-2 py-0.5 rounded ml-2 animate-bounce">Salvo!</span>}
            </button>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-brand-card border border-brand-hover p-6 rounded-md flex flex-col gap-4 shadow-xl max-w-[800px]">
            <div className="flex flex-col gap-1 border-b border-brand-hover pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2 m-0">
                👥 Usuários Ativos (CRM)
              </h2>
              <p className="text-xs text-brand-gray">Relação de todos os usuários registrados no sistema.</p>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              {isLoadingUsers ? (
                <div className="text-xs text-brand-gray animate-pulse font-semibold py-4">
                  Carregando usuários do CRM...
                </div>
              ) : users.length === 0 ? (
                <div className="text-xs text-brand-gray font-semibold py-4">
                  Nenhum usuário cadastrado no banco.
                </div>
              ) : (
                users.map(user => (
                  <div key={user.UserId} className="flex items-center justify-between border-b border-brand-hover pb-3 pt-1">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-white text-sm">{user.Email}</span>
                      <span className={`text-[10px] font-bold ${user.UserRole === 'Admin' ? 'text-brand-green' : user.UserRole === 'Moderator' ? 'text-blue-400' : 'text-brand-gray'}`}>
                        {user.UserRole === 'Admin' ? 'ADMINISTRADOR' : user.UserRole === 'Moderator' ? 'MODERADOR' : user.UserRole === 'PaidUser' ? 'USUÁRIO PREMIUM' : 'USUÁRIO COMUM'}
                      </span>
                    </div>
                    <span className="text-[10px] bg-brand-hover text-white px-2 py-1 rounded border border-brand-hover font-semibold">
                      {user.UserRole === 'PaidUser' || user.UserRole === 'Admin' ? 'Paid PRO' : 'Free Tier'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="flex flex-col gap-4">
            
            {/* Filtros e Busca */}
            <div className="bg-brand-card border border-brand-hover p-4 rounded-md flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
              
              {/* Campo de Busca */}
              <div className="relative flex-1 max-w-[450px]">
                <Search className="absolute left-3 top-3 w-4 h-4 text-brand-gray" />
                <input 
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por mensagem, música, usuário..."
                  className="w-full bg-black border border-brand-hover rounded pl-9 pr-3 py-2 text-xs text-white placeholder-brand-gray focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green"
                />
              </div>

              {/* Controles de Filtros */}
              <div className="flex flex-wrap items-center gap-3">
                
                {/* Filtro de Categoria */}
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="bg-black border border-brand-hover rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-green cursor-pointer"
                >
                  <option value="">Todas Categorias</option>
                  <option value="API">API</option>
                  <option value="Extractor">Extractor</option>
                  <option value="Downloader">Downloader</option>
                  <option value="Waveformer">Waveformer</option>
                  <option value="Auth">Auth</option>
                  <option value="System">System</option>
                </select>

                {/* Filtro de Nível */}
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="bg-black border border-brand-hover rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-green cursor-pointer"
                >
                  <option value="">Todos Níveis</option>
                  <option value="Info">Info</option>
                  <option value="Success">Success</option>
                  <option value="Warning">Warning</option>
                  <option value="Error">Error</option>
                </select>

                {/* Ordenação */}
                <button
                  onClick={() => setSortDescending(prev => !prev)}
                  className="flex items-center gap-2 bg-brand-hover border border-brand-hover hover:bg-zinc-800 text-white rounded px-3 py-2 text-xs font-semibold cursor-pointer active:scale-95 transition-all"
                  title="Inverter ordem do tempo"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>{sortDescending ? 'Mais Recentes' : 'Mais Antigos'}</span>
                </button>
              </div>

            </div>

            {/* Listagem de Logs (Design Compacto) */}
            <div className="bg-brand-card border border-brand-hover rounded-md shadow-xl overflow-hidden">
              {logs.length === 0 && !isLoadingLogs ? (
                <div className="text-center py-12 text-sm text-brand-gray font-semibold">
                  Nenhum log encontrado para os filtros selecionados.
                </div>
              ) : (
                <div className="divide-y divide-brand-hover">
                  {logs.map((log: any) => {
                    const isExpanded = expandedLogId === log.EventId;
                    const hasExtraInfo = log.Details || log.TrackTitle || log.UserEmail || log.UserName;
                    return (
                      <div 
                        key={log.EventId} 
                        className={`flex flex-col border-b border-brand-hover hover:bg-zinc-900/50 transition-colors ${isExpanded ? 'bg-zinc-900/30' : ''}`}
                      >
                        {/* Linha Principal do Log (Ultra Compacta) */}
                        <div 
                          onClick={() => setExpandedLogId(isExpanded ? null : log.EventId)}
                          className="flex items-center justify-between p-2 px-3 gap-3 text-xs cursor-pointer select-none min-h-[36px]"
                        >
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            {/* Nível do Log */}
                            <span className={`px-1.5 py-0.5 rounded-[3px] text-[8px] font-black tracking-wider uppercase border shrink-0 ${getLevelBadgeStyle(log.Level)}`}>
                              {log.Level}
                            </span>
                            {/* Categoria */}
                            <span className="bg-brand-hover text-white px-1.5 py-0.5 rounded-[3px] text-[8px] font-bold border border-brand-hover shrink-0">
                              {log.Category}
                            </span>
                            {/* Data/Hora */}
                            <span className="text-brand-gray text-[9px] shrink-0 font-mono">
                              {formatTimestamp(log.Timestamp)}
                            </span>
                            {/* Mensagem Principal (Truncada se recolhido) */}
                            <span className={`text-white font-medium text-xs min-w-0 ${isExpanded ? 'whitespace-normal' : 'truncate'}`}>
                              {log.Message}
                            </span>
                          </div>

                          {/* Indicador visual de que há mais conteúdo */}
                          {hasExtraInfo && (
                            <span className="text-[10px] text-brand-gray shrink-0 font-semibold px-2 py-0.5 rounded bg-brand-hover hover:text-white transition-colors">
                              {isExpanded ? 'Recolher' : 'Expandir'}
                            </span>
                          )}
                        </div>

                        {/* Detalhes Expansíveis (Acoplados: Música, Usuário e Stack Trace) */}
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-1 flex flex-col gap-2.5 animate-in slide-in-from-top-1 duration-150">
                            {/* Entidades Relacionadas (Música e Usuário) */}
                            {(log.TrackTitle || log.UserEmail || log.UserName) && (
                              <div className="flex flex-wrap gap-2 border-t border-brand-hover pt-2">
                                {log.TrackTitle && (
                                  <span className="text-[10px] bg-brand-green/10 border border-brand-green/20 text-brand-green px-2 py-0.5 rounded font-medium">
                                    🎵 Música: {log.TrackTitle}
                                  </span>
                                )}
                                {(log.UserEmail || log.UserName) && (
                                  <span className="text-[10px] bg-sky-500/10 border border-sky-500/20 text-sky-400 px-2 py-0.5 rounded font-medium">
                                    👤 Usuário: {log.UserName || log.UserEmail}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Detalhes do Log (ex: Stack Trace) */}
                            {log.Details && (
                              <div className="flex flex-col gap-1">
                                <span className="text-[8px] font-bold text-brand-gray tracking-wide uppercase">Detalhes Técnicos / Stack Trace:</span>
                                <pre className="bg-black text-rose-400 p-2.5 rounded text-[10px] font-mono border border-brand-hover overflow-x-auto leading-relaxed max-h-[300px] whitespace-pre-wrap">
                                  {log.Details}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Status de Loading no Bottom (Scroll Infinito) */}
              {isLoadingLogs && (
                <div className="text-center py-4 text-xs text-brand-gray animate-pulse font-semibold flex items-center justify-center gap-2 bg-zinc-950/20 border-t border-brand-hover">
                  <Database className="w-4 h-4 text-brand-green animate-spin" /> Carregando mais logs...
                </div>
              )}

              {/* Elemento observador invisible para trigger do scroll */}
              {hasMore && <div ref={observerRef} className="h-4" />}
            </div>

            {/* Contador total de logs */}
            <div className="text-right text-[10px] text-brand-gray px-1">
              Total de logs encontrados: <strong className="text-white">{totalLogs}</strong>
            </div>

          </div>
        )}

      </div>

    </div>
  );
};
