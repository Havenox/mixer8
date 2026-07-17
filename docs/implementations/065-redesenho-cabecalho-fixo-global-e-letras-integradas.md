# 065 - Frontend: Redesenho do Cabeçalho Fixo Global, Overlays de DAW/Letras e Chaveamento de Cifras

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 16/07/2026

---

## 🚀 Desafio de Engenharia
A interface da DAW possuía um cabeçalho duplicado e controles musicais flutuantes que mudavam de posição de forma inconsistente ao navegar entre as visões do sistema. Além disso, a exibição de letras e cifras ocorria dentro de um modal flutuante com cabeçalho redundante. Como o estúdio DAW e a tela de letras dependem exclusivamente de uma música ativa tocando na agulha, a existência de rotas SPA declarativas (`/daw` e `/lyrics`) gerava complexidade desnecessária com redirecionamentos na inicialização e desmontagem de componentes de catálogo de biblioteca, forçando novas consultas e perda de estado de scroll/busca do usuário.
Também havia o desejo de alternar entre letras puras e letras cifradas (estilo Cifra Club / Ultimate Guitar) onde as notas musicais flutuam perfeitamente alinhadas acima de cada palavra correspondente de acordo com o tempo e tom transposto, de forma flexível e sem quebrar o baseline do texto.

## 🧠 Estratégia da Solução
A solução envolveu descontinuar as rotas SPA `/daw` e `/lyrics` em prol de um **modelo de Overlays Globais de Layout (Opção B)**. O estado visual ativo é gerenciado centralmente por `activeOverlay` (`'none' | 'daw' | 'lyrics'`) em `PlayerContext.tsx`. 
No `PersistentLayout.tsx`, os painéis de DAW e Letras são injetados como overlays absolutos sobre o catálogo da biblioteca, o qual recebe `display: none` (`hidden`) apenas para ocultação visual. Isso mantém as páginas da biblioteca montadas no DOM em segundo plano, preservando integralmente o scroll do usuário e buscas ativas.
Adicionalmente, centralizamos o botão sutil de Fechar (X) na extrema direita do cabeçalho global fixo (`GlobalTopHeader`) contido em um wrapper de largura estática, prevenindo qualquer layout shift horizontal nos controles de Tom, BPM e Acorde quando o botão é ocultado.

Para as cifras, introduzimos o estado global `showChords` no `PlayerContext.tsx`.
- **Botão CIFRA (ON/OFF)**: Renderizado no topo quando a tela de letras está ativa. Segue exatamente a mesma linguagem de design das demais caixas do cabeçalho, exibindo "ON" em verde brilhante ou "OFF" em cinza escuro.
- **Renderização por Linha e Palavra**: Quando ativo, as palavras da linha são empilhadas verticalmente com um container `inline-flex flex-col items-start`. O acorde transposto (cruzado com a batida de áudio correspondente) flutua acima da palavra. Se a palavra não possuir acorde, injetamos `\u00A0` (non-breaking space) com a mesma altura para que a linha inteira de palavras permaneça alinhada horizontalmente no mesmo baseline, sem oscilações ou quebras de grade.

## 🛠️ Implementação Técnica

### Frontend (`mixer8-app`)
* **`GlobalTopHeader.tsx`**: Centralizados metadados, acorde reativo, transposição, BPM e controles de Zoom. O bloco de Zoom agora renderiza no lado direito (à esquerda do bloco de Acorde) para manter estabilidade visual. Adicionado o botão Close (X) em contêiner de largura física invariável para evitar layout shifts. Injetada a caixa de controle `CIFRA` (ON/OFF) quando o painel de letras estiver ativo.
* **`PersistentLayout.tsx`**: Ajustado para injetar os overlays absolutos com transição suave e gerenciar a ocultação reativa (`hidden`) das páginas de conteúdo comum.
* **`MesaPlayer.tsx`**: Modificados os cliques de capa e de botões (tanto desktop quanto mobile) para alterar o estado `activeOverlay` em vez de navegar em rotas.
* **`PlayerContext.tsx`**: Introduzido o estado global `activeOverlay` (com auto-limpeza) e o estado `showChords` para controle de cifra ativa.
* **`App.tsx`**: Removidas as rotas `/daw` e `/lyrics` e seus respectivos imports de componentes.
* **`LyricsChordsViewer.tsx`**: Refatorado para alternar a exibição entre letra pura e cifrada. Se `showChords` estiver ativo, renderiza o container flex vertical com as notas alinhadas horizontalmente por baseline.
* **`DawView.tsx`**: Ajustados os gatilhos e botões de retorno internos para executar `setActiveOverlay('none')` em vez de chamadas de roteador.

---

## 🎯 Impacto e Resultado
* **Preservação de Estado da Biblioteca**: O usuário pode abrir a DAW ou Letras a qualquer momento e fechá-las sem perder sua posição de rolagem ou filtro de busca atual na biblioteca de playlists.
* **Layout 100% Estável**: O alinhamento do Zoom/Cifra na direita e o espaçador estático do botão X eliminam qualquer deslocamento horizontal de elementos no cabeçalho global.
* **Experiência de Visualização Premium**: As cifras flutuam de forma fluida acima da letra em tempo real, transpondo de acordo com a alteração do tom base, mantendo um design limpo e de alto contraste.

---
**Nota do Desenvolvedor:** *A decisão por overlays absolutos baseados em CSS 'display: none' em React preserva o estado de mount da árvore do DOM, resultando em ganhos massivos de performance de renderização em SPAs de alta densidade como o catálogo do Mixer8.*
