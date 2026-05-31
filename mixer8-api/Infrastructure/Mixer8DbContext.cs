using Microsoft.EntityFrameworkCore;
using Mixer8.Api.Domain;

namespace Mixer8.Api.Infrastructure;

/// <summary>
/// Contexto de acesso ao banco relacional PostgreSQL do Mixer8.
/// </summary>
public class Mixer8DbContext(DbContextOptions<Mixer8DbContext> options) : DbContext(options)
{
    public DbSet<User> Users { get; set; } = null!;
    public DbSet<UserRole> UserRoles { get; set; } = null!;
    public DbSet<UserProfile> UserProfiles { get; set; } = null!;
    public DbSet<Track> Tracks { get; set; } = null!;
    public DbSet<Stem> Stems { get; set; } = null!;
    public DbSet<Playlist> Playlists { get; set; } = null!;
    public DbSet<PlaylistTrack> PlaylistTracks { get; set; } = null!;
    public DbSet<PlaylistCollaborator> PlaylistCollaborators { get; set; } = null!;
    public DbSet<SavedPlaylist> SavedPlaylists { get; set; } = null!;
    public DbSet<Album> Albums { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Mapeia nomes das tabelas de forma soberana (PascalCase)
        modelBuilder.Entity<User>().ToTable("Users");
        modelBuilder.Entity<UserRole>().ToTable("UserRoles");
        modelBuilder.Entity<UserProfile>().ToTable("UserProfiles");
        modelBuilder.Entity<Track>().ToTable("Tracks");
        modelBuilder.Entity<Stem>().ToTable("Stems");
        modelBuilder.Entity<Playlist>().ToTable("Playlists");
        modelBuilder.Entity<PlaylistTrack>().ToTable("PlaylistTracks");
        modelBuilder.Entity<PlaylistCollaborator>().ToTable("PlaylistCollaborators");
        modelBuilder.Entity<SavedPlaylist>().ToTable("SavedPlaylists");
        modelBuilder.Entity<Album>().ToTable("Albums");

        // Chaves primárias
        modelBuilder.Entity<User>().HasKey(u => u.UserId);
        modelBuilder.Entity<UserRole>().HasKey(ur => ur.UserRoleId);
        modelBuilder.Entity<UserProfile>().HasKey(up => up.UserProfileId);
        modelBuilder.Entity<Track>().HasKey(t => t.TrackId);
        modelBuilder.Entity<Stem>().HasKey(s => s.StemId);
        modelBuilder.Entity<Playlist>().HasKey(p => p.PlaylistId);
        modelBuilder.Entity<PlaylistTrack>().HasKey(pt => new { pt.PlaylistId, pt.TrackId });
        modelBuilder.Entity<PlaylistCollaborator>().HasKey(pc => new { pc.PlaylistId, pc.UserId });
        modelBuilder.Entity<SavedPlaylist>().HasKey(sp => sp.SavedPlaylistId);
        modelBuilder.Entity<Album>().HasKey(a => a.AlbumId);

        // Configura relacionamentos 1-para-1
        modelBuilder.Entity<User>()
            .HasOne(u => u.UserRole)
            .WithOne()
            .HasForeignKey<UserRole>(ur => ur.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<User>()
            .HasOne(u => u.UserProfile)
            .WithOne()
            .HasForeignKey<UserProfile>(up => up.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<UserProfile>()
            .HasIndex(up => up.UserName)
            .IsUnique();

        modelBuilder.Entity<SavedPlaylist>()
            .HasOne<User>()
            .WithMany()
            .HasForeignKey(sp => sp.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<SavedPlaylist>()
            .HasOne<Playlist>()
            .WithMany()
            .HasForeignKey(sp => sp.PlaylistId)
            .OnDelete(DeleteBehavior.Cascade);

        // Mapear preferências do perfil de usuário em formato JSON
        modelBuilder.Entity<UserProfile>()
            .OwnsOne(up => up.Preferences, builder =>
            {
                builder.ToJson();
                builder.OwnsOne(p => p.Notifications);
            });

        // Configura relacionamentos das faixas e stems
        modelBuilder.Entity<Track>()
            .HasMany(t => t.Stems)
            .WithOne()
            .HasForeignKey(s => s.TrackId)
            .OnDelete(DeleteBehavior.Cascade);

        // Configura relacionamento Track-Album
        modelBuilder.Entity<Track>()
            .HasOne(t => t.Album)
            .WithMany(a => a.Tracks)
            .HasForeignKey(t => t.AlbumId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<Playlist>()
            .HasOne<User>()
            .WithMany()
            .HasForeignKey(p => p.OwnerId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PlaylistTrack>()
            .HasOne(pt => pt.Playlist)
            .WithMany(p => p.PlaylistTracks)
            .HasForeignKey(pt => pt.PlaylistId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PlaylistTrack>()
            .HasOne(pt => pt.Track)
            .WithMany()
            .HasForeignKey(pt => pt.TrackId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PlaylistTrack>()
            .HasOne(pt => pt.AddedByUser)
            .WithMany()
            .HasForeignKey(pt => pt.AddedById)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<PlaylistCollaborator>()
            .HasOne(pc => pc.Playlist)
            .WithMany(p => p.PlaylistCollaborators)
            .HasForeignKey(pc => pc.PlaylistId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PlaylistCollaborator>()
            .HasOne(pc => pc.User)
            .WithMany()
            .HasForeignKey(pc => pc.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
