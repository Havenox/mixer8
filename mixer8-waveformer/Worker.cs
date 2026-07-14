using Microsoft.EntityFrameworkCore;
using Mixer8.Waveformer.Domain;
using Mixer8.Waveformer.Infrastructure;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;

namespace Mixer8.Waveformer;

public class Worker(
    ILogger<Worker> logger,
    IConfiguration configuration,
    Mixer8DbContext dbContext,
    HttpClient httpClient) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("[WAVEFORM WORKER] Iniciado com sucesso e escutando fila de Stems...");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                bool processed = await ProcessNextStemAsync(stoppingToken);
                if (processed)
                {
                    // Se processou um item, continua imediatamente sem delay
                    continue;
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "[WAVEFORM WORKER] Erro inesperado na iteracao principal da fila.");
            }

            // Se a fila estava vazia ou falhou, aguarda 5 segundos antes de buscar novamente
            await Task.Delay(5000, stoppingToken);
        }
    }

    private async Task<bool> ProcessNextStemAsync(CancellationToken stoppingToken)
    {
        using var transaction = await dbContext.Database.BeginTransactionAsync(stoppingToken);
        try
        {
            // Busca uma stem sem waveform associada usando skip locked
            var stem = await dbContext.Stems
                .FromSqlRaw(@"
                    SELECT s.* FROM ""Stems"" s
                    WHERE NOT EXISTS (
                        SELECT 1 FROM ""StemWaveforms"" sw
                        WHERE s.""StemId"" = sw.""StemId""
                    )
                    ORDER BY s.""CreatedAt"" ASC
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED")
                .FirstOrDefaultAsync(stoppingToken);

            if (stem == null)
            {
                await transaction.RollbackAsync(stoppingToken);
                return false;
            }

            var apiUrl = configuration["API_URL"] ?? "http://localhost:5000";
            var downloadUrl = $"{apiUrl.TrimEnd('/')}/{stem.AudioUrl.TrimStart('/')}";

            logger.LogInformation($"[WAVEFORM] Iniciando processamento da stem: {stem.StemId} ({stem.StemType})");

            using var response = await httpClient.GetAsync(downloadUrl, HttpCompletionOption.ResponseHeadersRead, stoppingToken);
            response.EnsureSuccessStatusCode();
            using var inputStream = await response.Content.ReadAsStreamAsync(stoppingToken);

            const int sampleRate = 8000;
            const int pointsPerSecond = 20;
            int samplesPerPoint = sampleRate / pointsPerSecond;
            int bytesPerPoint = samplesPerPoint * 2;

            var startInfo = new System.Diagnostics.ProcessStartInfo
            {
                FileName = "ffmpeg",
                Arguments = $"-y -i pipe:0 -f s16le -ac 1 -ar {sampleRate} pipe:1",
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = false,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var process = new System.Diagnostics.Process { StartInfo = startInfo };
            process.Start();

            var copyTask = Task.Run(async () =>
            {
                try
                {
                    await inputStream.CopyToAsync(process.StandardInput.BaseStream, stoppingToken);
                    process.StandardInput.Close();
                }
                catch (Exception ex)
                {
                    logger.LogWarning($"[WAVEFORM] Erro gravando no stdin do ffmpeg: {ex.Message}");
                    try { process.StandardInput.Close(); } catch { }
                }
            }, stoppingToken);

            var points = new List<int>();
            var buffer = new byte[bytesPerPoint];
            var stdoutStream = process.StandardOutput.BaseStream;

            while (true)
            {
                int bytesRead = 0;
                while (bytesRead < bytesPerPoint)
                {
                    int read = await stdoutStream.ReadAsync(buffer, bytesRead, bytesPerPoint - bytesRead, stoppingToken);
                    if (read <= 0) break;
                    bytesRead += read;
                }

                if (bytesRead == 0) break;

                int maxVal = 0;
                for (int i = 0; i < bytesRead; i += 2)
                {
                    if (i + 1 < bytesRead)
                    {
                        short sample = BitConverter.ToInt16(buffer, i);
                        int absSample = Math.Abs((int)sample);
                        if (absSample > maxVal)
                        {
                            maxVal = absSample;
                        }
                    }
                }

                int normalized = (int)Math.Round((maxVal / 32768.0) * 100.0);
                points.Add(normalized);
            }

            await copyTask;
            await process.WaitForExitAsync(stoppingToken);

            if (points.Count > 0)
            {
                int maxPeak = points.Max();
                if (maxPeak <= 2)
                {
                    logger.LogWarning($"[WAVEFORM SILENCE] Stem {stem.StemId} ({stem.StemType}) detectada como silenciosa (Pico maximo: {maxPeak}%). Iniciando remocao...");

                    var physicalPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", stem.AudioUrl.TrimStart('/'));
                    if (System.IO.File.Exists(physicalPath))
                    {
                        try
                        {
                            System.IO.File.Delete(physicalPath);
                            logger.LogInformation($"[WAVEFORM SILENCE] Arquivo fisico de audio excluido: {physicalPath}");
                        }
                        catch (Exception ex)
                        {
                            logger.LogError(ex, $"[WAVEFORM SILENCE] Erro ao deletar o arquivo fisico: {physicalPath}");
                        }
                    }
                    else
                    {
                        logger.LogWarning($"[WAVEFORM SILENCE] Arquivo fisico nao encontrado em: {physicalPath}");
                    }

                    dbContext.Stems.Remove(stem);
                    await dbContext.SaveChangesAsync(stoppingToken);
                    await transaction.CommitAsync(stoppingToken);

                    logger.LogInformation($"[WAVEFORM SILENCE SUCCESS] Registro da stem silenciosa {stem.StemId} removido do banco.");
                    return true;
                }

                if (maxPeak > 0 && maxPeak < 100)
                {
                    double scale = 100.0 / maxPeak;
                    for (int i = 0; i < points.Count; i++)
                    {
                        points[i] = (int)Math.Round(points[i] * scale);
                    }
                }
            }

            var waveform = new StemWaveform
            {
                StemId = stem.StemId,
                Points = points
            };

            dbContext.StemWaveforms.Add(waveform);
            await dbContext.SaveChangesAsync(stoppingToken);
            await transaction.CommitAsync(stoppingToken);

            logger.LogInformation($"[WAVEFORM SUCCESS] Waveform processada com sucesso para a stem: {stem.StemId} ({points.Count} pontos).");
            return true;
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(stoppingToken);
            logger.LogError(ex, $"[WAVEFORM ERROR] Falha no processamento da stem.");
            return false;
        }
    }
}
