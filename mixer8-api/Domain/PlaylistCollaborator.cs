using System;

namespace Mixer8.Api.Domain;

/// <summary>
/// Representa um colaborador autorizado a adicionar músicas a uma playlist de outro usuário.
/// </summary>
public class PlaylistCollaborator
{
    public Guid PlaylistId { get; set; }
    public Guid UserId { get; set; }
    public DateTime AddedAt { get; set; } = DateTime.UtcNow;

    public Playlist Playlist { get; set; } = null!;
    public User User { get; set; } = null!;
}
