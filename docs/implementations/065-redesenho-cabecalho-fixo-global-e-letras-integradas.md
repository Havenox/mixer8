# 065 - Frontend: Redesenho do Cabeçalho Fixo Global, Overlays de DAW/Letras e Chaveamento de Cifras

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 16/07/2026

---

## 🚀 Desafio de Engenharia
A interface da DAW possuía um cabeçalho duplicado e controles musicais flutuantes que mudavam de posição de forma inconsistente ao navegar entre as visões do sistema. Além disso, a exibição de letras e cifras ocorria dentro de um modal flutuante com cabeçalho redundante. Como o estúdio DAW e a tela de letras dependem exclusivamente de uma música ativa tocando na agulha, a existência de rotas SPA declarativas (`/daw` e `/lyrics`) gerava complexidade desnecessária com redirecionamentos na inicialização e desmontagem de componentes de catálogo de biblioteca, forçando novas consultas e perda de estado de scroll/busca do usuário.
Também havia o desejo de alternar entre letras puras e letras cifradas (estilo Cifra Club / Ultimate Guitar) onde as notas musicais flutuam perfeitamente alinhadas acima de cada palavra correspondente de acordo com o tempo e tom transposto, de forma flexível e sem quebrar o baseline do texto.

## 🧠 Estratégia da Solução
A solução envolveu descontinuar as rotas SPA `/daw` e `/lyrics` inativas em prol de um **modelo de Overlays Globais de Layout (Opção B)**. O estado visual ativo é gerenciado centralmente por `activeOverlay` (`'none' | 'daw' | 'lyrics'`) em `PlayerContext.tsx`. 
No `PersistentLayout.tsx`, os painéis de DAW e Letras são injetados como overlays absolutos sobre o catálogo da biblioteca, o qual recebe `display: none` (`hidden`) apenas para ocultação visual. Isso mantém as páginas da biblioteca montadas no DOM em segundo plano, preservando integralmente o scroll do usuário e buscas ativas.
Adicionalmente, centralizamos o botão sutil de Fechar (X) na extrema direita do cabeçalho global fixo (`GlobalTopHeader`) contido em um wrapper de largura estática, prevenindo qualquer layout shift horizontal nos controles de Tom, BPM e Acorde quando o botão é ocultado.

Para as cifras, introduzimos o estado global `showChords` no `PlayerContext.tsx`.
- **Botão CIFRA (ON/OFF)**: Renderizado no topo quando a tela de letras está ativa. Segue exatamente a mesma linguagem de design das demais caixas do cabeçalho, exibindo "ON" em verde brilhante ou "OFF" em cinza escuro.
- **Renderização por Linha e Palavra**: Quando ativo, as palavras da linha são empilhadas verticalmente com um container `inline-flex flex-col items-start`. O acorde transposto (cruzado com a batida de áudio correspondente) flutua acima da palavra. Se a palavra não possuir acorde, injetamos `\u00A0` (non-breaking space) com a mesma altura que ela para que a linha inteira de palavras permaneça alinhada horizontalmente no mesmo baseline, sem oscilações ou quebras de grade.
- **Isolamento e Destaque Temporal Único de Chords**: Cada acorde possui uma janela de tempo específica e mutuamente exclusiva que inicia no seu disparo e termina no disparo da próxima nota. Isso garante destaque verde brilhante (`text-brand-green` com glow) para **apenas uma nota por vez**, mantendo os demais acordes em branco opaco/nítido, impedindo destaques redundantes ou duplicados de notas idênticas na mesma estrofe.
- **Janela de Atividade de Linha Ampliada**: Modificado o cálculo de ativação para que cada linha permaneça 100% ativa (opacidade 100%) desde o seu início (ou tempo 0s no caso da introdução da música) até o início exato da próxima frase. Isso impede que o painel perca o foco nos silêncios intermediários (gaps), permitindo que os acordes instrumentais ou de transição que tocam entre frases continuem recebendo highlight verde.
- **Auto-fechamento por Roteamento**: Injetado um listener reativo em `PersistentLayout.tsx` que monitora mudanças no `location.pathname` e fecha qualquer overlay ativo (`activeOverlay = 'none'`) no instante em que o usuário troca de página na barra lateral, garantindo a consistência das visões do sistema.
- **Padronização e Redução Visual dos Títulos**: Reestilizados todos os títulos das caixas de controle superiores (Zoom, Cifra, Acorde, Tom, BPM) para usarem `text-[8px] font-extrabold text-brand-gray/50 uppercase tracking-widest leading-none mb-1`. Isso diminui o ruído visual do cabeçalho e direciona a atenção para os valores ativos dos controles.
- **Persistência de Preferências do Usuário (localStorage)**:
  - **Global**: O nível de Zoom da DAW e a ativação de Cifras (ON/OFF) ficam persistidos no cache local globalmente, aplicando-se para todas as músicas reproduzidas.
  - **Individual**: Alterações manuais no Tom (transpose) e variações de andamento (BPM) são salvas em chaves exclusivas de `TrackId` (`mixer8:track:${trackId}:...`), sendo restabelecidas automaticamente ao carregar a respectiva gravação.
- **Opacidade Confortável**: Elevada a opacidade das estrofes inativas de 25% para 65% para garantir conforto de leitura durante o acompanhamento de letras extensas.
- **Suporte Total a Mobile (Responsividade Dinâmica)**: O cabeçalho fixo global foi reconfigurado para se adaptar a smartphones. As informações de faixa (capa, título, artista) são ocultadas em telas menores que `768px` (`md`), pois já são exibidas no player de rodapé. Isso abre espaço total para as caixas de controle (Zoom, Cifra, Acorde, Tom, BPM e Fechar). O layout mobile é alinhado à direita (`justify-end`) com espaçamento equilibrado (`gap-1.5`). As caixas possuem larguras dinâmicas otimizadas (Tom a 108px/135px, BPM a 114px/140px, Zoom a 105px/130px, Acorde a 58px/76px, Cifra a 54px/70px), botões laterais de `w-7` (28px) e divisores limpos sem bordas duplas. O botão de fechar (X) retrai para `w-7` (28px) no celular (mantendo `w-10` no desktop para evitar layout shifts). No player expandido mobile, foi injetado o botão **Estúdio DAW** ao lado de **Mixer Stems** e **Letras & Cifras**. A altura do cabeçalho reduz de `72px` para `56px` no mobile.

## 🛠️ Implementação Técnica

### Frontend (`mixer8-app`)
* **`GlobalTopHeader.tsx`**: Centralizados metadados, acorde reativo, transposição, BPM e controles de Zoom. O bloco de Zoom agora renderiza no lado direito (à esquerda do bloco de Acorde) para manter estabilidade visual. Corrigidas as bordas dos botões internos (removendo `border-r` do botão de Plus) para eliminar divisores duplos no mobile. Ajustadas as larguras das caixas para garantirem alinhamento central limpo e leitura sem colisões de texto. Reduzido o botão Close X no mobile para `w-7 h-7` (28px).
* **`MesaPlayer.tsx`**: Modificados os cliques de capa e de botões (tanto desktop quanto mobile) para alterar o estado `activeOverlay` em vez de navegar em rotas. Adicionado o botão de atalho **Estúdio DAW** no player expandido de celular para permitir acionamento direto da DAW no mobile.
* **`PersistentLayout.tsx`**: Ajustado para injetar os overlays absolutos com transição suave e gerenciar a ocultação reativa (`hidden`) das páginas de conteúdo comum. Adicionado o listener reativo de auto-fechamento do overlay por mudança de rota do React Router. Aplicado `pt-16 md:pt-0` no container principal de conteúdo (`CONTEÚDO PRINCIPAL`) para garantir que o cabeçalho superior mobile (`Header Superior Mobile`, que é fixo com `h-16`) não oculte (engula) o banner ou a página inicial do Mixer8 nem o `GlobalTopHeader` quando ativo.
* **`MesaPlayer.tsx`**: Modificados os cliques de capa e de botões (tanto desktop quanto mobile) para alterar o estado `activeOverlay` em vez de navegar em rotas.
* **`PlayerContext.tsx`**: Introduzido o estado global `activeOverlay` (com auto-limpeza) e o estado `showChords` para controle de cifra ativa. Implementados os hooks de sincronização do localStorage para persistir de forma individual (por música) a transposição e o BPM delta, e de forma global o estado de cifra.
* **`App.tsx`**: Removidas as rotas `/daw` e `/lyrics` e seus respectivos imports de componentes.
* **`LyricsChordsViewer.tsx`**: Refatorado para alternar a exibição entre letra pura e cifrada. Se `showChords` estiver ativo, renderiza o container flex vertical com as notas alinhadas horizontalmente por baseline. Remove o cabeçalho local duplicado com botão de voltar e ajusta o realce temporal atômico das cifras e opacidades de leitura.
* **`DawView.tsx`**: Ajustados os gatilhos e botões de retorno internos para executar `setActiveOverlay('none')` em vez de chamadas de roteador. Implementada a recuperação de Zoom inicial do localStorage e persistência no dispatch.

---

## 🎯 Impacto e Resultado
* **Preservação de Estado da Biblioteca**: O usuário pode abrir a DAW ou Letras a qualquer momento e fechá-las sem perder sua posição de rolagem ou filtro de busca atual na biblioteca de playlists.
* **Layout 100% Estável**: O alinhamento do Zoom/Cifra na direita e o espaçador estático do botão X eliminam qualquer deslocamento horizontal de elementos no cabeçalho global.
* **Navegação Consistente**: Clicar nos links de navegação da barra lateral encerra os overlays visualmente de forma instantânea, abrindo a nova rota em tela cheia.
* **Usabilidade Premium e Memória de Contexto**: O player lembra o tom e andamento que o músico estava ensaiando para cada faixa individualmente, bem como suas configurações de zoom e preferências de visualização de cifras.

---
**Nota do Desenvolvedor:** *A decisão por overlays absolutos baseados em CSS 'display: none' em React preserva o estado de mount da árvore do DOM, resultando em ganhos massivos de performance de renderização em SPAs de alta densidade como o catálogo do Mixer8.*
