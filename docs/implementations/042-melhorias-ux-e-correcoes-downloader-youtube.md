# 042 - [UX/Downloader/API]: Melhorias de UX e Correções do Downloader do YouTube

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 06/06/2026

---

## 🚀 Desafio de Engenharia
Ao expandir as capacidades da plataforma Mixer8 para suportar importação de áudio a partir de links externos do YouTube, deparamo-nos com múltiplos desafios de experiência de usuário (UX) e infraestrutura/bloqueios de rede:
1. **Layout Shift e UX no Frontend**: Os cards das faixas exibiam textos de status longos e crus (ex: `"Processando: Baixando mídia"`, `"AguardandoDownload"`), o que causava distorção visual em resoluções menores e uma sensação de interface inacabada. Além disso, a ausência de um indicador de progresso dinâmico tornava a espera confusa.
2. **Responsividade de Cabeçalhos**: Cabeçalhos longos de páginas esticavam layouts em telas móveis.
3. **Fricção no Cadastro Manual**: Ao colar um link do YouTube, o usuário precisava digitar manualmente o nome da música e do artista. Se o título estivesse invertido ou o YouTube OEmbed extraísse o autor no campo errado, era trabalhoso recortar e colar as informações de volta.
4. **Bloqueio de Datacenters pelo YouTube**: O servidor VPS (Ubuntu Server) começou a ter requisições bloqueadas pelo YouTube com erros HTTP 403.
5. **Falha na Descriptografia de Assinaturas (n-challenge)**: A última versão do `yt-dlp` necessita de um runtime de JavaScript moderno para descriptografar os desafios de assinatura do YouTube. O pacote `nodejs` disponível por padrão nos repositórios estáveis do Debian (v18.19) é considerado obsoleto e incompatível pelo `yt-dlp`, resultando no erro `Signature solving failed`.

## 🧠 Estratégia da Solução
Abordamos essas questões em camadas de frontend, backend e infraestrutura:
1. **Badge de Status Compacto e Spinner Animado**: Criamos o componente `TrackStatusBadge` que centraliza as regras de tradução de status crus para formatos curtos legíveis (`FILA`, `BAIXANDO`, `SEPARANDO`, `CONVERTENDO`, `PRONTO`, `FALHOU`) e exibe um spinner circular animado por CSS (sem peso de bibliotecas de terceiros) para estados ativos.
2. **Responsividade nos Títulos**: Ajustamos os estilos dos cabeçalhos nas views (`Admin`, `Playlists`, `PopularPlaylists`, `WeeklyTrends`) para flex-wrap e quebra inteligente de linha no mobile.
3. **OEmbed Fetching & Botão Swap**: Integramos chamadas automáticas em background para a API do YouTube OEmbed a partir da URL inserida (com debounce de 500ms). Ao receber o título, separamos o nome do artista e da faixa via heurística (ex: separador `-` ou `|`) e populamos os campos. Um novo botão com ícone Lucide `ArrowLeftRight` (Swap) foi inserido para inverter instantaneamente os dois campos com um clique.
4. **Resolução de Cookies Compartilhados**: Implementamos o suporte a arquivos de cookies Netscape no Downloader. O worker carrega o arquivo `youtube-cookies.txt` (se presente no volume compartilhado) e o injeta como argumento `--cookies` na execução do `yt-dlp`.
5. **Runtime JS Moderno via Deno Estático & Scripts EJS**: Para resolver a descriptografia de assinaturas sem inchar a imagem Docker do downloader, copiamos o executável estático do Deno diretamente da imagem Docker oficial (`denoland/deno:bin`). Além disso, como o `yt-dlp` necessita dos scripts oficiais de resolução do EJS (Extractor JavaScript) e restringe execuções remotas sem consentimento, instalamos o pacote `yt-dlp-ejs` nativamente via pip no contêiner e adicionamos o argumento `--remote-components ejs:github` na chamada do worker. Isso fornece um interpretador JavaScript v8 ultra veloz com os solucionadores de desafios de assinatura pré-carregados e autorizados.

## 🛠️ Implementação Técnica

### Frontend (`mixer8-app`)
- **Novo Componente** `TrackStatusBadge` em [TrackStatusBadge.tsx](file:///g:/DEV/mixer8/mixer8-app/src/components/TrackStatusBadge.tsx): Mapeamento chave-valor de status e renderização do círculo com animação `spin` infinita.
- **Integração nas Grades/Listas**: Integrado em [TrackListing.tsx](file:///g:/DEV/mixer8/mixer8-app/src/components/TrackListing.tsx) e [ExploreShelf.tsx](file:///g:/DEV/mixer8/mixer8-app/src/components/ExploreShelf.tsx).
- **OEmbed e Swap no Dashboard**: Modificado o formulário de upload de links em [Dashboard.tsx](file:///g:/DEV/mixer8/mixer8-app/src/pages/Dashboard.tsx) para escutar mudanças no link, realizar o fetch e permitir a inversão dos campos pelo botão Swap.

### Backend/Infraestrutura (`mixer8-downloader`)
- **Atualização de Subprocesso** em [Worker.cs](file:///g:/DEV/mixer8/mixer8-downloader/Worker.cs): O método `RunYtdlpAsync` detecta a presença de cookies em `youtube-cookies.txt` e monta o argumento `--cookies "caminho"`. Além disso, injeta o argumento `--remote-components ejs:github` para permitir a execução e atualização dos scripts de descriptografia via Deno.
- **Dockerfile com Deno & EJS** em [Dockerfile](file:///g:/DEV/mixer8/mixer8-downloader/Dockerfile):
  ```dockerfile
  COPY --from=denoland/deno:bin /deno /usr/local/bin/deno
  ```
  Isso monta o Deno diretamente em `/usr/local/bin/deno` e remove a instalação do `nodejs` obsoleto do `apt-get`, instalando também o pacote `yt-dlp-ejs` via pip para empacotar os scripts de desafio localmente no ambiente virtual.

## 🎯 Impacto e Resultado
* **UX Premium e Limpa**: Badges curtos evitam quebra de layout de cards e o spinner dinâmico conforta o usuário informando que a operação está em andamento.
* **Fácil Correção de Metadados**: O usuário economiza digitação ao importar mídias externas, e o botão de swap resolve inversões de título/artista instantaneamente.
* **Bypass de Bloqueio**: A injeção de cookies ativos permite o download contínuo mesmo sob os limites mais rigorosos impostos pelos servidores de borda do YouTube.
* **Zero Falhas de Assinatura**: O Deno resolve os desafios de algoritmo JS do YouTube instantaneamente, eliminando completamente os travamentos de fila por falha de decifração.

---
**Nota do Desenvolvedor:** *Utilizar Deno em imagens multi-estágio nos permitiu sanar a fragilidade do pacote obsoleto do Debian sem termos que adicionar PPA adicionais de Node, mantendo a construção do contêiner idempotente, rápida e o tamanho total da imagem reduzido.*
