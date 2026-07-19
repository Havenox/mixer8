# 075 - UI & UX: Algoritmo Inteligente de Naming e Botão de Inversão de Metadados no Upload

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 19/07/2026

---

## 🚀 Desafio de Engenharia
Ao importar músicas via arquivos locais ou por links do YouTube, os títulos brutos frequentemente carregam "poluição" semântica — como numerações de faixas (ex: `02`, `05`), indicação de canal (ex: ` - Topic`), e marcadores de versão (ex: `(Ao Vivo)`, `[Official Audio]`, `(Clipe Oficial)`). Além disso, quando o formato de títulos vinha invertido (`[Música] - [Artista]`), o formulário de upload de arquivos físicos não possuía o botão de inversão (swap) de inputs que existia na aba de URLs, forçando o usuário a reescrever manualmente os dois campos.

## 🧠 Estratégia da Solução
1. **Módulo de Parsing Unificado (`metadataParser.ts`)**: Criar uma utilidade compartilhada e agnóstica para limpar e extrair metadados. O parser limpa expressões regulares de tags promocionais e formatações de áudio ao vivo, remove termos Topic e numerações com delimitadores, e separa a string em partes limpas por delimitadores comuns.
2. **Heurística de Auto-Inversão no YouTube**: Utilizar o nome do canal do autor (`data.author_name` do Youtube) como fallback inteligente. Se o parser identificar que o nome extraído como música bate com o autor do canal do Youtube, ele inverte automaticamente para preencher o artista e a música nos campos corretos desde o início.
3. **Harmonização Visual da Interface**: Reestruturar o formulário de metadados da aba de arquivos locais para adotar o layout de três colunas `grid-cols-[1fr_auto_1fr]` e incluir o botão de inversão instantânea com o ícone `ArrowLeftRight`, mantendo perfeita paridade visual e funcional com a aba de URL.

## 🛠️ Implementação Técnica

### Frontend
* **`metadataParser.ts`**:
  * Desenvolvida a função `parseTrackMetadata` que aceita o título bruto e um artista de fallback.
  * Remove `(Ao Vivo)`, ` - Topic`, numeração decimal inicial (`01`, `02.`, etc.) e strings promocionais do YouTube, reduzindo múltiplos espaços.
  * Executa a divisão por separadores estruturados (ex: ` - `) e cruas (ex: `-`).
  * Associa por padrão `parts[0]` ao Artista e `parts[1]` à Música.
  * Efetua auto-inversão se a música extraída for igual ao `fallbackArtist`.
* **`Library.tsx`**:
  * Importado `parseTrackMetadata` para substituir a lógica inline anterior do `useEffect` de URL/Youtube.
  * Substituído o split simples do `handleFileChange` pela nova função `parseTrackMetadata(nameWithoutExt)`.
  * Atualizada a renderização na aba de arquivos (`file`) para renderizar os inputs em grid de 3 colunas contendo o botão de inversão entre eles e adicionados placeholders ilustrativos.

## 🎯 Impacto e Resultado
* **Entrada de Dados Limpa**: Títulos poluídos como `05 - Quero Estar Livre - Grupo Modão - Topic` ou `Balada Prime (Ao Vivo) - Cristiano Araujo` agora preenchem os campos de formulário de forma totalmente higienizada.
* **Ergonomia e UX Consistente**: O botão de inversão de nomes está presente em ambas as abas, permitindo corrigir a ordenação com um único clique de forma fluida.
* **Aderência aos Padrões Estéticos**: A interface preserva as cores sóbrias e arquitetura minimalista, sem poluição de componentes.

---
**Nota do Desenvolvedor:** *Centralizar a lógica de higienização de strings em um módulo utilitário testável garante que melhorias futuras no parser de títulos possam ser aplicadas de forma global e uniforme no sistema, preservando a semântica e evitando duplicação de regexes em múltiplos componentes do ecossistema SPA.*
