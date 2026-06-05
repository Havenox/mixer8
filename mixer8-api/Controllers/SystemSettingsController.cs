using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mixer8.Api.Domain;
using Mixer8.Api.Infrastructure;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Mixer8.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SystemSettingsController(Mixer8DbContext dbContext) : ControllerBase
{
    private static readonly Dictionary<string, string> DefaultSettings = new()
    {
        { "PremiumFeature_DownloadOffline", "Admin,Moderator,PaidUser" }
    };

    /// <summary>
    /// Retorna as configurações ativas do sistema. Acesso público para permitir que o app valide permissões localmente.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetSettings()
    {
        var dbSettings = await dbContext.SystemSettings
            .Where(s => s.Key.StartsWith("PremiumFeature_"))
            .ToDictionaryAsync(s => s.Key, s => s.Value);
        var result = new Dictionary<string, string>();

        // Carrega configurações padrões
        foreach (var kvp in DefaultSettings)
        {
            result[kvp.Key] = kvp.Value;
        }

        // Sobrescreve com as configurações customizadas salvas no banco de dados
        foreach (var kvp in dbSettings)
        {
            result[kvp.Key] = kvp.Value;
        }

        return Ok(result);
    }

    /// <summary>
    /// Salva ou atualiza parametrizações de recursos premium. Acesso restrito a administradores.
    /// </summary>
    [Authorize(Roles = "Admin")]
    [HttpPut]
    public async Task<IActionResult> UpdateSettings([FromBody] Dictionary<string, string> settings)
    {
        foreach (var kvp in settings)
        {
            if (string.IsNullOrWhiteSpace(kvp.Key)) continue;

            var setting = await dbContext.SystemSettings.FindAsync(kvp.Key);
            if (setting == null)
            {
                setting = new SystemSetting
                {
                    Key = kvp.Key,
                    Value = kvp.Value ?? "",
                    UpdatedAt = DateTime.UtcNow
                };
                dbContext.SystemSettings.Add(setting);
            }
            else
            {
                setting.Value = kvp.Value ?? "";
                setting.UpdatedAt = DateTime.UtcNow;
                dbContext.Entry(setting).State = EntityState.Modified;
            }
        }

        await dbContext.SaveChangesAsync();
        return Ok(new { SuccessMessage = "SETTINGS_UPDATED_SUCCESSFULLY" });
    }
}
