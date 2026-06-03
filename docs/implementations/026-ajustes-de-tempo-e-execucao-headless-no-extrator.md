# 026 - [Automação / Extrator]: Ajuste de Tempos e Execução Headless Estável

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 02/06/2026

---

## 🚀 Desafio de Engenharia
Ao rodar o bot de extração de stems em ambientes headless (sem aceleração de GPU gráfica/hardware e sem interface de janela ativa), constatou-se que a renderização dos elementos gráficos complexos da DAW da plataforma de IA parceira (como a inicialização da engine de Web Audio, shaders do Canvas e ativação de frames) consome consideravelmente mais tempo do que em janelas gráficas normais.

Isso causava duas falhas principais:
1. O mix e as stems ainda não estavam totalmente consolidados no servidor de processamento quando o bot de extração tentava localizá-los, exigindo um tempo de carência maior antes da exportação.
2. Ao realizar o recarregamento de página (F5) para atualizar a DOM da Single Page Application (SPA), o tempo de espera pós-recarregamento de 10 segundos era insuficiente para que a interface gráfica headless inicializasse por completo e montasse os elementos interativos do player, provocando timeouts e falhas na localização do botão de exportação.

## 🧠 Estratégia da Solução
Ajustamos de forma cirúrgica as constantes de tempo de execução da automação Playwright C# para dar uma margem de segurança adequada à compilação e execução em servidores headless:
1. **Aumento dos Tempos Padrão do Time Gate**: Ajustamos o limite seguro de carência de transcodificação de stems de 2 para 3 minutos para arquivos normais. A proporção foi estendida para 4 minutos (arquivos médios) e 5 minutos (arquivos grandes), garantindo integridade e download completo.
2. **Buffer Pós-F5 Estendido**: Aumentamos o tempo de espera estático após a recarga da página (F5) de 10 segundos para 30 segundos, mitigando a lentidão de renderização sem aceleração GPU.
3. **Reativação do Headless em Desenvolvimento**: Com a robustez do fluxo validada em modo headed (com tela), o modo headless foi reativado no arquivo de configuração do ambiente local para teste em modo de homologação final.

## 🛠️ Implementação Técnica

### Extrator de Stems (.NET 10 Worker & Playwright)
* **Ajuste de Constantes em [Worker.cs](file:///g:/DEV/mixer8/mixer8-extractor/Worker.cs)**:
  - Redefinido `delayMs = 180000` (3 minutos) como valor inicial padrão.
  - Atualizadas as faixas de tamanho físico para definir `240000` (4 minutos) e `300000` (5 minutos) de espera fixa.
  - Aumentado o delay do `Task.Delay` subsequente ao `page.ReloadAsync` para `30000` ms (30 segundos).

### Configuração
* **Mudança em [appsettings.Development.json](file:///g:/DEV/mixer8/mixer8-extractor/appsettings.Development.json)**:
  - Alterado `"EXTRACTOR_HEADLESS"` de `false` para `true` para garantir testes e execuções headless imediatos pelo desenvolvedor.

## 🎯 Impacto e Resultado
* **Estabilidade Headless**: O robô agora inicializa o player, carrega o contexto de áudio e detecta os botões de exportação de forma consistente, mesmo sob altos tempos de inicialização da engine Web Audio em servidores sem GPU.
* **Redução de Exceções Stale**: Ao aguardar 30 segundos adicionais pós-F5, eliminamos condições de corrida na renderização inicial dos frames.

---
**Nota do Desenvolvedor:** *A execução headless economiza recursos substanciais de CPU e memória RAM no servidor de produção, mas impõe desafios únicos de temporização. O ajuste de limites seguros evita reprocessamentos e garante que o extrator seja 100% autônomo.*
