using Microsoft.EntityFrameworkCore;
using Mixer8.Extractor.Domain;
using Mixer8.Extractor.Infrastructure;
using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Mixer8.Extractor;

/// <summary>
/// Worker Service de Background que consome a fila de extração de Stems
/// a partir do banco de dados PostgreSQL usando locks de concorrência.
/// </summary>
public class Worker(ILogger<Worker> logger, IServiceProvider serviceProvider) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("[WORKER] Extrator de Stems iniciado em .NET 10.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessNextQueueItemAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "[WORKER ERROR] Ocorreu uma falha no processamento da fila.");
            }

            await Task.Delay(5000, stoppingToken); // Polling a cada 5 segundos
        }
    }

    private async Task ProcessNextQueueItemAsync(CancellationToken stoppingToken)
    {
        // Cria um escopo transacional para obter o DbContext
        using var scope = serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Mixer8DbContext>();

        Track? track = null;

        // Executa a transação atômica SKIP LOCKED para garantir isolamento absoluto
        using (var transaction = await db.Database.BeginTransactionAsync(stoppingToken))
        {
            try
            {
                // Query com Lock de Linha (FOR UPDATE SKIP LOCKED) nativo do PostgreSQL
                track = await db.Tracks
                    .FromSqlRaw("SELECT * FROM \"Tracks\" WHERE \"ExtractionStatus\" = 'Aguardando' ORDER BY \"CreatedAt\" ASC LIMIT 1 FOR UPDATE SKIP LOCKED")
                    .FirstOrDefaultAsync(stoppingToken);

                if (track != null)
                {
                    track.ExtractionStatus = "Processando: Inicializando";
                    await db.SaveChangesAsync(stoppingToken);
                    await transaction.CommitAsync(stoppingToken);
                    logger.LogInformation($"[WORKER] Música '{track.TrackTitle}' capturada com sucesso para processamento.");
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "[WORKER ERROR] Erro ao realizar lock transacional.");
                await transaction.RollbackAsync(stoppingToken);
                return;
            }
        }

        // Se encontrou alguma música para processar, inicia o fluxo real
        if (track != null)
        {
            await ExecuteExtractionWorkflowAsync(track, stoppingToken);
        }
    }

    private async Task ExecuteExtractionWorkflowAsync(Track track, CancellationToken stoppingToken)
    {
        // Reabre escopo limpo para salvar atualizações de status
        using var scope = serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Mixer8DbContext>();

        try
        {
            // Etapa 1: Inicializando o Browser
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Inicializando container do Playwright", db, stoppingToken);
            await Task.Delay(3000, stoppingToken);

            // Etapa 2: Importando cookies
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Importando cookies de sessão (auth.json)", db, stoppingToken);
            await Task.Delay(3000, stoppingToken);

            // Etapa 3: Upload
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Realizando upload seguro do áudio", db, stoppingToken);
            await Task.Delay(4000, stoppingToken);

            // Etapa 4: Separação (Esta etapa simula a separação da IA de stems)
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Separando stems de áudio (Voz, Baixo, Bateria...)", db, stoppingToken);
            await Task.Delay(8000, stoppingToken);

            // Etapa 5: Download
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Baixando ZIP de stems exportadas", db, stoppingToken);
            await Task.Delay(3000, stoppingToken);

            // Etapa 6: Criação das Stems físicas no banco de dados e conclusão!
            logger.LogInformation($"[WORKER] Extração de '{track.TrackTitle}' finalizada. Cadastrando stems de áudio...");

            var stems = new[]
            {
                new Stem { StemId = Guid.NewGuid(), TrackId = track.TrackId, StemType = "Vocals", AudioUrl = "/stems/mock_vocals.mp3" },
                new Stem { StemId = Guid.NewGuid(), TrackId = track.TrackId, StemType = "Drums", AudioUrl = "/stems/mock_drums.mp3" },
                new Stem { StemId = Guid.NewGuid(), TrackId = track.TrackId, StemType = "Bass", AudioUrl = "/stems/mock_bass.mp3" },
                new Stem { StemId = Guid.NewGuid(), TrackId = track.TrackId, StemType = "Piano", AudioUrl = "/stems/mock_piano.mp3" },
                new Stem { StemId = Guid.NewGuid(), TrackId = track.TrackId, StemType = "Others", AudioUrl = "/stems/mock_others.mp3" }
            };

            db.Stems.AddRange(stems);

            var dbTrack = await db.Tracks.FindAsync(track.TrackId);
            if (dbTrack != null)
            {
                dbTrack.ExtractionStatus = "Pronto";
            }

            await db.SaveChangesAsync(stoppingToken);
            logger.LogInformation($"[WORKER SUCCESS] Música '{track.TrackTitle}' processada com sucesso e 5 stems cadastradas no banco!");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, $"[WORKER ERROR] Falha catastrófica ao processar track: {track.TrackId}");
            var dbTrack = await db.Tracks.FindAsync(track.TrackId);
            if (dbTrack != null)
            {
                dbTrack.ExtractionStatus = "Falhou";
            }
            await db.SaveChangesAsync(stoppingToken);
        }
    }

    private async Task UpdateTrackStatusAsync(Guid trackId, string status, Mixer8DbContext db, CancellationToken stoppingToken)
    {
        var dbTrack = await db.Tracks.FindAsync(trackId);
        if (dbTrack != null)
        {
            dbTrack.ExtractionStatus = status;
            await db.SaveChangesAsync(stoppingToken);
            logger.LogInformation($"[WORKER STATUS] Track: {trackId} -> {status}");
        }
    }
}
