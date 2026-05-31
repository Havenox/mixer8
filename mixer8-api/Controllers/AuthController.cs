using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mixer8.Api.Domain;
using Mixer8.Api.Infrastructure;
using System;
using System.Security.Claims;
using System.Threading.Tasks;

namespace Mixer8.Api.Controllers;

/// <summary>
/// Controlador responsável pelas operações de autenticação e gerenciamento de perfil de usuário.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class AuthController(Mixer8DbContext dbContext, IConfiguration configuration) : ControllerBase
{
    [HttpPost("Register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password) || string.IsNullOrWhiteSpace(request.UserName))
        {
            return BadRequest(new { ErrorMessage = "EMAIL_PASSWORD_AND_USERNAME_REQUIRED" });
        }

        var normalizedEmail = request.Email.Trim().ToLower();
        var normalizedUserName = request.UserName.Trim().ToLower();

        // Validar formato do username (regex: letras, números, sublinhados, pontos; min 3 caracteres)
        var usernameRegex = new System.Text.RegularExpressions.Regex("^[a-zA-Z0-9_.]+$");
        if (normalizedUserName.Length < 3 || !usernameRegex.IsMatch(normalizedUserName))
        {
            return BadRequest(new { ErrorMessage = "INVALID_USERNAME_FORMAT" });
        }

        var emailExists = await dbContext.Users.AnyAsync(u => u.Email == normalizedEmail);
        if (emailExists)
        {
            return Conflict(new { ErrorMessage = "USER_ALREADY_EXISTS" });
        }

        var usernameExists = await dbContext.UserProfiles.AnyAsync(up => up.UserName == normalizedUserName);
        if (usernameExists)
        {
            return Conflict(new { ErrorMessage = "USERNAME_ALREADY_IN_USE" });
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

        var roleEnum = UserRoleType.User;
        var roleStr = "User";

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
            UserName = normalizedUserName,
            FirstName = null,
            LastName = null,
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
            UserRole = roleStr,
            UserName = userProfile.UserName
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
            .Include(u => u.UserProfile)
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
            UserRole = roleStr,
            UserName = user.UserProfile?.UserName ?? user.Email.Split('@')[0]
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
            .Include(u => u.UserProfile)
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
            CreatedAt = user.CreatedAt,
            UserName = user.UserProfile?.UserName ?? "",
            FirstName = user.UserProfile?.FirstName,
            LastName = user.UserProfile?.LastName,
            Phone = user.UserProfile?.Phone,
            Bio = user.UserProfile?.Bio,
            AvatarUrl = user.UserProfile?.AvatarUrl
        });
    }

    [HttpGet("CheckUsername")]
    public async Task<IActionResult> CheckUsername([FromQuery] string UserName)
    {
        if (string.IsNullOrWhiteSpace(UserName))
        {
            return BadRequest(new { ErrorMessage = "USERNAME_REQUIRED" });
        }

        var normalized = UserName.Trim().ToLower();

        // Validar formato do username (regex: letras, números, sublinhados, pontos; min 3 caracteres)
        var usernameRegex = new System.Text.RegularExpressions.Regex("^[a-zA-Z0-9_.]+$");
        if (normalized.Length < 3 || !usernameRegex.IsMatch(normalized))
        {
            return Ok(new CheckUsernameResponse { IsAvailable = false });
        }

        var exists = await dbContext.UserProfiles.AnyAsync(up => up.UserName == normalized);
        return Ok(new CheckUsernameResponse { IsAvailable = !exists });
    }

    [Authorize]
    [HttpPut("Profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new { ErrorMessage = "INVALID_TOKEN_CLAIMS" });
        }

        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.UserName))
        {
            return BadRequest(new { ErrorMessage = "EMAIL_AND_USERNAME_REQUIRED" });
        }

        var normalizedEmail = request.Email.Trim().ToLower();
        var normalizedUserName = request.UserName.Trim().ToLower();

        // Validar formato do username
        var usernameRegex = new System.Text.RegularExpressions.Regex("^[a-zA-Z0-9_.]+$");
        if (normalizedUserName.Length < 3 || !usernameRegex.IsMatch(normalizedUserName))
        {
            return BadRequest(new { ErrorMessage = "INVALID_USERNAME_FORMAT" });
        }

        var user = await dbContext.Users
            .Include(u => u.UserRole)
            .Include(u => u.UserProfile)
            .FirstOrDefaultAsync(u => u.UserId == userId);

        if (user == null || !user.IsActive)
        {
            return NotFound(new { ErrorMessage = "USER_NOT_FOUND" });
        }

        // Checar e-mail duplicado
        if (user.Email != normalizedEmail)
        {
            var emailExists = await dbContext.Users.AnyAsync(u => u.Email == normalizedEmail && u.UserId != userId);
            if (emailExists)
            {
                return Conflict(new { ErrorMessage = "EMAIL_ALREADY_IN_USE" });
            }
            user.Email = normalizedEmail;
        }

        // Checar username duplicado
        if (user.UserProfile.UserName != normalizedUserName)
        {
            var usernameExists = await dbContext.UserProfiles.AnyAsync(up => up.UserName == normalizedUserName && up.UserId != userId);
            if (usernameExists)
            {
                return Conflict(new { ErrorMessage = "USERNAME_ALREADY_IN_USE" });
            }
            user.UserProfile.UserName = normalizedUserName;
        }

        // Atualizar senha se fornecida
        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            if (string.IsNullOrWhiteSpace(request.CurrentPassword))
            {
                return BadRequest(new { ErrorMessage = "CURRENT_PASSWORD_REQUIRED" });
            }

            if (!SecurityHelper.VerifyPassword(request.CurrentPassword, user.PasswordHash))
            {
                return Unauthorized(new { ErrorMessage = "CURRENT_PASSWORD_INVALID" });
            }

            if (request.Password.Length < 6)
            {
                return BadRequest(new { ErrorMessage = "PASSWORD_TOO_SHORT" });
            }
            user.PasswordHash = SecurityHelper.HashPassword(request.Password);
        }

        // Atualizar demais propriedades do perfil
        user.UserProfile.FirstName = request.FirstName;
        user.UserProfile.LastName = request.LastName;
        user.UserProfile.Phone = request.Phone;
        user.UserProfile.Bio = request.Bio;
        user.UserProfile.AvatarUrl = request.AvatarUrl;
        user.UserProfile.UpdatedAt = DateTime.UtcNow;
        user.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();

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
    [HttpPost("Profile/Avatar")]
    public async Task<IActionResult> UploadAvatar(IFormFile file)
    {
        var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new { ErrorMessage = "INVALID_TOKEN_CLAIMS" });
        }

        if (file == null || file.Length == 0)
        {
            return BadRequest(new { ErrorMessage = "NO_FILE_UPLOADED" });
        }

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        var allowedExtensions = new[] { ".png", ".jpg", ".jpeg", ".webp" };
        if (!allowedExtensions.Contains(ext))
        {
            return BadRequest(new { ErrorMessage = "INVALID_FILE_TYPE" });
        }

        var profileDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "profiles", userId.ToString());
        if (!Directory.Exists(profileDir))
        {
            Directory.CreateDirectory(profileDir);
        }

        // Limpar avatares antigos para evitar sobras físicas de outros formatos
        foreach (var oldExt in allowedExtensions)
        {
            var oldFilePath = Path.Combine(profileDir, $"avatar{oldExt}");
            if (System.IO.File.Exists(oldFilePath))
            {
                System.IO.File.Delete(oldFilePath);
            }
        }

        var avatarFileName = "avatar.webp";
        var avatarPath = Path.Combine(profileDir, avatarFileName);

        await ImageHelper.ProcessAndSaveImageAsync(file, avatarPath);

        var avatarUrl = $"/profiles/{userId}/{avatarFileName}";

        var user = await dbContext.Users
            .Include(u => u.UserProfile)
            .FirstOrDefaultAsync(u => u.UserId == userId);

        if (user != null)
        {
            user.UserProfile.AvatarUrl = avatarUrl;
            user.UserProfile.UpdatedAt = DateTime.UtcNow;
            await dbContext.SaveChangesAsync();
        }

        return Ok(new { AvatarUrl = avatarUrl });
    }

    [HttpGet("Profile/{username}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublicProfile(string username)
    {
        if (string.IsNullOrWhiteSpace(username))
        {
            return BadRequest(new { ErrorMessage = "USERNAME_REQUIRED" });
        }

        var normalized = username.Trim().ToLower();
        var profile = await dbContext.UserProfiles
            .FirstOrDefaultAsync(up => up.UserName == normalized);

        if (profile == null)
        {
            return NotFound(new { ErrorMessage = "USER_NOT_FOUND" });
        }

        var userPlaylists = await dbContext.Playlists
            .Include(p => p.PlaylistTracks)
            .Where(p => p.OwnerId == profile.UserId && p.Visibility == "Public")
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        var publicPlaylistsDto = userPlaylists.Select(p =>
        {
            var firstTrackCover = p.PlaylistTracks
                .OrderBy(pt => pt.AddedAt)
                .Select(pt => pt.Track.CoverUrl)
                .FirstOrDefault();

            return new PlaylistResponseDto
            {
                PlaylistId = p.PlaylistId,
                Name = p.Name,
                Visibility = p.Visibility,
                Description = p.Description,
                OwnerId = p.OwnerId,
                OwnerEmail = "",
                CoverUrl = p.CoverUrl ?? firstTrackCover,
                CreatedAt = p.CreatedAt,
                IsOwner = false,
                IsCollaborator = false,
                IsSaved = false,
                TracksCount = p.PlaylistTracks.Count,
                OwnerUserName = profile.UserName,
                OwnerFirstName = profile.FirstName,
                OwnerLastName = profile.LastName,
                OwnerAvatarUrl = profile.AvatarUrl
            };
        }).ToList();

        var response = new PublicProfileResponseDto
        {
            UserName = profile.UserName,
            FirstName = profile.FirstName,
            LastName = profile.LastName,
            Bio = profile.Bio,
            AvatarUrl = profile.AvatarUrl,
            FollowersCount = 0,
            FollowingCount = 0,
            PublicPlaylists = publicPlaylistsDto
        };

        return Ok(response);
    }
}

public class RegisterRequest
{
    public string Email { get; set; } = null!;
    public string Password { get; set; } = null!;
    public string UserName { get; set; } = null!;
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
    public string UserName { get; set; } = null!;
}

public class UserResponse
{
    public Guid UserId { get; set; }
    public string Email { get; set; } = null!;
    public string UserRole { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
    public string UserName { get; set; } = null!;
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Phone { get; set; }
    public string? Bio { get; set; }
    public string? AvatarUrl { get; set; }
}

public class CheckUsernameResponse
{
    public bool IsAvailable { get; set; }
}

public class UpdateProfileRequest
{
    public string Email { get; set; } = null!;
    public string? Password { get; set; }
    public string? CurrentPassword { get; set; }
    public string UserName { get; set; } = null!;
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Phone { get; set; }
    public string? Bio { get; set; }
    public string? AvatarUrl { get; set; }
}

public class PublicProfileResponseDto
{
    public string UserName { get; set; } = null!;
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? Bio { get; set; }
    public string? AvatarUrl { get; set; }
    public int FollowersCount { get; set; }
    public int FollowingCount { get; set; }
    public List<PlaylistResponseDto> PublicPlaylists { get; set; } = new();
}
