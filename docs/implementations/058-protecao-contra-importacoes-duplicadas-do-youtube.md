# 058 - [Upload/YouTube]: Proteção contra Importações Duplicadas do YouTube e Busca por Link

**Autor:** Eduardo Nascimento (Havenox)
**Data:** 14/07/2026

---

## 🚀 Desafio de Engenharia
Ao importar músicas via link externo do YouTube ou YouTube Music, os usuários ocasionalmente colavam links que já haviam sido previamente importados e processados na plataforma. A API simplesmente criava um novo registro de música com o status `AguardandoDownload`, enfileirando uma nova tarefa redundante para o microsserviço de download (`yt-dlp`) e para o extrator de stems (`Moises.ai`).

Isso gerava desperdício massivo de cota de API de extração de stems, consumo indevido de banda do homelab, duplicações de registros no banco de dados e arquivos redundantes em disco. Havia a necessidade de bloquear solicitações duplicadas imediatamente na entrada e redirecionar a navegação do usuário de forma útil.

## 🧠 Estratégia da Solução
*   **Backend (Validação de Vídeo ID)**: O endpoint `ImportUrl` analisa o link do YouTube, extrai o ID único do vídeo (código de 11 caracteres) e realiza uma busca síncrona na tabela `"Tracks"` (`DownloadUrl == videoId`). Caso exista, retorna um código `409 Conflict`.
*   **Frontend (Redirecionamento Inteligente)**: O frontend SPA intercepta a resposta `409 Conflict` durante a requisição, exibe um Toast visual de aviso, fecha o modal de upload e insere a URL enviada diretamente no campo de busca global da biblioteca, exibindo instantaneamente a faixa correspondente para o usuário.
*   **Busca Global por Link/ID**: Aprimoramos o filtro de busca de faixas para extrair o ID do vídeo do termo pesquisado, permitindo que colando o link do YouTube na barra de busca a música existente seja encontrada de imediato.

---

## 🛠️ Implementação Técnica

### 1. Extração de ID e Validação na API (C#)
Implementado no [TracksController.cs](file:///g:/DEV/mixer8/mixer8-api/Controllers/TracksController.cs):
```csharp
[HttpPost("ImportUrl")]
public async Task<IActionResult> ImportUrl([FromBody] ImportUrlRequest request)
{
    // ... validações iniciais
    var videoIdOrUrl = ExtractYouTubeVideoIdOrUrl(request.DownloadUrl);
    
    // Verifica duplicados
    var existingTrack = await dbContext.Tracks.FirstOrDefaultAsync(t => t.DownloadUrl == videoIdOrUrl);
    if (existingTrack != null)
    {
        return Conflict(new { 
            ErrorMessage = "TRACK_ALREADY_EXISTS", 
            TrackId = existingTrack.TrackId, 
            TrackTitle = existingTrack.TrackTitle 
        });
    }

    // Segue fluxo padrão de inserção na fila de download
}
```

### 2. Filtro de Busca por ID de Vídeo (C#)
Ajustado no método `GetAll` de [TracksController.cs](file:///g:/DEV/mixer8/mixer8-api/Controllers/TracksController.cs):
```csharp
if (!string.IsNullOrWhiteSpace(search))
{
    var searchPattern = $"%{search}%";
    var youtubeId = ExtractYouTubeVideoIdOrUrl(search); // Resolve IDs de links colados na busca
    
    query = query.Where(t => 
        EF.Functions.ILike(EF.Functions.Unaccent(t.TrackTitle), EF.Functions.Unaccent(searchPattern)) || 
        EF.Functions.ILike(EF.Functions.Unaccent(t.ArtistName), EF.Functions.Unaccent(searchPattern)) ||
        (!string.IsNullOrEmpty(t.DownloadUrl) && t.DownloadUrl == youtubeId)
    );
}
```

### 3. Interceptação de Conflito na SPA (React)
Modificado no [Dashboard.tsx](file:///g:/DEV/mixer8/mixer8-app/src/pages/Dashboard.tsx):
```typescript
if (res.status === 409 || errorData.ErrorMessage === 'TRACK_ALREADY_EXISTS') {
  const trackTitle = errorData.TrackTitle || 'Música existente';
  setToastMessage(`A música "${trackTitle}" já existe na plataforma! Redirecionando para a busca...`);
  setShowToast(true);

  // Limpa formulários e fecha o modal
  setDownloadUrl('');
  setSongName('');
  setArtistName('');
  setIsUploading(false);
  navigate('/dashboard'); 

  // Insere a URL na barra de busca para filtrar a música
  setSearchInput(downloadUrl.trim());
  setDebouncedSearch(downloadUrl.trim());
}
```

---

## 🎯 Impacto e Resultado
* **Economia de Recursos**: Zero downloads ou extrações redundantes de links duplicados do YouTube.
* **UX Direcionada**: Em vez de simplesmente rejeitar o upload e exibir uma mensagem de erro fria, a SPA fecha o modal e apresenta a música já pronta e cadastrada diretamente na tela do usuário.
* **Busca Flexível**: O operador pode pesquisar músicas na biblioteca apenas colando o link original do YouTube na busca padrão.

---
**Nota do Desenvolvedor:** *A extração do ID de vídeo do YouTube em C# lida de forma flexível com diferentes formatos (`youtube.com/watch?v=...`, `youtu.be/...`, `embed`, `/shorts/`, ou `music.youtube.com`), mantendo a integridade da comparação.*
