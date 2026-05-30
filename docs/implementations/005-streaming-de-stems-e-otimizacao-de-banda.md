# 005 - [Transmissão/UX]: Streaming Progressivo (HTTP Range 206) e Controles de Sliders Premium

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 30/05/2026

---

## 🚀 Desafio de Engenharia
Melhorar a performance de transmissão de áudio do servidor backend de Mixer8 e a experiência do usuário no player.
Previamente, o carregamento de faixas iniciava o download simultâneo e total de todas as stems da música devido ao valor padrão de `preload = 'auto'`. Isso resultava em desperdício de processamento e banda no servidor se o usuário apenas testasse os primeiros segundos e trocasse de música.
Adicionalmente, os seletores da linha do tempo e do volume geral eram representados por barras estáticas fictícias ou disparavam requisições e seeks em tempo real repetitivos durante o arrasto, causando engasgos no player e travamentos visuais.

## 🧠 Estratégia da Solução
1. **Streaming Progressivo Nativo (HTTP Range 206)**:
   - Manutenção de arquivos no formato `.opus` utilizando requisições parciais de bytes (`Range`) nativas do protocolo HTTP 1.1 / RFC 7233.
   - Substituição da política de pré-carregamento para `preload = 'metadata'` no frontend. Ao carregar a faixa, o browser lê apenas os cabeçalhos de metadados para saber a duração da música, economizando 100% dos bytes de áudio físico até que o usuário clique em Play.
2. **Controle de Cache**:
   - Injeção do header de cache de longa duração (`Cache-Control: public, max-age=2592000`) nas respostas de arquivos estáticos da API, eliminando redundância de tráfego de rede para loops ou replays locais das faixas.
3. **UX Premium de Sliders**:
   - Implementação de sliders com alça de controle ("bolinha") verde e interações visuais baseadas em CSS customizado.
   - **Timeline (Drag-and-Release)**: Gerenciamento de estado local durante o arrasto na linha do tempo. O tempo visível atualiza dinamicamente na UI, mas a instrução física de pulo (`seek`) é retida até o gatilho de soltar o mouse (`onMouseUp` / `onTouchEnd`), minimizando I/O do servidor e cancelamentos de conexão.
   - **Volume Master**: Criação de um nó de ganho master real (`masterGainNode`) na Web Audio API do frontend acoplado ao fader de volume, atualizando de forma imediata (onChange).

## 🛠️ Implementação Técnica
### Frontend (React SPA)
- Atualizado [PlayerContext.tsx](file:///g:/DEV/mixer8/mixer8-app/src/context/PlayerContext.tsx) para:
  - Adicionar o nó `masterGainNodeRef` e a função `setMasterVolume` para controle de ganho master real.
  - Prefixar caminhos de áudios locais relativos com `SERVER_URL`.
  - Configurar `preload = 'metadata'` nas instâncias de áudio das stems.
- Refatorado [MesaPlayer.tsx](file:///g:/DEV/mixer8/mixer8-app/src/components/MesaPlayer.tsx) para:
  - Substituir faders fictícios por inputs range do tipo `<input type="range" />` reais para volume geral e timeline.
  - Implementar estado local `isDraggingProgress` e `dragProgressTime` para pulo na timeline apenas ao soltar o mouse.
- Adicionados estilos visuais de faders com bolinha verde e escalas dinâmicas no [index.css](file:///g:/DEV/mixer8/mixer8-app/src/index.css).

### Backend (.NET 10 API)
- Adicionado o cabeçalho `Cache-Control` na entrega de arquivos estáticos em [Program.cs](file:///g:/DEV/mixer8/mixer8-api/Program.cs).

## 🎯 Impacto e Resultado
* **Economia Extrema de Banda**: Redução drástica do tráfego do servidor. Músicas carregadas na biblioteca não geram custos de rede até que o Play seja ativado, e a interrupção de faixas cessa o tráfego HTTP 206 instantaneamente.
* **Mesa de Som Funcional**: O fader de volume master do painel do player passou a atuar de forma real e contínua no volume de saída das stems combinadas da Web Audio API.
* **Suavidade na Timeline**: O arrasto na linha do tempo tornou-se fluido, sem re-bufferings ou requisições repetidas ao servidor durante o deslocamento do cursor de tempo.
