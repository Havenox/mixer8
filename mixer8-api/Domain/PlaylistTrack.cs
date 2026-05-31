using System;

namespace Mixer8.Api.Domain;

/// <summary>
/// Tabela de junção muitos-para-muitos entre Playlists e Tracks, registrando quem adicionou e quando.
/// </summary>
public class PlaylistTrack
{
    public Guid PlaylistId { get; set; }
    public Guid TrackId { get; set; }
    public Guid AddedById { get; set; }
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;

    public int Order { get; set; }

    public Playlist Playlist { get; set; } = null!;
    public Track Track { get; set; } = null!;
    public User AddedByUser { get; set; } = null!;
}
