using System;
using System.Collections.Generic;

namespace Mixer8.Api.Domain;

/// <summary>
/// Representa a forma de onda (waveform) calculada de uma stem individual.
/// </summary>
public class StemWaveform
{
    public Guid StemId { get; set; }
    public List<int> Points { get; set; } = new();
}
