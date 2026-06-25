# 045 - Extrator & API: Extração e Exposição Segura de Cifras e Letras

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 24/06/2026

---

## 🚀 Desafio de Engenharia
A plataforma de separação de stems Moises.ai realiza de forma nativa a detecção de batidas, cifras e letras sincronizadas de cada arquivo de áudio submetido, servindo-os na sua DAW Web como arquivos JSON estáticos (como `chords.json` e `lyrics.json`). 

O desafio consistiu em interceptar esses dados ricos durante o processo automatizado headless do bot Playwright no `mixer8-extractor` e enviá-los de forma consolidada para a `mixer8-api` sem abrir brechas de segurança cibernética graves. Ao permitir arquivos `.json` dentro do ZIP de stems, abrir-se-ia um risco de injeção de arquivos maliciosos, estouro de disco via Zip Bombs (Denial of Service) e sobrescrita de arquivos do sistema operacional ou configurações do servidor via ataques de Path Traversal (*Zip Slip*).

## 🧠 Estratégia da Solução
Para garantir a soberania do backend e a segurança integral da infraestrutura física da API e do armazenamento estático, adotamos a seguinte estratégia:
1.  **Captação Passiva no Worker**: Registramos um listener assíncrono para o evento `page.Response` no Playwright para escutar o tráfego HTTP. Quando o navegador headless do bot carrega a DAW, as requisições nativas de cifras e letras são capturadas na memória do Worker e, ao fim do download do ZIP de stems, injetadas como arquivos `"chords.json"` e `"lyrics.json"` no pacote físico.
2.  **Proteções Ativas de Descompactação na API**:
    *   **Isolamento do Caminho (Anti-Zip Slip)**: Ignora-se a propriedade `FullName` ou qualquer caminho relativo vindo do arquivo ZIP do usuário. O arquivo JSON é salvo em um caminho fixo determinado estritamente no servidor através de `Path.Combine(trackDir, entryNameLower)`.
    *   **Limite Físico (Anti-Zip Bomb)**: Limita-se o tamanho de descompactação a no máximo **2 MB** para qualquer arquivo `.json`, prevenindo exaustão de espaço em disco ou memória.
    *   **Validação Sintática Ativa (Anti-Malware/Polyglots)**: Antes de efetuar a gravação física no servidor, a API lê o stream do arquivo e realiza o parse completo usando o parser assíncrono seguro `System.Text.Json.JsonDocument.ParseAsync`. Se houver qualquer erro de estruturação (caracteres malformados, scripts brutos disfarçados ou binários executáveis), o arquivo é sumariamente descartado e a transação atômica prossegue de forma limpa.
3.  **Aproveitamento de Infraestrutura Estática**: Salvando-os como arquivos estáticos no diretório `/wwwroot/stems/{TrackId}/`, mantemos a arquitetura pronta para migração stateless de CDN/Object Storage (S3/R2) sem a necessidade de inflar as tabelas relacionais do banco PostgreSQL com milhares de batidas e acordes individuais.

## 🛠️ Implementação Técnica

### Backend (API)
*   **[TracksController.cs](file:///g:/DEV/mixer8/mixer8-api/Controllers/TracksController.cs)**:
    *   Implementado o filtro lógico nos loops de descompactação de ZIP nos endpoints de `ProcessStemsZip` (usado pelo bot), `Upload` e `Edit` (usados no fluxo manual de criadores).
    *   Arquivos `chords.json` e `lyrics.json` são interceptados na descompactação, validados com limite de 2MB, submetidos a parse de JSON assíncrono estruturado e salvos de forma estritamente isolada e segura.

### Extrator (Worker)
*   **[Worker.cs](file:///g:/DEV/mixer8/mixer8-extractor/Worker.cs)**:
    *   Declaradas variáveis locais de captação na rotina `ExecuteExtractionWorkflowAsync`.
    *   Injetado o hook `page.Response` no Playwright para extrair o conteúdo textual de batidas/acordes e letras de forma agnóstica.
    *   Adicionada a rotina de atualização pós-download do ZIP utilizando a biblioteca nativa `System.IO.Compression.ZipFile` para abrir o arquivo e injetar os JSONs interceptados sob o escopo transacional.

## 🎯 Impacto e Resultado
*   **Mitigação de Path Traversal**: Zero chance de escrita arbitrária fora das pastas de stems designadas para cada música, neutralizando a brecha clássica de descompactadores.
*   **Segurança contra Scripts Maliciosos (XSS/Stored)**: O parse ativo garante que arquivos fingindo ser JSON mas contendo outros tipos de código sejam impedidos de entrar na máquina.
*   **Estrada Pavimentada para a Web**: Cifras e letras agora residem organizadas na pasta de áudio da música, servidas de forma direta e extremamente veloz com custo computacional nulo para os servidores.

---
**Nota do Desenvolvedor:** *O uso de caminhos estáticos gerados pelo backend ao descompactar arquivos ZIP (em vez de confiar no diretório estrutural embutido na entrada do arquivo) é um princípio inegociável de segurança. A adição de validação ativa de JSON eleva o Mixer8 a padrões corporativos de conformidade de segurança.*
