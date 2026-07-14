# 054 - [Waveformer]: Detecção de Silêncio e Remoção de Stems Vazias

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 14/07/2026

---

## 🚀 Desafio de Engenharia
Ao extrair stems de uma faixa (por exemplo, dividindo em 7 canais), ferramentas de IA como o Moises.ai retornam todas as faixas independentemente de conterem áudio. Uma música sem bateria ou sem vocal de apoio ainda produzirá arquivos físicos `.opus` silenciosos ou com ruídos estáticos microscópicos (resíduos da inteligência artificial). 

Armazenar essas faixas "vazias" desperdiça espaço em disco no servidor host desnecessariamente e polui a interface de mixagem com faixas sem sinal útil.

## 🧠 Estratégia da Solução
Aproveitamos o ciclo de processamento do microsserviço `mixer8-waveformer` (que lê os picos da stem decodificada) para analisar a amplitude do áudio.
1. **Limiar de Silêncio Seguro**: Antes de aplicar a normalização de picos (Peak Normalization), verificamos se o pico máximo absoluto obtido (`maxPeak`) em toda a stem é menor ou igual a **2%** (cerca de **-34 dBFS**). Esse valor é extremamente seguro para distinguir entre faixas com som de baixo volume (como solos distantes de sopro ou sussurros) e silêncio absoluto com ruído de artefatos de IA.
2. **Deleção Física e Atômica**: Se a stem for classificada como silenciosa, o worker apaga o arquivo físico Opus da pasta compartilhada `/app/wwwroot/stems` e exclui o registro `Stem` do banco de dados na mesma transação.
3. **Prevenção de Registros Fantasmas**: A remoção da entidade `Stem` limpa automaticamente quaisquer tabelas dependentes (como a de waveforms) devido à chave estrangeira com exclusão física em cascata (`ON DELETE CASCADE`).

## 🛠️ Implementação Técnica

### Backend / Workers
*   **[Worker.cs (mixer8-waveformer)](file:///g:/DEV/mixer8/mixer8-waveformer/Worker.cs)**:
    *   Leitura do maior pico absoluto (`maxPeak <= 2`).
    *   Exclusão física do arquivo com `System.IO.File.Delete`.
    *   Remoção do registro de banco com `dbContext.Stems.Remove(stem)`.
*   **[docker-compose.yml](file:///g:/DEV/mixer8/docker-compose.yml)**: Mapeamento do volume físico compartilhado `./mixer8-api/wwwroot:/app/wwwroot` no serviço do `mixer8-waveformer`.

## 🎯 Impacto e Resultado
* **Economia de Armazenamento**: Stems silenciosas deixam de consumir espaço físico em disco imediatamente após a extração, otimizando o host de produção.
* **Interface Limpa**: O player de mixagem não carrega canais vazios, melhorando a usabilidade e a experiência do usuário.
* **Execução Retroativa**: A autolimpeza funciona retroativamente; qualquer stem legada sem waveform que for lida pelo worker e identificada como vazia é eliminada de forma totalmente automatizada.

---
**Nota do Desenvolvedor:** *A decisão de integrar o analisador de silêncio no waveformer foi muito elegante porque aproveita a leitura completa do array de picos que já estava ocorrendo na CPU, sem adicionar novos fluxos pesados de decodificação.*
