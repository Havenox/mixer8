using System;

namespace Mixer8.Api.Domain;

/// <summary>
/// Representa as funções de acesso disponíveis para os usuários (RBAC).
/// </summary>
public enum UserRoleType
{
    Admin,
    Moderator,
    PaidUser,
    User
}

/// <summary>
/// Mapeia o papel de controle de acesso (Role) atribuído a um usuário.
/// </summary>
public class UserRole
{
    public Guid UserRoleId { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public UserRoleType Role { get; set; } = UserRoleType.User;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
