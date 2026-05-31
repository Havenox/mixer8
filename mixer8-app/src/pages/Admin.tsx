import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Shield, Key, Users, Cpu, FileJson, 
  HelpCircle, CheckCircle, RefreshCw, AlertTriangle, Play
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const Admin: React.FC = () => {
  const { CurrentUser, Token } = useAuth();
  
  // Controle do painel de cookies
  const [cookiesJson, setCookiesJson] = useState('[\n  {\n    "name": "session",\n    "value": "valor_real_dos_cookies_aqui",\n    "domain": ".plataforma-stems.ai",\n    "path": "/"\n  }\n]');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Controle de teste de conexão com o Bot
  const [isTesting, setIsTesting] = useState(false);
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);

  // Status de Diagnóstico da Sessão
  const [sessionAge, setSessionAge] = useState<number | null>(null);
  const [sessionActive, setSessionActive] = useState<boolean>(false);

  // Estado dos usuários cadastrados no banco de dados
  const [users, setUsers] = useState<{ UserId: string; Email: string; UserRole: string; CreatedAt: string }[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  const fetchSessionStatus = async () => {
    if (!Token) return;
    try {
      const res = await fetch(`${API_URL}/Admin/TestSession`, {
        headers: {
          'Authorization': `Bearer ${Token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSessionActive(data.IsActive);
        setSessionAge(data.IsActive ? data.SessionAgeHours : null);
      }
    } catch {
      // Ignora falha silenciosa
    }
  };

  const fetchCookies = async () => {
    if (!Token) return;
    try {
      const res = await fetch(`${API_URL}/Admin/GetSession`, {
        headers: {
          'Authorization': `Bearer ${Token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.CookiesJson) {
          setCookiesJson(data.CookiesJson);
        }
      }
    } catch {
      // Ignora falha silenciosa
    }
  };

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

  useEffect(() => {
    fetchSessionStatus();
    fetchCookies();
    fetchUsers();
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

  const handleSaveCookies = async () => {
    if (!Token) return;
    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    try {
      const res = await fetch(`${API_URL}/Admin/ImportSession`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Token}`
        },
        body: JSON.stringify({ CookiesJson: cookiesJson })
      });

      if (res.ok) {
        setSaveSuccess(true);
        fetchSessionStatus();
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        const errorData = await res.json();
        setSaveError(errorData.ErrorMessage || 'Falha ao importar sessão.');
      }
    } catch {
      setSaveError('Erro de conexão ao tentar salvar cookies.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!Token) return;
    setIsTesting(true);
    setTestResult(null);
    setTestLogs(['[BOT] Solicitando validação real dos cookies no servidor...']);

    try {
      const res = await fetch(`${API_URL}/Admin/TestConnection`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        setTestLogs(prev => [
          ...prev,
          `[BOT] Resposta recebida do servidor.`,
          `[BOT] URL de Destino final: ${data.Url}`,
          `[BOT] Diagnóstico: ${data.Message}`
        ]);
        if (data.IsActive) {
          setTestResult('success');
        } else {
          setTestResult('failed');
        }
      } else {
        const errorData = await res.json();
        setTestLogs(prev => [...prev, `[BOT ERROR] Falha no teste de conexão: ${errorData.ErrorMessage || 'Erro Desconhecido'}`]);
        setTestResult('failed');
      }
    } catch {
      setTestLogs(prev => [...prev, '[BOT ERROR] Erro de rede ao conectar com a API de testes.']);
      setTestResult('failed');
    } finally {
      setIsTesting(false);
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
          <p className="text-sm text-brand-gray">Administre usuários, sessões e parametrize a integração headless da plataforma de Stems AI.</p>
        </div>
      </div>

      {/* KPI Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* CPU */}
        <div className="bg-brand-card border border-brand-hover p-4 rounded-md flex items-center justify-between shadow-lg">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">Uso de CPU (VPS)</span>
            <span className="text-xl font-bold text-white">4.2%</span>
          </div>
          <Cpu className="w-8 h-8 text-brand-green/40" />
        </div>

        {/* RAM */}
        <div className="bg-brand-card border border-brand-hover p-4 rounded-md flex items-center justify-between shadow-lg">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">Uso de RAM</span>
            <span className="text-xl font-bold text-white">312 MB / 2 GB</span>
          </div>
          <Users className="w-8 h-8 text-brand-green/40" />
        </div>

        {/* Status Fila */}
        <div className="bg-brand-card border border-brand-hover p-4 rounded-md flex items-center justify-between shadow-lg">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">Status do Extrator</span>
            <span className={`text-xs font-bold flex items-center gap-1 ${sessionActive ? 'text-brand-green' : 'text-red-400'}`}>
              <span className={`w-2 h-2 rounded-full ${sessionActive ? 'bg-brand-green animate-ping' : 'bg-red-400'}`} />
              {sessionActive ? 'Sessão Ativa' : 'Sessão Inexistente'}
            </span>
          </div>
          <Key className="w-8 h-8 text-brand-green/40" />
        </div>

        {/* Idade da Sessão */}
        <div className="bg-brand-card border border-brand-hover p-4 rounded-md flex items-center justify-between shadow-lg">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">Idade da Sessão</span>
            <span className="text-xl font-bold text-white">
              {sessionActive && sessionAge !== null ? `${sessionAge}h` : 'N/A'}
            </span>
          </div>
          <RefreshCw className="w-8 h-8 text-brand-green/40" />
        </div>

      </div>

      {/* Seção Central de 2 Colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Caixa de Importação de Cookies */}
          <div className="bg-brand-card border border-brand-hover p-6 rounded-md flex flex-col gap-4 shadow-xl">
            
            <div className="flex flex-col gap-1 border-b border-brand-hover pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2 m-0">
                <FileJson className="w-5 h-5 text-brand-green" /> Importador de Sessão (auth.json)
              </h2>
              <p className="text-xs text-brand-gray">
                Burlar captcha e verificação Cloudflare injetando a sessão de cookies já autenticada da sua máquina pessoal.
              </p>
            </div>

            {/* Guia Rápido */}
            <div className="bg-black/50 border border-brand-hover p-4 rounded text-xs text-brand-gray flex flex-col gap-2">
              <span className="font-bold text-white flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-brand-green" /> Como obter seus cookies?
              </span>
              <ol className="list-decimal list-inside flex flex-col gap-1 pl-1">
                <li>Instale uma extensão como <strong className="text-white">EditThisCookie</strong> no seu Chrome/Edge.</li>
                <li>Acesse a plataforma de stems externa no seu navegador e faça login normalmente.</li>
                <li>Abra a extensão, clique em "Exportar" para copiar os cookies em formato JSON.</li>
                <li>Cole o JSON na caixa abaixo e clique em <strong className="text-white">Importar Cookies de Sessão</strong>.</li>
              </ol>
            </div>

            {saveError && (
              <div className="bg-red-500/10 border border-red-500/30 p-3 rounded text-xs text-red-400">
                {saveError}
              </div>
            )}

            {/* Textarea */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-brand-gray">JSON de Estado (Cookies / localStorage)</label>
              <textarea 
                value={cookiesJson}
                onChange={(e) => setCookiesJson(e.target.value)}
                rows={6}
                disabled={isSaving}
                className="w-full bg-black border border-brand-hover rounded p-3 font-mono text-[10px] text-brand-green focus:outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green"
              />
            </div>

            {/* Botão Salvar */}
            <button 
              onClick={handleSaveCookies}
              disabled={isSaving}
              className="py-2.5 px-4 bg-brand-green text-black font-bold text-sm rounded hover:scale-105 active:scale-95 transition-all self-start flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:scale-100"
            >
              {isSaving ? 'Salvando no Container...' : 'Importar Cookies de Sessão'}
              {saveSuccess && <span className="text-xs text-black font-normal bg-white px-2 py-0.5 rounded ml-2 animate-bounce">Sessão Salva!</span>}
            </button>

          </div>

          {/* Análise de Viabilidade Técnica e Bypass */}
          <div className="bg-brand-card border border-brand-hover p-6 rounded-md flex flex-col gap-4 shadow-xl">
            <div className="flex flex-col gap-1 border-b border-brand-hover pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2 m-0">
                🧠 Estudo de Caso: Por que essa abordagem é a melhor?
              </h2>
            </div>
            <div className="text-xs text-brand-gray flex flex-col gap-3 leading-relaxed">
              <p>
                A sua proposta de <strong className="text-white">"trazer o login do extrator para o frontend e repassar os cookies"</strong> é **altamente viável, segura e representa o estado da arte** para burlar proteções contra bots como Cloudflare Turnstile, Cloudflare WAF, e CAPTCHAs que barram IPs de nuvens VPS.
              </p>
              <p>
                <strong>Por que é genial?</strong> O Cloudflare analisa o "comportamento mecânico" e as assinaturas de rede (TLS fingerprint) apenas **durante o processo de autenticação e preenchimento de login**. Uma vez que a sessão foi validada em seu navegador residencial limpo, a requisição de navegação subsequente já logada utiliza apenas cookies HTTP normais.
              </p>
              <p>
                Ao colar os cookies e o estado do `localStorage` (como o token JWT) no nosso painel, a API do backend grava diretamente esses dados em <code className="text-white bg-black px-1.5 py-0.5 rounded">mixer8-extractor/config/auth.json</code>. 
              </p>
              <p>
                Quando o Bot Playwright na VPS Linux inicializa o Chromium, ele carrega o arquivo de estado e abre a página diretamente logado na biblioteca do extrator externo, **pulando completamente a tela de login**, eliminando qualquer barreira de CAPTCHA!
              </p>
            </div>
          </div>

        </div>

        {/* Coluna Direita: Testador do Robô & Lista de Admin */}
        <div className="flex flex-col gap-6">
          
          {/* Testador do Robô em Execução */}
          <div className="bg-brand-card border border-brand-hover p-6 rounded-md flex flex-col gap-4 shadow-xl">
            <div className="flex flex-col gap-1 border-b border-brand-hover pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2 m-0">
                🧪 Testar Conexão do Bot
              </h2>
              <p className="text-xs text-brand-gray">Verifique se o robô da VPS consegue logar com a sessão atual.</p>
            </div>

            <button 
              onClick={handleTestConnection}
              disabled={isTesting || !sessionActive}
              className="w-full py-2.5 bg-brand-hover hover:bg-brand-green hover:text-black border border-brand-hover text-white rounded font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4 fill-current" />
              {isTesting ? 'Bot Testando...' : 'Iniciar Teste de Sessão'}
            </button>

            {/* Logs de Teste */}
            {(testLogs.length > 0 || isTesting) && (
              <div className="bg-black rounded p-3 font-mono text-[9px] text-brand-gray h-44 overflow-y-auto flex flex-col gap-1 shadow-inner">
                {testLogs.map((log, idx) => (
                  <div key={idx} className="flex gap-1.5 items-start">
                    <span className="text-brand-green">❯</span>
                    <span>{log}</span>
                  </div>
                ))}
                {isTesting && (
                  <div className="flex gap-1.5 items-center text-white font-bold animate-pulse">
                    <span className="text-brand-green">❯</span>
                    <span>Aguardando resposta da VPS...</span>
                  </div>
                )}
                {testResult === 'success' && (
                  <div className="text-brand-green font-bold mt-2 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> TESTE FINALIZADO: SESSÃO ATIVA E SEGURA!
                  </div>
                )}
              </div>
            )}

          </div>

          {/* CRM Lista de Usuários */}
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
