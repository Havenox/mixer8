# 060 - [Infra / Backend]: Resolução de IP Real com Forwarded Headers em Contêineres

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 15/07/2026

---

## 🚀 Desafio de Engenharia
Ao executar a API do Mixer8 (`mixer8-api`) dentro de contêineres Docker atrás de um proxy reverso (Nginx), o endereço IP do cliente recebido pela propriedade `HttpContext.Connection.RemoteIpAddress` do ASP.NET Core era sempre o IP interno do gateway da rede Docker (ex: `192.168.128.1`).
Isso causava dois problemas críticos na plataforma:
1. **Logs de Auditoria Inválidos**: Todas as ações executadas por usuários deslogados/anônimos eram atribuídas ao mesmo IP interno do Docker, prejudicando o rastreamento e auditoria de acessos.
2. **Colisão de Rate Limit / Cooldown**: A lógica de cooldown para incrementos de reproduções de música (Play Count) é individualizada por usuário logado ou por endereço IP para usuários anônimos. Devido à colisão de IPs internos, um único play disparado por um usuário anônimo acionava o cooldown globalmente para todos os outros usuários anônimos na rede, bloqueando contagens válidas.

## 🧠 Estratégia da Solução
Configuramos a API ASP.NET Core para consumir e confiar nas informações de roteamento fornecidas pelos cabeçalhos de proxy do Nginx.
1. O Nginx já injetava de forma segura os cabeçalhos `X-Forwarded-For` (IP original do cliente) e `X-Forwarded-Proto` (protocolo da requisição original HTTP/HTTPS).
2. Adicionamos o middleware **`UseForwardedHeaders`** no topo do pipeline HTTP do ASP.NET Core.
3. Para contornar as restrições padrão do .NET que rejeitam encaminhamentos de proxies fora da rede loopback local (`127.0.0.1`), limpamos as coleções de proxies e redes conhecidas (`KnownProxies.Clear()` e `KnownIPNetworks.Clear()`), permitindo que a API processe os cabeçalhos transmitidos de qualquer IP do gateway Docker.
4. **Suporte a Múltiplos Saltos (VPS / VPN)**: Como a infraestrutura roteia as conexões por uma VPS pública e uma VPN interna (onde o IP de origem chega na máquina local como o gateway `10.8.0.1`), o cabeçalho `X-Forwarded-For` contém múltiplos endereços (`IP_CLIENTE, 10.8.0.1`). Por padrão, o ASP.NET Core tem um limite de salto (`ForwardLimit`) igual a `1`, capturando apenas o último proxy (`10.8.0.1`). Definimos `ForwardLimit = null` para forçar o middleware a ler toda a cadeia de cabeçalhos da direita para a esquerda e obter o IP público real original do cliente.

## 🛠️ Implementação Técnica

### Backend (mixer8-api)
* **[Program.cs](file:///g:/DEV/mixer8/mixer8-api/Program.cs)**:
  * Importado o namespace `Microsoft.AspNetCore.HttpOverrides`.
  * Registrado e ativado o middleware de cabeçalhos encaminhados (`UseForwardedHeaders`) no início do pipeline com suporte a `X-Forwarded-For` e `X-Forwarded-Proto`.
  * Definido `ForwardLimit = null` para processar múltiplos hops de proxy reverso e VPN.
  * Limpas as restrições de redes e proxies locais com `KnownIPNetworks.Clear()` e `KnownProxies.Clear()`, adaptando a aplicação para o ecossistema Docker.

## 🎯 Impacto e Resultado
* **Identificação Correta de IP**: A propriedade `RemoteIpAddress` do ASP.NET Core agora resolve corretamente o IP público real de cada usuário conectado.
* **Rate Limits Precisos**: O cooldown de reprodução de músicas (`play_cooldown:track:{id}:ip_CLIENT_IP`) passou a atuar de forma estritamente isolada e individualizada por IP para usuários anônimos, eliminando colisões de limite de taxa.
* **Logs Fidedignos**: Os logs de auditoria no PostgreSQL exibem agora a chave de IP pública real de acessos anônimos.

---
**Nota do Desenvolvedor:** *Colocar o middleware UseForwardedHeaders como o primeiríssimo elemento do pipeline de requisição HTTP garante que todos os middlewares subsequentes (CORS, Authentication, Routing) operem sobre metadados de rede de cliente válidos e consistentes.*
