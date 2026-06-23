# 043 - [SEO]: SEO de Playlists e Otimização de Miniaturas (Open Graph)

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 23/06/2026

---

## 🚀 Desafio de Engenharia

O Mixer8 é construído sobre uma arquitetura SPA (Single Page Application) em React, servida estaticamente pelo Nginx. Ao compartilhar ou indexar um link direto de uma playlist (ex: `https://mixer8.havenox.dev/playlists/{id}`), robôs e crawlers de redes sociais (como os do Telegram, WhatsApp, Discord, Slack, etc.) liam apenas o `index.html` estático geral da aplicação, que exibia títulos e descrições genéricas da plataforma, em vez dos metadados específicos da playlist. Como esses indexadores não interpretam código JavaScript nem aguardam requisições de API, a renderização client-side padrão do React não era suficiente para apresentar miniaturas ricas e personalizadas.

---

## 🧠 Estratégia da Solução

Implementou-se o padrão de **Dynamic Rendering** (Prerendering sob demanda por User-Agent):
1. **Roteamento no Nginx:** Criou-se uma regra de localização prioritária no Nginx (`mixer8-app`) para capturar requisições nas rotas `/playlists/{id}`. Caso o cabeçalho `User-Agent` corresponda a um crawler conhecido, a requisição é interceptada e encaminhada via proxy reverso diretamente à API backend (`mixer8-api`). Caso contrário, ela segue o fluxo padrão de fallback da SPA para renderizar o app no navegador do usuário.
2. **HTML Dinâmico na API:** Desenvolveu-se um endpoint público `/api/seo/playlists/{id}` no backend .NET 10. Ele extrai os metadados reais da playlist no banco PostgreSQL (incluindo cálculo de tempo total, contagem de músicas, resolução do avatar/nome amigável do criador e fallbacks de imagem de capa) e devolve um HTML enxuto contendo os blocos `<meta>` Open Graph e Twitter Cards apropriados para o parser do crawler.
3. **Controle de Privacidade Estrito:** O endpoint valida a privacidade da playlist. Se a playlist for `Private` (Privada), oculta-se a imagem de capa e serve-se um HTML genérico com um título padrão de playlist privada e uma descrição com uma chamada para ação (CTA) convidando o usuário a se registrar no ecossistema Mixer8.

---

## 🛠️ Implementação Técnica

### Backend (`mixer8-api`)
* **[SeoController.cs](file:///g:/DEV/mixer8/mixer8-api/Controllers/SeoController.cs):** Criação do controlador anônimo com o método `GetPlaylistSeo(string id)`.
  * Conversão segura e validação sintática do GUID recebido.
  * Lógica para carregar a playlist incluindo `PlaylistTracks` e `Track` associadas, além do proprietário (`User` e `UserProfile`).
  * Tratamento de playlists privadas para retornar um bloco HTML simplificado sem imagem e com descrição contendo o CTA corporativo.
  * Formatação amigável do criador seguindo a precedência: Nome Completo (`FirstName` + `LastName`), `FirstName`, `UserName` ou início do `Email`.
  * Formatação humana do tempo acumulado das faixas em horas e minutos (ex: `1h 58m` ou `45 min`).
  * Construção e normalização de URLs absolutas de imagem de capa (capa direta da playlist, capa da primeira música ou logomarca da plataforma como fallback) baseado nos cabeçalhos `X-Forwarded-*` encaminhados pelo proxy.
  * Injeção de script de redirecionamento `window.location.replace()` no body do HTML gerado como contingência para navegadores tradicionais.

### Frontend (`mixer8-app`)
* **[nginx.conf](file:///g:/DEV/mixer8/mixer8-app/nginx.conf):** Adicionada a regra `location ~* ^/playlists/([^/]+)/?$` avaliando se o tráfego provém de bots por meio de expressão regular. Em caso positivo, efetua o proxy reverso para `http://api:5000/api/seo/playlists/$1` repassando os cabeçalhos de contexto originais (`Host`, `X-Forwarded-Proto`, etc.).

---

## 🎯 Impacto e Resultado

* **[Miniaturas Ricas Personalizadas]**: Links públicos e não listados de playlists compartilhados nas redes sociais agora renderizam previews customizados contendo a capa da playlist (ou primeira música), nome, quantidade de faixas, tempo total e o autor da lista.
* **[Preservação de Segurança]**: Playlists privadas permanecem opacas a robôs e crawlers, exibindo apenas um banner genérico convidando novos usuários a se registrarem na plataforma.
* **[Zero Overhead para Usuários Reais]**: A SPA continua sendo servida de forma estática e instantânea para os usuários finais, sem adicionar requisições extras ou processamento no servidor backend para acessos normais via navegador.

---
**Nota do Desenvolvedor:** *A abordagem de Dynamic Rendering interceptando requisições apenas no nível do servidor web (Nginx) se provou uma escolha arquitetural extremamente limpa. Ela evitou o acoplamento de frameworks híbridos mais complexos e manteve a SPA client-side extremamente leve e rápida, delegando o processamento pesado de SEO apenas quando estritamente necessário (quando robôs batem na aplicação).*
