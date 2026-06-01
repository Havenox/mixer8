# 022 - [Player]: Correção de Loop de Drift e Sincronização Robusta de Stems

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 01/06/2026

---

## 🚀 Desafio de Engenharia
Durante a reprodução de faixas multi-stem (músicas contendo múltiplos canais de áudio individuais como Voz, Bateria, Baixo, etc.), ocorria um travamento sistemático ao atingir o último segundo de reprodução. O tempo de reprodução congelava na tela (ex: `3:11` de uma música de `3:12`), o áudio entrava em um gaguejo (*stuttering*) cíclico ininterrupto e o player ficava impossibilitado de avançar automaticamente para a próxima faixa da fila.

Esse bug manifestava-se com maior intensidade no modo online devido a variações naturais de latência de rede no streaming de cada stem, mas também ocorria em reproduções locais offline devido a sutis desvios de microsegundos de decodificação na extremidade final dos arquivos Opus. A raiz do problema estava no loop de alinhamento contra *drift* de tempo (que roda a cada 250ms), o qual tentava buscar (`seek`) incessantemente o tempo final do elemento master nas stems secundárias atrasadas, inundando o pipeline de áudio do navegador com seeks concorrentes infinitos e travando o disparo do evento nativo `ended` do elemento master.

## 🧠 Estratégia da Solução
A solução de engenharia adotada consistiu em resguardar o pipeline de áudio no encerramento da música, cedendo o controle de alinhamento na margem final e deixando que os decodificadores concluam o fluxo naturalmente.

As seguintes regras de segurança foram adicionadas no loop contínuo de alinhamento:
1. **Margem de Encerramento (Trava de Fim)**: Ao atingir o limiar dos **últimos 1.5 segundos** de duração total da faixa, ou caso o elemento master já seja sinalizado como concluído (`ended`), o alinhamento de drift é completamente abortado. Pequenos desvios de milissegundos nesta janela são inaudíveis para o ouvido humano e o alinhamento é desnecessário.
2. **Pausa em Sincronização e Busca**: O alinhamento de drift é suspenso imediatamente se o player estiver atravessando uma barreira de sincronização inicial (`loadTrack`) ou aguardando rede durante uma operação de busca manual (`seek`).
3. **Respeito a Elementos Inativos**: Ignorar stems secundárias que já estejam pausadas ou finalizadas para evitar seeks forçados indesejados.

Esta abordagem elimina o loop de gaguejo e permite que o elemento master atinja a marca final física de forma fluida, garantindo que o evento `'ended'` seja disparado sem concorrência e o fluxo de reprodução pule suavemente para a próxima faixa.

## 🛠️ Implementação Técnica

### Frontend (Player Core)
* **[PlayerContext.tsx](file:///g:/DEV/mixer8/mixer8-app/src/context/PlayerContext.tsx)**:
  * Refatorado o `useEffect` de alinhamento contínuo contra drift (linha ~251).
  * Inserida a verificação curta `if (isSyncingRef.current) return;` no topo do intervalo de 250ms.
  * Inserida a condicional robusta para detecção de término: `if (masterItem.audio.ended || (masterDuration && masterTime >= masterDuration - 1.5)) return;`.
  * Atualizado o laço de correção secundário para ignorar elementos parados: `if (item.audio.ended || item.audio.paused) continue;`.

## 🎯 Impacto e Resultado
* **Transição Fluida de Faixas**: O player agora avança de forma 100% autônoma e silenciosa para a próxima música da playlist ao término de qualquer faixa multi-stem, tanto no desktop quanto em dispositivos móveis (online ou offline).
* **Eliminação Total de Gaguejo**: O ruído cíclico e repetições indesejadas no último segundo das stems foram completamente extintos.
* **Desafogamento do Pipeline de Áudio**: Redução drástica de chamadas desnecessárias à API de áudio e rede no fechamento de cada faixa, economizando recursos e bateria de dispositivos mobile.

---

**Nota do Desenvolvedor:** *O desenvolvimento de sistemas de áudio multitrack no navegador exige cuidado redobrado com a saturação de tarefas assíncronas do Web Audio. Um fluxo contínuo de `seeks` em múltiplos elementos HTMLAudioElement em paralelo é uma operação extremamente pesada e bloqueante para a thread gráfica e de mídia. Proteger os estados finais de transição nos últimos segundos é uma excelente prática para garantir resiliência e estabilidade Spotify-like.*
