# 077 - Upload: Formatador Title Case Inteligente no Algoritmo de Naming de Metadados

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 20/07/2026

---

## 🚀 Desafio de Engenharia
Ao importar músicas via arquivos locais ou links do YouTube, os metadados brutos sofrem de poluição visual na capitalização:
* Nomes inteiros em `UPPERCASE` (ex: `QUERO ESTAR LIVRE - GRUPO MODÃO`).
* Nomes em `lowercase` (ex: `djavan - oceano`).
* Conectores de ligação capitalizados indevidamente no meio do texto (ex: "Céu E Mar", "Jota Quest De Volta").

O objetivo é garantir que os nomes fiquem formatados no padrão de design estético **Title Case** de forma inteligente, respeitando conectores/ligações em minúsculas e siglas comuns ou numerais romanos em maiúsculas, sem estragar a capitalização da primeira palavra de cada campo.

## 🧠 Estratégia da Solução
Implementada a função auxiliar `toTitleCase(text: string): string` acoplada diretamente à saída da rotina `parseTrackMetadata`. As regras aplicadas são:
1. **Capitalização Padrão (Title Case):** Palavras comuns têm a primeira letra convertida para maiúscula e as seguintes para minúscula.
2. **Preservação de Ligações (em lowercase):** Palavras como `e`, `ou`, `de`, `do`, `da`, `para`, `com`, `and`, `the`, `with` etc., são deixadas em minúsculas quando estiverem localizadas no meio do texto.
3. **Imposição da Primeira Letra:** A primeira palavra da string sempre recebe capitalização com primeira letra maiúscula, mesmo se for uma palavra de ligação (ex: `"O Vento"`, e não `"o Vento"`).
4. **Preservação de Siglas e Romanos (em UPPERCASE):** Palavras reconhecidas como siglas (ex: `"DJ"`, `"MC"`) ou numerais romanos comuns (ex: `"IV"`, `"III"`) são formatadas em maiúsculas de forma fixa.

## 🛠️ Detalhes da Implementação
No arquivo `metadataParser.ts`:
* Injetada a rotina `toTitleCase` nas chaves de saída `songName` e `artistName`.
* Criados os dicionários estáticos (`Set`) `lowercaseWords` e `uppercaseWords` para buscas eficientes em $O(1)$.
* Limpos os caracteres de pontuação do início e fim das palavras (`word.replace(/^[^\w\dÀ-ÿ]+|[^\w\dÀ-ÿ]+$/g, '').toLowerCase()`) apenas para fins de comparação com a tabela de dicionários, preservando qualquer símbolo original (como pontos ou vírgulas nas bordas).

## 🎯 Impacto e Resultado
* **Paridade de Design:** Entradas de metadados agora possuem consistência profissional e limpa, independentemente de como o título original está cadastrado no arquivo ou no YouTube.
* **Sem Falsa Inversão:** O comportamento de divisão e auto-inversão permanece íntegro e preciso, refinando apenas a estética do texto que será exibida nas caixas de input da UI.
