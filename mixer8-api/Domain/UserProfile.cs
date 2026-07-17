using System;

namespace Mixer8.Api.Domain;

/// <summary>
/// Contém os metadados de perfil, preferências de notificação e imagem de avatar do usuário.
/// </summary>
public class UserProfile
{
    public Guid UserProfileId { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string UserName { get; set; } = null!;
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Phone { get; set; }
    public DateTime? BirthDate { get; set; }
    public string? Bio { get; set; }
    public UserProfilePreferences Preferences { get; set; } = new();
    public string AudioEngineMode { get; set; } = "Power"; // "Power" (WASM SIMD - Alta Fidelidade) ou "Lite" (Aceleração Nativa)
    public string? AvatarUrl { get; set; }
    public string? RegistrationIp { get; set; }
    public string? LastLoginIp { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public List<UserIpLog> AccessedIps { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Estrutura de registro histórico de IPs acessados por um usuário.
/// </summary>
public class UserIpLog
{
    public string Ip { get; set; } = string.Empty;
    public DateTime FirstSeenAt { get; set; } = DateTime.UtcNow;
    public DateTime LastSeenAt { get; set; } = DateTime.UtcNow;
    public int AccessCount { get; set; } = 1;
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
