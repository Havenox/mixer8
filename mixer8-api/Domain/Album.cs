using System;
using System.Collections.Generic;

namespace Mixer8.Api.Domain;

/// <summary>
/// Representa um álbum na biblioteca contendo suas respectivas faixas.
/// </summary>
public class Album
{
    public Guid AlbumId { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = null!;
    public string ArtistName { get; set; } = null!;
    public DateTime ReleaseDate { get; set; }
    public string? CoverUrl { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public long PlayCount { get; set; } = 0;

    public ICollection<Track> Tracks { get; set; } = new List<Track>();
}
