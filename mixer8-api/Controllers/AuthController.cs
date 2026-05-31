using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mixer8.Api.Domain;
using Mixer8.Api.Infrastructure;
using System;
using System.Security.Claims;
using System.Threading.Tasks;

namespace Mixer8.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(Mixer8DbContext dbContext, IConfiguration configuration) : ControllerBase
{
    [HttpPost("Register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { ErrorMessage = "EMAIL_AND_PASSWORD_REQUIRED" });
        }

        var normalizedEmail = request.Email.Trim().ToLower();
        var exists = await dbContext.Users.AnyAsync(u => u.Email == normalizedEmail);
        if (exists)
        {
            return Conflict(new { ErrorMessage = "USER_ALREADY_EXISTS" });
        }

        var user = new User
        {
            UserId = Guid.NewGuid(),
            Email = normalizedEmail,
            PasswordHash = SecurityHelper.HashPassword(request.Password),
            IsActive = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var roleStr = request.UserRole ?? "User";
        var roleEnum = roleStr switch
        {
            "Admin" => UserRoleType.Admin,
            "Moderator" => UserRoleType.Moderator,
            "PaidUser" => UserRoleType.PaidUser,
            _ => UserRoleType.User
        };

        var userRole = new UserRole
        {
            UserRoleId = Guid.NewGuid(),
            UserId = user.UserId,
            Role = roleEnum,
            UpdatedAt = DateTime.UtcNow
        };

        var userProfile = new UserProfile
        {
            UserProfileId = Guid.NewGuid(),
            UserId = user.UserId,
            Name = roleStr, // Nome padrão inicial baseado no papel
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Preferences = new UserProfilePreferences()
        };

        dbContext.Users.Add(user);
        dbContext.UserRoles.Add(userRole);
        dbContext.UserProfiles.Add(userProfile);
        await dbContext.SaveChangesAsync();

        var secret = configuration["JWT_SECRET"] ?? "sua_chave_secreta_jwt_aqui_minimo_32_caracteres";
        var expirationDays = Convert.ToInt32(configuration["JWT_EXPIRATION_DAYS"] ?? "7");
        var token = SecurityHelper.GenerateJwtToken(user, roleStr, secret, expirationDays);

        return Ok(new AuthResponse
        {
            Token = token,
            Email = user.Email,
            UserRole = roleStr
        });
    }

    [HttpPost("Login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { ErrorMessage = "EMAIL_AND_PASSWORD_REQUIRED" });
        }

        var normalizedEmail = request.Email.Trim().ToLower();
        var user = await dbContext.Users
            .Include(u => u.UserRole)
            .FirstOrDefaultAsync(u => u.Email == normalizedEmail);

        if (user == null || !user.IsActive || !SecurityHelper.VerifyPassword(request.Password, user.PasswordHash))
        {
            return Unauthorized(new { ErrorMessage = "INVALID_CREDENTIALS" });
        }

        var roleStr = user.UserRole.Role.ToString();
        var secret = configuration["JWT_SECRET"] ?? "sua_chave_secreta_jwt_aqui_minimo_32_caracteres";
        var expirationDays = Convert.ToInt32(configuration["JWT_EXPIRATION_DAYS"] ?? "7");
        var token = SecurityHelper.GenerateJwtToken(user, roleStr, secret, expirationDays);

        return Ok(new AuthResponse
        {
            Token = token,
            Email = user.Email,
            UserRole = roleStr
        });
    }

    [Authorize]
    [HttpGet("Me")]
    public async Task<IActionResult> Me()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new { ErrorMessage = "INVALID_TOKEN_CLAIMS" });
        }

        var user = await dbContext.Users
            .Include(u => u.UserRole)
            .FirstOrDefaultAsync(u => u.UserId == userId);

        if (user == null || !user.IsActive)
        {
            return NotFound(new { ErrorMessage = "USER_NOT_FOUND" });
        }

        return Ok(new UserResponse
        {
            UserId = user.UserId,
            Email = user.Email,
            UserRole = user.UserRole.Role.ToString(),
            CreatedAt = user.CreatedAt
        });
    }
}

public class RegisterRequest
{
    public string Email { get; set; } = null!;
    public string Password { get; set; } = null!;
    public string? UserRole { get; set; }
}

public class LoginRequest
{
    public string Email { get; set; } = null!;
    public string Password { get; set; } = null!;
}

public class AuthResponse
{
    public string Token { get; set; } = null!;
    public string Email { get; set; } = null!;
    public string UserRole { get; set; } = null!;
}

public class UserResponse
{
    public Guid UserId { get; set; }
    public string Email { get; set; } = null!;
    public string UserRole { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
}
