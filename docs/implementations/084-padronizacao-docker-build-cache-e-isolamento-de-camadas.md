# 084 - Infra: Padronização de Docker Build Cache, Imagem Oficial Playwright, FFmpeg Estático e Pip Resiliente

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 30/08/2026

---

## 🚀 Desafio de Engenharia
Durante o fluxo de Continuous Delivery e manutenção em produção, alterações pontuais de código-fonte resultavam em tempos de compilação excessivos e falhas de timeout de rede no servidor:
1. **Compilação Manual Excessiva no Extrator:** O `mixer8-extractor` instalava centenas de pacotes Linux para rodar o Chrome.
2. **Dependências Gigantescas do Pacote `ffmpeg` no Ubuntu:** O `apt-get install -y ffmpeg` baixava 217 pacotes (459MB), incluindo drivers X11/Mesa e o compilador LLVM de 30MB, levando mais de 10 minutos para baixar.
3. **Falhas de Timeout no Pip do Downloader:** Ao baixar o pacote binário `curl-cffi` (13.5MB), o `pip install` sofria `ReadTimeoutError` em conexões residenciais/VPS sem timeout e retentativas configuradas.

---

## 🧠 Estratégia da Solução
1. **Migração do Extrator para Imagem Oficial da Microsoft:** Utilização da imagem `mcr.microsoft.com/playwright/dotnet:v1.49.0-noble` com Chrome e 120+ libs pré-instaladas de fábrica (Zero apt-get).
2. **Adoção Universal de FFmpeg Estático (`mwader/static-ffmpeg:latest`):** Os serviços `api`, `waveformer` e `downloader` agora copiam binários estáticos compilados do `ffmpeg` e `ffprobe`, eliminando 100% dos pacotes gráficos e LLVM do Ubuntu.
3. **Python Minimal e Pip Resiliente no Downloader:** O `apt-get` instala estritamente o runtime Python (~15MB), e o `pip` agora opera com `--timeout 120 --retries 10 --no-cache-dir`.
4. **Cache Imutável em 4 Camadas e `.dockerignore` Universal.**

---

## 🛠️ Implementação Técnica

### 1. `mixer8-extractor`
* **Base Oficial:** Imagem runtime `mcr.microsoft.com/playwright/dotnet:v1.49.0-noble`.
* **Zero apt-get:** Sem etapas de compilação de SO.

### 2. `mixer8-waveformer` e `mixer8-api`
* **FFmpeg Estático:** `COPY --from=mwader/static-ffmpeg:latest /ffmpeg /ffprobe /usr/local/bin/`.
* **Zero apt-get:** Sem nenhum `apt-get update` ou `install` no runtime.

### 3. `mixer8-downloader`
* **FFmpeg Estático:** `COPY --from=mwader/static-ffmpeg:latest /ffmpeg /ffprobe /usr/local/bin/`.
* **Python Minimal:** `apt-get install -y python3 python3-pip python3-venv --no-install-recommends`.
* **Pip Blindado:** `/opt/venv/bin/pip install --no-cache-dir --timeout 120 --retries 10 yt-dlp yt-dlp-ejs curl-cffi`.

---

## 🎯 Impacto e Resultados

| Microsserviço | Método Anterior | Novo Método Otimizado | Tempo de Rebuild |
| :--- | :--- | :--- | :--- |
| **`mixer8-extractor`** | 100+ debs manuais | Imagem Oficial Microsoft Playwright | **~3 a 5s** |
| **`mixer8-waveformer`** | apt-get ffmpeg (217 pacotes) | Binário estático `mwader/static-ffmpeg` | **~2 a 3s** (0 apt-get) |
| **`mixer8-api`** | apt-get ffmpeg (217 pacotes) | Binário estático `mwader/static-ffmpeg` | **~3 a 5s** (0 apt-get) |
| **`mixer8-downloader`** | apt ffmpeg + pip frágil | FFmpeg estático + Python minimal + Pip timeout | **~10 a 15s** (primeiro) / **~3s** (rebuilds) |
| **`mixer8-app`** | NGINX + Multi-stage | Build Vite cacheado | **0.0s (CACHED)** / **~2s** |

---
**Nota do Desenvolvedor:** *A substituição de pacotes pesados do S.O. por binários estáticos multi-stage (`static-ffmpeg`, `deno`, `playwright-noble`) zera completamente o overhead de pacotes do Ubuntu e garante deploy resiliente mesmo em conexões instáveis.*
