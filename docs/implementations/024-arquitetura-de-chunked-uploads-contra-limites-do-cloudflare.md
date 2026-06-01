# 024 - [Uploads]: Arquitetura de Chunked Uploads contra Limites do Cloudflare

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 01/06/2026

---

## 🚀 Desafio de Engenharia
Ao expor a API do Mixer8 através do Cloudflare na camada Proxy ativa (nuvem laranja) para blindar o IP de origem do homelab contra ataques de negação de serviço (DDoS) e varreduras maliciosas, esbarramos no limite estrito de payload HTTP (Request Body Size Limit) de **100MB** imposto na modalidade gratuita da Cloudflare. 

Quando múltiplos stems de áudio eram enviados simultaneamente ou um pacote `.zip` robusto com mais de 100MB era transmitido direto via uploader, o Cloudflare cortava silenciosamente a conexão do cliente, deixando o upload travado em status *Pending* infinitamente no navegador. Desativar o proxy da Cloudflare colocaria em risco a segurança e a integridade de todo o servidor doméstico, sendo uma opção inviável.

## 🧠 Estratégia da Solução
A única alternativa resiliente e de padrão ouro foi implementar uma **Arquitetura de Transmissão Fragmentada (File Chunking)**. Em vez de enviar as stems de uma única vez em uma grande requisição multi-part, adotamos a seguinte abordagem:
1. **Fatiamento no Frontend**: O navegador fatia dinamicamente cada arquivo (sejam stems individuais `.mp3` ou arquivos compactados `.zip`) em blocos idênticos de **10MB** usando as APIs nativas do JavaScript (`File.prototype.slice`).
2. **Endpoints de Escopo Separado**:
   - `POST /api/Tracks/UploadChunk`: Recebe individualmente cada bloco físico de 10MB e o armazena sequencialmente no disco temporário do servidor identificado por um `UploadId` único (GUID) e `ChunkIndex`. Quando todos os blocos do arquivo são recebidos, a API remonta o arquivo e exclui as partes temporárias.
   - `POST /api/Tracks/UploadDirect`: Agora aceita uma lista de `UploadIds` para buscar os arquivos previamente remontados e executar o fluxo de pipeline do FFmpeg e gravação estrita das tracks.
3. **Segurança de Borda Mantida**: Com pedaços de 10MB fluindo individualmente, o upload passa de forma ultra-veloz pela borda do Cloudflare, mantendo a proteção proxy de DDoS 100% ativa.

## 🛠️ Implementação Técnica

### Backend (.NET 10 & C# 13)
- **Criação do DTO `UploadChunkRequest`**: Encapsula `File` (bloco), `UploadId`, `ChunkIndex`, `TotalChunks` e `FileName`.
- **Criação do Endpoint `/api/Tracks/UploadChunk`**:
  - Salva os blocos `.tmp` no caminho físico `wwwroot/temp_uploads/{UploadId}/{ChunkIndex}.tmp`.
  - Mecanismo de montagem síncrona com ordenação sequencial que funde os pedaços usando `FileStream.CopyToAsync` assim que o contador de arquivos `.tmp` equivale a `TotalChunks`.
- **Refatoração do `/api/Tracks/UploadDirect`**:
  - Aceita a lista delimitada por vírgulas de `UploadIds`.
  - Varre o diretório temporário para obter os streams físicos correspondentes.
  - Bloco `finally` robusto com liberação rigorosa de streams e exclusão recursiva de todas as pastas temporárias de trabalho.

### Frontend (React, TypeScript & Tailwind)
- **Implementação do Algoritmo de Slicing**: Loop sequencial que particiona blobs usando a fórmula `file.slice(start, end)` e os transmite via `FormData` com propriedades em PascalCase estrito.
- **Estado de Progresso `filesProgress`**: Mapeia o progresso individual de cada stem de áudio, atualizando barras de carregamento sutis e status visuais dedicados (*Pendente, Enviando, Montando, Pronto, Falhou*).
- **Design Defensivo Premium**: Desabilita fisicamente todos os controles de formulário e inputs durante a transmissão para mitigar submissões concorrentes (*Double Submit*).

## 🎯 Impacto e Resultado
* **Segurança Inabalável**: Blindagem IP do homelab preservada sob o proxy (nuvem laranja) do Cloudflare ativa.
* **Superação Física de Limites**: Capacidade de processar stems e ZIPs de qualquer tamanho (por exemplo, 200MB, 500MB) contornando a restrição de 100MB por bloco.
* **Experiência de Usuário Excepcional**: O progresso detalhado de cada fader a ser importado gera confiança na interface do Mixer8, oferecendo um acompanhamento transparente em tempo real.

---
**Nota do Desenvolvedor:** *A arquitetura de chunked upload não apenas sanou a limitação do proxy de borda, como forneceu um modelo extremamente resiliente de transferência de arquivos. Mesmo que uma fatia venha a falhar, o cliente sabe exatamente qual arquivo quebrou, permitindo futuras implementações de retentativas inteligentes sem retransmitir toda a biblioteca de uma só vez.*
