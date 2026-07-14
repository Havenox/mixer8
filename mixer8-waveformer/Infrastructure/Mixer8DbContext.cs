using Microsoft.EntityFrameworkCore;
using Mixer8.Waveformer.Domain;

namespace Mixer8.Waveformer.Infrastructure;

public class Mixer8DbContext(DbContextOptions<Mixer8DbContext> options) : DbContext(options)
{
    public DbSet<Stem> Stems { get; set; } = null!;
    public DbSet<StemWaveform> StemWaveforms { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Stem>().ToTable("Stems");
        modelBuilder.Entity<StemWaveform>().ToTable("StemWaveforms");

        modelBuilder.Entity<Stem>().HasKey(s => s.StemId);
        modelBuilder.Entity<StemWaveform>().HasKey(sw => sw.StemId);

        modelBuilder.Entity<Stem>()
            .HasOne(s => s.Waveform)
            .WithOne()
            .HasForeignKey<StemWaveform>(sw => sw.StemId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<StemWaveform>()
            .Property(sw => sw.Points)
            .HasColumnType("integer[]");
    }
}
