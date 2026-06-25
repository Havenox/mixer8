# 052 - [Downloader]: Argumentos Extras no yt-dlp e Impersonação TLS (curl-cffi)

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 25/06/2026

---

## 🚀 Desafio de Engenharia
No ambiente de produção (rodando em servidor VPS), os downloads de streams de áudio do YouTube (formato 251/Opus) começaram a falhar sistematicamente com o erro `HTTP Error 403: Forbidden`. Esse problema persistia mesmo com o uso de cookies atualizados (`youtube-cookies.txt`). O motivo é que o YouTube realiza validações rígidas de assinatura e impressões digitais TLS para conexões vindas de faixas de IP de data centers, bloqueando tentativas de download anônimas ou com agentes de usuário (User-Agent) que não correspondem aos cookies exportados.

## 🧠 Estratégia da Solução
Para contornar o bloqueio de IP e assinatura do YouTube, adotamos duas estratégias integradas no microsserviço `mixer8-downloader`:
1. **Passagem Dinâmica de Parâmetros (`YT_DLP_EXTRA_ARGS`):** Alteramos o Worker em C# para ler argumentos adicionais do `yt-dlp` a partir do arquivo de configuração/variáveis de ambiente `.env`. Isso permite alternar clientes de reprodução (ex: `--extractor-args "youtube:player_client=web_embedded,web"`) sem a necessidade de reescrever e recompilar o código C#.
2. **Impersonação de TLS Browser-Like (`curl-cffi`):** Adicionamos a biblioteca Python `curl-cffi` à imagem Docker do Downloader. Com isso, torna-se possível utilizar a flag `--impersonate chrome` no `yt-dlp`. Esta flag simula perfeitamente o aperto de mão TLS (Client Hello) e os cabeçalhos HTTP do navegador Google Chrome, fazendo com que as requisições enviadas pelo servidor pareçam vir de um navegador comum de usuário final, legitimando os cookies fornecidos.

## 🛠️ Implementação Técnica

### Backend (`mixer8-downloader`)
* **[Worker.cs](file:///g:/DEV/mixer8/mixer8-downloader/Worker.cs):**
  * Modificado o fluxo de captura de configurações para ler a variável `YT_DLP_EXTRA_ARGS` (vazia por padrão).
  * Atualizada a assinatura do método `RunYtdlpAsync` para aceitar a string `extraArgs` e concatená-la à linha de comando que invoca o binário do `yt-dlp`.
* **[Dockerfile](file:///g:/DEV/mixer8/mixer8-downloader/Dockerfile):**
  * Incluída a dependência `curl-cffi` na instalação do ambiente virtual do Python via `pip install --upgrade pip yt-dlp yt-dlp-ejs curl-cffi`. Isso adiciona nativamente o suporte ao handler de requisições `curl_cffi` para o `yt-dlp`.

### Configurações / Infraestrutura
* **[.env.example](file:///g:/DEV/mixer8/.env.example) & [.env](file:///g:/DEV/mixer8/.env):**
  * Adicionada e comentada a variável `YT_DLP_EXTRA_ARGS` documentando as flags recomendadas para produção (`--impersonate chrome --extractor-args "youtube:player_client=web_embedded,web"`).

## 🎯 Impacto e Resultado
* **Resiliência do Serviço de Downloads**: Possibilidade de burlar o erro HTTP 403 em ambientes com restrição severa de IP (como VPS) simulando TLS de navegadores autênticos.
* **Manutenibilidade Sem Paradas de Build**: As flags do `yt-dlp` agora são 100% configuráveis pelo arquivo `.env`, o que permite reagrupar e atualizar comandos instantaneamente caso o YouTube mude os algoritmos no futuro.

---
**Nota do Desenvolvedor:** *A simulação de TLS via curl-cffi associada ao Deno (para solucionar desafios em tempo de execução) é atualmente a melhor defesa contra a detecção de assinaturas automatizadas do YouTube. Permitir que essas configurações sejam injetadas dinamicamente traz independência para a operação do homelab e servidores remotos.*
