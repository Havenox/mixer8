# 004 - [Infraestrutura/Arquitetura]: Dockerização Geral e Refatoração de Stems para Opus

**Autor:** Antigravity (IA) / Eduardo Nascimento (Havenox)
**Data:** 30/05/2026

---

## 🚀 Desafio de Engenharia
Facilitar o empacotamento, distribuição e deploy do ecossistema do Mixer8 (API, Extrator e SPA React) preparando-os para rodar conteinerizados via Docker Compose.
A infraestrutura requeria a instalação nativa do `ffmpeg` com a biblioteca de codec de áudio `libopus` habilitada no contêiner da API de backend, garantindo que a conversão in-memory e mono/stereo downmixing das stems funcionassem perfeitamente, sem depender de recursos instalados na máquina do host.
Além disso, era necessário adaptar o Worker Simulator para reproduzir fielmente o fluxo de geração de arquivos ZIP contendo as 5 stems simuladas e acionar o endpoint de conversão Opus da API.

## 🧠 Estratégia da Solução
1. **Dockerização por Microserviços**:
   - Criação de `Dockerfile`s com compilação multi-stage em .NET 10.0 (API e Worker).
   - Instalação automatizada do `ffmpeg` via gerenciador de pacotes (`apt-get`) no contêiner do runtime da API do backend.
   - Criação de `Dockerfile` de produção com Nginx Alpine para servir a SPA React do frontend na porta 3000, tratando rotas do React Router.
2. **Volume Compartilhado de Downloads**:
   - Configuração de um volume físico bind-mount compartilhado entre o contêiner do `mixer8-extractor` e o `mixer8-api` em `/app/downloads`. Isso permite que o Worker encontre os arquivos originais carregados no upload, e a API encontre o arquivo ZIP de stems gerado pelo Worker.
3. **Simulação Real do Worker**:
   - Refatoração do `Worker.cs` no Extrator para empacotar o áudio original em um arquivo compactado `{trackId}_stems.zip` com as 5 stems nomeadas adequadamente.
   - Comunicação interna do Docker: Utilização de chamada HTTP POST para a API do backend através do endpoint `ProcessStemsZip` com tratamento de erros.

## 🛠️ Implementação Técnica
### Docker e Orquestração
- Criado [Dockerfile (mixer8-api)](file:///g:/DEV/mixer8/mixer8-api/Dockerfile) com instalação do `ffmpeg`.
- Criado [Dockerfile (mixer8-extractor)](file:///g:/DEV/mixer8/mixer8-extractor/Dockerfile).
- Criado [Dockerfile (mixer8-app)](file:///g:/DEV/mixer8/mixer8-app/Dockerfile) e [nginx.conf (mixer8-app)](file:///g:/DEV/mixer8/mixer8-app/nginx.conf) configurados para SPA.
- Atualizado [docker-compose.yml](file:///g:/DEV/mixer8/docker-compose.yml) para ativar e orquestrar todos os contêineres na mesma rede e volumes compartilhados.

### Worker de Background (.NET 10)
- Injetada a configuração do app settings e .env via `IConfiguration`.
- Refatorado [Worker.cs](file:///g:/DEV/mixer8/mixer8-extractor/Worker.cs) para:
  - Localizar o arquivo original carregado.
  - Criar o pacote ZIP contendo 5 entries (`vocals`, `drums`, `bass`, `piano`, `others`).
  - Chamar a rota `POST api/Tracks/{id}/ProcessStemsZip` para que o processador e codificador Opus centralizado no backend realize a persistência.

## 🎯 Impacto e Resultado
* **Independência de Ambiente**: Todo o ecossistema Mixer8 pode ser clonado e inicializado em qualquer servidor VPS ou Homelab que possua Docker e Docker Compose, instalando dependências de áudio (FFmpeg) automaticamente no contêiner.
* **Consistência de Dados**: O Worker não realiza mais inserções diretas e arbitrárias no banco de dados para as stems, delegando a responsabilidade de conversão e gravação de forma segura e transacional ACID para a API.
