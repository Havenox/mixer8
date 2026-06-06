using Microsoft.EntityFrameworkCore;
using Mixer8.Downloader.Domain;

namespace Mixer8.Downloader.Infrastructure;

public class Mixer8DbContext(DbContextOptions<Mixer8DbContext> options) : DbContext(options)
{
    public DbSet<User> Users { get; set; } = null!;
    public DbSet<Track> Tracks { get; set; } = null!;
    public DbSet<Stem> Stems { get; set; } = null!;
    public DbSet<SystemSetting> SystemSettings { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>().ToTable("Users");
        modelBuilder.Entity<Track>().ToTable("Tracks");
        modelBuilder.Entity<Stem>().ToTable("Stems");
        modelBuilder.Entity<SystemSetting>().ToTable("SystemSettings");

        modelBuilder.Entity<User>().HasKey(u => u.UserId);
        modelBuilder.Entity<Track>().HasKey(t => t.TrackId);
        modelBuilder.Entity<Stem>().HasKey(s => s.StemId);
        modelBuilder.Entity<SystemSetting>().HasKey(s => s.Key);

        modelBuilder.Entity<Track>()
            .HasMany(t => t.Stems)
            .WithOne()
            .HasForeignKey(s => s.TrackId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
