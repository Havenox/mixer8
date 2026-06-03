# 026 - [Automação / Extrator]: Ajuste de Tempos e Execução Headless Estável

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 02/06/2026

---

## 🚀 Desafio de Engenharia
Ao rodar o bot de extração de stems em ambientes headless (sem aceleração de GPU gráfica/hardware e sem interface de janela activa), constatou-se que a renderização dos elementos gráficos complexos da DAW da plataforma de IA parceira (como a inicialização da engine de Web Audio, shaders do Canvas e ativação de frames) consome consideravelmente mais tempo do que em janelas gráficas normais.

Isso causava três falhas principais:
1. O mix e as stems ainda não estavam totalmente consolidados no servidor de processamento quando o bot de extração tentava localizá-los, exigindo um tempo de carência maior antes da exportação.
2. Ao realizar o recarregamento de página (F5) para atualizar a DOM da Single Page Application (SPA), o tempo de espera pós-recarregamento de 10 segundos era insuficiente para que a interface gráfica headless inicializasse por completo e montasse os elementos interativos do player, provocando timeouts e falhas na localização do botão de exportação.
3. A política de reprodução automática (Autoplay Policy) do Chromium bloqueia por padrão a inicialização do contexto de áudio (AudioContext) sem uma interação humana direta (como um clique) após o F5, travando a montagem e a inicialização da DAW em ambientes automatizados e invisíveis.

## 🧠 Estratégia da Solução
Ajustamos de forma cirúrgica as constantes de tempo de execução da automação Playwright C# e as diretrizes do navegador para dar uma margem de segurança adequada à compilação e execução em servidores headless:
1. **Atraso Base Parametrizado via `.env`**: Em vez de valores hardcoded, o atraso de carência base agora é lido da variável de ambiente `EXTRACTOR_WAIT_TIME_BASE_SECONDS` (com padrão de 180 segundos). A escala para arquivos médios (+60s) e grandes (+120s) é gerada proporcionalmente, garantindo integridade e download completo.
2. **Buffer Pós-F5 Estendido**: Aumentamos o tempo de espera estático após a recarga da página (F5) para 30 segundos, mitigando a lentidão de renderização sem aceleração GPU.
3. **Diretrizes de Autoplay e Renderização Gráfica**: Injetamos argumentos de inicialização no Chromium para ignorar a restrição de autoplay e habilitar renderização por software de WebGL/GPU (via ANGLE/SwiftShader).
4. **Remoção de Elementos de Depuração Temporários**: Os logs verbosos de frames e as capturas de tela sequenciais (`daw_01` a `daw_06` e `daw_debug.png`) foram removidos para evitar gravação contínua em disco em ambiente produtivo, restando apenas os logs informativos normais de fluxo.
5. **Decisões de Arquitetura de Rede**:
   - **Transferência via Volume Compartilhado**: Para evitar limites de tráfego de arquivos grandes (100MB+) via Cloudflare, o extrator grava o ZIP baixado em uma pasta física compartilhada e faz um POST com payload vazio para a API. A API lê o arquivo diretamente do disco.
   - **Comunicação Desacoplada**: O Worker monitora o banco PostgreSQL via polling (`SKIP LOCKED`) e chama a API utilizando seu domínio público parametrizado, permitindo que a API e o extrator rodem em servidores geograficamente separados.

## 🛠️ Implementação Técnica

### Extrator de Stems (.NET 10 Worker & Playwright)
* **Argumentos de Inicialização do Navegador em [Worker.cs](file:///g:/DEV/mixer8/mixer8-extractor/Worker.cs)**:
  - Adicionado `--autoplay-policy=no-user-gesture-required` para isentar a exigência de gestos em reproduções de áudio.
  - Adicionados `--use-gl=angle`, `--use-angle=gl`, `--ignore-gpu-blocklist` e `--enable-webgl` para forçar compatibilidade gráfica no headless.
  - Adicionada variável de classe `_activePage` e uma thread em background que monitora a existência do arquivo `/app/config/take_screenshot.flag` para capturar prints de tela em tempo real (`screenshot_live.png`) de forma não-intrusiva.
* **Ajuste de Constantes e Parametrização em [Worker.cs](file:///g:/DEV/mixer8/mixer8-extractor/Worker.cs)**:
  - Leitura de `EXTRACTOR_WAIT_TIME_BASE_SECONDS` das configurações (padrão 180s).
  - Escalonamento dinâmico: arquivos médios (`base + 60s`) e grandes (`base + 120s`).
  - Delay estático de `30000` ms (30 segundos) mantido pós-F5 para segurança de interface.
  - **Loops de Retry para IFrames**: Envelopamento da detecção de frames dinâmicos (`GetActiveUploadFrameAsync` e `GetActivePlayerFrameAsync`) em loops de retry de 10s e 15s respectivamente para evitar falhas de carregamento assíncrono.

### Configuração e Infraestrutura (Docker & Host)
* **Mudanças em [.env](file:///g:/DEV/mixer8/.env) e [.env.example](file:///g:/DEV/mixer8/.env.example)**:
  - Adicionada a variável `EXTRACTOR_WAIT_TIME_BASE_SECONDS=180` para fácil ajuste do time-gate.
  - Adicionada a variável `EXTRACTOR_BROWSER_CHANNEL=chrome` para definir a distribuição oficial do Chrome.
* **Suporte ao Google Chrome Oficial no Docker Linux**:
  - Atualizado o [Dockerfile](file:///g:/DEV/mixer8/mixer8-extractor/Dockerfile) para baixar a distribuição oficial do Chrome (`install --with-deps chrome`), resolvendo a deficiência de decodificadores de mídia proprietários (MP3/AAC) do Chromium base.
  - Ajustado o [docker-compose.yml](file:///g:/DEV/mixer8/docker-compose.yml) para injetar `EXTRACTOR_BROWSER_CHANNEL=chrome` e `EXTRACTOR_CONFIG_DIR=/app/config` no contêiner, garantindo persistência de volumes (`auth.json`, perfil e flags de debug) entre o host e o contêiner.

## 🎯 Impacto e Resultado
* **Paridade Total Host/Docker**: O contêiner Docker agora roda sob o Google Chrome Oficial estável do Linux, decodificando áudio da DAW perfeitamente e eliminando a tela preta com *"Ocorreu algum erro"*.
* **Depuração Não Intrusiva**: Possibilidade de auditar a interface do navegador headless em runtime em produção gravando arquivos flag em disco.
* **Resiliência e Persistência**: A detecção dinâmica de IFrames tolerante a atrasos e o isolamento de caminhos em volumes compartilhados no docker-compose garantem alta imunidade a falhas de rede.

---
**Nota do Desenvolvedor:** *A instalação do Google Chrome Oficial no Linux resolveu de vez a quebra do player de áudio na DAW, trazendo o comportamento do contêiner idêntico ao Windows baremetal. As flags de screenshot sob demanda no disco facilitaram o diagnóstico sem a necessidade de manter logs verbosos de imagem ativos.*
