using System;

namespace Mixer8.Api.Domain;

/// <summary>
/// Log individual de reprodução para contabilidade de tendências temporais.
/// </summary>
public class TrackPlay
{
    public Guid TrackPlayId { get; set; } = Guid.NewGuid();
    public Guid TrackId { get; set; }
    public DateTime PlayedAt { get; set; } = DateTime.UtcNow;

    public Track Track { get; set; } = null!;
}
