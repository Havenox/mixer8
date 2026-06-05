using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mixer8.Api.Domain;
using Mixer8.Api.Infrastructure;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace Mixer8.Api.Controllers;

/// <summary>
/// Controlador público para exibir os dados da página principal (Explorar)
/// de forma segura para anônimos e logados, sem risco de scraping massivo.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[AllowAnonymous]
public class ExploreController(Mixer8DbContext dbContext) : ControllerBase
{
    /// <summary>
    /// Retorna exatamente as 6 faixas públicas mais tocadas da semana.
    /// </summary>
    [HttpGet("WeeklyTrends")]
    public async Task<IActionResult> GetExploreWeeklyTrends()
    {
        var tracks = await dbContext.Tracks
            .Include(t => t.Stems)
            .Where(t => !t.DeletionPending && t.Visibility == "Public")
            .OrderByDescending(t => t.WeekPlayCount)
            .Take(6)
            .ToListAsync();

        return Ok(tracks);
    }

    /// <summary>
    /// Retorna as 6 playlists públicas mais ouvidas, com dados dinâmicos do usuário
    /// se autenticado de forma opcional (IsSaved, IsOwner, IsCollaborator).
    /// </summary>
    [HttpGet("PopularPlaylists")]
    public async Task<IActionResult> GetExplorePopularPlaylists()
    {
        Guid? userId = null;
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim != null && Guid.TryParse(userIdClaim, out var parsedUserId))
        {
            userId = parsedUserId;
        }

        var isAdmin = userId.HasValue && User.IsInRole("Admin");

        // Busca apenas as playlists públicas do sistema ordenadas por reproduções
        var query = dbContext.Playlists
            .Include(p => p.PlaylistTracks)
                .ThenInclude(pt => pt.Track)
            .Include(p => p.PlaylistCollaborators)
            .AsSplitQuery()
            .Where(p => p.Visibility == "Public")
            .OrderByDescending(p => p.PlayCount);

        var playlists = await query.Take(6).ToListAsync();

        var userIds = playlists.Select(p => p.OwnerId).Distinct().ToList();
        var userEmails = await dbContext.Users
            .Where(u => userIds.Contains(u.UserId))
            .ToDictionaryAsync(u => u.UserId, u => u.Email);

        var userProfiles = await dbContext.UserProfiles
            .Where(up => userIds.Contains(up.UserId))
            .ToDictionaryAsync(up => up.UserId, up => up);

        // Carrega IDs das playlists salvas pelo usuário se estiver logado
        List<Guid> savedPlaylistIds = new();
        if (userId.HasValue)
        {
            savedPlaylistIds = await dbContext.SavedPlaylists
                .Where(sp => sp.UserId == userId.Value)
                .Select(sp => sp.PlaylistId)
                .ToListAsync();
        }

        var result = playlists.Select(p =>
        {
            var firstTrackCover = p.PlaylistTracks
                .OrderBy(pt => pt.AddedAt)
                .Select(pt => pt.Track.CoverUrl)
                .FirstOrDefault();

            userEmails.TryGetValue(p.OwnerId, out var email);
            userProfiles.TryGetValue(p.OwnerId, out var profile);

            return new PlaylistResponseDto
            {
                PlaylistId = p.PlaylistId,
                Name = p.Name,
                Visibility = p.Visibility,
                Description = p.Description,
                OwnerId = p.OwnerId,
                OwnerEmail = email ?? "",
                CoverUrl = p.CoverUrl ?? firstTrackCover,
                CreatedAt = p.CreatedAt,
                IsOwner = userId.HasValue && p.OwnerId == userId.Value,
                IsCollaborator = userId.HasValue && p.PlaylistCollaborators.Any(pc => pc.UserId == userId.Value),
                IsSaved = userId.HasValue && savedPlaylistIds.Contains(p.PlaylistId),
                TracksCount = p.PlaylistTracks.Count(pt => IsTrackVisible(pt.Track, p, userId, isAdmin)),
                OwnerUserName = profile?.UserName,
                OwnerFirstName = profile?.FirstName,
                OwnerLastName = profile?.LastName,
                OwnerAvatarUrl = profile?.AvatarUrl
            };
        }).ToList();

        return Ok(result);
    }

    private static bool IsTrackVisible(Track track, Playlist playlist, Guid? userId, bool isAdmin)
    {
        if (track.DeletionPending) return isAdmin;
        if (track.Visibility == "Public") return true;

        if (track.Visibility == "Unlisted")
        {
            if (playlist.Visibility == "Unlisted") return true;
            if (userId == null) return false;
            return track.UploadedBy == userId.Value || 
                   isAdmin || 
                   playlist.OwnerId == userId.Value || 
                   playlist.PlaylistCollaborators.Any(pc => pc.UserId == userId.Value);
        }

        if (userId == null) return false;
        if (track.UploadedBy == userId.Value || isAdmin) return true;
        return false;
    }
}
