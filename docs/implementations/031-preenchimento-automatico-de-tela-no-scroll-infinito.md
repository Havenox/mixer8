# 031 - Biblioteca: Preenchimento Automático de Tela no Scroll Infinito

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 04/06/2026

---

## 🚀 Desafio de Engenharia
Em monitores de alta resolução vertical (como 1080p, 1440p ou 4K) ou telas ultra-wide, a primeira página da paginação de faixas (limite de 10 itens) é completamente desenhada na tela sem exceder a altura visível do container. Com isso, nenhuma barra de rolagem vertical (`scrollbar`) é gerada. Como o scroll infinito baseia-se puramente na escuta do evento `scroll` do container `.overflow-y-auto`, e o usuário é incapaz de rolar uma página sem barra de rolagem, a paginação congelava e os itens subsequentes (Página 2 em diante) nunca eram requisitados.

## 🧠 Estratégia da Solução
A solução para quebrar essa limitação sem remover a rolagem infinita consistiu em implementar um ciclo reativo e autolimitado de preenchimento (auto-fill):
1. **Verificação de Altura do DOM**: Após cada renderização bem-sucedida de faixas, a aplicação calcula se a altura do conteúdo total (`scrollHeight`) do container é menor ou igual à altura visível (`clientHeight` + margem de tolerância de 50px).
2. **Carregamento Autônomo e Recursivo**: Caso o container não seja rolável e exista mais conteúdo no backend (`hasMore === true`), a aplicação dispara automaticamente `fetchTracks(false)` para obter a página seguinte. Ao carregar a página seguinte, o estado das faixas muda, disparando uma nova verificação. Esse loop cessa de forma natural e limpa assim que a barra de rolagem finalmente aparece ou as faixas no backend acabam.
3. **Resiliência a Redimensionamento**: Registrou-se um event listener de `resize` na janela global do navegador. Se o usuário redimensionar o navegador (por exemplo, esticar a janela verticalmente ou maximizá-la), a verificação é reexecutada de imediato para buscar mais faixas e preencher o novo espaço vago.
4. **Proteção contra Sobrecarga (Hammers)**: Todas as verificações respeitam as flags de rede `isFetchingMore` e `isLoadingTracks`, e rodam dentro de um `setTimeout` de 300ms, permitindo que o navegador finalize a pintura e cálculo do layout antes de ler as propriedades de altura.

## 🛠️ Implementação Técnica

### Frontend (React SPA)
- Modificado o componente `Dashboard.tsx` ([Dashboard.tsx:L276-302](file:///g:/DEV/mixer8/mixer8-app/src/pages/Dashboard.tsx#L276-L302)).
- Adicionado um hook `useEffect` reativo dependente de `[tracks, hasMore, isFetchingMore, isLoadingTracks]` para monitorar o preenchimento da tela e acionar a chamada se a barra de rolagem não estiver presente.
- Integrado o listener do evento `resize` da window com a devida limpeza de memória no retorno do hook.

---

## 🎯 Impacto e Resultado
* **Rolagem Infinita Transparente**: Usuários em telas grandes agora veem o grid ser preenchido de forma suave e contínua até o aparecimento da barra de rolagem, sem precisar de cliques em botões.
* **Resiliência de Layout**: Suporte total ao redimensionamento de janela e mudanças bruscas de zoom sem quebras de estados.
* **Segurança de Consumo da API**: Sem loops infinitos ou sobrecarga do backend, graças às verificações rigorosas das flags de status da Promise.

---
**Nota do Desenvolvedor:** *A determinação de tamanhos e alturas no ciclo de vida do React pode sofrer com corridas de render (race conditions) caso o cálculo de clientHeight/scrollHeight ocorra antes do navegador terminar o reflow do DOM. O uso de um temporizador leve (300ms) cria a estabilização necessária sem prejudicar a percepção de performance do usuário.*
