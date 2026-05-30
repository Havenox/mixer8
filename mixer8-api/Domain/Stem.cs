using System;

namespace Mixer8.Api.Domain;

/// <summary>
/// Representa uma faixa/stem individual de áudio vinculada a uma música.
/// </summary>
public class Stem
{
    public Guid StemId { get; set; } = Guid.NewGuid();
    public Guid TrackId { get; set; }
    public string StemType { get; set; } = null!; // Vocals, Drums, Bass, Piano, Others
    public string AudioUrl { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
