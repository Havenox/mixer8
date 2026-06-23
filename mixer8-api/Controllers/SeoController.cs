using System;
using System.Linq;
using System.Net;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mixer8.Api.Infrastructure;

namespace Mixer8.Api.Controllers;

/// <summary>
/// Controlador responsável por gerar metadados de SEO (Open Graph / Twitter Cards) dinâmicos
/// para indexadores de busca e robôs de redes sociais (crawlers).
/// </summary>
[ApiController]
[Route("api/[controller]")]
[AllowAnonymous]
public class SeoController(Mixer8DbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Retorna uma página HTML contendo metadados dinâmicos sobre a playlist especificada.
    /// Caso a playlist seja privada, exibe metadados restritos com uma chamada para ação (CTA).
    /// </summary>
    /// <param name="id">ID da playlist no formato GUID.</param>
    /// <returns>HTML preenchido com as tags SEO correspondentes.</returns>
    [HttpGet("Playlists/{id}")]
    public async Task<IActionResult> GetPlaylistSeo(string id)
    {
        if (!Guid.TryParse(id, out var playlistId))
        {
            return NotFound("ID de playlist inválido.");
        }

        // Busca a playlist com as faixas correspondentes
        var playlist = await dbContext.Playlists
            .Include(p => p.PlaylistTracks)
                .ThenInclude(pt => pt.Track)
            .FirstOrDefaultAsync(p => p.PlaylistId == playlistId);

        if (playlist == null)
        {
            return NotFound("Playlist não encontrada.");
        }

        // Resolve os cabeçalhos do host para construir caminhos absolutos
        var scheme = Request.Headers["X-Forwarded-Proto"].FirstOrDefault() ?? Request.Scheme;
        var host = Request.Headers["X-Forwarded-Host"].FirstOrDefault() ?? Request.Headers["Host"].FirstOrDefault() ?? Request.Host.Value;
        var baseUrl = $"{scheme}://{host}";
        var absolutePageUrl = $"{baseUrl}/playlists/{playlist.PlaylistId}";

        // 1. Caso a playlist seja PRIVADA: metadados restritos + CTA de cadastro
        if (playlist.Visibility != null && playlist.Visibility.Equals("Private", StringComparison.OrdinalIgnoreCase))
        {
            const string privateTitle = "Mixer 8 | Playlist Privada";
            const string privateDesc = "Esta playlist é privada. Cadastre-se no Mixer8 para criar suas próprias playlists e experimentar a mixagem digital baseada em stems com controle total!";
            
            var privateHtml = $$"""
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>{{WebUtility.HtmlEncode(privateTitle)}}</title>
                <meta name="description" content="{{WebUtility.HtmlEncode(privateDesc)}}">
                
                <!-- Open Graph -->
                <meta property="og:title" content="{{WebUtility.HtmlEncode(privateTitle)}}">
                <meta property="og:description" content="{{WebUtility.HtmlEncode(privateDesc)}}">
                <meta property="og:type" content="website">
                <meta property="og:url" content="{{WebUtility.HtmlEncode(absolutePageUrl)}}">
                <meta property="og:site_name" content="Mixer 8">

                <!-- Twitter -->
                <meta name="twitter:card" content="summary">
                <meta name="twitter:title" content="{{WebUtility.HtmlEncode(privateTitle)}}">
                <meta name="twitter:description" content="{{WebUtility.HtmlEncode(privateDesc)}}">
                
                <script>
                    // Redireciona usuários normais de volta para a rota da SPA
                    window.location.replace("{{absolutePageUrl}}");
                </script>
            </head>
            <body>
                <h1>{{WebUtility.HtmlEncode(privateTitle)}}</h1>
                <p>{{WebUtility.HtmlEncode(privateDesc)}}</p>
            </body>
            </html>
            """;

            return Content(privateHtml, "text/html; charset=utf-8");
        }

        // 2. Caso a playlist seja PÚBLICA ou NÃO LISTADA: carrega metadados ricos
        var ownerProfile = await dbContext.UserProfiles
            .FirstOrDefaultAsync(up => up.UserId == playlist.OwnerId);

        var ownerUser = await dbContext.Users
            .FirstOrDefaultAsync(u => u.UserId == playlist.OwnerId);

        // Formata o nome de exibição do criador
        var creatorName = GetOwnerDisplayName(
            ownerProfile?.FirstName,
            ownerProfile?.LastName,
            ownerProfile?.UserName,
            ownerUser?.Email
        );

        // Calcula informações de faixas e duração total
        var tracksCount = playlist.PlaylistTracks.Count;
        var totalSeconds = playlist.PlaylistTracks.Sum(pt => pt.Track?.Duration ?? 0);
        var totalMinutes = totalSeconds / 60;
        
        string totalDurationStr;
        if (totalMinutes >= 60)
        {
            var hours = totalMinutes / 60;
            var mins = totalMinutes % 60;
            totalDurationStr = $"{hours}h {mins}m";
        }
        else if (totalMinutes > 0)
        {
            totalDurationStr = $"{totalMinutes} min";
        }
        else
        {
            totalDurationStr = "0 min";
        }

        var tracksText = tracksCount == 1 ? "1 música" : $"{tracksCount} músicas";

        // Constrói a descrição da miniatura
        var playlistDesc = !string.IsNullOrWhiteSpace(playlist.Description) 
            ? playlist.Description.Trim() 
            : "Confira esta playlist exclusiva no Mixer8.";

        var metadataDescription = $"{playlistDesc} • Criador: {creatorName} • {tracksText} • {totalDurationStr}";
        var pageTitle = $"Mixer 8 | {playlist.Name}";

        // Resolve a URL da imagem de capa (deve ser absoluta)
        var coverUrl = playlist.CoverUrl;
        if (string.IsNullOrWhiteSpace(coverUrl))
        {
            // Fallback para a primeira faixa adicionada que possua capa
            coverUrl = playlist.PlaylistTracks
                .OrderBy(pt => pt.AddedAt)
                .Select(pt => pt.Track != null ? pt.Track.CoverUrl : null)
                .FirstOrDefault(c => !string.IsNullOrEmpty(c));
        }

        string absoluteCoverUrl;
        if (string.IsNullOrWhiteSpace(coverUrl))
        {
            absoluteCoverUrl = $"{baseUrl}/mixer8-logo.webp";
        }
        else if (coverUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase))
        {
            absoluteCoverUrl = coverUrl;
        }
        else
        {
            absoluteCoverUrl = $"{baseUrl}{(coverUrl.StartsWith('/') ? "" : "/")}{coverUrl}";
        }

        var dynamicHtml = $$"""
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>{{WebUtility.HtmlEncode(pageTitle)}}</title>
            <meta name="description" content="{{WebUtility.HtmlEncode(metadataDescription)}}">
            
            <!-- Open Graph -->
            <meta property="og:title" content="{{WebUtility.HtmlEncode(pageTitle)}}">
            <meta property="og:description" content="{{WebUtility.HtmlEncode(metadataDescription)}}">
            <meta property="og:type" content="music.playlist">
            <meta property="og:image" content="{{WebUtility.HtmlEncode(absoluteCoverUrl)}}">
            <meta property="og:url" content="{{WebUtility.HtmlEncode(absolutePageUrl)}}">
            <meta property="og:site_name" content="Mixer 8">

            <!-- Twitter -->
            <meta name="twitter:card" content="summary_large_image">
            <meta name="twitter:title" content="{{WebUtility.HtmlEncode(pageTitle)}}">
            <meta name="twitter:description" content="{{WebUtility.HtmlEncode(metadataDescription)}}">
            <meta name="twitter:image" content="{{WebUtility.HtmlEncode(absoluteCoverUrl)}}">
            
            <script>
                // Redireciona usuários normais de volta para a rota da SPA
                window.location.replace("{{absolutePageUrl}}");
            </script>
        </head>
        <body>
            <h1>{{WebUtility.HtmlEncode(pageTitle)}}</h1>
            <p>{{WebUtility.HtmlEncode(metadataDescription)}}</p>
            <img src="{{WebUtility.HtmlEncode(absoluteCoverUrl)}}" alt="Capa da Playlist">
        </body>
        </html>
        """;

        return Content(dynamicHtml, "text/html; charset=utf-8");
    }

    /// <summary>
    /// Retorna o nome amigável do criador seguindo a precedência: FirstName+LastName, FirstName, UserName, Email (sem o domínio).
    /// </summary>
    private static string GetOwnerDisplayName(string? firstName, string? lastName, string? userName, string? email)
    {
        if (!string.IsNullOrWhiteSpace(firstName) && !string.IsNullOrWhiteSpace(lastName))
        {
            return $"{firstName.Trim()} {lastName.Trim()}";
        }
        if (!string.IsNullOrWhiteSpace(firstName))
        {
            return firstName.Trim();
        }
        if (!string.IsNullOrWhiteSpace(userName))
        {
            return userName.Trim();
        }
        if (!string.IsNullOrWhiteSpace(email))
        {
            var part = email.Split('@')[0];
            if (part.Length > 0)
            {
                return char.ToUpper(part[0]) + part[1..];
            }
            return part;
        }
        return "Usuário";
    }
}
