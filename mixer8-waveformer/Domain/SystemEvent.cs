using System;

namespace Mixer8.Waveformer.Domain;

public class SystemEvent
{
    public Guid EventId { get; set; } = Guid.NewGuid();
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string Category { get; set; } = null!;
    public string Level { get; set; } = null!;
    public string Message { get; set; } = null!;
    public string? Details { get; set; }
    public Guid? TrackId { get; set; }
    public Guid? UserId { get; set; }
}
