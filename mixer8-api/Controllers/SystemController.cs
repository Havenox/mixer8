using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mixer8.Api.Domain;
using Mixer8.Api.Infrastructure;
using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;

namespace Mixer8.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SystemController(Mixer8DbContext dbContext) : ControllerBase
{
    private static readonly HttpClient HttpClientInstance = new();

    [HttpPost("Access")]
    [AllowAnonymous]
    public async Task<IActionResult> TrackAccess([FromBody] TrackAccessRequest request)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown_ip";
        var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        Guid? userId = null;
        string userIdentifier = "Anônimo";

        if (userIdClaim != null && Guid.TryParse(userIdClaim, out var parsedId))
        {
            userId = parsedId;
            var userProfile = await dbContext.UserProfiles
                .AsNoTracking()
                .FirstOrDefaultAsync(up => up.UserId == userId);
            userIdentifier = userProfile?.UserName ?? "Usuário";
        }

        // Extrai a origem da requisição de entrada
        string origin = HttpContext.Request.Headers["Origin"].ToString();
        if (string.IsNullOrWhiteSpace(origin) && Uri.TryCreate(request.Url, UriKind.Absolute, out var pageUri))
        {
            origin = $"{pageUri.Scheme}://{pageUri.Authority}";
        }

        // 1. Registrar no Log do PostgreSQL local
        await dbContext.LogEventAsync(
            "Access",
            "Info",
            $"Acesso registrado: {userIdentifier} (IP: {ip}).",
            $"URL: {request.Url} | Referer: {request.Referrer} | UA: {request.UserAgent} | Res: {request.ScreenResolution}",
            null,
            userId
        );

        // 2. Disparar Webhook do Administrador se configurado
        var webhookSetting = await dbContext.SystemSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Key == "AccessWebhookUrl");

        if (webhookSetting != null && !string.IsNullOrWhiteSpace(webhookSetting.Value))
        {
            if (Uri.TryCreate(webhookSetting.Value, UriKind.Absolute, out var uri))
            {
                _ = Task.Run(async () =>
                {
                    try
                    {
                        using var requestMessage = new HttpRequestMessage(HttpMethod.Post, uri);
                        requestMessage.Content = JsonContent.Create(new
                        {
                            userAgent = request.UserAgent,
                            language = request.Language,
                            referrer = request.Referrer,
                            url = request.Url,
                            screenResolution = request.ScreenResolution,
                            timestamp = DateTime.UtcNow.ToString("o")
                        });

                        // Injeta os cabeçalhos de rede reais do cliente para compatibilidade total com n8n
                        requestMessage.Headers.TryAddWithoutValidation("X-Forwarded-For", ip);
                        requestMessage.Headers.TryAddWithoutValidation("X-Real-IP", ip);
                        requestMessage.Headers.TryAddWithoutValidation("User-Agent", request.UserAgent);

                        if (!string.IsNullOrEmpty(origin))
                        {
                            requestMessage.Headers.TryAddWithoutValidation("Origin", origin);
                        }

                        await HttpClientInstance.SendAsync(requestMessage);
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[WEBHOOK] Erro ao disparar webhook de acesso: {ex.Message}");
                    }
                });
            }
        }

        return Ok(new { Success = true });
    }

    [HttpPost("TestWebhook")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> TestWebhook([FromBody] TestWebhookRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.WebhookUrl) || !Uri.TryCreate(request.WebhookUrl, UriKind.Absolute, out var uri))
        {
            return BadRequest(new { ErrorMessage = "URL de webhook inválida." });
        }

        string origin = HttpContext.Request.Headers["Origin"].ToString();
        if (string.IsNullOrWhiteSpace(origin))
        {
            origin = $"{Request.Scheme}://{Request.Host}";
        }

        try
        {
            using var requestMessage = new HttpRequestMessage(HttpMethod.Post, uri);
            requestMessage.Content = JsonContent.Create(new
            {
                userAgent = "Mixer8 Audit System (Test Event)",
                language = "pt-BR",
                referrer = "Mixer8 Admin Dashboard",
                url = "https://mixer8.com/admin",
                screenResolution = "1920x1080",
                timestamp = DateTime.UtcNow.ToString("o")
            });

            // Injeta cabeçalhos mockados seguros para o teste
            requestMessage.Headers.TryAddWithoutValidation("X-Forwarded-For", "127.0.0.1");
            requestMessage.Headers.TryAddWithoutValidation("X-Real-IP", "127.0.0.1");
            requestMessage.Headers.TryAddWithoutValidation("User-Agent", "Mixer8 Test Agent");

            if (!string.IsNullOrEmpty(origin))
            {
                requestMessage.Headers.TryAddWithoutValidation("Origin", origin);
            }

            var response = await HttpClientInstance.SendAsync(requestMessage);
            if (response.IsSuccessStatusCode)
            {
                return Ok(new { Success = true });
            }
            else
            {
                return StatusCode((int)response.StatusCode, new { ErrorMessage = $"O webhook respondeu com código de status {response.StatusCode}." });
            }
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { ErrorMessage = $"Falha ao disparar requisição HTTP para o webhook: {ex.Message}" });
        }
    }
}

public class TrackAccessRequest
{
    public string UserAgent { get; set; } = string.Empty;
    public string Language { get; set; } = string.Empty;
    public string Referrer { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string ScreenResolution { get; set; } = string.Empty;
}

public class TestWebhookRequest
{
    public string WebhookUrl { get; set; } = string.Empty;
}
