# 035 - [Frontend/Layout]: Refatoração das Seções do Explorar e Layout de Lista Compacta

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 04/06/2026

---

## 🚀 Desafio de Engenharia
A página inicial (Explorar) exibia as estantes de destaque ("Tendências da Semana" e "Playlists Populares") de forma rígida e com código duplicado para cada seção. Além disso, a visualização em grade clássica ocupava muito espaço vertical. Havia o desejo de oferecer uma visualização alternativa em "Lista Compacta" que fosse mais eficiente em termos de densidade de tela e de metade da largura das outras telas, permitindo exibir exatamente 6 itens por prateleira alinhados horizontalmente no desktop, sem quebrar o layout e de forma totalmente modular e reaproveitável para novos tipos de seleções/estantes que possam entrar futuramente.

## 🧠 Estratégia da Solução
1. **Componentização Modular (`ExploreShelf`)**: Criamos um componente genérico e reutilizável que encapsula a renderização de qualquer estante do Explorar. Ele recebe dados e parâmetros, limita a exibição a no máximo 6 itens (`.slice(0, 6)`) e lida nativamente com o carregamento (skeletons dinâmicos de 6 elementos), cliques de play/navegação e exibição de menus de contexto.
2. **Layout de Lista Compacta**: Desenvolvemos tiles retangulares horizontais com capas em miniatura à esquerda e metadados empilhados à direita. No desktop, eles se organizam em um grid de 6 colunas (`lg:grid-cols-6`). Em janelas reduzidas ou telas médias, adaptam-se para 3 colunas e 2 linhas (`md:grid-cols-3`), mantendo a proporção de espaço requerida.
3. **Preferência Global Salva**: Adicionamos um seletor visual discreto no topo da página Explorar que sincroniza a escolha do modo de exibição (Grade clássica vs Lista Compacta) no `localStorage` sob a chave `mixer8:explore-layout-preference`.

## 🛠️ Implementação Técnica
* **ExploreShelf Component**: Criado em `mixer8-app/src/components/ExploreShelf.tsx`. Implementa lógica de renderização condicional por tipo (`tracks` ou `playlists`) e layout (`grid` ou `compact-list`).
* **Explore Page Refactor**: Atualizado `mixer8-app/src/App.tsx` para declarar e persistir `layoutMode` e injetar instâncias limpas do `<ExploreShelf>`.
* **Remoção de Código Morto**: Limpeza de imports e variáveis obsoletas em `App.tsx` e `ExploreShelf.tsx`, garantindo compilação estrita limpa.

## 🎯 Impacto e Resultado
* **Extensibilidade e Manutenibilidade**: Novas estantes de tops (diário, mensal, álbuns) podem ser adicionadas futuramente com apenas uma linha de código reutilizando `<ExploreShelf>`.
* **Melhoria de UX/Densidade**: A Lista Compacta permite ao usuário examinar e interagir com 6 faixas ou playlists de forma condensada, reduzindo a rolagem vertical em telas menores.

---
**Nota do Desenvolvedor:** *A arquitetura de estantes baseada em componentes reutilizáveis, combinada com a abstração do player e playlist contexts, simplificou consideravelmente o código da página de Explorar, reduzindo-o em centenas de linhas e tornando o projeto muito mais escalável para novos conteúdos de destaque.*
