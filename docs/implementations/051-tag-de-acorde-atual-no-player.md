# 051 - Player: Tag de Acorde Atual em Tempo de Execução

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 25/06/2026

---

## 🚀 Desafio de Engenharia
Ao reproduzir músicas com cifra extraída no Mixer8, os usuários não tinham feedback visual direto da harmonia atual (acorde) na barra do player inferior, dependendo exclusivamente de abrir o modal flutuante de letras. Havia o desafio de projetar uma tag compacta e elegante para exibir o acorde ativo em tempo real na barra de reprodução (tanto em computadores/tablets quanto em smartphones), de forma condicional à existência de cifras, reprodução ativa (`isPlaying === true`) e sincronização imediata de tom (transposição de semitons).

## 🧠 Estratégia da Solução
A estratégia consistiu em:
1. **Centralização da Transposição**: Migrou-se o estado de `transpose` (antes local do modal de letras) para o `PlayerContext.tsx` global. Isso permite que qualquer alteração de semitons reflita instantaneamente em qualquer componente que mostre acordes. Ao carregar uma nova música, o tom é automaticamente resetado para `0`.
2. **Carregamento Assíncrono Local no Player**: O componente `MesaPlayer.tsx` agora monitora a música ativa e faz download dinâmico e sob demanda do arquivo `/stems/{TrackId}/chords.json`.
3. **Mapeamento Temporal de Acorde**: Com base no `currentTime` e no tom de transposição, calcula-se o acorde ativo e renderiza-se condicionalmente a tag sem a classe `uppercase` para preservar a grafia case-sensitive (ex: `Eb` em vez de `EB`).
4. **Alinhamento na Interface (UI/UX)**:
   * **Desktop (PC/Tablet)**: Se o acorde estiver ativo, a tag "Stems" é movida para cima, alinhando-se ao título da música, e a tag de acorde é renderizada logo abaixo, alinhando-se ao nome do artista.
   * **Mobile**: A tag do acorde é renderizada inline na mesma linha ao lado do artista, otimizando o espaço da viewport.

## 🛠️ Implementação Técnica

### Frontend (mixer8-app)
* **[PlayerContext.tsx](file:///g:/DEV/mixer8/mixer8-app/src/context/PlayerContext.tsx)**:
  * Adicionados `transpose` e `setTranspose` ao contrato `IPlayerContext`.
  * Adicionado estado `transpose` e reset para `0` na função `loadTrack`.
* **[LyricsChordsViewer.tsx](file:///g:/DEV/mixer8/mixer8-app/src/components/LyricsChordsViewer.tsx)**:
  * Removido estado local `transpose` e consumido o estado global exposto pelo `usePlayer` do context do player.
* **[MesaPlayer.tsx](file:///g:/DEV/mixer8/mixer8-app/src/components/MesaPlayer.tsx)**:
  * Importados `transposeChord`, `IChordBeat` e hooks de efeito e memorização (`useEffect`, `useMemo`).
  * Adicionado hook de carregamento para baixar o arquivo `/chords.json` da faixa ativa.
  * Atualizado o layout de informações de música na barra inferior para PC, Mini-Player e Player Expandido para incluir a nova tag de acorde de forma condicional e alinhada.

## 🎯 Impacto e Resultado
* **Visibilidade Harmônica**: O músico visualiza a progressão harmônica sem precisar manter a janela de letras aberta, melhorando a utilidade do player como ferramenta de estúdio.
* **Sincronia Absoluta**: A transposição de tom atualiza as cifras no modal e no player ao mesmo tempo, mantendo a coerência tonal de todo o ecossistema.

---
**Nota do Desenvolvedor:** *Compartilhar o estado de transposição no contexto de reprodução é uma fundação crucial que prepara a arquitetura para o próximo passo, que consistirá em integrar o motor digital de pitch shifting de áudio no player.*
