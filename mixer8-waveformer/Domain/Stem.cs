using System;

namespace Mixer8.Waveformer.Domain;

public class Stem
{
    public Guid StemId { get; set; } = Guid.NewGuid();
    public Guid TrackId { get; set; }
    public string StemType { get; set; } = null!;
    public string AudioUrl { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public virtual StemWaveform? Waveform { get; set; }
}
