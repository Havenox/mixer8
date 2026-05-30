# 009 - [Mesa/DAW]: Sistema Avançado de Mute e Solo com Sincronia de Ganho no Web Audio API

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 30/05/2026

---

## 🚀 Desafio de Engenharia
Implementar as funcionalidades clássicas de mesas de mixagem profissional de Mute ("M") e Solo ("S") para cada stem individual de áudio. A funcionalidade necessitava atender a regras rígidas de mixagem concorrente e precedência:
- É possível solar ou mutar tantas stems quanto desejado simultaneamente.
- A função Solo possui precedência sobre o Mute da mesma stem (ou seja, se a bateria estiver em mute e em solo concorrentemente, ela topará no volume do fader normalmente).
- Caso haja qualquer stem solada no mixer, todas as stems que NÃO estiverem marcadas como solo devem ser mutadas (ganho zero no Web Audio API) independentemente do slider de volume e de seu estado de Mute individual.
- Visualmente, os botões não poderiam extrapolar a altura de linha do nome das stems. Qualquer canal silenciado (seja pelo Mute ativo ou porque outro canal está em Solo) deve aparecer acinzentado/esmaecido no painel da DAW, emulando consoles analógicos e de estúdio (Logic, Pro Tools).

---

## 🧠 Estratégia da Solução
1. **Gerenciamento Centralizado no Web Audio API**:
   - Criados os estados de dicionário `stemsMute` e `stemsSolo` em `PlayerContext.tsx` acompanhados dos callbacks modificadores rápidos `toggleStemMute(type)` e `toggleStemSolo(type)`.
   - Implementado o método interno `updateAudioGains(volumes, mutes, solos)` responsável por recalcular dinamicamente os ganhos de cada nó de áudio ativo:
     - Identifica a presença de qualquer flag `true` no dicionário de solos (`hasAnySolo`).
     - Se `hasAnySolo === true`, o ganho da stem será o volume do slider caso esteja em solo, ou `0` caso contrário.
     - Se `hasAnySolo === false`, o ganho da stem será `0` caso esteja mutada, ou o volume do slider caso contrário.
   - Sincronização automática de ganho nas mutações de volume fader, ao acionar mute/solo ou ao carregar uma nova música (zerando as definições anteriores).
2. **Layout Compacto e Ultra Premium**:
   - Integrados os botões "M" (vermelho ativo) e "S" (amarelo ativo) adjacentes ao nome de cada canal do mixer de som em [MesaPlayer.tsx](file:///g:/DEV/mixer8/mixer8-app/src/components/MesaPlayer.tsx).
   - O tamanho foi limitado para exatamente `w-4 h-4` (`16px`), igualando a altura de linha (`line-height`) padrão de `text-xs font-semibold`, garantindo 100% de conformidade técnica e sem quebras de layout.
   - Aplicada a classe utilitária de opacidade `opacity-40` no container correspondente do fader de forma reativa a `isSilenced === true`, deixando o canal inteiro acinzentado e inativo para a percepção visual do usuário de forma automática.

---

## 🛠️ Implementação Técnica

### Frontend (React SPA)
- **Player**: [PlayerContext.tsx](file:///g:/DEV/mixer8/mixer8-app/src/context/PlayerContext.tsx)
  - Declaradas propriedades e métodos na interface `IPlayerContext` e no provedor `PlayerProvider`.
  - Escrita a função `updateAudioGains` manipulando os ganhos das referências nativas `MediaElementAudioSourceNode` com `gain.setValueAtTime`.
- **DAW**: [MesaPlayer.tsx](file:///g:/DEV/mixer8/mixer8-app/src/components/MesaPlayer.tsx)
  - Extraídos os novos métodos de controle de áudio e aplicados nos faders dinâmicos.
  - Adicionado suporte reativo visual e de hover para transicionar cores para vermelho no Mute e amarelo no Solo.

---

## 🎯 Impacto e Resultado
* **Controle Total de Mixagem**: Profissionais e usuários agora podem isolar com precisão canais (ex: solar baixo e bateria juntos) com sincronismo milimétrico e sem latências.
* **UX Sob Medida**: O canal esmaecido (`opacity-40`) oferece um feedback visual imediato e agradável do estado de saída de áudio de cada canal sem sobrecarregar a tela com cores chamativas.
* **Segurança Concorrente**: A lógica implementada garante que o Mute individual não anule o Solo (e vice-versa), cobrindo 100% dos requisitos de engenharia de som profissional solicitados.
