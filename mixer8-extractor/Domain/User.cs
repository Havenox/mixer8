using System;

namespace Mixer8.Extractor.Domain;

public class User
{
    public Guid UserId { get; set; }
    public string Email { get; set; } = null!;
    public string PasswordHash { get; set; } = null!;
    public string UserRole { get; set; } = "User";
    public DateTime CreatedAt { get; set; }
}
