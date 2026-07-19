# 076 - Audio: Robustez e Estabilidade do Motor de Áudio Multicanal no iOS (WebKit)

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 19/07/2026

---

## 🚀 Desafio de Engenharia
A reprodução de áudio multicanal sincronizado (*stems*) é uma das tarefas mais exigentes da Web Audio API. Em dispositivos da Apple (iOS e Safari macOS), que utilizam obrigatoriamente o motor **WebKit**, os usuários frequentemente relatam problemas graves como:
1. **Muting / Descarte de Canais:** Um canal (como a voz ou baixo) ficava silencioso repentinamente durante a execução da música.
2. **Dessincronização de Trilhas:** Stems saindo do tempo de alinhamento com a stem master (efeito de eco/atraso).
3. **Travamento Geral pós-Bloqueio:** O áudio parava de responder após o usuário bloquear e desbloquear o celular ou alternar entre abas do navegador.

## 🧠 Estratégia da Solução
1. **Prevenção contra Coleta de Lixo (Anti-GC):** O WebKit descarta nós de áudio em reprodução se o JavaScript não retiver referências fortes. Vinculamos de forma permanente todos os nós criados (`AudioNode`) como propriedades das instâncias dos elementos `<audio>` correspondentes, além de gerenciar um `Set` de referências ativas no próprio `AudioContext`.
2. **Controle Dinâmico de Drift (Exclusivo iOS/Safari):** O alinhamento rígido a cada 50ms é ideal para desktop, mas no iOS causa engasgos devido à latência física de operação do comando `currentTime` nos elementos de áudio. Implementamos uma detecção de ambiente para aumentar o limiar de drift no iOS para 150ms e rate-limit de correções repetidas em uma mesma stem para 2.5s.
3. **Gerenciamento do Ciclo de Vida da Aba:** Registramos listeners globais para `visibilitychange` (para resumir contextos que o SO suspendeu silenciosamente) e interações na janela (para contornar a exigência de gestos de usuário para reprodução do Web Audio ao retornar da tela bloqueada).

## 🛠️ Implementação Técnica

### Frontend (`PlayerContext.tsx`)
* **Retenção de Nós (`loadTrack`):**
  * Anexadas referências customizadas no elemento de áudio: `audio._sourceNode = sourceNode`, `audio._gainNode = gainNode`, etc.
  * Criado o conjunto `ctx._activeNodes` para reter o grafo ativo em memória.
* **Limpeza Controlada (`cleanupActiveStems`):**
  * Limpeza explícita do `Set` de nós ativos e exclusão das propriedades customizadas do `audio` para evitar vazamentos de memória.
  * Reset do histórico de timestamps de seeks.
* **Refinamento do Drift (`useEffect`):**
  * Detectado o ambiente Apple com Regex no UserAgent e suporte a múltiplos toques (`maxTouchPoints`).
  * Utilizado limiar adaptativo (`driftThreshold = isAppleEnv ? 0.15 : 0.05`).
  * Limitada a taxa de ajustes de currentTime por stem index usando `lastDriftCorrectionTimestampsRef` para prevenir *seeking loops*.
* **Auto-Recuperação do Estado:**
  * Monitoramento do evento `visibilitychange`. Caso a página se torne visível e o status do player seja de reprodução ativa com o `AudioContext` suspenso, executa-se `.resume()` e o realinhamento pontual de playheads.
  * Adicionados ouvintes de clique e toque na janela para atuar como gatilhos de retomada do contexto de áudio interrompido.

## 🎯 Impacto e Resultado
* **Estabilidade no iOS:** Mitigados os silenciamentos repentinos gerados por coleta de lixo e as dessincronizações de faixas pós-desbloqueio.
* **Fluidez na Mudança de Estados:** A transição do navegador de/para o plano de fundo recupera a reprodução sem quebras perceptíveis.
* **Isolamento de Impacto:** O ambiente Windows/Chrome Desktop mantém as políticas originais de máxima precisão (50ms de tolerância e atualização em tempo real sem rate-limiting), preservando o comportamento que já funcionava perfeitamente no PC.

---
**Nota do Desenvolvedor:** *O gerenciamento de áudio em tempo real sob restrições severas de consumo e otimização do WebKit é um desafio constante. O encapsulamento inteligente e isolado por ambiente garante a máxima robustez em plataformas móveis sem abrir mão da precisão cirúrgica de alinhamento em desktops.*
