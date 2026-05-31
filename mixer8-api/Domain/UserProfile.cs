using System;

namespace Mixer8.Api.Domain;

/// <summary>
/// Contém os metadados de perfil, preferências de notificação e imagem de avatar do usuário.
/// </summary>
public class UserProfile
{
    public Guid UserProfileId { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string? Name { get; set; }
    public string? Phone { get; set; }
    public DateTime? BirthDate { get; set; }
    public string? Bio { get; set; }
    public UserProfilePreferences Preferences { get; set; } = new();
    public string? AvatarUrl { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Preferências de perfil do usuário.
/// </summary>
public class UserProfilePreferences
{
    public NotificationPreferences Notifications { get; set; } = new();
}

/// <summary>
/// Definições de notificações de e-mail e push do usuário.
/// </summary>
public class NotificationPreferences
{
    public bool EmailOrders { get; set; } = true;
    public bool EmailComments { get; set; } = true;
    public bool EmailMarketing { get; set; } = true;
    public bool PushOrders { get; set; } = true;
    public bool PushComments { get; set; } = false;
}
