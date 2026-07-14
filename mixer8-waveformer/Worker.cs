using Microsoft.EntityFrameworkCore;
using Mixer8.Waveformer.Domain;
using Mixer8.Waveformer.Infrastructure;
using System;
using System.Diagnostics;
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
        Stem? stem = null;
        using var transaction = await dbContext.Database.BeginTransactionAsync(stoppingToken);
        try
        {
            // Busca uma stem sem waveform associada usando skip locked
            stem = await dbContext.Stems
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

            using var request = new HttpRequestMessage(HttpMethod.Get, downloadUrl);
            using var response = await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, stoppingToken);
            response.EnsureSuccessStatusCode();

            using var audioStream = await response.Content.ReadAsStreamAsync(stoppingToken);

            // Inicia o processo do ffmpeg para ler áudio da entrada padrão (pipe:0)
            using var process = new Process();
            process.StartInfo.FileName = "ffmpeg";
            process.StartInfo.Arguments = "-i pipe:0 -f s16le -ac 1 -ar 8000 -";
            process.StartInfo.UseShellExecute = false;
            process.StartInfo.RedirectStandardInput = true;
            process.StartInfo.RedirectStandardOutput = true;
            process.StartInfo.CreateNoWindow = true;

            process.Start();

            // Copia o áudio baixado do endpoint diretamente para o stdin do FFmpeg na memória
            var copyTask = Task.Run(async () =>
            {
                try
                {
                    await audioStream.CopyToAsync(process.StandardInput.BaseStream, stoppingToken);
                }
                catch (Exception ex)
                {
                    logger.LogDebug($"[WAVEFORM DEBUG] Escrita no stdin do FFmpeg encerrada: {ex.Message}");
                }
                finally
                {
                    process.StandardInput.Close();
                }
            }, stoppingToken);

            // Lê a saída s16le (PCM 16-bit mono 8000Hz) em blocos
            var stdoutStream = process.StandardOutput.BaseStream;
            var points = new List<int>();
            
            // Cada ponto da waveform representa o maior pico de amplitude de um bloco de 800 bytes
            // A taxa de amostragem é 8000Hz (PCM 16-bit = 2 bytes por amostra).
            // 800 bytes = 400 amostras. A 8000 amostras por segundo, 400 amostras duram exatamente 0.05 segundos (50ms).
            // Isso produz 20 pontos de waveform por segundo de áudio.
            var buffer = new byte[800];
            int bytesRead;

            while ((bytesRead = await stdoutStream.ReadAsync(buffer, 0, buffer.Length, stoppingToken)) > 0)
            {
                int samples = bytesRead / 2;
                if (samples == 0) continue;

                int maxVal = 0;
                for (int i = 0; i < samples; i++)
                {
                    // Lê cada amostra short (Int16) com sinal
                    short sample = BitConverter.ToInt16(buffer, i * 2);
                    
                    // Aplica cast para int antes do Abs para evitar System.OverflowException em short.MinValue (-32768)
                    int val = Math.Abs((int)sample);
                    if (val > maxVal)
                    {
                        maxVal = val;
                    }
                }

                // Normaliza o pico lido em relação ao limite máximo absoluto de 16-bit (32768) na escala de 0 a 100
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
                    await dbContext.LogEventAsync("Waveformer", "Warning", $"Stem '{stem.StemType}' removida por ser silenciosa (Pico maximo: {maxPeak}%).", $"AudioUrl: {stem.AudioUrl}", stem.TrackId, cancellationToken: stoppingToken);
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
            await dbContext.LogEventAsync("Waveformer", "Success", $"Waveform gerada para a stem '{stem.StemType}' ({points.Count} pontos).", $"AudioUrl: {stem.AudioUrl}", stem.TrackId, cancellationToken: stoppingToken);
            await transaction.CommitAsync(stoppingToken);

            logger.LogInformation($"[WAVEFORM SUCCESS] Waveform processada com sucesso para a stem: {stem.StemId} ({points.Count} pontos).");
            return true;
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(stoppingToken);
            logger.LogError(ex, $"[WAVEFORM ERROR] Falha no processamento da stem.");
            try
            {
                await dbContext.LogEventAsync("Waveformer", "Error", $"Falha ao gerar waveform para a stem '{stem?.StemType}'.", ex.ToString(), stem?.TrackId, cancellationToken: stoppingToken);
            }
            catch {}
            return false;
        }
    }
}
