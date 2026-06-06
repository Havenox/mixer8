# 041 - [Downloader/API]: Extração Automática de Thumbnails do YouTube e Conversão para WebP

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 06/06/2026

---

## 🚀 Desafio de Engenharia
Ao importar músicas na plataforma via links de mídia (YouTube), a faixa era inserida sem qualquer imagem de capa associada, deixando o card na biblioteca com uma imagem genérica e sem contexto. Embora os metadados do arquivo pudessem conter imagens embutidas (extraídas com `TagLibSharp`), as mídias baixadas do YouTube raramente possuem capas embutidas. Era necessário extrair automaticamente a thumbnail original do vídeo do YouTube associado de forma performática e sem adicionar dependências complexas de conversão gráfica nos contêineres dos workers de download.

## 🧠 Estratégia da Solução
A solução adotada evita o overhead de usar o `yt-dlp` com conversores nativos Python no contêiner do downloader. Em vez disso:
1. **Downloader Stateless**: O `mixer8-downloader` resolve o ID do vídeo do YouTube a partir do link, e faz o download direto da imagem oficial de thumbnail via `HttpClient` (tentando `maxresdefault.jpg` com fallback automático para `hqdefault.jpg`).
2. **Envio via Multipart**: O arquivo temporário da thumbnail é anexado sob a chave `coverFile` na requisição `POST /api/Tracks/{id}/ImportCompleted` junto com o áudio finalizado.
3. **Conversão no Servidor**: O backend C# (`mixer8-api`) processa essa imagem enviada utilizando o `ImageHelper` existente (corte quadrado 1:1 centralizado e salvamento em formato WebP compactado com 80% de qualidade), persistindo a capa otimizada em disco e associando-a no PostgreSQL.

## 🛠️ Implementação Técnica

### Backend API (`mixer8-api`)
- **Atualização de Endpoint**: Alterada a assinatura do método `ImportCompleted` em [TracksController.cs](file:///g:/DEV/mixer8/mixer8-api/Controllers/TracksController.cs) para aceitar o arquivo opcional `[FromForm] IFormFile? coverFile`.
- **Processamento de Capa**: Se `coverFile` for enviado, a API o converte e compacta em WebP, salvando o arquivo resultante em `wwwroot/covers/{id}.webp` e definindo `track.CoverUrl`. Caso contrário, mantém o fallback retrocompatível de extração via `TagLibSharp` a partir de metadados embutidos no áudio.

### Microsserviço Downloader (`mixer8-downloader`)
- **Resolução de ID**: Implementado método utilitário `GetYouTubeVideoId` em [Worker.cs](file:///g:/DEV/mixer8/mixer8-downloader/Worker.cs) para extrair o código único do vídeo a partir de URLs curtas (`youtu.be/`) ou completas (`youtube.com/watch?v=`).
- **Download Resiliente**: Implementado método `DownloadYouTubeThumbnailAsync` que baixa a imagem do servidor do YouTube, testando primeiramente a resolução máxima e, em caso de erro, usando a de alta qualidade.
- **Payload Multipart**: Modificado o `UploadCompletedAudioAsync` para anexar o Stream da imagem como `coverFile` no formulário HTTP multipart/form-data.
- **Limpeza de Cache**: Garantida a exclusão do arquivo temporário da thumbnail em disco após a tentativa de upload.

## 🎯 Impacto e Resultado
* **Capa Automática e Reativa**: Vídeos importados do YouTube agora exibem automaticamente a thumbnail original do vídeo convertida, cortada e otimizada logo após o fechamento automático do modal.
* **Resiliência e Desacoplamento**: Se o download ou processamento da imagem falhar, a música ainda é importada e processada normalmente sem quebrar a pipeline de áudio.
* **Performance e Tamanho de Disco**: A compressão em WebP (500x500 px, 80% de qualidade) garante que as imagens fiquem extremamente leves, mantendo as páginas do catálogo rápidas de carregar e minimizando custos de tráfego de rede e uso de disco na API VPS.

---
**Nota do Desenvolvedor:** *Usar a infraestrutura de imagem da API principal (que já dependia de `SixLabors.ImageSharp`) para o corte e compressão de imagens manteve o microsserviço downloader extremamente enxuto e livre de dependências de subprocessos gráficos nativos como FFMpeg ou bibliotecas de conversão no Linux, preservando o princípio de responsabilidade única e simplicidade de deploys.*
