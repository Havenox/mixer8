# 019 - [Imagem/Performance]: Motor de Compressão WebP e Upload de Avatar

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 31/05/2026

---

## 🚀 Desafio de Engenharia
Até então, o upload de imagens de capas de músicas e playlists na plataforma mantinha os arquivos nos formatos e resoluções originais no disco (como JPEGs ou PNGs pesados e não padronizados). Além de causar ineficiência no consumo de armazenamento, isso prejudicava o desempenho de carregamento client-side e impossibilitava o corte estrito das capas em formato quadrado (proporção 1:1). Adicionalmente, o cadastro de imagens de perfil de usuário (avatar) aceitava somente links externos arbitrários via campo de texto, limitando severamente a experiência e usabilidade.

## 🧠 Estratégia da Solução
Para endereçar esses problemas de ponta a ponta de maneira resiliente e escalável:
1. **Biblioteca Nativa de Processamento de Imagens**: Introduzimos o pacote performático `SixLabors.ImageSharp` ao ecossistema do backend C# (.NET 10).
2. **Motor de Processamento Centrado em WebP**: Desenvolvemos uma classe utilitária unificada `ImageHelper` em `Infrastructure` que realiza o corte quadrado (`Crop` 1:1 centralizado) dinâmico em memória e comprime a imagem para o moderno formato **WebP com 80% de qualidade** antes da gravação física.
3. **Novo Fluxo de Upload de Perfil**: Implementamos um endpoint dedicado de upload de arquivos de imagem (`POST /api/Auth/Profile/Avatar`) para converter e salvar a foto do usuário fisicamente em `wwwroot/profiles/{userId}/avatar.webp`.
4. **Resiliência e Flexibilidade da UI**: Redesenhamos a seção de perfil no React SPA para unificar o upload por arquivo de imagem de forma interativa com micro-animações, enquanto preservamos a opção de URLs externas. Ajustamos o carregamento de imagens locais relativizando com `SERVER_URL`.
5. **Aprimoramento de Infra e Git**: Simplificamos o volume do Docker Compose concentrando a persistência de toda a pasta `/wwwroot` (agora blindando também as fotos de perfil) e isolamos o diretório no `.gitignore` para bloquear vazamentos de binários no controle de versão.

## 🛠️ Implementação Técnica

### Backend (.NET 10 / C# 13)
- **Mixer8.Api.csproj**: Registrada a dependência do pacote `SixLabors.ImageSharp` v3.1.5.
- **ImageHelper.cs**: Utilitário estático encapsulando o fluxo de processamento de imagem em memória: extração de menor dimensão, corte 1:1, encoding WebP e criação automática de subpastas no salvamento de arquivos físicos.
- **TracksController.cs**: Integrado o `ImageHelper` nos endpoints de criação e edição de músicas, convertendo as capas para `cover.webp` e limpando arquivos legados com outras extensões.
- **PlaylistsController.cs**: Adaptado os endpoints de criação e atualização de playlists para processar as capas para `cover.webp` e remover capas órfãs redundantes do diretório.
- **AuthController.cs**: Adicionado o novo endpoint `[HttpPost("Profile/Avatar")]` de envio multipart (`IFormFile`) de foto, executando a validação e conversão para WebP do avatar, gravando em `wwwroot/profiles/{userId}/avatar.webp` e persistindo a rota relativa no banco de dados.

### Frontend (React SPA + Vite)
- **Settings.tsx**: Redesenhado a coluna direita de avatar com input invisível `<input type="file">` acionado por um botão premium `"Upload Foto"`. Incluído estado de carregamento assíncrono com animação e tratamento de concatenação dinâmica de caminhos relativos usando `SERVER_URL`.
- **PersistentLayout.tsx** & **App.tsx**: Ajustada a exibição do avatar de usuário no rodapé e criador nas playlists populares respectivamente, para resolver e carregar caminhos de imagem locais prependendo `SERVER_URL` se a rota começar com `/`.

### Infraestrutura e Git
- **docker-compose.yml**: Substituídos os múltiplos mapeamentos específicos de `/wwwroot/stems` e `/playlists` por um bind único no diretório raiz `./mixer8-api/wwwroot:/app/wwwroot`.
- **.gitignore**: Substituído o bloqueio granular de stems pelo bloqueio completo de uploads de mídia local ignorando `**/wwwroot/`.

## 🎯 Impacto e Resultado
* **Desempenho Otimizado**: Imagens WebP com 80% de qualidade e proporção quadrada estrita diminuem drasticamente o consumo de banda de internet dos clientes e aumentam consideravelmente a velocidade de renderização da interface.
* **Experiência de Usuário Premium**: Upload físico reativo integrado de avatares com feedback instantâneo de envio e corte perfeito.
* **Segurança e Organização do Git**: Zero risco de commit de arquivos estáticos pesados ou autorais com a nova blindagem do `.gitignore`.

---
**Nota do Desenvolvedor:** *A consolidação do processamento de imagens diretamente em memória no backend usando ImageSharp antes de tocar o disco garante a consistência total dos ativos da plataforma. A decisão de bindar o wwwroot inteiro simplifica a infraestrutura e blinda os dados de profiles e quaisquer futuros subdiretórios de mídia física sem exigir intervenções posteriores no Docker Compose.*
