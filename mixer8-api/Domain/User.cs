using System;

namespace Mixer8.Api.Domain;

/// <summary>
/// Representa a credencial de segurança e status principal do usuário no sistema.
/// </summary>
public class User
{
    public Guid UserId { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Propriedades de navegação em relacionamento 1-para-1
    public virtual UserRole UserRole { get; set; } = null!;
    public virtual UserProfile UserProfile { get; set; } = null!;
}
