# 050 - Extrator: Monitoramento GraphQL Resiliente de BEATSCHORDS_A

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 25/06/2026

---

## 🚀 Desafio de Engenharia
No processo de extração de faixas do Moises.ai pelo bot headless do Mixer8, ocorriam situações em que o download das stems e o encerramento do bot aconteciam antes que a detecção de batidas e geração de cifras (operação `BEATSCHORDS_A`) estivesse totalmente concluída. Isso resultava em músicas extraídas incompletas: sem o arquivo de cifras (`chords.json`) e sem a faixa de metrônomo correspondente no arquivo ZIP. Havia a necessidade de sincronizar de forma inteligente o término das operações de IA secundárias (cifras e metrônomo), sem que falhas nessas etapas secundárias quebrassem o processo principal de separação das stems (que é a funcionalidade crítica).

## 🧠 Estratégia da Solução
A solução foi implementar um monitoramento ativo da operação `BEATSCHORDS_A` via GraphQL no interceptador de respostas HTTP do Playwright em `Worker.cs`:
1. **Diferenciação entre Erro Fatal e Não-Fatal**: A separação de stems (`SEPARATE_CUSTOM`) continua sendo a única operação fatal. Se falhar ou estourar o tempo limite de 15 minutos, a extração falha. A operação `BEATSCHORDS_A` é tratada como opcional (não-fatal).
2. **Espera Adicional Não-Obstrutiva**: Após a conclusão das stems, se a operação `BEATSCHORDS_A` ainda estiver pendente, o worker aguarda por até 180 segundos adicionais. Se a operação for concluída dentro desse tempo limite, as cifras e o metrônomo serão exportados normalmente pela DAW. Se falhar ou estourar o tempo limite de 180 segundos, o bot registra um aviso no console e prossegue apenas com as stems normais obtidas, evitando travar a fila do extrator.

## 🛠️ Implementação Técnica

### Backend (mixer8-extractor)
* **[Worker.cs](file:///g:/DEV/mixer8/mixer8-extractor/Worker.cs)**:
  * Adicionada a variável local `beatschordsOperationStatus` para monitorar o progresso da operação.
  * Atualizado o interceptador de rede do Playwright para interceptar requisições contendo `"BEATSCHORDS"` ou `"beatschords"`.
  * Extraído o status de `BEATSCHORDS_A` a partir da lista `operations` ou do objeto de resumo `summary.v1.beatschords` do JSON retornado via GraphQL.
  * Modificado o loop de espera síncrona: primeiro aguarda-se a conclusão das stems (limite de 900s, fatal em caso de falha/timeout), e em seguida aguarda-se até 180s adicionais de forma não-bloqueante/não-fatal pela conclusão da operação de batidas/cifras.

## 🎯 Impacto e Resultado
* **Garantia de Cifras e Metrônomo**: A exportação na DAW e o recarregamento da página ocorrem no tempo correto, garantindo que o `chords.json` seja interceptado e a faixa de metrônomo seja incluída nativamente no ZIP.
* **Resiliência de Fluxo**: Falhas na geração de cifras ou no processamento de batidas no Moises.ai não causam mais o cancelamento de toda a extração, garantindo que o usuário ainda tenha acesso às stems principais.

---
**Nota do Desenvolvedor:** *A arquitetura de bots headless que dependem de APIs de terceiros deve sempre mapear e isolar as dependências críticas das opcionais. Garantir que o núcleo da aplicação (as stems de áudio) funcione independentemente de enriquecimentos secundários (letras, cifras) é um princípio fundamental para alta disponibilidade.*
