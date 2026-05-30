using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mixer8.Api.Infrastructure;
using System.Linq;
using System.Threading.Tasks;

namespace Mixer8.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,Moderator")]
public class UsersController(Mixer8DbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetUsers()
    {
        var users = await dbContext.Users
            .Select(u => new
            {
                u.UserId,
                u.Email,
                u.UserRole,
                u.CreatedAt
            })
            .ToListAsync();

        return Ok(users);
    }
}
