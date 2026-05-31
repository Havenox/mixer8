using System;

namespace Mixer8.Api.Domain;

/// <summary>
/// Representa a relação de salvamento de playlists públicas de terceiros na biblioteca do usuário.
/// </summary>
public class SavedPlaylist
{
    public Guid SavedPlaylistId { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid PlaylistId { get; set; }
    public DateTime SavedAt { get; set; } = DateTime.UtcNow;
}
