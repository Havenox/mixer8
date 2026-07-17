# 065 - Frontend: Redesenho do Cabeçalho Fixo Global e Visão Integrada de Letras

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 16/07/2026

---

## 🚀 Desafio de Engenharia
A interface da DAW possuía um cabeçalho duplicado e controles musicais flutuantes que mudavam de posição de forma inconsistente ao navegar entre as visões do sistema. Além disso, a exibição de letras e cifras ocorria dentro de um modal flutuante com cabeçalho redundante, cujos elementos colidiam visualmente com o botão de voltar quando a letra era rolada para cima, resultando em uma experiência de usuário abaixo do padrão premium desejado.

## 🧠 Estratégia da Solução
A solução envolveu unificar os controles de reprodução (acorde atual, tom e BPM) em um cabeçalho global fixo (`GlobalTopHeader`) que se posiciona de forma consistente no topo de todas as páginas sempre que uma faixa estiver ativa. O cabeçalho foi redesenhado com base no padrão Spotify premium (caixas com altura uniforme de 46px, ícones Lucide vetoriais de +/- e dimensões estáveis que previnem oscilações na interface). 
O modal flutuante de Letras & Cifras foi descontinuado em prol de uma exibição integrada de tela cheia no corpo principal da aplicação. Um pequeno cabeçalho transparente de 56px foi criado exclusivamente para isolar o botão voltar, garantindo que o scroll do texto nunca se choque com ele.

## 🛠️ Implementação Técnica

### Frontend (`mixer8-app`)
* **`GlobalTopHeader.tsx` [NEW]**: Criado componente para centralizar os metadados da faixa e os controles de tom (transpose), BPM e Zoom (visível na rota `/daw`). As caixas têm tamanho fixo para evitar quebra de layout quando o reset (`RotateCcw`) está inativo.
* **`PersistentLayout.tsx`**: Ajustado para renderizar o cabeçalho fixo global na parte superior de todas as páginas e incluir a view de letras integrada no container de rotas.
* **`MesaPlayer.tsx`**: Modificada a ação de clique nas capas e no botão de Letras do player principal para alternar a exibição da view integrada ao invés de acionar o modal obsoleto.
* **`LyricsChordsViewer.tsx`**: Removido o cabeçalho duplicado antigo. Adicionada a barra superior de 56px (`h-14`) contendo o botão de voltar circular premium com excelente visibilidade e contraste.
* **`DawView.tsx`**: Removido o cabeçalho local da DAW para herdar diretamente a estrutura fixa global. O botão de voltar `<` foi movido para o canto esquerdo da coluna de pistas (`CANAIS / PISTAS`).

---

## 🎯 Impacto e Resultado
* **Consistência de Layout**: Os botões de transposição, acorde atual e BPM permanecem fixos e estáveis no canto superior direito, sem saltar ou mudar de posição entre as telas.
* **Aprimoramento Visual (Estilo Spotify)**: Elementos geométricos alinhados verticalmente com altura padronizada de 46px e ícones nativos elegantes.
* **Leitura Confortável**: A área de rolagem das letras está isolada da barra superior do botão voltar, eliminando colisões de texto.

---
**Nota do Desenvolvedor:** *A estruturação do cabeçalho de forma unificada e a utilização de estados derivados e eventos para sincronização de zoom entre a DAW e o cabeçalho global reduzem a complexidade de renderização e garantem referências estáveis de componentes no ecossistema do React.*
