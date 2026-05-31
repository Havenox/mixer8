using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mixer8.Api.Domain;
using Mixer8.Api.Infrastructure;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace Mixer8.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PlaylistsController(Mixer8DbContext dbContext) : ControllerBase
{
    [HttpPost]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> CreatePlaylist([FromForm] CreatePlaylistRequest request)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized(new { ErrorMessage = "INVALID_TOKEN_CLAIMS" });

        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { ErrorMessage = "PLAYLIST_NAME_REQUIRED" });

        var visibility = request.Visibility?.Trim() ?? "Public";
        if (visibility != "Public" && visibility != "Private" && visibility != "Unlisted")
            return BadRequest(new { ErrorMessage = "INVALID_VISIBILITY_VALUE" });

        var playlist = new Playlist
        {
            PlaylistId = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Visibility = visibility,
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            OwnerId = userId,
            CreatedAt = DateTime.UtcNow
        };

        // Salvar arquivo físico de capa se fornecido
        if (request.CoverFile != null && request.CoverFile.Length > 0)
        {
            var playlistDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "playlists", playlist.PlaylistId.ToString());
            if (!Directory.Exists(playlistDir))
            {
                Directory.CreateDirectory(playlistDir);
            }

            var ext = Path.GetExtension(request.CoverFile.FileName).ToLowerInvariant();
            var allowedExtensions = new[] { ".png", ".jpg", ".jpeg", ".webp" };
            if (allowedExtensions.Contains(ext))
            {
                var coverFileName = $"cover{ext}";
                var coverPath = Path.Combine(playlistDir, coverFileName);

                using (var stream = new FileStream(coverPath, FileMode.Create))
                {
                    await request.CoverFile.CopyToAsync(stream);
                }

                playlist.CoverUrl = $"/playlists/{playlist.PlaylistId}/{coverFileName}";
            }
        }

        dbContext.Playlists.Add(playlist);
        await dbContext.SaveChangesAsync();

        var ownerEmail = await dbContext.Users
            .Where(u => u.UserId == userId)
            .Select(u => u.Email)
            .FirstOrDefaultAsync() ?? "";

        return Ok(new PlaylistResponseDto
        {
            PlaylistId = playlist.PlaylistId,
            Name = playlist.Name,
            Visibility = playlist.Visibility,
            Description = playlist.Description,
            OwnerId = playlist.OwnerId,
            OwnerEmail = ownerEmail,
            CoverUrl = playlist.CoverUrl,
            CreatedAt = playlist.CreatedAt,
            IsOwner = true,
            IsCollaborator = false,
            TracksCount = 0
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetPlaylists()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized(new { ErrorMessage = "INVALID_TOKEN_CLAIMS" });

        var isAdmin = User.IsInRole("Admin");

        var playlistsQuery = dbContext.Playlists
            .Include(p => p.PlaylistTracks)
                .ThenInclude(pt => pt.Track)
            .Include(p => p.PlaylistCollaborators)
            .AsSplitQuery() // Otimiza a performance evitando produto cartesiano em múltiplas coleções
            .AsQueryable();

        // Se for admin, lista todas. Caso contrário, lista as que ele é dono, colaborador, ou públicas.
        if (!isAdmin)
        {
            playlistsQuery = playlistsQuery.Where(p =>
                p.OwnerId == userId ||
                p.PlaylistCollaborators.Any(pc => pc.UserId == userId) ||
                p.Visibility == "Public"
            );
        }

        var playlists = await playlistsQuery.ToListAsync();

        var userIds = playlists.Select(p => p.OwnerId).Distinct().ToList();
        var userEmails = await dbContext.Users
            .Where(u => userIds.Contains(u.UserId))
            .ToDictionaryAsync(u => u.UserId, u => u.Email);

        var result = playlists.Select(p =>
        {
            var firstTrackCover = p.PlaylistTracks
                .OrderBy(pt => pt.AddedAt)
                .Select(pt => pt.Track.CoverUrl)
                .FirstOrDefault();

            userEmails.TryGetValue(p.OwnerId, out var email);

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
                IsOwner = p.OwnerId == userId,
                IsCollaborator = p.PlaylistCollaborators.Any(pc => pc.UserId == userId),
                TracksCount = p.PlaylistTracks.Count
            };
        })
        .OrderByDescending(p => p.CreatedAt)
        .ToList();

        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetPlaylistById(Guid id)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized(new { ErrorMessage = "INVALID_TOKEN_CLAIMS" });

        var isAdmin = User.IsInRole("Admin");

        var playlist = await dbContext.Playlists
            .Include(p => p.PlaylistTracks)
                .ThenInclude(pt => pt.Track)
                    .ThenInclude(t => t.Stems)
            .Include(p => p.PlaylistTracks)
                .ThenInclude(pt => pt.AddedByUser)
            .Include(p => p.PlaylistCollaborators)
                .ThenInclude(pc => pc.User)
            .AsSplitQuery() // Otimiza a performance evitando produto cartesiano em múltiplas coleções
            .FirstOrDefaultAsync(p => p.PlaylistId == id);

        if (playlist == null)
            return NotFound(new { ErrorMessage = "PLAYLIST_NOT_FOUND" });

        var isOwner = playlist.OwnerId == userId;
        var isCollaborator = playlist.PlaylistCollaborators.Any(pc => pc.UserId == userId);

        // Se for privada e não for dono/colaborador/admin, nega acesso
        if (playlist.Visibility == "Private" && !isOwner && !isCollaborator && !isAdmin)
            return Forbid();

        var ownerEmail = await dbContext.Users
            .Where(u => u.UserId == playlist.OwnerId)
            .Select(u => u.Email)
            .FirstOrDefaultAsync() ?? "";

        var firstTrackCover = playlist.PlaylistTracks
            .OrderBy(pt => pt.AddedAt)
            .Select(pt => pt.Track.CoverUrl)
            .FirstOrDefault();

        var detailDto = new PlaylistDetailResponseDto
        {
            PlaylistId = playlist.PlaylistId,
            Name = playlist.Name,
            Visibility = playlist.Visibility,
            Description = playlist.Description,
            OwnerId = playlist.OwnerId,
            OwnerEmail = ownerEmail,
            CoverUrl = playlist.CoverUrl ?? firstTrackCover,
            CreatedAt = playlist.CreatedAt,
            IsOwner = isOwner,
            IsCollaborator = isCollaborator,
            Tracks = playlist.PlaylistTracks
                .OrderBy(pt => pt.AddedAt)
                .Select(pt => new PlaylistTrackResponseDto
                {
                    TrackId = pt.TrackId,
                    TrackTitle = pt.Track.TrackTitle,
                    ArtistName = pt.Track.ArtistName,
                    CoverUrl = pt.Track.CoverUrl,
                    AddedById = pt.AddedById,
                    AddedByEmail = pt.AddedByUser != null ? pt.AddedByUser.Email : "",
                    AddedAt = pt.AddedAt,
                    Stems = pt.Track.Stems.Select(s => new PlaylistStemResponseDto
                    {
                        StemId = s.StemId,
                        TrackId = s.TrackId,
                        StemType = s.StemType,
                        AudioUrl = s.AudioUrl
                    }).ToList()
                }).ToList(),
            Collaborators = playlist.PlaylistCollaborators.Select(pc => new PlaylistCollaboratorResponseDto
            {
                UserId = pc.UserId,
                Email = pc.User.Email,
                AddedAt = pc.AddedAt
            }).ToList()
        };

        return Ok(detailDto);
    }

    [HttpPut("{id}")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UpdatePlaylist(Guid id, [FromForm] UpdatePlaylistRequest request)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized(new { ErrorMessage = "INVALID_TOKEN_CLAIMS" });

        var playlist = await dbContext.Playlists.FindAsync(id);
        if (playlist == null)
            return NotFound(new { ErrorMessage = "PLAYLIST_NOT_FOUND" });

        var isAdmin = User.IsInRole("Admin");
        if (playlist.OwnerId != userId && !isAdmin)
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { ErrorMessage = "PLAYLIST_NAME_REQUIRED" });

        var visibility = request.Visibility?.Trim();
        if (visibility != null && visibility != "Public" && visibility != "Private" && visibility != "Unlisted")
            return BadRequest(new { ErrorMessage = "INVALID_VISIBILITY_VALUE" });

        playlist.Name = request.Name.Trim();
        if (visibility != null)
            playlist.Visibility = visibility;

        playlist.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();

        // Gerenciar exclusão física da capa anterior se solicitado ou ao substituir por novo arquivo
        if (request.DeleteCover || (request.CoverFile != null && request.CoverFile.Length > 0))
        {
            if (!string.IsNullOrWhiteSpace(playlist.CoverUrl) && playlist.CoverUrl.StartsWith("/playlists/"))
            {
                var oldPhysicalPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", playlist.CoverUrl.TrimStart('/'));
                if (System.IO.File.Exists(oldPhysicalPath))
                {
                    try
                    {
                        System.IO.File.Delete(oldPhysicalPath);
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[DELETE COVER ERROR] Falha ao deletar capa física antiga: {ex.Message}");
                    }
                }
            }

            playlist.CoverUrl = null;
        }

        // Salvar novo arquivo físico de capa se fornecido
        if (request.CoverFile != null && request.CoverFile.Length > 0)
        {
            var playlistDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "playlists", id.ToString());
            if (!Directory.Exists(playlistDir))
            {
                Directory.CreateDirectory(playlistDir);
            }

            var ext = Path.GetExtension(request.CoverFile.FileName).ToLowerInvariant();
            var allowedExtensions = new[] { ".png", ".jpg", ".jpeg", ".webp" };
            if (allowedExtensions.Contains(ext))
            {
                var coverFileName = $"cover{ext}";
                var coverPath = Path.Combine(playlistDir, coverFileName);

                using (var stream = new FileStream(coverPath, FileMode.Create))
                {
                    await request.CoverFile.CopyToAsync(stream);
                }

                playlist.CoverUrl = $"/playlists/{id}/{coverFileName}";
            }
        }

        await dbContext.SaveChangesAsync();
        return Ok(playlist);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeletePlaylist(Guid id)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized(new { ErrorMessage = "INVALID_TOKEN_CLAIMS" });

        var playlist = await dbContext.Playlists.FindAsync(id);
        if (playlist == null)
            return NotFound(new { ErrorMessage = "PLAYLIST_NOT_FOUND" });

        var isAdmin = User.IsInRole("Admin");
        if (playlist.OwnerId != userId && !isAdmin)
            return Forbid();

        // Deletar fisicamente a pasta de arquivos customizados da playlist
        if (!string.IsNullOrWhiteSpace(playlist.CoverUrl) && playlist.CoverUrl.StartsWith("/playlists/"))
        {
            var playlistDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "playlists", id.ToString());
            if (Directory.Exists(playlistDir))
            {
                try
                {
                    Directory.Delete(playlistDir, true);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[DELETE PLAYLIST DIR ERROR] Falha ao deletar pasta física da playlist: {ex.Message}");
                }
            }
        }

        dbContext.Playlists.Remove(playlist);
        await dbContext.SaveChangesAsync();
        return Ok(new { Success = true });
    }

    [HttpPost("{id}/Tracks")]
    public async Task<IActionResult> AddTrackToPlaylist(Guid id, [FromBody] AddTrackDto request)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized(new { ErrorMessage = "INVALID_TOKEN_CLAIMS" });

        var playlist = await dbContext.Playlists
            .Include(p => p.PlaylistCollaborators)
            .FirstOrDefaultAsync(p => p.PlaylistId == id);

        if (playlist == null)
            return NotFound(new { ErrorMessage = "PLAYLIST_NOT_FOUND" });

        var isOwner = playlist.OwnerId == userId;
        var isCollaborator = playlist.PlaylistCollaborators.Any(pc => pc.UserId == userId);
        var isAdmin = User.IsInRole("Admin");

        if (!isOwner && !isCollaborator && !isAdmin)
            return Forbid();

        var trackExists = await dbContext.Tracks.AnyAsync(t => t.TrackId == request.TrackId);
        if (!trackExists)
            return BadRequest(new { ErrorMessage = "TRACK_NOT_FOUND" });

        var alreadyInPlaylist = await dbContext.PlaylistTracks
            .AnyAsync(pt => pt.PlaylistId == id && pt.TrackId == request.TrackId);

        if (alreadyInPlaylist)
            return BadRequest(new { ErrorMessage = "TRACK_ALREADY_IN_PLAYLIST" });

        var playlistTrack = new PlaylistTrack
        {
            PlaylistId = id,
            TrackId = request.TrackId,
            AddedById = userId,
            AddedAt = DateTime.UtcNow
        };

        dbContext.PlaylistTracks.Add(playlistTrack);
        await dbContext.SaveChangesAsync();

        return Ok(new { Success = true });
    }

    [HttpDelete("{id}/Tracks/{trackId}")]
    public async Task<IActionResult> RemoveTrackFromPlaylist(Guid id, Guid trackId)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized(new { ErrorMessage = "INVALID_TOKEN_CLAIMS" });

        var playlist = await dbContext.Playlists.FindAsync(id);
        if (playlist == null)
            return NotFound(new { ErrorMessage = "PLAYLIST_NOT_FOUND" });

        var playlistTrack = await dbContext.PlaylistTracks
            .FirstOrDefaultAsync(pt => pt.PlaylistId == id && pt.TrackId == trackId);

        if (playlistTrack == null)
            return NotFound(new { ErrorMessage = "TRACK_NOT_FOUND_IN_PLAYLIST" });

        var isOwner = playlist.OwnerId == userId;
        var isAddedByCurrentUser = playlistTrack.AddedById == userId;
        var isAdmin = User.IsInRole("Admin");

        // Somente o dono da playlist, o colaborador que adicionou a música, ou admins podem remover a música
        if (!isOwner && !isAddedByCurrentUser && !isAdmin)
            return Forbid();

        dbContext.PlaylistTracks.Remove(playlistTrack);
        await dbContext.SaveChangesAsync();

        return Ok(new { Success = true });
    }

    [HttpPost("{id}/Collaborators")]
    public async Task<IActionResult> AddCollaborator(Guid id, [FromBody] AddCollaboratorDto request)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
            return Unauthorized(new { ErrorMessage = "INVALID_TOKEN_CLAIMS" });

        var playlist = await dbContext.Playlists.FindAsync(id);
        if (playlist == null)
            return NotFound(new { ErrorMessage = "PLAYLIST_NOT_FOUND" });

        var isOwner = playlist.OwnerId == userId;
        var isAdmin = User.IsInRole("Admin");

        if (!isOwner && !isAdmin)
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.Email))
            return BadRequest(new { ErrorMessage = "EMAIL_REQUIRED" });

        var targetUser = await dbContext.Users
            .FirstOrDefaultAsync(u => u.Email == request.Email.ToLower().Trim());

        if (targetUser == null)
            return BadRequest(new { ErrorMessage = "USER_NOT_FOUND" });

        if (targetUser.UserId == playlist.OwnerId)
            return BadRequest(new { ErrorMessage = "CANNOT_ADD_OWNER_AS_COLLABORATOR" });

        var alreadyCollaborator = await dbContext.PlaylistCollaborators
            .AnyAsync(pc => pc.PlaylistId == id && pc.UserId == targetUser.UserId);

        if (alreadyCollaborator)
            return BadRequest(new { ErrorMessage = "ALREADY_COLLABORATOR" });

        var collaborator = new PlaylistCollaborator
        {
            PlaylistId = id,
            UserId = targetUser.UserId,
            AddedAt = DateTime.UtcNow
        };

        dbContext.PlaylistCollaborators.Add(collaborator);
        await dbContext.SaveChangesAsync();

        return Ok(new PlaylistCollaboratorResponseDto
        {
            UserId = targetUser.UserId,
            Email = targetUser.Email,
            AddedAt = collaborator.AddedAt
        });
    }

    [HttpDelete("{id}/Collaborators/{userId}")]
    public async Task<IActionResult> RemoveCollaborator(Guid id, Guid userId)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var currentUserId))
            return Unauthorized(new { ErrorMessage = "INVALID_TOKEN_CLAIMS" });

        var playlist = await dbContext.Playlists.FindAsync(id);
        if (playlist == null)
            return NotFound(new { ErrorMessage = "PLAYLIST_NOT_FOUND" });

        var isOwner = playlist.OwnerId == currentUserId;
        var isAdmin = User.IsInRole("Admin");

        if (!isOwner && !isAdmin)
            return Forbid();

        var collaborator = await dbContext.PlaylistCollaborators
            .FirstOrDefaultAsync(pc => pc.PlaylistId == id && pc.UserId == userId);

        if (collaborator == null)
            return NotFound(new { ErrorMessage = "COLLABORATOR_NOT_FOUND" });

        dbContext.PlaylistCollaborators.Remove(collaborator);
        await dbContext.SaveChangesAsync();

        return Ok(new { Success = true });
    }
}

public class CreatePlaylistRequest
{
    public string Name { get; set; } = null!;
    public string? Visibility { get; set; }
    public string? Description { get; set; }
    public IFormFile? CoverFile { get; set; }
}

public class UpdatePlaylistRequest
{
    public string Name { get; set; } = null!;
    public string? Visibility { get; set; }
    public string? Description { get; set; }
    public IFormFile? CoverFile { get; set; }
    public bool DeleteCover { get; set; }
}

public class AddTrackDto
{
    public Guid TrackId { get; set; }
}

public class AddCollaboratorDto
{
    public string Email { get; set; } = null!;
}

public class PlaylistResponseDto
{
    public Guid PlaylistId { get; set; }
    public string Name { get; set; } = null!;
    public string Visibility { get; set; } = null!;
    public string? Description { get; set; }
    public Guid OwnerId { get; set; }
    public string OwnerEmail { get; set; } = null!;
    public string? CoverUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool IsOwner { get; set; }
    public bool IsCollaborator { get; set; }
    public int TracksCount { get; set; }
}

public class PlaylistDetailResponseDto
{
    public Guid PlaylistId { get; set; }
    public string Name { get; set; } = null!;
    public string Visibility { get; set; } = null!;
    public string? Description { get; set; }
    public Guid OwnerId { get; set; }
    public string OwnerEmail { get; set; } = null!;
    public string? CoverUrl { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool IsOwner { get; set; }
    public bool IsCollaborator { get; set; }
    public List<PlaylistTrackResponseDto> Tracks { get; set; } = new();
    public List<PlaylistCollaboratorResponseDto> Collaborators { get; set; } = new();
}

public class PlaylistTrackResponseDto
{
    public Guid TrackId { get; set; }
    public string TrackTitle { get; set; } = null!;
    public string ArtistName { get; set; } = null!;
    public string? CoverUrl { get; set; }
    public Guid AddedById { get; set; }
    public string AddedByEmail { get; set; } = null!;
    public DateTime AddedAt { get; set; }
    public List<PlaylistStemResponseDto> Stems { get; set; } = new();
}

public class PlaylistStemResponseDto
{
    public Guid StemId { get; set; }
    public Guid TrackId { get; set; }
    public string StemType { get; set; } = null!;
    public string AudioUrl { get; set; } = null!;
}

public class PlaylistCollaboratorResponseDto
{
    public Guid UserId { get; set; }
    public string Email { get; set; } = null!;
    public DateTime AddedAt { get; set; }
}
