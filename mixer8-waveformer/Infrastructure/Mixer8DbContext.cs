using Microsoft.EntityFrameworkCore;
using Mixer8.Waveformer.Domain;

namespace Mixer8.Waveformer.Infrastructure;

public class Mixer8DbContext(DbContextOptions<Mixer8DbContext> options) : DbContext(options)
{
    public DbSet<Stem> Stems { get; set; } = null!;
    public DbSet<StemWaveform> StemWaveforms { get; set; } = null!;
    public DbSet<SystemEvent> SystemEvents { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Stem>().ToTable("Stems");
        modelBuilder.Entity<StemWaveform>().ToTable("StemWaveforms");
        modelBuilder.Entity<SystemEvent>().ToTable("SystemEvents");

        modelBuilder.Entity<Stem>().HasKey(s => s.StemId);
        modelBuilder.Entity<StemWaveform>().HasKey(sw => sw.StemId);
        modelBuilder.Entity<SystemEvent>().HasKey(se => se.EventId);

        modelBuilder.Entity<Stem>()
            .HasOne(s => s.Waveform)
            .WithOne()
            .HasForeignKey<StemWaveform>(sw => sw.StemId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<StemWaveform>()
            .Property(sw => sw.Points)
            .HasColumnType("integer[]");
    }

    public async Task LogEventAsync(
        string category,
        string level,
        string message,
        string? details = null,
        Guid? trackId = null,
        Guid? userId = null,
        System.Threading.CancellationToken cancellationToken = default)
    {
        var evt = new SystemEvent
        {
            Category = category,
            Level = level,
            Message = message,
            Details = details,
            TrackId = trackId,
            UserId = userId
        };
        SystemEvents.Add(evt);
        await SaveChangesAsync(cancellationToken);
    }
}
