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
1. **Aumento dos Tempos Padrão do Time Gate**: Ajustamos o limite seguro de carência de transcodificação de stems de 2 para 3 minutos para arquivos normais. A proporção foi estendida para 4 minutos (arquivos médios) e 5 minutos (arquivos grandes), garantindo integridade e download completo.
2. **Buffer Pós-F5 Estendido**: Aumentamos o tempo de espera estático após a recarga da página (F5) de 10 segundos para 30 segundos, mitigando a lentidão de renderização sem aceleração GPU.
3. **Diretrizes de Autoplay e Renderização Gráfica**: Injetamos argumentos de inicialização no Chromium para ignorar a restrição de autoplay e habilitar renderização por software de WebGL/GPU (via ANGLE/SwiftShader).
4. **Telemetria de Frames e Logs de Erro**: Inserimos logs informativos detalhados no loop do extrator (URL principal e mapeamento de frames).
5. **Sequenciamento de Fotos de Diagnóstico e Captura de Console**: Criamos um fluxo de capturas de tela sequenciais controladas pelo tempo durante o ciclo de processamento da DAW e persistimos todos os eventos e exceções do console do navegador no arquivo local `browser_console.txt` para auditoria offline completa.
6. **Reativação do Headless em Desenvolvimento**: Com a robustez do fluxo validada em modo headed (com tela), o modo headless foi reativado no arquivo de configuração do ambiente local para teste em modo de homologação final.

## 🛠️ Implementação Técnica

### Extrator de Stems (.NET 10 Worker & Playwright)
* **Argumentos de Inicialização do Navegador em [Worker.cs](file:///g:/DEV/mixer8/mixer8-extractor/Worker.cs)**:
  - Adicionado `--autoplay-policy=no-user-gesture-required` para isentar a exigência de gestos em reproduções de áudio.
  - Adicionados `--use-gl=angle`, `--use-angle=gl`, `--ignore-gpu-blocklist` e `--enable-webgl` para forçar compatibilidade gráfica no headless.
* **Ajuste de Constantes em [Worker.cs](file:///g:/DEV/mixer8/mixer8-extractor/Worker.cs)**:
  - Redefinido `delayMs = 180000` (3 minutos) como valor inicial padrão.
  - Atualizadas as faixas de tamanho físico para definir `240000` (4 minutos) e `300000` (5 minutos) de espera fixa.
  - Aumentado o delay do `Task.Delay` subsequente ao `page.ReloadAsync` para `30000` ms (30 segundos).
* **Telemetria e Debug em [Worker.cs](file:///g:/DEV/mixer8/mixer8-extractor/Worker.cs)**:
  - Emissão da URL atual da página principal e listagem do grafo de URLs e nomes de frames ativos durante a checagem de prontidão da DAW.
  - Gravação em tempo real de todas as mensagens e erros de console no arquivo `browser_console.txt`.
  - Sequência de screenshots na esteira da DAW: `daw_01_acesso.png` (abertura), `daw_02_10seg.png` (10s), `daw_03_20seg.png` (20s), `daw_04_antes_refresh.png` (fim do time gate), `daw_05_pos_refresh.png` (pós-F5 imediato) e `daw_06_fim_delay_pos_refresh.png` (pós-F5 tardio).
  - Captura sob demanda `daw_debug.png` em caso de falhas na localização do botão de exportação.

### Configuração
* **Mudança em [appsettings.Development.json](file:///g:/DEV/mixer8/mixer8-extractor/appsettings.Development.json)**:
  - Alterado `"EXTRACTOR_HEADLESS"` de `false` para `true` para garantir testes e execuções headless imediatos pelo desenvolvedor.

## 🎯 Impacto e Resultado
* **Estabilidade Headless**: O robô agora inicializa o player, carrega o contexto de áudio e detecta os botões de exportação de forma consistente, mesmo sob altos tempos de inicialização da engine Web Audio em servidores sem GPU.
* **Diagnósticos Transparentes**: Desenvolvedores e logs conseguem acompanhar a hierarquia de frames, os logs do console em `browser_console.txt` e a tela real do navegador através da linha do tempo visual gerada pelos screenshots de depuração.
* **Redução de Exceções Stale**: Ao aguardar 30 segundos adicionais pós-F5, eliminamos condições de corrida na renderização inicial dos frames.

---
**Nota do Desenvolvedor:** *A execução headless economiza recursos substanciais de CPU e memória RAM no servidor de produção, mas impõe desafios únicos de temporização e áudio. O relaxamento das políticas de autoplay e a injeção de suporte a GL resolvem os travamentos silenciosos da engine.*
