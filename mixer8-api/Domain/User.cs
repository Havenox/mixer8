using System;

namespace Mixer8.Api.Domain;

/// <summary>
/// Representa a entidade de Usuário no sistema com controle RBAC.
/// </summary>
public class User
{
    public Guid UserId { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public string UserRole { get; set; } = "User"; // Admin, Moderator, PaidUser, User
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
