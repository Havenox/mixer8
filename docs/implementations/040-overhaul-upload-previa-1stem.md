# 040 - Overhaul de Upload & Prévia Imediata (1-Stem) com Workers 100% Stateless

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 06/06/2026

---

## 🚀 Desafio de Engenharia
No modelo anterior do Mixer8, o usuário passava por uma longa espera passiva durante a extração de stems (de 3 a 5 minutos), sem nenhuma interatividade ou possibilidade de ouvir a faixa até que todo o processamento de separação estivesse concluído. Além disso, a arquitetura possuía um forte acoplamento físico em produção: tanto o microsserviço de download quanto o de extração dependiam de volumes de armazenamento compartilhados (diretório `downloads/`) com a API principal. Essa dependência impedia a escalabilidade horizontal e o deploy totalmente stateless em ambientes de nuvem modernos (como Kubernetes ou instâncias isoladas de App Services).

## 🧠 Estratégia da Solução
Redesenhamos o fluxo de processamento de mídias introduzindo o conceito de **1-Stem (Prévia Imediata)** e desacoplamento total de I/O em disco físico através de APIs HTTP stateless:
1. **Prévia Imediata (Completo.opus)**: No momento em que um arquivo de mídia é carregado por upload físico ou baixado pelo downloader, ele é instantaneamente convertido em memória para um arquivo Opus Estéreo leve de alta fidelidade e salvo em `wwwroot/stems/{trackId}/Completo.opus`. Um registro de stem temporário denominado `"Completo"` é inserido na tabela de banco de dados.
2. **Leitura Automatizada de Metadados Ricos (TagLibSharp)**: Adicionado o leitor de tags nativo `TagLibSharp` no backend para extrair automaticamente metadados físicos (Título, Artista e Imagem de Capa embutida) do áudio enviado, processando a capa in-memory para WebP (500x500 px, 80% qualidade), evitando campos vazios no catálogo.
3. **Comunicação 100% Stateless via HTTP**: Removemos todas as dependências de volumes compartilhados em produção:
   * **Downloader**: Transmite o arquivo de áudio concluído diretamente para a API principal por meio de uma requisição `POST /api/Tracks/{id}/ImportCompleted` e descarta a cópia local.
   * **Extractor**: Realiza polling na API buscando o status `"Processando: Aguardando Extração"`, baixa o arquivo de prévia `Completo.opus` via HTTP GET para seu diretório temporário, executa a extração automatizada via Playwright e envia o ZIP de stems finais por meio do endpoint `POST /api/Tracks/{id}/ProcessStemsZip`.
4. **Substituição Atômica (ACID Swap)**: Ao receber as stems finais em ZIP, a API executa uma transação atômica no banco de dados Entity Framework para apagar a stem provisória `"Completo"`, apagar o arquivo físico `Completo.opus` do disco e inserir as stems oficiais transcodificadas, mudando o status da faixa para `"Pronto"`.
5. **Experiência do Usuário SPA (Player Reativo)**: Faixas com status iniciando em `"Processando"` agora podem ser tocadas na SPA imediatamente usando a stem `"Completo"`. Para manter a integridade visual da DAW e evitar controles quebrados, os faders individuais da mesa de som são ocultados e substituídos por um aviso premium informativo.

## 🛠️ Implementação Técnica

### Backend API (`mixer8-api`)
* **TagLibSharp**: Instalada biblioteca para extração in-memory de metadados ricos de faixas de mídia física.
* **ImageHelper.cs**: Adicionado overload de `ProcessAndSaveImageAsync` que processa `Stream` de bytes de capas embutidas direto em memória para WebP.
* **TracksController.cs**:
  * Overhaul no método `Upload` para extrair metadados, criar o diretório da faixa, converter para `Completo.opus` e salvar a stem temporária `"Completo"`.
  * Criação do endpoint `POST /api/Tracks/{id}/ImportCompleted` para recebimento de áudios finais do downloader.
  * Atualização de `ProcessStemsZip` para executar em escopo transacional de banco de dados, excluindo a stem temporária `"Completo"` e deletando o arquivo físico correspondente.

### Microsserviço Downloader (`mixer8-downloader`)
* **Worker.cs**: Atualizado para realizar upload de arquivos baixados com sucesso via HTTP POST para o endpoint `/api/Tracks/{id}/ImportCompleted` e realizar a limpeza atômica de cache local no disco.

### Microsserviço Extrator (`mixer8-extractor`)
* **Worker.cs**:
  * Modificação da busca de fila de banco de dados para filtrar pelo status `"Processando: Aguardando Extração"`.
  * Implementação de download remoto do arquivo `Completo.opus` via HTTP GET.
  * Modificação da submissão do ZIP final para fazer upload via requisição HTTP `POST /api/Tracks/{id}/ProcessStemsZip` com formulário multipart contendo os binários do arquivo ZIP.
  * Limpeza proativa de arquivos locais residuais pós-execução para evitar disk leak no worker.

### Frontend React (`mixer8-app`)
* **Player Core**: Atualizado o player e os componentes de prateleira/listas para permitir reprodução de músicas que iniciam com o status `"Processando"`.
* **MesaPlayer.tsx (Mesa de Mixagem)**: Adicionada regra reativa para verificar se a música está em processamento ou contém apenas a stem `"Completo"`. Caso verdadeiro, oculta os faders da DAW e exibe a mensagem de onboarding premium: *"Mixagem em processamento. Ouça a prévia completa enquanto separamos os canais."*
* **TrackListing.tsx & ExploreShelf.tsx**: Formatação do sub-status dinâmico em uppercase com cores harmônicas adequadas ao tema (ex: `"AGUARDANDO EXTRAÇÃO"` ou `"EXTRAINDO STEMS"`).

## 🎯 Impacto e Resultado
* **Espera Zero para o Usuário**: O tempo de espera passivo caiu de 3-5 minutos para zero. O usuário ouve a música instantaneamente após o upload ou download enquanto o processamento ocorre em segundo plano.
* **Workers Completamente Stateless**: Eliminou-se qualquer dependência de volumes NFS ou compartilhamento de diretórios físicos. A API e os Workers podem ser distribuídos horizontalmente de forma independente na nuvem.
* **Metadados Ricos Automatizados**: Reduziu o trabalho manual do usuário de digitar títulos/artistas e buscar capas de álbuns, já que o TagLibSharp processa as tags e capas embutidas do próprio arquivo enviado de forma instantânea.
