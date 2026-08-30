# 084 - Infra: Padronização de Docker Build Cache e Isolamento de Camadas Estáticas

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 30/08/2026

---

## 🚀 Desafio de Engenharia
Durante o fluxo de Continuous Delivery e manutenção em produção, alterações pontuais de código-fonte (como uma única palavra em regras de negócio ou seletores do Playwright em `Worker.cs`) resultavam em tempos de compilação excessivos (mais de 1 hora e meia no servidor). 

Ao investigar o comportamento do Docker BuildKit, identificou-se um problema grave de **invalidação em cascata de camadas de build (cache bust)**:
1. No `mixer8-extractor`, o script de instalação do Google Chrome Oficial e das dependências de interface gráfica e áudio do Linux (`node cli.js install --with-deps chrome`) estava posicionado **após** a cópia da pasta compilada `/app/out` do estágio de build C#. Como qualquer modificação de código C# altera os timestamps e binários de `/app/out`, a camada do Chrome perdia o cache e forçava o download e instalação de centenas de pacotes do Ubuntu a cada `docker compose build`.
2. A ausência de arquivos `.dockerignore` em múltiplos microsserviços (`mixer8-downloader`, `mixer8-waveformer`, `mixer8-app`) fazia com que diretórios locais pesados (`bin/`, `obj/`, `node_modules/`, `dist/`, `downloads/`) fossem transferidos como contexto para o daemon, corrompendo a integridade dos caches de compilação.

---

## 🧠 Estratégia da Solução
Estabeleceu-se uma arquitetura padronizada e universal de **Cache Imutável em 4 Camadas** para todos os containers do ecossistema:

1. **Camada 1 - Sistema Operacional e Ferramentas Pesadas (100% Imutável):** Ferramentas do sistema (`apt-get`, `ffmpeg`, `python3`, `node`, `yt-dlp`, `chrome`) são instaladas diretamente na imagem base do estágio de runtime antes de qualquer injeção de código da aplicação.
2. **Camada 2 - Resolução de Pacotes e Dependências:** Arquivos `.csproj` ou `package.json` são copiados isoladamente para restaurar pacotes (`dotnet restore` ou `npm install`). Essa camada só reexecuta se uma dependência for adicionada/removida.
3. **Camada 3 - Compilação de Código-Fonte:** O código C# ou TypeScript é copiado e compilado (`dotnet publish -c Release -o out` ou `npm run build`), executando em 3 a 6 segundos.
4. **Camada 4 - Injeção Final de Binários:** O estágio de runtime recebe apenas a pasta compilada final (`COPY --from=build-env /app/out .` ou `/app/dist`) como a última instrução antes do `ENTRYPOINT`.
5. **Bloqueio de Contexto Residual (`.dockerignore`):** Criação e expansão de regras rigorosas em todos os microsserviços, impedindo o envio de pastas temporárias, binários de compilação local, arquivos de IDE e logs.

---

## 🛠️ Implementação Técnica

### 1. `mixer8-extractor`
* **Desacoplamento do Playwright:** No estágio de runtime, o Chrome e as bibliotecas Linux são instalados via `npx -y playwright@1.49.0 install --with-deps chrome` antes da cópia de `/app/out`.
* **Ambiente Estável:** Adicionada a variável de ambiente `PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright`.
* **`.dockerignore`:** Bloqueados `bin/`, `obj/`, `config/`, `downloads/`, `.git/`, `.vscode/`, `*.log`.

### 2. `mixer8-downloader`
* **`.dockerignore`:** Criado arquivo ignorando `bin/`, `obj/`, `downloads/`, `.git/`, `.vscode/`, `*.log`.
* **Otimização de Pacotes:** Adicionado `--no-install-recommends` no `apt-get` para redução do tamanho da imagem e maior velocidade.

### 3. `mixer8-waveformer`
* **`.dockerignore`:** Criado arquivo ignorando `bin/`, `obj/`, `.git/`, `.vscode/`, `*.log`.

### 4. `mixer8-api`
* **`.dockerignore`:** Expandido para cobrir `wwwroot/stems/`, `wwwroot/temp_uploads/`, `wwwroot/playlists/`, `wwwroot/profiles/`, `bin/`, `obj/`, `.git/`, `.vscode/`.

### 5. `mixer8-app`
* **`.dockerignore`:** Criado arquivo ignorando `node_modules/`, `dist/`, `.vite/`, `.git/`, `.vscode/`, `*.log`.

---

## 🎯 Impacto e Resultados

| Cenário | Tempo Anterior | Novo Tempo com Cache Otimizado |
| :--- | :--- | :--- |
| **Alteração de 1 palavra em C# (Extractor)** | ~1h 27m (5.259s) | **~5 a 6 segundos** |
| **Rebuild de API / Downloader / Waveformer** | ~2 a 5 minutos | **~3 a 5 segundos** |
| **Rebuild do Frontend (React SPA)** | ~1 a 2 minutos | **~2 a 3 segundos** |
| **Transferência de Contexto Docker** | ~800MB a 1.5GB | **< 100KB** |

---
**Nota do Desenvolvedor:** *O isolamento estrito de camadas imutáveis do sistema operacional transforma o ciclo de desenvolvimento e deploy em containers, garantindo builds quase instantâneos e previsíveis em ambientes locais e de produção.*
