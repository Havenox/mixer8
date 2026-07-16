using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mixer8.Api.Domain;
using Mixer8.Api.Infrastructure;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace Mixer8.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,Moderator")]
public class UsersController(Mixer8DbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetUsers(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] string? role = null,
        [FromQuery] string? sortBy = "createdAt",
        [FromQuery] bool sortDescending = true)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        var query = dbContext.Users
            .Include(u => u.UserRole)
            .Include(u => u.UserProfile)
            .AsSplitQuery()
            .AsNoTracking();

        // 1. Filtrar por Role
        if (!string.IsNullOrWhiteSpace(role))
        {
            if (Enum.TryParse<UserRoleType>(role, true, out var parsedRole))
            {
                query = query.Where(u => u.UserRole.Role == parsedRole);
            }
        }

        // 2. Busca case/accent-insensitive (unaccent) no email, username, firstName, lastName
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchPattern = $"%{search}%";
            query = query.Where(u =>
                EF.Functions.ILike(EF.Functions.Unaccent(u.Email), EF.Functions.Unaccent(searchPattern)) ||
                (u.UserProfile != null && EF.Functions.ILike(EF.Functions.Unaccent(u.UserProfile.UserName), EF.Functions.Unaccent(searchPattern))) ||
                (u.UserProfile != null && u.UserProfile.FirstName != null && EF.Functions.ILike(EF.Functions.Unaccent(u.UserProfile.FirstName), EF.Functions.Unaccent(searchPattern))) ||
                (u.UserProfile != null && u.UserProfile.LastName != null && EF.Functions.ILike(EF.Functions.Unaccent(u.UserProfile.LastName), EF.Functions.Unaccent(searchPattern)))
            );
        }

        // 3. Contagem total
        var totalCount = await query.CountAsync();

        // 4. Ordenação
        query = sortBy?.ToLower() switch
        {
            "email" => sortDescending ? query.OrderByDescending(u => u.Email) : query.OrderBy(u => u.Email),
            "username" => sortDescending ? query.OrderByDescending(u => u.UserProfile.UserName) : query.OrderBy(u => u.UserProfile.UserName),
            "role" => sortDescending ? query.OrderByDescending(u => u.UserRole.Role) : query.OrderBy(u => u.UserRole.Role),
            _ => sortDescending ? query.OrderByDescending(u => u.CreatedAt) : query.OrderBy(u => u.CreatedAt)
        };

        // 5. Paginação
        var users = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new
            {
                u.UserId,
                u.Email,
                UserRole = u.UserRole.Role.ToString(),
                u.CreatedAt,
                UserName = u.UserProfile != null ? u.UserProfile.UserName : null,
                FirstName = u.UserProfile != null ? u.UserProfile.FirstName : null,
                LastName = u.UserProfile != null ? u.UserProfile.LastName : null,
                Phone = u.UserProfile != null ? u.UserProfile.Phone : null,
                Bio = u.UserProfile != null ? u.UserProfile.Bio : null,
                AvatarUrl = u.UserProfile != null ? u.UserProfile.AvatarUrl : null,
                RegistrationIp = u.UserProfile != null ? u.UserProfile.RegistrationIp : null,
                LastLoginIp = u.UserProfile != null ? u.UserProfile.LastLoginIp : null,
                LastLoginAt = u.UserProfile != null ? u.UserProfile.LastLoginAt : null,
                AccessedIps = u.UserProfile != null ? u.UserProfile.AccessedIps : new List<UserIpLog>()
            })
            .ToListAsync();

        var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        return Ok(new
        {
            Items = users,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = totalPages
        });
    }

    [HttpPut("{id}/Role")]
    [Authorize(Roles = "Admin")] // Apenas admins de verdade podem alterar funções (moderadores apenas consultam)
    public async Task<IActionResult> UpdateUserRole(Guid id, [FromBody] UpdateUserRoleRequest request)
    {
        var adminIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (adminIdClaim == null || !Guid.TryParse(adminIdClaim, out var adminId))
        {
            return Unauthorized(new { ErrorMessage = "INVALID_TOKEN_CLAIMS" });
        }

        if (string.IsNullOrWhiteSpace(request.Role))
        {
            return BadRequest(new { ErrorMessage = "ROLE_REQUIRED" });
        }

        if (!Enum.TryParse<UserRoleType>(request.Role, true, out var roleEnum))
        {
            return BadRequest(new { ErrorMessage = "INVALID_ROLE" });
        }

        var user = await dbContext.Users
            .Include(u => u.UserRole)
            .Include(u => u.UserProfile)
            .FirstOrDefaultAsync(u => u.UserId == id);

        if (user == null)
        {
            return NotFound(new { ErrorMessage = "USER_NOT_FOUND" });
        }

        // Prevenir auto-rebaixamento se for o único admin
        if (id == adminId && roleEnum != UserRoleType.Admin)
        {
            var otherAdminExists = await dbContext.UserRoles.AnyAsync(ur => ur.UserId != id && ur.Role == UserRoleType.Admin);
            if (!otherAdminExists)
            {
                return BadRequest(new { ErrorMessage = "CANNOT_DEMOTE_SOLE_ADMIN" });
            }
        }

        var oldRole = user.UserRole.Role.ToString();
        user.UserRole.Role = roleEnum;
        user.UserRole.UpdatedAt = DateTime.UtcNow;
        user.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();

        // Registrar log de auditoria
        await dbContext.LogEventAsync("API", "Warning", $"Papel do usuário '{user.UserProfile?.UserName ?? user.Email}' alterado de '{oldRole}' para '{roleEnum}'.", $"Alterado pelo administrador {adminIdClaim}", null, id);

        return Ok(new
        {
            user.UserId,
            user.Email,
            UserRole = user.UserRole.Role.ToString(),
            UserName = user.UserProfile?.UserName
        });
    }
}

public class UpdateUserRoleRequest
{
    public string Role { get; set; } = null!;
}
