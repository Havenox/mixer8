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
    public string Visibility { get; set; } = "Public";

    public int Duration { get; set; } // Duração em segundos
    public long PlayCount { get; set; } = 0; // Contador de reproduções

    public Guid? AlbumId { get; set; }
    public int? TrackNumber { get; set; }
    public int DiscNumber { get; set; } = 1;

    public Album? Album { get; set; }

    public ICollection<Stem> Stems { get; set; } = new List<Stem>();
}
