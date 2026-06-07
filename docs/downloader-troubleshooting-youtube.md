# Downloader Troubleshooting: Guia de Solução para Importação de Mídia do YouTube

Este guia reúne todo o conhecimento técnico acumulado sobre o microsserviço `mixer8-downloader` e os desafios enfrentados para realizar downloads resilientes a partir do YouTube em ambientes de servidores VPS (como Ubuntu Server), servindo como documentação oficial e playbook de depuração para futuros incidentes.

---

## 1. Visão Geral da Arquitetura do Downloader

O `mixer8-downloader` é um worker .NET 10 executado em background que consome uma fila no PostgreSQL (`Tracks` com `ExtractionStatus = 'AguardandoDownload'`). O fluxo é composto por:

1. **Lock Concorrente**: Busca de registro usando `FOR UPDATE SKIP LOCKED` para isolamento absoluto.
2. **Extração de Thumbnail**: Download paralelo e direto da capa do YouTube via `HttpClient` e envio via POST multipart para o backend principal converter em WebP.
3. **Download da Mídia**: Invocação assíncrona do subprocesso **`yt-dlp`** em linha de comando para baixar e converter o fluxo de áudio para `.opus` (96k).
4. **Upload para a API**: Envio do áudio processado por HTTP multipart para que seja cortado e mixado em stems no servidor.

---

## 2. Anatomia dos Bloqueios do YouTube em Servidores VPS

Ao mover o downloader da máquina local de desenvolvimento para a VPS (servidor Ubuntu na nuvem), a importação imediatamente começou a falhar. Duas defesas principais do YouTube causaram essa quebra de pipeline:

### A. Reputação de IP e Bloqueio de Datacenters (Erro HTTP 403 Forbidden)
O YouTube mantém um sistema rigoroso de reputação de rede. Endereços de IP pertencentes a blocos de provedores de nuvem e datacenters (AWS, DigitalOcean, Hetzner, Linode, Oracle Cloud, etc.) têm baixíssima reputação porque são comumente utilizados por bots de raspagem e downloads em massa. 

* **O Sintoma**: Requisições de download retornavam erros imediatos de acesso negado (HTTP 403) ou redirecionamento para captchas.
* **A Solução**: O uso de **Cookies de Sessão Autenticados** (Netscape HTTP Cookie format).

#### Como funcionam os cookies para o yt-dlp?
Quando passamos cookies de uma conta ativa do YouTube, o servidor do YouTube associa a requisição à conta de um usuário doméstico real (com histórico de navegação, conta ativa, etc.) em vez de um bot anônimo vindo de um IP de datacenter. Isso contorna completamente o bloqueio por IP de nuvem.

#### De onde vêm esses cookies e como gerá-los?
Os cookies não podem ser gerados de forma programática facilmente por causa dos algoritmos de criptografia e tokens rotativos de login do Google. Eles devem ser extraídos de um navegador onde você esteja ativamente logado em uma conta Google.

**Passo a passo para gerar o arquivo de cookies:**
1. Instale no seu navegador (Chrome/Firefox) uma extensão segura e amplamente utilizada para exportar cookies, como a **"Get cookies.txt LOCALLY"** (disponível nas Web Stores oficiais).
   * *Atenção:* Evite extensões suspeitas ou que enviem dados a servidores externos, pois os cookies dão acesso completo à sua conta Google.
2. Acesse o [YouTube](https://www.youtube.com) e garanta que você está logado.
3. Clique no ícone da extensão e escolha exportar os cookies do domínio ativo (`youtube.com`). A extensão gerará um arquivo de texto no formato Netscape.
4. Salve o arquivo com o nome **`youtube-cookies.txt`**.
5. Copie o arquivo para o diretório de downloads compartilhado pelo Docker na VPS (mapeado para `/app/downloads/youtube-cookies.txt` dentro do contêiner).

O código em `Worker.cs` detectará a existência desse arquivo e injetará automaticamente o argumento `--cookies` na chamada do comando:
```csharp
var cookiesArg = "";
if (!string.IsNullOrEmpty(cookiesPath) && File.Exists(cookiesPath))
{
    cookiesArg = $"--cookies \"{cookiesPath}\" ";
}
```

---

## 3. Desafio de Assinaturas e Runtimes JavaScript (n-challenge)

Depois de resolver o bloqueio de IP usando cookies, surgiu um segundo problema: **`Signature solving failed`** e **`n challenge solving failed`**.

### O que é o n-parameter / n-challenge?
O YouTube altera dinamicamente algoritmos de criptografia e parâmetros de assinatura de vídeo (em especial o parâmetro `n`) em seus players JavaScript para impedir que reprodutores não autorizados decodifiquem a URL direta de transmissão de mídia.
Para decifrar esses parâmetros, o `yt-dlp` precisa decodificar a lógica do player JavaScript do vídeo em tempo real. Por esse motivo, o `yt-dlp` **exige um runtime/interpretador JavaScript** instalado no sistema.

### Por que o Node.js v18.x falhou no Linux?
Inicialmente, instalou-se o pacote `nodejs` padrão do repositório estável Debian/Ubuntu.
* **O Sintoma**: Os logs mostravam que o `yt-dlp` falhava na assinatura por considerar a versão do Node.js instalada (v18.19.1) obsoleta, instável ou sem suporte para os recursos modernos necessários de interpretador JS.
* **A Consequência**: Downloads de vídeos recentes do YouTube travavam ou falhavam com mensagem de erro `Only images are available for download`.

### Por que escolhemos o Deno?
Os desenvolvedores do `yt-dlp` recomendam o **Deno** como o runtime JavaScript mais moderno, rápido e seguro para executar os desafios de decifração. Além disso, o Deno pode ser obtido como um binário estático único (zero dependências compartilhadas no Linux).

Para integrá-lo ao contêiner de forma ultra leve sem precisar configurar repositórios APT adicionais de Node na imagem Docker, utilizamos uma imagem Docker multi-estágio (`multi-stage build`):
```dockerfile
# Copia o binário estático do Deno
COPY --from=denoland/deno:bin /deno /usr/local/bin/deno
```
Isso coloca o executável estático do Deno em `/usr/local/bin/deno` instantaneamente, fornecendo ao `yt-dlp` a infraestrutura de descriptografia ideal.

---

## 4. A Armadilha do Modo Seguro EJS (Extractor JavaScript)

Mesmo com o Deno instalado no contêiner, os logs continuavam exibindo warnings e erros de falha na resolução de assinaturas:
```text
[youtube] [jsc:deno] Solving JS challenges using deno
WARNING: [youtube] [jsc] Remote components challenge solver script (deno) and NPM package (deno) were skipped. These may be required to solve JS challenges.
WARNING: [youtube] jnOAQSDd63M: Signature solving failed
```

### O que aconteceu?
O `yt-dlp` introduziu um sistema chamado **EJS** (*Extractor JavaScript*). Por razões de privacidade e segurança, o `yt-dlp` roda em modo restrito por padrão (safe-mode). Ele **ignora e pula** a execução dos scripts externos de solução de assinatura se eles não estiverem instalados de forma local e confiável, a menos que explicitamente autorizado.

### A Solução em Duas Camadas:

1. **Instalação do `yt-dlp-ejs` via PIP**:
   No [Dockerfile](file:///g:/DEV/mixer8/mixer8-downloader/Dockerfile), incluímos a biblioteca opcional `yt-dlp-ejs` diretamente na construção do ambiente virtual do Python:
   ```dockerfile
   /opt/venv/bin/pip install --upgrade pip yt-dlp yt-dlp-ejs
   ```
   Isso faz com que os scripts e pacotes resolvedores de desafios fiquem embutidos de forma segura e estática na própria imagem Docker, eliminando a necessidade de baixá-los do GitHub em tempo de execução para cada download.

2. **Autorização de Uso de Componentes Remotos**:
   No [Worker.cs](file:///g:/DEV/mixer8/mixer8-downloader/Worker.cs), injetamos o argumento de linha de comando `--remote-components ejs:github` na chamada do subprocesso:
   ```csharp
   Arguments = $"{cookiesArg}--remote-components ejs:github --no-playlist -x --audio-format opus ...";
   ```
   Isso instrui o `yt-dlp` a consumir e atualizar dinamicamente os algoritmos de decodificação EJS usando o repositório oficial do GitHub quando necessário, trabalhando perfeitamente com o Deno.

Ao aplicar essa abordagem híbrida, o `yt-dlp` passou a listar:
```text
[debug] Optional libraries: sqlite3-3.45.1, yt_dlp_ejs-0.8.0
[debug] JS runtimes: deno-2.8.2
```
A descriptografia é realizada localmente em milissegundos sem qualquer erro ou aviso.

---

## 5. Playbook de Diagnóstico e Resolução (Guia Prático)

Se a fila de downloads de mídias do YouTube travar ou retornar erros de "Falhou" no sistema Mixer8, siga este passo a passo para depuração:

### Passo 1: Verificar Runtimes e Extensões no Contêiner
Abra o terminal do servidor VPS e execute o comando abaixo para ver os logs do `yt-dlp` rodando dentro do contêiner ativo:
```bash
docker exec -it <nome_ou_id_do_conteiner_downloader> yt-dlp -v
```
**O que você deve esperar ver no output:**
* Uma linha contendo `JS runtimes: deno-<versão>` (ex: `deno-2.8.2`).
* Uma linha de `Optional libraries` que inclua `yt_dlp_ejs-<versão>`.

Se Deno estiver listado como `none` ou `unsupported`, o Dockerfile foi montado sem a cópia do binário do Deno ou o interpretador não tem permissões de execução.

---

### Passo 2: Diagnosticar Cookies Expirados
O principal motivo para falhas repentinas em downloads depois de um período de funcionamento normal é a expiração dos cookies da sessão Google.
* **O Sintoma nos Logs**: Erros recorrentes do tipo `HTTP Error 403: Forbidden` ou `Sign in to confirm your age` / `This video is private` nos logs do Docker:
  ```bash
  docker compose logs -f mixer8-downloader
  ```
* **Como Corrigir**:
  1. No seu navegador, saia e entre novamente no YouTube para renovar os cookies.
  2. Use a extensão **"Get cookies.txt LOCALLY"** para exportar um novo arquivo.
  3. Substitua o arquivo antigo `youtube-cookies.txt` no servidor no caminho do volume compartilhado de downloads.
  4. O worker detectará a alteração do arquivo de cookies e usará a nova sessão nas próximas requisições imediatamente (sem necessidade de reiniciar o contêiner).

---

### Passo 3: Limpeza de Cache do yt-dlp
Em raros casos, o cache local dos algoritmos de descriptografia pode se corromper. Para limpar o cache dentro do contêiner rodando na VPS:
```bash
docker exec -it <nome_do_conteiner_downloader> yt-dlp --rm-cache-dir
```
Isso força o `yt-dlp` a baixar novamente assinaturas limpas do EJS.

---

## 6. Resumo das Lições Aprendidas de Engenharia

1. **Evitar Runtimes de Distribuição Linux Obsoletos**: Em ambientes conteinerizados leves (como Alpine ou Debian Slim), a instalação de runtimes complexos de repositórios nativos (como Node.js via APT) frequentemente traz pacotes desatualizados ou gera um inchaço indesejado na imagem. A cópia multi-estágio de um binário estático do Deno resolveu o interpretador JavaScript com zero overhead.
2. **Proatividade contra Anti-Bots**: O download de links externos de redes globais de streaming como YouTube/Vimeo é uma "corrida armamentista". Usar soluções puramente estáticas sem suporte a cookies ou atualizadores de descriptografia (EJS) invariavelmente quebrará em produção em poucos dias ou semanas. A injeção flexível de cookies e componentes remotos foi essencial para a resiliência do Mixer8.
3. **Desacoplamento e Resiliência**: O worker C# foi projetado para tolerar a quebra do subprocesso. Se o `yt-dlp` falhar ou os cookies expirarem, a transação do banco é revertida ou marcada como falha de forma assíncrona, impedindo que trave outros fluxos ou derrube o painel do usuário no frontend.
