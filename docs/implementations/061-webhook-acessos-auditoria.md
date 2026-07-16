# 061 - [Funcionalidade / Infra]: Centralização de Webhooks de Acesso e Auditoria

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 16/07/2026

---

## 🚀 Desafio de Engenharia
Anteriormente, o monitoramento de acessos no Mixer8 ocorria de forma direta no frontend React, que realizava requisições `fetch` HTTP postando dados estatísticos a uma URL de webhook hardcoded (`https://n8n.impulse8.com.br/webhook/access`).
Isso trazia três inconvenientes:
1. **Exposição de Infraestrutura**: A URL privada do webhook n8n ficava visível para qualquer usuário inspecionando o console de rede (F12) no navegador.
2. **Duplicidade de Logs**: O acesso não era registrado no banco de dados local do sistema de auditoria (tabela `SystemEvents`).
3. **Bloqueios de AdBlocker**: Extensões de navegadores focadas em privacidade bloqueavam a requisição direta a domínios externos de webhooks, impedindo a coleta correta de estatísticas de audiência.

## 🧠 Estratégia da Solução
Abstraímos a chamada de webhook para o lado do servidor (backend) do Mixer8, mantendo 100% de retrocompatibilidade com a integração existente no n8n.
1. **Unificação na API local**: O frontend agora chama apenas o endpoint local `POST /api/System/Access`.
2. **Auditoria Centralizada**: Ao receber a chamada, a API grava um log local em `SystemEvents` associando o IP real resolvido (graças ao ajuste anterior do proxy headers) e o usuário autenticado (se o token JWT estiver presente).
3. **Encaminhamento Retrocompatível (Back-to-Webhook)**: A API lê a chave `"AccessWebhookUrl"` da tabela de parametrizações `SystemSettings`. Se configurado, dispara uma chamada HTTP POST assíncrona (`HttpClient`) reconstruindo o payload original do frontend (em camelCase).
4. **Preservação de Cabeçalhos de Rede**: Para evitar que o n8n registre o IP do servidor do Mixer8 em vez do IP do usuário, a API injeta os cabeçalhos `X-Forwarded-For`, `X-Real-IP` e `User-Agent` originais na requisição de saída, preservando a inteligência interna do n8n de forma transparente.

## 🛠️ Implementação Técnica

### Backend (mixer8-api)
* **[SystemController.cs](file:///g:/DEV/mixer8/mixer8-api/Controllers/SystemController.cs)** [NEW]:
  * Implementados os endpoints `POST /api/System/Access` (público) e `POST /api/System/TestWebhook` (restrito a administradores).
* **[SystemSettingsController.cs](file:///g:/DEV/mixer8/mixer8-api/Controllers/SystemSettingsController.cs)** [MODIFY]:
  * Adicionado o endpoint `GET /api/SystemSettings/AdminSettings` restrito ao papel `Admin`. Ele retorna todas as chaves dinâmicas, incluindo a URL do webhook, enquanto o endpoint público padrão `/api/SystemSettings` continua ocultando configurações sensíveis.

### Frontend (mixer8-app)
* **[App.tsx](file:///g:/DEV/mixer8/mixer8-app/src/App.tsx)** [MODIFY]:
  * Removido o hook `useEffect` raiz com a chamada HTTP hardcoded para o n8n.
* **[PersistentLayout.tsx](file:///g:/DEV/mixer8/mixer8-app/src/components/PersistentLayout.tsx)** [MODIFY]:
  * Adicionado hook `useEffect` que executa a chamada local `/api/System/Access` uma única vez no carregamento, enviando dados do navegador e anexando os cabeçalhos de autorização do usuário caso esteja logado.
* **[Admin.tsx](file:///g:/DEV/mixer8/mixer8-app/src/pages/Admin.tsx)** [MODIFY]:
  * Alterado o carregamento de configurações administrativas para consumir o novo endpoint `/AdminSettings`.
  * Adicionada a seção do webhook de acesso na interface gráfica da aba de configurações (input dinâmico persistido e botão "Testar Webhook" integrado com a API).

---
**Nota do Desenvolvedor:** *A injeção do User-Agent e X-Forwarded-For no HttpClient de saída garante que o integrador n8n continue interpretando o evento como se viesse direto do navegador do usuário, eliminando a necessidade de ajustes na engine de recepção.*
