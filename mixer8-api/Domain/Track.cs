using System;
using System.Collections.Generic;

namespace Mixer8.Api.Domain;

/// <summary>
/// Representa uma música na biblioteca contendo suas respectivas stems.
/// </summary>
public class Track
{
    public Guid TrackId { get; set; } = Guid.NewGuid();
    public string TrackTitle { get; set; } = null!;
    public string ArtistName { get; set; } = null!;
    public Guid UploadedBy { get; set; }
    public string ExtractionStatus { get; set; } = "Aguardando"; // Aguardando, Processando, Pronto, Falhou
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string? CoverUrl { get; set; }

    public ICollection<Stem> Stems { get; set; } = new List<Stem>();
}
