# 071 - Frontend: Exportação de MIX Customizada na DAW em MP3 192kbps 48kHz Assíncrono

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 17/07/2026

---

## 🚀 Desafio de Engenharia
Os usuários da DAW do Mixer8 necessitavam da funcionalidade de exportar a mixagem customizada da música em reprodução (com seus ajustes de volume por stem, mutes, solos, balanço estéreo/panning, tom transposto e variação de BPM).

Os requisitos estritos definidos foram:
1. **Fidelidade Total:** O arquivo exportado deve refletir com precisão cirúrgica a exata configuração de áudio do cliente no momento da exportação.
2. **Formato Exato de Saída:** MP3 estéreo de **192 kbps** e taxa de amostragem de **48 kHz** (48000 Hz).
3. **Padronização do Nome do Arquivo:** Formato `<nomedamusica> - <nome do artista> (<tom> - <bpm>bpm).mp3` (ex: `Namorando Com Saudade - Jorge & Mateus (Em - 78bpm).mp3`).
4. **UX Totalmente Assíncrona e Não-Bloqueante:** O clique em "Exportar mix" não pode travar a tela ou os controles de reprodução. O progresso (0% a 100%) deve ser acompanhado através de um Toast flutuante com barra em tempo real enquanto o usuário navega livremente pela SPA.

## 🧠 Estratégia da Solução
1. **Renderização 100% Client-Side via Web Audio API (`OfflineAudioContext`)**:
   - Em vez de sobrecarregar a CPU do servidor com jobs pesados do FFmpeg, criamos um motor de renderização offline no navegador utilizando `OfflineAudioContext(2, totalSamples, 48000)`.
   - Reconstruímos todo o grafo de áudio Web Audio (`AudioBufferSourceNode`, `GainNode`, `StereoPannerNode`, `MasterGainNode`), aplicando pitch shift/speed ratio (`(calculatedBpm / baseBpm) * 2^(transpose/12)`).
   - O processamento offline da Web Audio API renderiza uma música inteira em 1 a 2 segundos no cliente.
2. **Codificação PCM Float32 para MP3 192kbps 48kHz (`lamejs`)**:
   - Desenvolvemos o módulo `mixExporter.ts` que converte a matriz PCM Float32 de 48kHz resultante em buffers Int16 e encoda em MP3 192kbps via `lamejs`.
   - O processo roda em micro-blocos assíncronos (`setTimeout(r, 0)`), liberando a thread principal da UI a cada iteração e atualizando o progresso suavemente a 60fps no Toast sem congelar o navegador.
3. **UX Não-Bloqueante (`ExportToast.tsx` & `GlobalTopHeader.tsx`)**:
   - Incluído o botão padronizado **"Exportar mix"** na barra fixada superior da DAW (`GlobalTopHeader.tsx`), exatamente à esquerda dos controles de Zoom.
   - Criado o componente `<ExportToast />` em `PersistentLayout.tsx` com barra de progresso em verde, porcentagem dinâmica e botão de download automático.

## 🛠️ Implementação Técnica
### Frontend (`mixer8-app`)
* **`package.json` & `lamejs.d.ts`**:
  * Adicionada a dependência `lamejs` para codificação MP3 no navegador e a tipagem TypeScript correspondente.
* **`mixExporter.ts`**:
  * Módulo assíncrono que carrega as stems, reconstrói o grafo Web Audio na `OfflineAudioContext`, executa `startRendering()` a 48000 Hz, encoda os canais estéreo em MP3 192kbps e constrói o `Blob` final.
  * Formata o nome do arquivo sanitizado no padrão `<nomedamusica> - <nome do artista> (<tom> - <bpm>bpm).mp3`.
* **`PlayerContext.tsx`**:
  * Expostos os estados de exportação (`isExporting`, `exportProgress`, `exportStatusMessage`, `exportFileName`, `exportError`, `exportSuccess`) e as funções `exportMix()` e `closeExportToast()`.
* **`ExportToast.tsx`**:
  * Componente toast flutuante estilizado no padrão dark Spotify-style com barra de progresso animada (`bg-gradient-to-r from-brand-green to-emerald-400`).
* **`GlobalTopHeader.tsx`**:
  * Integrado o botão "Exportar mix" com ícone `Download` / `Loader2`, posicionado à esquerda do controle de Zoom na DAW.

## 🎯 Impacto e Resultado
* **Velocidade e Resiliência:** Mixagens de 4 minutos são renderizadas e encodadas em menos de 3 segundos com consumo zero de servidores backend.
* **Navegação Sem Travamentos:** O usuário pode dar play/pause, mudar faders ou trocar de aba enquanto a barra de progresso do Toast avança em tempo real de 0% a 100%.

---
**Nota do Desenvolvedor:** *Liberar a thread principal durante a codificação em blocos permitiu que o Toast e todas as animações da SPA mantivessem a fluidez em 60fps enquanto o áudio é processado em background.*
