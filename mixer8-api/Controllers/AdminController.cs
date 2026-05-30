using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Http;
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
        await System.IO.File.WriteAllTextAsync(filePath, request.CookiesJson);

        return Ok(new { SuccessMessage = "SESSION_IMPORTED_SUCCESSFULLY" });
    }

    [Authorize(Roles = "Admin,Moderator")]
    [HttpGet("GetSession")]
    public async Task<IActionResult> GetSession()
    {
        var configDir = configuration["EXTRACTOR_CONFIG_DIR"] ?? "./mixer8-extractor/config";
        if (!Path.IsPathRooted(configDir))
        {
            configDir = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", configDir));
        }

        var filePath = Path.Combine(configDir, "auth.json");
        if (System.IO.File.Exists(filePath))
        {
            var content = await System.IO.File.ReadAllTextAsync(filePath);
            return Ok(new { CookiesJson = content });
        }

        return NotFound(new { ErrorMessage = "NO_SESSION_FOUND" });
    }

    [Authorize(Roles = "Admin,Moderator")]
    [HttpPost("TestConnection")]
    public async Task<IActionResult> TestConnection()
    {
        var configDir = configuration["EXTRACTOR_CONFIG_DIR"] ?? "./mixer8-extractor/config";
        if (!Path.IsPathRooted(configDir))
        {
            configDir = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", configDir));
        }

        var filePath = Path.Combine(configDir, "auth.json");
        if (!System.IO.File.Exists(filePath))
        {
            return BadRequest(new { ErrorMessage = "NO_SESSION_FOUND" });
        }

        try
        {
            var content = await System.IO.File.ReadAllTextAsync(filePath);
            var cookies = JsonSerializer.Deserialize<List<CookieItem>>(content);

            if (cookies == null || cookies.Count == 0)
            {
                return BadRequest(new { ErrorMessage = "INVALID_COOKIES_FORMAT" });
            }

            var cookieContainer = new CookieContainer();
            foreach (var cookie in cookies)
            {
                var domain = cookie.domain;
                cookieContainer.Add(new Uri("https://studio.moises.ai"), new Cookie(cookie.name, cookie.value, cookie.path, domain));
            }

            var handler = new HttpClientHandler
            {
                CookieContainer = cookieContainer,
                AllowAutoRedirect = true
            };

            using var httpClient = new HttpClient(handler);
            httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            
            // Faz a requisição real de validação de cookies
            var response = await httpClient.GetAsync("https://studio.moises.ai/");
            var responseUrl = response.RequestMessage?.RequestUri?.ToString() ?? "";
            
            // Se foi redirecionado para a tela de auth/login, significa que os cookies são inválidos ou expirados!
            bool isActive = !responseUrl.Contains("/auth/login") && !responseUrl.Contains("/login") && response.IsSuccessStatusCode;

            return Ok(new TestConnectionResponse
            {
                Success = true,
                IsActive = isActive,
                Url = responseUrl,
                StatusCode = (int)response.StatusCode,
                Message = isActive ? "Sessão validada com sucesso! Logado na plataforma de stems." : "Cookies expirados ou inválidos. Redirecionado para tela de login."
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { ErrorMessage = $"FAILED_TO_TEST_CONNECTION: {ex.Message}" });
        }
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
        var active = System.IO.File.Exists(filePath);

        return Ok(new TestSessionResponse
        {
            IsActive = active,
            SessionAgeHours = active ? Convert.ToInt32((DateTime.UtcNow - System.IO.File.GetLastWriteTimeUtc(filePath)).TotalHours) : 0,
            PlatformUrl = "https://studio.moises.ai/"
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

public class CookieItem
{
    public string name { get; set; } = null!;
    public string value { get; set; } = null!;
    public string domain { get; set; } = null!;
    public string path { get; set; } = null!;
}

public class TestConnectionResponse
{
    public bool Success { get; set; }
    public bool IsActive { get; set; }
    public string Url { get; set; } = null!;
    public int StatusCode { get; set; }
    public string Message { get; set; } = null!;
}
