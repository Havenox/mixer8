# 065 - Frontend: Redesenho do Cabeçalho Fixo Global e Visão Integrada de Letras

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 16/07/2026

---

## 🚀 Desafio de Engenharia
A interface da DAW possuía um cabeçalho duplicado e controles musicais flutuantes que mudavam de posição de forma inconsistente ao navegar entre as visões do sistema. Além disso, a exibição de letras e cifras ocorria dentro de um modal flutuante com cabeçalho redundante e baseado em estado local condicional (`isLyricsOpen`), o que impedia uma navegação SPA limpa através do histórico do navegador e causava colisões visuais de scroll com o botão de voltar.

## 🧠 Estratégia da Solução
A solução envolveu unificar os controles de reprodução (acorde atual, tom e BPM) em um cabeçalho global fixo (`GlobalTopHeader`) que se posiciona de forma consistente no topo de todas as páginas sempre que uma faixa estiver ativa. O cabeçalho foi redesenhado com base no padrão Spotify premium.
O modal flutuante e o estado reativo `isLyricsOpen` foram descontinuados em prol de uma **rota nativa dedicada (`/lyrics`)** no React Router, tratando a tela de Letras & Cifras como uma página legítima e de tela cheia, idêntica ao modelo de roteamento da DAW (`/daw`). A rolagem de texto foi isolada internamente usando manipulação direta de `scrollTop` (via `.scrollTo()`), eliminando o bolhamento de scroll que empurrava o cabeçalho global para fora do viewport.

## 🛠️ Implementação Técnica

### Frontend (`mixer8-app`)
* **`GlobalTopHeader.tsx`**: Criado componente para centralizar os metadados da faixa e os controles de tom (transpose), BPM e Zoom (visível na rota `/daw`). As caixas têm tamanho fixo para evitar quebra de layout quando o reset (`RotateCcw`) está inativo.
* **`LyricsView.tsx` [NEW]**: Nova página mapeada para a rota `/lyrics` no React Router. Trata o estado de carregamento de faixas e renderiza o visualizador ou exibe um bloco premium de redirecionamento caso nenhuma música esteja ativa.
* **`App.tsx`**: Registrada a nova rota protegida `/lyrics` no roteador principal.
* **`PersistentLayout.tsx`**: Ajustado para tratar a rota `/lyrics` de forma idêntica a `/daw` (renderizando em contêiner de tela cheia com `overflow-hidden` abaixo do topo global), limpando a lógica do estado condicional obsoleto.
* **`MesaPlayer.tsx`**: Alterados todos os cliques e ações de capas e botões do player (Desktop e Mobile) para realizar navegação de rotas para `/lyrics` (e fechar o painel mobile expandido quando ativado).
* **`LyricsChordsViewer.tsx`**: Substituído o método nativo `.scrollIntoView()` por um controle de scroll suave manual com `.scrollTo()`. Adicionada classe `relative` no contêiner de rolagem das letras para garantir que `offsetTop` seja ancorado localmente, prevenindo qualquer deslocamento do cabeçalho global fixo.
* **`DawView.tsx`**: Removido o cabeçalho local da DAW para herdar diretamente a estrutura fixa global. O botão de voltar `<` foi movido para o canto esquerdo da coluna de pistas (`CANAIS / PISTAS`).

---

## 🎯 Impacto e Resultado
* **Consistência de Layout**: Os botões de transposição, acorde atual e BPM permanecem fixos e estáveis no canto superior direito, sem saltar ou mudar de posição entre as telas.
* **Aprimoramento Visual (Estilo Spotify)**: Elementos geométricos alinhados verticalmente com altura padronizada de 46px e ícones nativos elegantes.
* **Leitura Confortável**: A área de rolagem das letras está isolada da barra superior do botão voltar, eliminando colisões de texto.

---
**Nota do Desenvolvedor:** *A estruturação do cabeçalho de forma unificada e a utilização de estados derivados e eventos para sincronização de zoom entre a DAW e o cabeçalho global reduzem a complexidade de renderização e garantem referências estáveis de componentes no ecossistema do React.*
