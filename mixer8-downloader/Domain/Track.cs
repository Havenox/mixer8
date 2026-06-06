using System;
using System.Collections.Generic;

namespace Mixer8.Downloader.Domain;

public class Track
{
    public Guid TrackId { get; set; }
    public string TrackTitle { get; set; } = null!;
    public string ArtistName { get; set; } = null!;
    public Guid UploadedBy { get; set; }
    public string ExtractionStatus { get; set; } = "Aguardando"; // Aguardando, Processando, Pronto, Falhou
    public DateTime CreatedAt { get; set; }
    public string? CoverUrl { get; set; }
    public string? DownloadUrl { get; set; }
    public int Duration { get; set; } // Duração em segundos
    public string Visibility { get; set; } = "Public";
    public bool DeletionPending { get; set; } = false;
    public string? DeletionReason { get; set; }

    public ICollection<Stem> Stems { get; set; } = new List<Stem>();
}
