using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mixer8.Api.Domain;
using Mixer8.Api.Infrastructure;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Mixer8.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,Moderator")]
public class SystemEventsController(Mixer8DbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetSystemEvents(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] string? category = null,
        [FromQuery] string? level = null,
        [FromQuery] string? sortBy = "timestamp",
        [FromQuery] bool sortDescending = true)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        // Base query
        var query = dbContext.SystemEvents.AsNoTracking().AsQueryable();

        // 1. Filtrar por Categoria
        if (!string.IsNullOrWhiteSpace(category))
        {
            query = query.Where(se => se.Category == category);
        }

        // 2. Filtrar por Nível
        if (!string.IsNullOrWhiteSpace(level))
        {
            query = query.Where(se => se.Level == level);
        }

        // 3. Projetar DTO com joins para evitar expor IDs puros e recuperar nomes amigáveis
        var dtoQuery = from se in query
                       join t in dbContext.Tracks on se.TrackId equals t.TrackId into trackJoin
                       from t in trackJoin.DefaultIfEmpty()
                       join u in dbContext.Users on se.UserId equals u.UserId into userJoin
                       from u in userJoin.DefaultIfEmpty()
                       join up in dbContext.UserProfiles on se.UserId equals up.UserId into profileJoin
                       from up in profileJoin.DefaultIfEmpty()
                       select new SystemEventDto
                       {
                           EventId = se.EventId,
                           Timestamp = se.Timestamp,
                           Category = se.Category,
                           Level = se.Level,
                           Message = se.Message,
                           Details = se.Details,
                           TrackId = se.TrackId,
                           TrackTitle = t != null ? t.TrackTitle : null,
                           UserId = se.UserId,
                           UserEmail = u != null ? u.Email : null,
                           UserName = up != null ? up.UserName : null
                       };

        // 4. Aplicar busca case-insensitive e accent-insensitive (unaccent)
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchPattern = $"%{search}%";
            dtoQuery = dtoQuery.Where(se =>
                EF.Functions.ILike(EF.Functions.Unaccent(se.Message), EF.Functions.Unaccent(searchPattern)) ||
                (se.Details != null && EF.Functions.ILike(EF.Functions.Unaccent(se.Details), EF.Functions.Unaccent(searchPattern))) ||
                EF.Functions.ILike(EF.Functions.Unaccent(se.Category), EF.Functions.Unaccent(searchPattern)) ||
                (se.TrackTitle != null && EF.Functions.ILike(EF.Functions.Unaccent(se.TrackTitle), EF.Functions.Unaccent(searchPattern))) ||
                (se.UserEmail != null && EF.Functions.ILike(EF.Functions.Unaccent(se.UserEmail), EF.Functions.Unaccent(searchPattern))) ||
                (se.UserName != null && EF.Functions.ILike(EF.Functions.Unaccent(se.UserName), EF.Functions.Unaccent(searchPattern)))
            );
        }

        // 5. Total de itens após filtros/busca
        var totalCount = await dtoQuery.CountAsync();

        // 6. Ordenação
        dtoQuery = sortBy?.ToLower() switch
        {
            "category" => sortDescending ? dtoQuery.OrderByDescending(se => se.Category) : dtoQuery.OrderBy(se => se.Category),
            "level" => sortDescending ? dtoQuery.OrderByDescending(se => se.Level) : dtoQuery.OrderBy(se => se.Level),
            "message" => sortDescending ? dtoQuery.OrderByDescending(se => se.Message) : dtoQuery.OrderBy(se => se.Message),
            _ => sortDescending ? dtoQuery.OrderByDescending(se => se.Timestamp) : dtoQuery.OrderBy(se => se.Timestamp)
        };

        // 7. Paginação
        var items = await dtoQuery
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

        return Ok(new PaginatedSystemEventsResponse
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = totalPages
        });
    }
}

public class SystemEventDto
{
    public Guid EventId { get; set; }
    public DateTime Timestamp { get; set; }
    public string Category { get; set; } = null!;
    public string Level { get; set; } = null!;
    public string Message { get; set; } = null!;
    public string? Details { get; set; }
    public Guid? TrackId { get; set; }
    public string? TrackTitle { get; set; }
    public Guid? UserId { get; set; }
    public string? UserEmail { get; set; }
    public string? UserName { get; set; }
}

public class PaginatedSystemEventsResponse
{
    public List<SystemEventDto> Items { get; set; } = null!;
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
}
