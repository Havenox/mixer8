# 001 - Banco de Dados e Integração: Fundação Real e Arquitetura Multi-Stems Sem Mocks

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 30/05/2026

---

## 🚀 Desafio de Engenharia
O ecossistema do **Mixer8** necessitava migrar de uma estrutura conceitual inicial ("mockada") para um embrião 100% real e persistente. Os principais pontos de dor eram:
1. **Dados Estáticos na UI**: Diversos elementos da interface de usuário (como lista de músicas, gêneros, tocador de áudio e lista de usuários no CRM) eram definidos estaticamente no frontend, camuflando o estado real do banco de dados PostgreSQL do Homelab.
2. **Volatilidade de Cookies**: Ao importar cookies de sessão para o extrator headless, os dados desapareciam da tela após um F5 (recarregamento) porque o frontend não consultava o arquivo físico salvo na API, além do teste de conexão com o robô ser totalmente simulado por cronômetro.
3. **Complexidade e Variabilidade de Stems**: O extrator de IA (baseado em Playwright) extrai entre 1 a 10 faixas (stems) opcionais em arquivos `.zip` nomeados de forma padronizada (`nome-stem-tonalidade-bpm-frequencia.mp3`). A arquitetura do player e da API precisavam de suporte para lidar dinamicamente com qualquer combinação de faixas de forma real.

## 🧠 Estratégia da Solução
Decidimos por uma abordagem de **Zero Simulação (Pure Real-State)**, removendo todos os mocks e garantindo que o catálogo seja 100% governado pelo PostgreSQL:
1. **Persistência de Cookies Nativa**: Criamos rotas reais na API C# para persistir o `auth.json` sob a pasta de configurações do extrator (`GetSession`), e implementamos um teste de conexão HTTP ativo (`TestConnection`) que monta um container de cookies nativo e dispara uma requisição real contra o portal de Stems AI externo (`https://studio.moises.ai/`), validando com precisão o estado de autenticação (ativo vs. expirado).
2. **Mapeamento de 10 Stems Opcionais**: Desenvolvemos a especificação técnica para processar até 10 faixas opcionais (Metrônomo, Outros, Voz, Guitarra, Baixo, Bateria, Piano, Teclado, Sopro, Cordas). O extrator descompactará o ZIP, identificará o sufixo no nome original, renomeará o arquivo físico no servidor (ex: `Baixo.mp3`) e indexará sua URL de streaming na tabela relacional `"Stems"`.
3. **Player Dinâmico Relacional**: Se uma música possuir apenas 1 stem (não separada), ela será reproduzida como um single player tradicional. Se possuir mais, o painel de mixagem renderizará controles deslizantes de volume (`GainNodes` na Web Audio API) sob demanda apenas para os canais que existirem fisicamente no banco de dados.

## 🛠️ Implementação Técnica
* **Geração de Migrations Física (EF Core 10)**: Criamos e executamos a migração inicial `InitialCreate` mapeando fisicamente as tabelas relacionais em PascalCase (`Users`, `Tracks`, `Stems`).
* **Seeding Dinâmico Resiliente**: Implementamos no boot do [Program.cs](file:///g:/DEV/mixer8/mixer8-api/Program.cs) o auto-seeding de usuários com perfis RBAC (senha `mixer8` em BCrypt) e uma música de demonstração real com 5 canais ativos vinculados se a biblioteca estiver zerada.
* **Portas Injetadas dinamicamente**: Vinculamos o backend Kestrel (porta `5000`) e o frontend Vite (porta `3000`) de forma estrita às variáveis `API_PORT` e `WEB_PORT` do arquivo `.env` unificado na raiz.
* **Refatoração no Frontend**: Substituímos os placeholders de cookies no [Admin.tsx](file:///g:/DEV/mixer8/mixer8-app/src/pages/Admin.tsx) e injetamos o consumo dos endpoints `/Admin/GetSession` e `/Admin/TestConnection` reais, eliminando o timer simulado.

## 🎯 Impacto e Resultado
* **Conexão Real do Bot**: O painel administrativo agora valida fisicamente se os cookies copiados da extensão são válidos para bypass de CAPTCHA direto nos servidores de destino em tempo real.
* **Persistência em Refresh (F5)**: A tela administrativa exibe o JSON real gravado no disco ao recarregar a página, removendo o template estático de mock.
* **Infraestrutura Desacoplada e Agnóstica**: Todas as três pontas (API, Extrator Worker e React Frontend) comunicam-se via variáveis e portas centralizadas no `.env` do diretório pai, prontas para rodar em produção via Docker ou Baremetal.

---
**Nota do Desenvolvedor:** *A arquitetura de stems variáveis em banco de dados relacional assegura escalabilidade e flexibilidade. O uso da Web Audio API com mapeamento sob demanda resolve o maior gargalo de players concorrentes (que assumem faixas fixas), pavimentando o caminho para um player ultra-moderno e fidedigno ao banco de dados.*
