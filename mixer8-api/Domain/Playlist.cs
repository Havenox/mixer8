using System;
using System.Collections.Generic;

namespace Mixer8.Api.Domain;

/// <summary>
/// Representa uma playlist de músicas criada por um usuário.
/// </summary>
public class Playlist
{
    public Guid PlaylistId { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = null!;
    public string Visibility { get; set; } = "Public"; // Public, Private, Unlisted
    public Guid OwnerId { get; set; }
    public string? CoverUrl { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<PlaylistTrack> PlaylistTracks { get; set; } = new List<PlaylistTrack>();
    public ICollection<PlaylistCollaborator> PlaylistCollaborators { get; set; } = new List<PlaylistCollaborator>();
}
