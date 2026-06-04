using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Mixer8.Api.Infrastructure;

public class WeeklyPlayCleanupWorker(IServiceProvider serviceProvider, ILogger<WeeklyPlayCleanupWorker> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("[WeeklyPlayCleanupWorker] Iniciado.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunCleanupAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "[WeeklyPlayCleanupWorker] Erro durante a execução da limpeza.");
            }

            await Task.Delay(Interval, stoppingToken);
        }
    }

    private async Task RunCleanupAsync(CancellationToken cancellationToken)
    {
        using var scope = serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<Mixer8DbContext>();

        var threshold = DateTime.UtcNow.AddDays(-7);
        logger.LogInformation("[WeeklyPlayCleanupWorker] Iniciando purga de plays anteriores a {Threshold}...", threshold);

        // 1. Deletar plays expirados
        var deletedCount = await dbContext.TrackPlays
            .Where(tp => tp.PlayedAt < threshold)
            .ExecuteDeleteAsync(cancellationToken);

        logger.LogInformation("[WeeklyPlayCleanupWorker] Purga concluída. {Count} registros removidos.", deletedCount);

        // 2. Sincronizar/Recalcular WeekPlayCount de todas as tracks
        logger.LogInformation("[WeeklyPlayCleanupWorker] Recalculando WeekPlayCount de todas as músicas...");
        
        // Uma única query nativa realiza o update em lote com máxima performance
        var updatedCount = await dbContext.Database.ExecuteSqlAsync($@"
            UPDATE ""Tracks""
            SET ""WeekPlayCount"" = COALESCE((
                SELECT COUNT(*)
                FROM ""TrackPlays""
                WHERE ""TrackPlays"".""TrackId"" = ""Tracks"".""TrackId""
            ), 0)", cancellationToken);

        logger.LogInformation("[WeeklyPlayCleanupWorker] Sincronização de contagem concluída.");
    }
}
