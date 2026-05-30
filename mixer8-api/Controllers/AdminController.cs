using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;

namespace Mixer8.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AdminController(IConfiguration configuration) : ControllerBase
{
    [Authorize(Roles = "Admin,Moderator")]
    [HttpPost("ImportSession")]
    public async Task<IActionResult> ImportSession([FromBody] ImportSessionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.CookiesJson))
        {
            return BadRequest(new { ErrorMessage = "COOKIES_JSON_REQUIRED" });
        }

        try
        {
            // Valida se é um JSON sintaticamente correto
            using var doc = JsonDocument.Parse(request.CookiesJson);
        }
        catch (JsonException)
        {
            return BadRequest(new { ErrorMessage = "INVALID_JSON_FORMAT" });
        }

        // Resolve o diretório de configurações do extrator do .env
        var configDir = configuration["EXTRACTOR_CONFIG_DIR"] ?? "./mixer8-extractor/config";
        
        if (!Path.IsPathRooted(configDir))
        {
            configDir = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", configDir));
        }

        if (!Directory.Exists(configDir))
        {
            Directory.CreateDirectory(configDir);
        }

        // Grava fisicamente a sessão no arquivo auth.json que o Playwright usará para o bypass de login!
        var filePath = Path.Combine(configDir, "auth.json");
        await File.WriteAllTextAsync(filePath, request.CookiesJson);

        return Ok(new { SuccessMessage = "SESSION_IMPORTED_SUCCESSFULLY" });
    }

    [Authorize(Roles = "Admin,Moderator")]
    [HttpGet("TestSession")]
    public IActionResult TestSession()
    {
        // Resolve o caminho de auth.json
        var configDir = configuration["EXTRACTOR_CONFIG_DIR"] ?? "./mixer8-extractor/config";
        if (!Path.IsPathRooted(configDir))
        {
            configDir = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", configDir));
        }

        var filePath = Path.Combine(configDir, "auth.json");
        var active = File.Exists(filePath);

        return Ok(new TestSessionResponse
        {
            IsActive = active,
            SessionAgeHours = active ? Convert.ToInt32((DateTime.UtcNow - File.GetLastWriteTimeUtc(filePath)).TotalHours) : 0,
            PlatformUrl = "https://mixer8-extractor.local"
        });
    }
}

public class ImportSessionRequest
{
    public string CookiesJson { get; set; } = null!;
}

public class TestSessionResponse
{
    public bool IsActive { get; set; }
    public int SessionAgeHours { get; set; }
    public string PlatformUrl { get; set; } = null!;
}
