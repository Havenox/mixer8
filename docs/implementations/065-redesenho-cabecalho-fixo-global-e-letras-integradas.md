# 065 - Frontend: Redesenho do Cabeçalho Fixo Global e Overlays de DAW e Letras

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 16/07/2026

---

## 🚀 Desafio de Engenharia
A interface da DAW possuía um cabeçalho duplicado e controles musicais flutuantes que mudavam de posição de forma inconsistente ao navegar entre as visões do sistema. Além disso, a exibição de letras e cifras ocorria dentro de um modal flutuante com cabeçalho redundante. Como o estúdio DAW e a tela de letras dependem exclusivamente de uma música ativa tocando na agulha, a existência de rotas SPA declarativas (`/daw` e `/lyrics`) gerava complexidade desnecessária com redirecionamentos na inicialização e desmontagem de componentes de catálogo de biblioteca, forçando novas consultas e perda de estado de scroll/busca do usuário.

## 🧠 Estratégia da Solução
A solução envolveu descontinuar as rotas SPA `/daw` e `/lyrics` em prol de um **modelo de Overlays Globais de Layout (Opção B)**. O estado visual ativo é gerenciado centralmente por `activeOverlay` (`'none' | 'daw' | 'lyrics'`) em `PlayerContext.tsx`. 
No `PersistentLayout.tsx`, os painéis de DAW e Letras são injetados como overlays absolutos sobre o catálogo da biblioteca, o qual recebe `display: none` (`hidden`) apenas para ocultação visual. Isso mantém as páginas da biblioteca montadas no DOM em segundo plano, preservando integralmente o scroll do usuário e buscas ativas.
Adicionalmente, centralizamos o botão sutil de Fechar (X) na extrema direita do cabeçalho global fixo (`GlobalTopHeader`) contido em um wrapper de largura estática, prevenindo qualquer layout shift horizontal nos controles de Tom, BPM e Acorde quando o botão é ocultado.

## 🛠️ Implementação Técnica

### Frontend (`mixer8-app`)
* **`GlobalTopHeader.tsx`**: Centralizados metadados, acorde reativo, transposição, BPM e controles de Zoom. O bloco de Zoom agora renderiza no lado direito (à esquerda do bloco de Acorde) para manter estabilidade visual. Adicionado o botão Close (X) em contêiner de largura física invariável para evitar layout shifts.
* **`PersistentLayout.tsx`**: Ajustado para injetar os overlays absolutos com transição suave e gerenciar a ocultação reativa (`hidden`) das páginas de conteúdo comum.
* **`MesaPlayer.tsx`**: Modificados os cliques de capa e de botões (tanto desktop quanto mobile) para alterar o estado `activeOverlay` em vez de navegar em rotas.
* **`PlayerContext.tsx`**: Introduzido o estado global `activeOverlay` com efeito de auto-limpeza (volta para `'none'` se a música na agulha tornar-se nula).
* **`App.tsx`**: Removidas as rotas `/daw` e `/lyrics` e seus respectivos imports de componentes.
* **`LyricsChordsViewer.tsx`**: Substituído o método nativo `.scrollIntoView()` por um controle de scroll suave manual com `.scrollTo()`. Adicionada classe `relative` no contêiner de rolagem das letras para garantir que `offsetTop` seja ancorado localmente.
* **`DawView.tsx`**: Ajustados os gatilhos e botões de retorno internos para executar `setActiveOverlay('none')` em vez de chamadas de roteador.

---

## 🎯 Impacto e Resultado
* **Preservação de Estado da Biblioteca**: O usuário pode abrir a DAW ou Letras a qualquer momento e fechá-las sem perder sua posição de rolagem ou filtro de busca atual na biblioteca de playlists.
* **Layout 100% Estável**: O alinhamento do Zoom na direita e o espaçador estático do botão X eliminam qualquer deslocamento horizontal de elementos no cabeçalho global.
* **Transição Inteligente**: Clicar na DAW enquanto as Letras estão abertas fecha as Letras e abre a DAW instantaneamente (e vice-versa), sem sobreposição de painéis.

---
**Nota do Desenvolvedor:** *A decisão por overlays absolutos baseados em CSS 'display: none' em React preserva o estado de mount da árvore do DOM, resultando em ganhos massivos de performance de renderização em SPAs de alta densidade como o catálogo do Mixer8.*
