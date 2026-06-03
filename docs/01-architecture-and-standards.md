# Documento de Arquitetura e Padrões (ADR-01)

Este documento estabelece as diretrizes fundamentais de arquitetura, convenções de código, segurança e integridade de dados que governam o desenvolvimento de todo o ecossistema **Mixer8**. Estas decisões são inegociáveis e devem ser seguidas estritamente por qualquer agente ou desenvolvedor que atue no repositório.

---

## 1. Soberania do Backend & Convenção de Case (PascalCase)

Para garantir consistência absoluta entre as linguagens C# (backend) e TypeScript (frontend), adotamos a política de **Soberania do Backend**:

> [!IMPORTANT]
> **A Regra de Ouro**: O servidor dita as regras e convenções do ecossistema. Toda a comunicação de dados, incluindo **obrigatoriamente as chaves de payloads JSON de entrada e saída (Request/Response) da API**, namespaces, classes, métodos e propriedades devem utilizar a grafia **PascalCase**.

### Exemplo de Contrato da API (JSON)
O backend **não** converterá chaves para camelCase na serialização. O payload trafegará exatamente assim:

```json
{
  "TrackId": "e29c8821-3990-4408-803b-0c9a999e7e22",
  "TrackTitle": "Bohemian Rhapsody",
  "ArtistName": "Queen",
  "Stems": [
    {
      "StemId": "fa910d65-1033-41c1-90a2-cb391e8e2fa9",
      "StemType": "Vocals",
      "AudioUrl": "https://storage.mixer8.local/stems/bohemian_vocals.mp3"
    }
  ]
}
```

### Complacência no Frontend (React SPA)
O TypeScript mapeará as interfaces retendo **exatamente** as chaves em PascalCase ditadas pelo servidor, eliminando conversores arbitrários client-side:

```typescript
// Mapeamento idêntico no mixer8-web
export interface IStemData {
  StemId: string;
  StemType: string;
  AudioUrl: string;
}

export interface ITrackData {
  TrackId: string;
  TrackTitle: string;
  ArtistName: string;
  Stems: IStemData[];
}
```

---

## 2. Agnosticismo de Ambiente e Segurança (Zero Hardcode)

Adotamos uma política rígida de **Zero Hardcode** para dados sensíveis, segredos de infraestrutura ou URLs:

* **Injeção de Configurações**: Todas as portas de escuta, conexões de banco de dados, chaves de criptografia e credenciais de serviços externos devem ser carregadas em tempo de execução das variáveis de ambiente (`EnvironmentVariables`).
* **Estrutura de Variáveis**: O arquivo `.env` na raiz é o ponto centralizador local. No Docker Compose, os valores são repassados aos containers pelo mecanismo de `env_file`.
* **String de Conexão Dinâmica**: No C# e no Node, as conexões de banco não devem ser duplicadas. A string de conexão final deve ser construída programaticamente a partir das chaves individuais (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`), simplificando a alteração de senhas sem riscos de inconsistência.
* **Parametrização do Extrator Headless**: Variáveis de ambiente como `EXTRACTOR_WAIT_TIME_BASE_SECONDS` (tempo de carência base), `EXTRACTOR_BROWSER_CHANNEL` (canal de distribuição do navegador) e `EXTRACTOR_CONFIG_DIR` (diretório de dados e flags) evitam o hardcoding de caminhos físicos ou tempos estáticos de espera, permitindo a adequação do bot a diferentes capacidades de hardware e ambientes de infraestrutura sem alterações no código fonte.

---

## 3. Modelo de Autenticação e Segurança (JWT + RBAC)

O controle de acessos da API do Mixer8 garante a proteção dos recursos intelectuais e de áudio:

* **Autenticação**: Baseada em **JSON Web Tokens (JWT)** assinados de forma assimétrica ou simétrica de alta entropia. O token trafega no cabeçalho HTTP `Authorization: Bearer <TOKEN>`.
* **Controle de Acesso Baseado em Perfis (RBAC)**:
  Existem quatro níveis claros de permissão (Roles) injetados nos Claims do Token JWT:
  1. `Admin`: Acesso total e irrestrito ao sistema, configurações do Docker, logs e gerenciamento de usuários.
  2. `Moderator`: Permissão para editar metadados de tracks globais, gerenciar playlists públicas e aprovar novos uploads.
  3. `PaidUser`: Permissão total para utilizar a DAW web de mixagem de stems e acionar o microserviço `mixer8-extractor` para novos uploads.
  4. `User`: Acesso básico de escuta do catálogo, criação de playlists pessoais de mixagens estáticas.
* **Rotas Públicas vs Privadas**:
  * Rotas de autenticação, registro e catálogo público básico de áudio são livres.
  * O player de áudio sincronizado por stems e o fluxo de upload/DAW exigem validação rigorosa de assinatura de perfil do usuário.

---

## 4. Padrões de Código e Engenharia

### 💻 Práticas do Backend (.NET 10 & C# 13)
* **Primary Constructors**: Obrigatório o uso da sintaxe de Primary Constructors em controllers, services, repositories e handlers para injeção de dependências limpa:
  ```csharp
  public class TrackService(ITrackRepository trackRepository, ILogger<TrackService> logger) : ITrackService
  {
      // Dependências disponíveis de forma limpa no corpo da classe
  }
  ```
* **Assincronismo de Ponta a Ponta**: Todas as chamadas de banco de dados, acesso a disco e requisições HTTP devem ser assíncronas (`async`/`await`), retornando `Task` ou `Task<T>`.
* **Tratamento de Exceções**: Lançamento de exceções de domínio tipadas com códigos literais em caixa alta (ex: `BUSINESS_RULE_VIOLATION`, `UNAUTHORIZED_ACCESS`), as quais são traduzidas por um middleware global de tratamento de erros para respostas HTTP limpas e estruturadas.
* **Rate-Limit por Cache em Memória**: Controle de anti-spam e cooldowns deslizantes para mutações de dados leves (como incremento de plays) devem utilizar `IMemoryCache` de forma a blindar o banco de dados contra requisições de clicks repetidos no frontend.

### ⚛️ Práticas do Frontend (React + TypeScript)
* **Zero Mocks (Estado de Tela Baseado em Dados Reais)**: Proibido o uso de dados de demonstração hardcodados localmente (mockados) para listas de catálogo, estatísticas ou usuários. Caso o banco de dados esteja vazio, a aplicação deve renderizar estados de tela limpos de feedback (ex: "Nenhuma música disponível", "Fila de processamento vazia") em vez de simular registros fictícios.
* **Type-Only Imports (Prevenção de Erros ESM em Vite)**: Todas as importações de interfaces e tipos puros do TypeScript que não possuam representação em JavaScript em tempo de execução (runtime) devem utilizar a cláusula `import type`. Isso evita falhas de módulo vazio no navegador durante a transpilação do bundler.
* **Derived State (Estado Derivado)**: Proibido o uso de `useEffect` para sincronizar estados redundantes. Toda a lógica de filtragem, paginação ou formatação deve ser calculada na renderização de forma síncrona.
* **Prevenção de Duplo Envio**: Todos os formulários e ações de mutação assíncrona devem desabilitar fisicamente a interação do usuário (`disabled={isPending}`) durante o processamento.
* **Acumuladores de Tempo Reais para Audiência**: Para medição de audiência e controle de reproduções, o tempo escutado deve ser acumulado de forma líquida em referências estáveis (`useRef`) no context player do React, disparando a chamada da API somente após satisfazer o limite temporal do negócio (Regra dos 30s).

### 🤖 Práticas de Automação Headless (Playwright & Docker)
* **Requisitos do Navegador e Codecs Proprietários**: A decodificação de áudio de alta fidelidade em DAWs de terceiros requer codecs proprietários (como MP3/AAC). Por conta disso, o contêiner de automação deve obrigatoriamente executar a distribuição oficial estável do Google Chrome (canal de navegador `chrome`) em vez do Chromium básico padrão do Playwright, mitigando erros de inicialização de áudio (*EncodingError*).
* **Argumentos de Inicialização Headless**: A execução estável em ambientes virtuais sem aceleração de GPU por hardware exige a desativação da política de autoplay (`--autoplay-policy=no-user-gesture-required`) e a ativação forçada de renderização via software WebGL (ex: SwiftShader/ANGLE), permitindo que a interface gráfica virtual da DAW inicialize perfeitamente.
