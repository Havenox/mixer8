using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Net.Http;
using Mixer8.Downloader.Domain;
using Mixer8.Downloader.Infrastructure;
using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Mixer8.Downloader;

/// <summary>
/// Worker Service de Background que consome a fila de downloads de mídias externas
/// a partir do banco de dados PostgreSQL usando locks de concorrência e o yt-dlp.
/// </summary>
public class Worker(ILogger<Worker> logger, IServiceProvider serviceProvider, IConfiguration configuration) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("[DOWNLOADER] Microsserviço de Download Mixer8 iniciado em .NET 10.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessNextQueueItemAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "[DOWNLOADER ERROR] Ocorreu uma falha no processamento da fila de downloads.");
            }

            await Task.Delay(5000, stoppingToken); // Polling a cada 5 segundos
        }
    }

    private async Task ProcessNextQueueItemAsync(CancellationToken stoppingToken)
    {
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
                    .FromSqlRaw("SELECT * FROM \"Tracks\" WHERE \"ExtractionStatus\" = 'AguardandoDownload' ORDER BY \"CreatedAt\" ASC LIMIT 1 FOR UPDATE SKIP LOCKED")
                    .FirstOrDefaultAsync(stoppingToken);

                if (track != null)
                {
                    track.ExtractionStatus = "Processando: Baixando mídia";
                    await db.SaveChangesAsync(stoppingToken);
                    await transaction.CommitAsync(stoppingToken);
                    logger.LogInformation($"[DOWNLOADER] Música '{track.TrackTitle}' capturada com sucesso para download.");
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "[DOWNLOADER ERROR] Erro ao realizar lock transacional.");
                await transaction.RollbackAsync(stoppingToken);
                return;
            }
        }

        if (track != null)
        {
            var downloadsDir = configuration["EXTRACTOR_DOWNLOADS_DIR"] ?? "./mixer8-extractor/downloads";
            if (!Path.IsPathRooted(downloadsDir))
            {
                downloadsDir = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", downloadsDir));
                if (!Directory.Exists(downloadsDir)) downloadsDir = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", downloadsDir));
                if (!Directory.Exists(downloadsDir)) downloadsDir = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", downloadsDir));
                if (!Directory.Exists(downloadsDir)) downloadsDir = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, downloadsDir));
            }

            if (!Directory.Exists(downloadsDir))
            {
                Directory.CreateDirectory(downloadsDir);
            }

            var outputTemplate = Path.Combine(downloadsDir, $"{track.TrackId}.%(ext)s");
            var finalFilePath = Path.Combine(downloadsDir, $"{track.TrackId}.opus");

            // Executa o download via yt-dlp
            var success = await RunYtdlpAsync(track.DownloadUrl!, outputTemplate);

            using var updateScope = serviceProvider.CreateScope();
            var updateDb = updateScope.ServiceProvider.GetRequiredService<Mixer8DbContext>();
            var dbTrack = await updateDb.Tracks.FindAsync(track.TrackId);

            if (dbTrack != null)
            {
                bool uploadSuccess = false;
                if (success && File.Exists(finalFilePath))
                {
                    logger.LogInformation($"[DOWNLOADER] Download concluído com sucesso. Iniciando upload via HTTP...");
                    uploadSuccess = await UploadCompletedAudioAsync(track.TrackId, finalFilePath, stoppingToken);
                }

                if (uploadSuccess)
                {
                    logger.LogInformation($"[DOWNLOADER] Upload HTTP bem-sucedido para {track.TrackId}. Limpando arquivo local...");
                    try
                    {
                        if (File.Exists(finalFilePath))
                        {
                            File.Delete(finalFilePath);
                        }
                    }
                    catch (Exception ex)
                    {
                        logger.LogWarning($"[DOWNLOADER] Falha ao deletar arquivo local: {ex.Message}");
                    }
                }
                else
                {
                    logger.LogError($"[DOWNLOADER] Falha no download ou no upload via HTTP para {track.TrackId}. Marcando como Falhou.");
                    dbTrack.ExtractionStatus = "Falhou";
                    await updateDb.SaveChangesAsync(stoppingToken);

                    try
                    {
                        if (File.Exists(finalFilePath))
                        {
                            File.Delete(finalFilePath);
                        }
                    }
                    catch {}
                }
            }
        }
    }

    private static async Task<bool> RunYtdlpAsync(string downloadUrl, string outputPath)
    {
        Console.WriteLine($"[YT-DLP] Iniciando download: {downloadUrl} -> {outputPath}");
        var startInfo = new System.Diagnostics.ProcessStartInfo
        {
            FileName = "yt-dlp",
            Arguments = $"-x --audio-format opus --audio-quality 96K -o \"{outputPath}\" \"{downloadUrl}\"",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = new System.Diagnostics.Process { StartInfo = startInfo };
        var stdoutBuilder = new StringBuilder();
        var stderrBuilder = new StringBuilder();

        process.OutputDataReceived += (sender, e) =>
        {
            if (e.Data != null)
            {
                stdoutBuilder.AppendLine(e.Data);
                Console.WriteLine($"[YT-DLP OUT] {e.Data}");
            }
        };
        process.ErrorDataReceived += (sender, e) =>
        {
            if (e.Data != null)
            {
                stderrBuilder.AppendLine(e.Data);
                Console.WriteLine($"[YT-DLP ERR] {e.Data}");
            }
        };

        try
        {
            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();

            await process.WaitForExitAsync();

            Console.WriteLine($"[YT-DLP] Processo finalizado com ExitCode={process.ExitCode}");
            return process.ExitCode == 0;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[YT-DLP EXCEPTION] Falha ao executar download: {ex.Message}");
            return false;
        }
    }

    private static async Task<double> GetAudioDurationAsync(string filePath)
    {
        Console.WriteLine($"[FFPROBE] Lendo duração do arquivo: {filePath}");
        var startInfo = new System.Diagnostics.ProcessStartInfo
        {
            FileName = "ffprobe",
            Arguments = $"-v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 \"{filePath}\"",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = new System.Diagnostics.Process { StartInfo = startInfo };
        var stdoutBuilder = new StringBuilder();
        var stderrBuilder = new StringBuilder();

        process.OutputDataReceived += (sender, e) =>
        {
            if (e.Data != null)
            {
                stdoutBuilder.AppendLine(e.Data);
            }
        };
        process.ErrorDataReceived += (sender, e) =>
        {
            if (e.Data != null)
            {
                stderrBuilder.AppendLine(e.Data);
            }
        };

        try
        {
            process.Start();
            process.BeginOutputReadLine();
            process.BeginErrorReadLine();

            await process.WaitForExitAsync();

            var output = stdoutBuilder.ToString();
            var error = stderrBuilder.ToString();
            Console.WriteLine($"[FFPROBE] Finalizado. ExitCode={process.ExitCode}, Output={output.Trim()}");

            if (process.ExitCode == 0 && double.TryParse(output.Trim(), System.Globalization.CultureInfo.InvariantCulture, out var duration))
            {
                return duration;
            }
            else
            {
                Console.WriteLine($"[FFPROBE ERROR] ExitCode {process.ExitCode}. Output: {output}. Error: {error}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[FFPROBE EXCEPTION] Falha ao ler duração: {ex.Message}");
        }

        return 0;
    }

    private async Task<bool> UploadCompletedAudioAsync(Guid trackId, string filePath, CancellationToken stoppingToken)
    {
        var apiUrl = configuration["API_URL"];
        if (string.IsNullOrEmpty(apiUrl))
        {
            var apiPort = configuration["API_PORT"] ?? "5000";
            apiUrl = $"http://localhost:{apiPort}";
        }
        apiUrl = apiUrl.TrimEnd('/');

        var requestUrl = $"{apiUrl}/api/Tracks/{trackId}/ImportCompleted";
        logger.LogInformation($"[DOWNLOADER] Enviando áudio concluído via POST para {requestUrl}...");

        try
        {
            using var httpClient = new HttpClient();
            httpClient.Timeout = TimeSpan.FromMinutes(10); // Grande timeout para arquivos grandes e conexões lentas

            using var content = new MultipartFormDataContent();
            using var fileStream = File.OpenRead(filePath);
            using var streamContent = new StreamContent(fileStream);

            streamContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("audio/opus");
            content.Add(streamContent, "file", Path.GetFileName(filePath));

            var response = await httpClient.PostAsync(requestUrl, content, stoppingToken);
            if (response.IsSuccessStatusCode)
            {
                logger.LogInformation($"[DOWNLOADER] Envio do áudio finalizado com sucesso!");
                return true;
            }

            var responseStr = await response.Content.ReadAsStringAsync(stoppingToken);
            logger.LogError($"[DOWNLOADER ERROR] Erro na requisição HTTP: {response.StatusCode} - {responseStr}");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, $"[DOWNLOADER EXCEPTION] Falha ao enviar arquivo via HTTP.");
        }

        return false;
    }
}
