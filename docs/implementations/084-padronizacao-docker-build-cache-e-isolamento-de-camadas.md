# 084 - Infra: Padronização de Docker Build Cache, Imagem Oficial Playwright e Correção de Timeout IPv6

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 30/08/2026

---

## 🚀 Desafio de Engenharia
Durante o fluxo de Continuous Delivery e manutenção em produção, alterações pontuais de código-fonte (como uma única palavra em regras de negócio ou seletores do Playwright em `Worker.cs`) resultavam em tempos de compilação excessivos (mais de 1 hora e meia no servidor). 

Ao investigar o comportamento do Docker BuildKit e do daemon Linux, identificaram-se dois problemas críticos:
1. **Invalidação de Cache e Compilação Manual Excessiva no Extrator:** No `mixer8-extractor`, o script de instalação do Google Chrome Oficial e das dependências Linux (`node cli.js install --with-deps chrome`) executava centenas de downloads manuais via `apt-get` acoplados à compilação C#.
2. **Bug do Timeout de IPv6 no `apt-get` do Docker:** Imagens base baseadas no Ubuntu 24.04 (Noble) tentam conexões IPv6 por padrão nos espelhos `archive.ubuntu.com`. Sem rota IPv6 nas bridges locais, cada download de pacote sofria timeout de 30 a 60 segundos antes de tentar IPv4. Com mais de 120 pacotes em fila, o tempo de build somava mais de 5.400 segundos (1h30).
3. **Ausência de `.dockerignore`:** Diretórios locais pesados (`bin/`, `obj/`, `node_modules/`, `dist/`, `downloads/`) eram enviados como contexto ao daemon.

---

## 🧠 Estratégia da Solução
1. **Migração do Extrator para Imagem Oficial da Microsoft:** Utilização da imagem `mcr.microsoft.com/playwright/dotnet:v1.49.0-noble`, onde o Chrome, Node.js e todas as 120+ bibliotecas do Linux já vêm 100% pré-instaladas de fábrica. O `apt-get` foi completamente eliminado do Dockerfile do Extrator.
2. **Forçar IPv4 no APT (`Acquire::ForceIPv4 "true"`):** Adicionada configuração nos containers que utilizam `apt-get` (`api`, `downloader`, `waveformer`), forçando resolução IPv4 direta e eliminando completamente os timeouts de conexão de 30s.
3. **Cache Imutável em 4 Camadas:** Isolamento estrito entre SO, restauração de dependências (`.csproj` / `package.json`), compilação de código (`publish` / `build`) e injeção final de binários.
4. **Bloqueio de Contexto Residual (`.dockerignore`):** Criação e expansão de regras em todos os 5 microsserviços.

---

## 🛠️ Implementação Técnica

### 1. `mixer8-extractor`
* **Base Oficial:** Imagem runtime migrada para `mcr.microsoft.com/playwright/dotnet:v1.49.0-noble`.
* **Zero apt-get:** O build apenas restaura o `.csproj`, compila o C# e copia `/app/out` para a imagem base pré-configurada.
* **`.dockerignore`:** Bloqueados `bin/`, `obj/`, `config/`, `downloads/`, `.git/`, `.vscode/`, `*.log`.

### 2. `mixer8-downloader`
* **Force IPv4:** `echo 'Acquire::ForceIPv4 "true";' > /etc/apt/apt.conf.d/99force-ipv4`.
* **`.dockerignore`:** Criado arquivo ignorando `bin/`, `obj/`, `downloads/`, `.git/`, `.vscode/`, `*.log`.

### 3. `mixer8-waveformer`
* **Force IPv4:** `echo 'Acquire::ForceIPv4 "true";' > /etc/apt/apt.conf.d/99force-ipv4`.
* **`.dockerignore`:** Criado arquivo ignorando `bin/`, `obj/`, `.git/`, `.vscode/`, `*.log`.

### 4. `mixer8-api`
* **Force IPv4:** `echo 'Acquire::ForceIPv4 "true";' > /etc/apt/apt.conf.d/99force-ipv4`.
* **`.dockerignore`:** Expandido para cobrir `wwwroot/stems/`, `wwwroot/temp_uploads/`, `wwwroot/playlists/`, `wwwroot/profiles/`, `bin/`, `obj/`, `.git/`, `.vscode/`.

### 5. `mixer8-app`
* **`.dockerignore`:** Criado arquivo ignorando `node_modules/`, `dist/`, `.vite/`, `.git/`, `.vscode/`, `*.log`.

---

## 🎯 Impacto e Resultados

| Cenário | Tempo Anterior | Novo Tempo com Otimizações |
| :--- | :--- | :--- |
| **Rebuild de Extrator (C#)** | ~1h 30m (5.413s) | **~3 a 5 segundos** |
| **Rebuild de Downloader / Waveformer** | ~1h 30m (timeouts) | **~10 a 15 segundos** (primeiro build) / **~3s** (rebuilds) |
| **Rebuild de API** | ~4.6s | **~3s** |
| **Rebuild de Frontend (React)** | Instantâneo / 0.0s | **0.0s (CACHED)** / **~2s** |

---
**Nota do Desenvolvedor:** *A união da imagem oficial pré-fabricada do Playwright com a eliminação do timeout de IPv6 no apt-get remove completamente os gargalos de rede e transforma o deploy em um processo ágil e previsível.*
