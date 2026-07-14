using System;
using System.Collections.Generic;

namespace Mixer8.Waveformer.Domain;

public class StemWaveform
{
    public Guid StemId { get; set; }
    public List<int> Points { get; set; } = new();
}
