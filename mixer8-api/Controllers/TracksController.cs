using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Mixer8.Api.Domain;
using Mixer8.Api.Infrastructure;
using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;

namespace Mixer8.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TracksController(Mixer8DbContext dbContext, IConfiguration configuration, IMemoryCache memoryCache) : ControllerBase
{
    private static readonly string[] AllowedMediaExtensions = { 
        ".mp3", ".wav", ".ogg", ".aac", ".flac", ".opus", ".m4a", ".wma",
        ".mp4", ".mkv", ".avi", ".mov", ".flv", ".webm", ".m4v", ".3gp", ".ts"
    };
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? page, [FromQuery] int? limit)
    {
        var query = dbContext.Tracks
            .Include(t => t.Stems)
            .OrderByDescending(t => t.CreatedAt);

        if (page.HasValue && limit.HasValue)
        {
            var p = page.Value;
            var l = limit.Value;
            if (p < 1) p = 1;
            if (l < 1) l = 10;

            var paginatedTracks = await query
                .Skip((p - 1) * l)
                .Take(l)
                .ToListAsync();

            return Ok(paginatedTracks);
        }

        var tracks = await query.ToListAsync();
        return Ok(tracks);
    }

    [Authorize]
    [HttpPost("Upload")]
    public async Task<IActionResult> Upload([FromForm] UploadTrackRequest request)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new { ErrorMessage = "INVALID_TOKEN_CLAIMS" });
        }

        if (request.File == null || request.File.Length == 0)
        {
            return BadRequest(new { ErrorMessage = "FILE_REQUIRED" });
        }

        if (string.IsNullOrWhiteSpace(request.TrackTitle) || string.IsNullOrWhiteSpace(request.ArtistName))
        {
            return BadRequest(new { ErrorMessage = "METADATA_REQUIRED" });
        }

        // Resolve o diretório de destino lendo a configuração do .env
        var downloadsDir = configuration["EXTRACTOR_DOWNLOADS_DIR"] ?? "./mixer8-extractor/downloads";
        
        // Se for caminhos relativos em desenvolvimento baremetal, resolve
        if (!Path.IsPathRooted(downloadsDir))
        {
            downloadsDir = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", downloadsDir));
        }

        // Caso a pasta Downloads não exista fisicamente, cria
        if (!Directory.Exists(downloadsDir))
        {
            Directory.CreateDirectory(downloadsDir);
        }

        var trackId = Guid.NewGuid();
        var fileExtension = Path.GetExtension(request.File.FileName).ToLowerInvariant();
        
        if (!AllowedMediaExtensions.Contains(fileExtension))
        {
            return BadRequest(new { ErrorMessage = "INVALID_AUDIO_FORMAT" });
        }

        // O nome do arquivo no disco será o ID com extensão .opus
        var fileName = $"{trackId}.opus";
        var filePath = Path.Combine(downloadsDir, fileName);

        // Extrai e converte a mídia em memória para Opus estéreo, salvando apenas o .opus leve no disco
        using (var stream = request.File.OpenReadStream())
        {
            var success = await ConvertToOpusAsync(stream, filePath, forceMono: false);
            if (!success)
            {
                return StatusCode(500, new { ErrorMessage = "AUDIO_CONVERSION_FAILED" });
            }
        }

        var durationDouble = await GetAudioDurationAsync(filePath);
        var durationSecs = (int)Math.Round(durationDouble);

        var track = new Track
        {
            TrackId = trackId,
            TrackTitle = request.TrackTitle.Trim(),
            ArtistName = request.ArtistName.Trim(),
            UploadedBy = userId,
            ExtractionStatus = "Aguardando", // Disponível para o Worker capturar
            CreatedAt = DateTime.UtcNow,
            Duration = durationSecs
        };

        dbContext.Tracks.Add(track);
        await dbContext.SaveChangesAsync();

        return Ok(track);
    }

    [Authorize(Roles = "Admin,PaidUser")]
    [HttpPost("UploadChunk")]
    [DisableRequestSizeLimit]
    public async Task<IActionResult> UploadChunk([FromForm] UploadChunkRequest request)
    {
        if (request.File == null || request.File.Length == 0)
        {
            return BadRequest(new { ErrorMessage = "CHUNK_REQUIRED" });
        }

        var tempDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "temp_uploads", request.UploadId);
        if (!Directory.Exists(tempDir))
        {
            Directory.CreateDirectory(tempDir);
        }

        var chunkPath = Path.Combine(tempDir, $"{request.ChunkIndex}.tmp");
        using (var fs = new FileStream(chunkPath, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            await request.File.CopyToAsync(fs);
        }

        Console.WriteLine($"[CHUNK] Recebido chunk {request.ChunkIndex + 1}/{request.TotalChunks} para upload {request.UploadId} ({request.File.Length} bytes)");

        var chunkFiles = Directory.GetFiles(tempDir, "*.tmp")
            .Select(Path.GetFileNameWithoutExtension)
            .Select(f => int.TryParse(f, out var parsed) ? parsed : -1)
            .Where(idx => idx >= 0)
            .ToList();

        if (chunkFiles.Count == request.TotalChunks)
        {
            Console.WriteLine($"[CHUNK] Todos os {request.TotalChunks} chunks recebidos para {request.UploadId}. Iniciando montagem...");
            var finalFilePath = Path.Combine(tempDir, request.FileName);
            using (var finalFs = new FileStream(finalFilePath, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                for (int i = 0; i < request.TotalChunks; i++)
                {
                    var currentChunkPath = Path.Combine(tempDir, $"{i}.tmp");
                    using (var chunkFs = new FileStream(currentChunkPath, FileMode.Open, FileAccess.Read, FileShare.None))
                    {
                        await chunkFs.CopyToAsync(finalFs);
                    }
                    System.IO.File.Delete(currentChunkPath);
                }
            }
            Console.WriteLine($"[CHUNK] Arquivo montado com sucesso em {finalFilePath}");
            return Ok(new { Completed = true, UploadId = request.UploadId });
        }

        return Ok(new { Completed = false });
    }

    [Authorize(Roles = "Admin,PaidUser")]
    [HttpPost("UploadDirect")]
    [DisableRequestSizeLimit]
    public async Task<IActionResult> UploadDirect([FromForm] UploadDirectRequest request)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new { ErrorMessage = "INVALID_TOKEN_CLAIMS" });
        }

        Console.WriteLine($"[API] Recebendo UploadDirect: TrackTitle='{request.TrackTitle}', ArtistName='{request.ArtistName}', FilesCount={request.Files?.Count ?? 0}, UploadIds='{request.UploadIds}'");

        if (string.IsNullOrWhiteSpace(request.TrackTitle) || string.IsNullOrWhiteSpace(request.ArtistName))
        {
            return BadRequest(new { ErrorMessage = "METADATA_REQUIRED" });
        }

        if (string.IsNullOrEmpty(request.UploadIds) && (request.Files == null || request.Files.Count == 0))
        {
            return BadRequest(new { ErrorMessage = "FILES_REQUIRED" });
        }

        // Resolvendo diretório de stems físicas
        var stemsDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "stems");
        if (!Directory.Exists(stemsDir))
        {
            Directory.CreateDirectory(stemsDir);
        }

        var trackId = Guid.NewGuid();
        var trackDir = Path.Combine(stemsDir, trackId.ToString());
        if (!Directory.Exists(trackDir))
        {
            Directory.CreateDirectory(trackDir);
        }

        // Processando CoverFile
        string? coverUrl = null;
        if (request.CoverFile != null && request.CoverFile.Length > 0)
        {
            var coverExt = Path.GetExtension(request.CoverFile.FileName).ToLowerInvariant();
            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };
            if (allowedExtensions.Contains(coverExt))
            {
                var coverPath = Path.Combine(trackDir, "cover.webp");
                await ImageHelper.ProcessAndSaveImageAsync(request.CoverFile, coverPath);
                coverUrl = $"/stems/{trackId}/cover.webp";
            }
        }

        // Mapeia os arquivos a serem processados (sejam chunks temporários ou arquivos diretos)
        var filesToProcess = new List<(string FilePath, string FileName, Stream Stream)>();
        try
        {
            if (!string.IsNullOrEmpty(request.UploadIds))
            {
                var ids = request.UploadIds.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                foreach (var id in ids)
                {
                    var idDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "temp_uploads", id);
                    if (Directory.Exists(idDir))
                    {
                        var filePaths = Directory.GetFiles(idDir);
                        foreach (var fp in filePaths)
                        {
                            if (fp.EndsWith(".tmp")) continue; // Pula chunks temporários residuais
                            var fn = Path.GetFileName(fp);
                            var fs = System.IO.File.OpenRead(fp);
                            filesToProcess.Add((fp, fn, fs));
                        }
                    }
                }
            }
            else if (request.Files != null)
            {
                foreach (var file in request.Files)
                {
                    if (file.Length == 0) continue;
                    filesToProcess.Add(("", file.FileName, file.OpenReadStream()));
                }
            }

            if (filesToProcess.Count == 0)
            {
                if (Directory.Exists(trackDir))
                {
                    Directory.Delete(trackDir, true);
                }
                return BadRequest(new { ErrorMessage = "NO_VALID_FILES_FOUND" });
            }

            // Pré-calculando se é faixa única
            int validFileCount = 0;
            foreach (var f in filesToProcess)
            {
                if (f.Stream.Length == 0) continue;
                var ext = Path.GetExtension(f.FileName).ToLowerInvariant();
                if (ext == ".zip")
                {
                    using var archive = new ZipArchive(f.Stream, ZipArchiveMode.Read, leaveOpen: true);
                    validFileCount += archive.Entries.Count(entry => 
                        !string.IsNullOrEmpty(entry.Name) && 
                        entry.Length > 0 && 
                        AllowedMediaExtensions.Contains(Path.GetExtension(entry.Name).ToLowerInvariant()));
                }
                else if (AllowedMediaExtensions.Contains(ext))
                {
                    validFileCount++;
                }
            }
            bool isSingleTrack = validFileCount == 1;

            var stemsList = new List<Stem>();

            // Processamento das Stems (Arquivos de áudio diretos ou .zip compactado)
            foreach (var f in filesToProcess)
            {
                if (f.Stream.Length == 0) continue;
                var ext = Path.GetExtension(f.FileName).ToLowerInvariant();

                if (ext == ".zip")
                {
                    // Reinicia a posição do stream caso tenha sido lido no pré-cálculo
                    if (f.Stream.CanSeek) f.Stream.Position = 0;

                    using (var archive = new ZipArchive(f.Stream, ZipArchiveMode.Read, leaveOpen: true))
                    {
                        foreach (var entry in archive.Entries)
                        {
                            if (string.IsNullOrEmpty(entry.Name) || entry.Length == 0) continue;

                            var entryExt = Path.GetExtension(entry.Name).ToLowerInvariant();
                            if (!AllowedMediaExtensions.Contains(entryExt)) continue;

                            var stemType = MapFileNameToStemType(entry.Name);
                            var stemFileName = $"{stemType}.opus";
                            var stemPath = Path.Combine(trackDir, stemFileName);

                            bool forceMono = ShouldForceMono(stemType, isSingleTrack);

                            using (var entryStream = entry.Open())
                            {
                                var success = await ConvertToOpusAsync(entryStream, stemPath, forceMono);
                                if (!success) continue;
                            }

                            var existing = stemsList.FirstOrDefault(s => s.StemType == stemType);
                            if (existing != null)
                            {
                                stemsList.Remove(existing);
                            }

                            stemsList.Add(new Stem
                            {
                                StemId = Guid.NewGuid(),
                                TrackId = trackId,
                                StemType = stemType,
                                AudioUrl = $"/stems/{trackId}/{stemFileName}",
                                CreatedAt = DateTime.UtcNow
                            });
                        }
                    }
                }
                else if (AllowedMediaExtensions.Contains(ext))
                {
                    if (f.Stream.CanSeek) f.Stream.Position = 0;

                    var stemType = MapFileNameToStemType(f.FileName);
                    var stemFileName = $"{stemType}.opus";
                    var stemPath = Path.Combine(trackDir, stemFileName);

                    bool forceMono = ShouldForceMono(stemType, isSingleTrack);

                    var success = await ConvertToOpusAsync(f.Stream, stemPath, forceMono);
                    if (success)
                    {
                        var existing = stemsList.FirstOrDefault(s => s.StemType == stemType);
                        if (existing != null)
                        {
                            stemsList.Remove(existing);
                        }

                        stemsList.Add(new Stem
                        {
                            StemId = Guid.NewGuid(),
                            TrackId = trackId,
                            StemType = stemType,
                            AudioUrl = $"/stems/{trackId}/{stemFileName}",
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                }
            }

            if (stemsList.Count == 0)
            {
                if (Directory.Exists(trackDir))
                {
                    Directory.Delete(trackDir, true);
                }
                return BadRequest(new { ErrorMessage = "NO_VALID_AUDIO_FILES" });
            }

            int maxDuration = 0;
            foreach (var stem in stemsList)
            {
                var physicalPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", stem.AudioUrl.TrimStart('/'));
                if (System.IO.File.Exists(physicalPath))
                {
                    var durationDouble = await GetAudioDurationAsync(physicalPath);
                    var durationSecs = (int)Math.Round(durationDouble);
                    if (durationSecs > maxDuration)
                    {
                        maxDuration = durationSecs;
                    }
                }
            }

            var track = new Track
            {
                TrackId = trackId,
                TrackTitle = request.TrackTitle.Trim(),
                ArtistName = request.ArtistName.Trim(),
                UploadedBy = userId,
                ExtractionStatus = "Pronto",
                CreatedAt = DateTime.UtcNow,
                Stems = stemsList,
                CoverUrl = coverUrl,
                Duration = maxDuration
            };

            dbContext.Tracks.Add(track);
            await dbContext.SaveChangesAsync();

            return Ok(track);
        }
        finally
        {
            // Libera todos os streams físicos/arquivos abertos com segurança
            foreach (var f in filesToProcess)
            {
                await f.Stream.DisposeAsync();
            }

            // Realiza a limpeza de todos os diretórios temporários dos chunks montados
            if (!string.IsNullOrEmpty(request.UploadIds))
            {
                var ids = request.UploadIds.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                foreach (var id in ids)
                {
                    var idDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "temp_uploads", id);
                    if (Directory.Exists(idDir))
                    {
                        try
                        {
                            Directory.Delete(idDir, true);
                            Console.WriteLine($"[CLEANUP] Diretório temporário {id} excluído com sucesso.");
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"[CLEANUP ERROR] Falha ao excluir pasta temporária de upload {id}: {ex.Message}");
                        }
                    }
                }
            }
        }
    }

    private static string MapFileNameToStemType(string fileName)
    {
        var lower = fileName.ToLowerInvariant();
        if (lower.Contains("backing_vocals") || lower.Contains("backingvocals") || lower.Contains("vocal_de_apoio"))
            return "Vocal";
        if (lower.Contains("vocals") || lower.Contains("vocais") || lower.Contains("voz"))
            return "Voz";
        if (lower.Contains("drums") || lower.Contains("bateria") || lower.Contains("percussion"))
            return "Bateria";
        if (lower.Contains("bass") || lower.Contains("baixo"))
            return "Baixo";
        if (lower.Contains("lead") || lower.Contains("solo"))
            return "Guitarra Solo";
        if (lower.Contains("rhythm") || lower.Contains("base"))
            return "Guitarra Base";
        if (lower.Contains("guitar") || lower.Contains("guitarra"))
            return "Guitarra";
        if (lower.Contains("keys") || lower.Contains("keyboard") || lower.Contains("teclado"))
            return "Teclado";
        if (lower.Contains("piano") || lower.Contains("pian"))
            return "Piano";
        if (lower.Contains("strings") || lower.Contains("cordas") || lower.Contains("violin") || lower.Contains("cello"))
            return "Cordas";
        if (lower.Contains("sopro") || lower.Contains("wind") || lower.Contains("brass") || lower.Contains("horns"))
            return "Sopro";
        if (lower.Contains("metronome") || lower.Contains("metronomo") || lower.Contains("metrônomo") || lower.Contains("click"))
            return "Metrônomo";
        
        return "Outros";
    }

    [AllowAnonymous]
    [HttpPost("{id}/ProcessStemsZip")]
    public async Task<IActionResult> ProcessStemsZip(Guid id)
    {
        var track = await dbContext.Tracks.Include(t => t.Stems).FirstOrDefaultAsync(t => t.TrackId == id);
        if (track == null)
        {
            return NotFound(new { ErrorMessage = "TRACK_NOT_FOUND" });
        }

        var downloadsDir = configuration["EXTRACTOR_DOWNLOADS_DIR"] ?? "./mixer8-extractor/downloads";
        if (!Path.IsPathRooted(downloadsDir))
        {
            downloadsDir = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", downloadsDir));
        }

        var zipFileName = $"{id}_stems.zip";
        var zipPath = Path.Combine(downloadsDir, zipFileName);

        if (!System.IO.File.Exists(zipPath))
        {
            return BadRequest(new { ErrorMessage = "ZIP_FILE_NOT_FOUND" });
        }

        var stemsDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "stems");
        if (!Directory.Exists(stemsDir))
        {
            Directory.CreateDirectory(stemsDir);
        }

        var trackDir = Path.Combine(stemsDir, id.ToString());
        if (!Directory.Exists(trackDir))
        {
            Directory.CreateDirectory(trackDir);
        }

        var stemsList = new List<Stem>();

        // Extração em memória segura e validação
        using (var archiveStream = System.IO.File.OpenRead(zipPath))
        {
            using (var archive = new ZipArchive(archiveStream, ZipArchiveMode.Read))
            {
                foreach (var entry in archive.Entries)
                {
                    if (string.IsNullOrEmpty(entry.Name) || entry.Length == 0) continue;

                    var entryExt = Path.GetExtension(entry.Name).ToLowerInvariant();
                    if (!AllowedMediaExtensions.Contains(entryExt)) continue;

                    var stemType = MapFileNameToStemType(entry.Name);
                    var stemFileName = $"{stemType}.opus";
                    var stemPath = Path.Combine(trackDir, stemFileName);

                    using (var entryStream = entry.Open())
                    {
                        var success = await ConvertToOpusAsync(entryStream, stemPath, ShouldForceMono(stemType, isSingleTrack: false));
                        if (!success) continue;
                    }

                    var existing = stemsList.FirstOrDefault(s => s.StemType == stemType);
                    if (existing != null)
                    {
                        stemsList.Remove(existing);
                    }

                    stemsList.Add(new Stem
                    {
                        StemId = Guid.NewGuid(),
                        TrackId = id,
                        StemType = stemType,
                        AudioUrl = $"/stems/{id}/{stemFileName}",
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }
        }

        if (stemsList.Count == 0)
        {
            if (Directory.Exists(trackDir) && Directory.GetFileSystemEntries(trackDir).Length == 0)
            {
                Directory.Delete(trackDir, true);
            }
            return BadRequest(new { ErrorMessage = "NO_VALID_AUDIO_FILES_IN_ZIP" });
        }

        int maxDuration = 0;
        foreach (var stem in stemsList)
        {
            var physicalPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", stem.AudioUrl.TrimStart('/'));
            if (System.IO.File.Exists(physicalPath))
            {
                var durationDouble = await GetAudioDurationAsync(physicalPath);
                var durationSecs = (int)Math.Round(durationDouble);
                if (durationSecs > maxDuration)
                {
                    maxDuration = durationSecs;
                }
            }
        }

        dbContext.Stems.AddRange(stemsList);
        track.ExtractionStatus = "Pronto";
        track.Duration = maxDuration;
        await dbContext.SaveChangesAsync();

        // Limpeza dos arquivos temporários de downloads para economizar armazenamento
        try
        {
            System.IO.File.Delete(zipPath);

            var originalFiles = Directory.GetFiles(downloadsDir, $"{id}.*");
            foreach (var origFile in originalFiles)
            {
                System.IO.File.Delete(origFile);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CLEANUP ERROR] Falha ao excluir arquivos de downloads temporários: {ex.Message}");
        }

        return Ok(track);
    }

    private static bool ShouldForceMono(string stemType, bool isSingleTrack)
    {
        if (isSingleTrack) return false;
        return stemType == "Voz" || stemType == "Vocal" || stemType == "Vocais" || stemType == "Baixo" || stemType == "Metrônomo";
    }

    private static async Task<bool> ConvertToOpusAsync(Stream inputStream, string outputFilePath, bool forceMono)
    {
        Console.WriteLine($"[FFMPEG] ConvertToOpusAsync iniciado. Mono={forceMono}, Output={outputFilePath}");
        string arguments = forceMono
            ? $"-y -i pipe:0 -ac 1 -c:a libopus -b:a 64k -vbr on -ar 48000 \"{outputFilePath}\""
            : $"-y -i pipe:0 -ac 2 -c:a libopus -b:a 96k -vbr on -ar 48000 \"{outputFilePath}\"";

        var startInfo = new System.Diagnostics.ProcessStartInfo
        {
            FileName = "ffmpeg",
            Arguments = arguments,
            RedirectStandardInput = true,
            RedirectStandardOutput = false,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = new System.Diagnostics.Process { StartInfo = startInfo };
        var stderrBuilder = new StringBuilder();

        // Registra o handler para capturar a saída de erro do FFmpeg de forma totalmente assíncrona
        process.ErrorDataReceived += (sender, e) =>
        {
            if (e.Data != null)
            {
                stderrBuilder.AppendLine(e.Data);
            }
        };

        try
        {
            Console.WriteLine("[FFMPEG] Iniciando processo ffmpeg...");
            process.Start();
            
            // Inicia o consumo assíncrono em segundo plano gerenciado pelo SO
            process.BeginErrorReadLine();
            Console.WriteLine("[FFMPEG] Processo iniciado. Começando gravação de áudio no stdin...");

            // Escreve a entrada in-memory de forma assíncrona na stdin do processo
            var copyTask = inputStream.CopyToAsync(process.StandardInput.BaseStream);
            await copyTask;
            process.StandardInput.Close();
            Console.WriteLine("[FFMPEG] Gravação em stdin concluída. Aguardando saída do ffmpeg...");

            await process.WaitForExitAsync();
            Console.WriteLine($"[FFMPEG] Processo finalizado. ExitCode={process.ExitCode}");

            if (process.ExitCode != 0)
            {
                Console.WriteLine($"[FFMPEG ERROR] Conversão para Opus falhou com ExitCode {process.ExitCode}. Erro: {stderrBuilder}");
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[FFMPEG ERROR] Falha ao executar conversão Opus via FFmpeg: {ex.Message}");
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

    [Authorize(Roles = "Admin")]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var track = await dbContext.Tracks
            .Include(t => t.Stems)
            .FirstOrDefaultAsync(t => t.TrackId == id);

        if (track == null)
        {
            return NotFound(new { ErrorMessage = "TRACK_NOT_FOUND" });
        }

        using var transaction = await dbContext.Database.BeginTransactionAsync();
        try
        {
            dbContext.Tracks.Remove(track);
            await dbContext.SaveChangesAsync();

            // Deletar pasta física de stems
            var stemsDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "stems");
            var trackDir = Path.Combine(stemsDir, id.ToString());
            if (Directory.Exists(trackDir))
            {
                Directory.Delete(trackDir, true);
            }

            // Deletar do downloadsDir temporário se houver
            var downloadsDir = configuration["EXTRACTOR_DOWNLOADS_DIR"] ?? "./mixer8-extractor/downloads";
            if (!Path.IsPathRooted(downloadsDir))
            {
                downloadsDir = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", downloadsDir));
            }
            if (Directory.Exists(downloadsDir))
            {
                var originalFiles = Directory.GetFiles(downloadsDir, $"{id}.*");
                foreach (var origFile in originalFiles)
                {
                    System.IO.File.Delete(origFile);
                }
            }

            await transaction.CommitAsync();
            return NoContent();
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            Console.WriteLine($"[DELETE TRACK ERROR] Falha ao excluir música: {ex.Message}");
            return StatusCode(500, new { ErrorMessage = "DELETE_FAILED", Details = ex.Message });
        }
    }

    [Authorize(Roles = "Admin")]
    [HttpPut("{id}")]
    [DisableRequestSizeLimit]
    public async Task<IActionResult> Update(Guid id, [FromForm] UpdateTrackRequest request)
    {
        var track = await dbContext.Tracks
            .Include(t => t.Stems)
            .FirstOrDefaultAsync(t => t.TrackId == id);

        if (track == null)
        {
            return NotFound(new { ErrorMessage = "TRACK_NOT_FOUND" });
        }

        using var transaction = await dbContext.Database.BeginTransactionAsync();
        try
        {
            // 1. Atualizar metadados textuais
            track.TrackTitle = request.TrackTitle.Trim();
            track.ArtistName = request.ArtistName.Trim();

            var stemsDir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "stems");
            var trackDir = Path.Combine(stemsDir, id.ToString());
            if (!Directory.Exists(trackDir))
            {
                Directory.CreateDirectory(trackDir);
            }

            // 2. Atualizar capa
            var hasNewCoverFile = request.CoverFile != null && request.CoverFile.Length > 0;
            var coverUrlChanged = request.CoverUrl != null && request.CoverUrl.Trim() != (track.CoverUrl ?? "");

            if (hasNewCoverFile || coverUrlChanged)
            {
                // Remover capas antigas com extensões legadas se for um caminho local sob /stems/
                if (!string.IsNullOrWhiteSpace(track.CoverUrl) && track.CoverUrl.StartsWith("/stems/"))
                {
                    var oldExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };
                    foreach (var oldExt in oldExtensions)
                    {
                        var oldFilePath = Path.Combine(trackDir, $"cover{oldExt}");
                        if (System.IO.File.Exists(oldFilePath))
                        {
                            System.IO.File.Delete(oldFilePath);
                        }
                    }
                }
                track.CoverUrl = null;
            }

            if (hasNewCoverFile)
            {
                var coverExt = Path.GetExtension(request.CoverFile!.FileName).ToLowerInvariant();
                var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };
                if (allowedExtensions.Contains(coverExt))
                {
                    var coverPath = Path.Combine(trackDir, "cover.webp");
                    await ImageHelper.ProcessAndSaveImageAsync(request.CoverFile, coverPath);
                    track.CoverUrl = $"/stems/{id}/cover.webp";
                }
            }
            else if (request.CoverUrl != null)
            {
                track.CoverUrl = string.IsNullOrWhiteSpace(request.CoverUrl) ? null : request.CoverUrl.Trim();
            }

            // 3. Deletar stems selecionadas
            var deletedStemIds = new List<Guid>();
            if (!string.IsNullOrWhiteSpace(request.DeleteStemIds))
            {
                deletedStemIds = request.DeleteStemIds.Split(',')
                    .Select(s => s.Trim())
                    .Where(s => Guid.TryParse(s, out _))
                    .Select(Guid.Parse)
                    .ToList();

                foreach (var stemId in deletedStemIds)
                {
                    var stem = track.Stems.FirstOrDefault(s => s.StemId == stemId);
                    if (stem != null)
                    {
                        var physicalPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", stem.AudioUrl.TrimStart('/'));
                        if (System.IO.File.Exists(physicalPath))
                        {
                            System.IO.File.Delete(physicalPath);
                        }
                        dbContext.Stems.Remove(stem);
                    }
                }
            }

            // Calcular se o total final de stems é faixa única para decidir a regra de mono
            int existingStemsCountAfterDelete = track.Stems.Count(s => !deletedStemIds.Contains(s.StemId));
            int newStemsCount = 0;
            if (request.Files != null)
            {
                foreach (var file in request.Files)
                {
                    if (file.Length == 0) continue;
                    var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
                    if (ext == ".zip")
                    {
                        using var archiveStream = file.OpenReadStream();
                        using var archive = new ZipArchive(archiveStream, ZipArchiveMode.Read);
                        newStemsCount += archive.Entries.Count(entry => 
                            !string.IsNullOrEmpty(entry.Name) && 
                            entry.Length > 0 && 
                            AllowedMediaExtensions.Contains(Path.GetExtension(entry.Name).ToLowerInvariant()));
                    }
                    else if (AllowedMediaExtensions.Contains(ext))
                    {
                        newStemsCount++;
                    }
                }
            }
            int totalStemsCount = existingStemsCountAfterDelete + newStemsCount;
            bool isSingleTrack = totalStemsCount <= 1;

            // 4. Processar Substituições de Stems Individuais (Chave: ReplaceStem_{stemId})
            foreach (var file in Request.Form.Files)
            {
                if (file.Name.StartsWith("ReplaceStem_"))
                {
                    var stemIdStr = file.Name.Substring("ReplaceStem_".Length);
                    if (Guid.TryParse(stemIdStr, out var stemId))
                    {
                        var oldStem = track.Stems.FirstOrDefault(s => s.StemId == stemId);
                        if (oldStem != null && file.Length > 0)
                        {
                            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
                            if (AllowedMediaExtensions.Contains(ext))
                            {
                                // Deleta o arquivo físico antigo
                                var oldPhysicalPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", oldStem.AudioUrl.TrimStart('/'));
                                if (System.IO.File.Exists(oldPhysicalPath))
                                {
                                    System.IO.File.Delete(oldPhysicalPath);
                                }

                                var newStemId = Guid.NewGuid();
                                var stemType = MapFileNameToStemType(file.FileName);
                                var stemFileName = $"{stemType}_{newStemId}.opus";
                                var stemPath = Path.Combine(trackDir, stemFileName);

                                bool forceMono = ShouldForceMono(stemType, isSingleTrack);

                                using (var stream = file.OpenReadStream())
                                {
                                    var success = await ConvertToOpusAsync(stream, stemPath, forceMono);
                                    if (success)
                                    {
                                        oldStem.StemType = stemType;
                                        oldStem.AudioUrl = $"/stems/{id}/{stemFileName}";
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 5. Processar Adição de Novas Stems (gerais/novas via Files)
            if (request.Files != null && request.Files.Count > 0)
            {
                foreach (var file in request.Files)
                {
                    if (file.Length == 0) continue;
                    var ext = Path.GetExtension(file.FileName).ToLowerInvariant();

                    if (ext == ".zip")
                    {
                        using (var archiveStream = file.OpenReadStream())
                        {
                            using (var archive = new ZipArchive(archiveStream, ZipArchiveMode.Read))
                            {
                                foreach (var entry in archive.Entries)
                                {
                                    if (string.IsNullOrEmpty(entry.Name) || entry.Length == 0) continue;

                                    var entryExt = Path.GetExtension(entry.Name).ToLowerInvariant();
                                    if (!AllowedMediaExtensions.Contains(entryExt)) continue;

                                    var newStemId = Guid.NewGuid();
                                    var stemType = MapFileNameToStemType(entry.Name);
                                    var stemFileName = $"{stemType}_{newStemId}.opus";
                                    var stemPath = Path.Combine(trackDir, stemFileName);

                                    bool forceMono = ShouldForceMono(stemType, isSingleTrack);

                                    using (var entryStream = entry.Open())
                                    {
                                        var success = await ConvertToOpusAsync(entryStream, stemPath, forceMono);
                                        if (!success) continue;
                                    }

                                    dbContext.Stems.Add(new Stem
                                    {
                                        StemId = newStemId,
                                        TrackId = id,
                                        StemType = stemType,
                                        AudioUrl = $"/stems/{id}/{stemFileName}",
                                        CreatedAt = DateTime.UtcNow
                                    });
                                }
                            }
                        }
                    }
                    else if (AllowedMediaExtensions.Contains(ext))
                    {
                        var newStemId = Guid.NewGuid();
                        var stemType = MapFileNameToStemType(file.FileName);
                        var stemFileName = $"{stemType}_{newStemId}.opus";
                        var stemPath = Path.Combine(trackDir, stemFileName);

                        bool forceMono = ShouldForceMono(stemType, isSingleTrack);

                        using (var stream = file.OpenReadStream())
                        {
                            var success = await ConvertToOpusAsync(stream, stemPath, forceMono);
                            if (success)
                            {
                                dbContext.Stems.Add(new Stem
                                {
                                    StemId = newStemId,
                                    TrackId = id,
                                    StemType = stemType,
                                    AudioUrl = $"/stems/{id}/{stemFileName}",
                                    CreatedAt = DateTime.UtcNow
                                });
                            }
                        }
                    }
                }
            }

            // Recalcular a duração das stems que restaram + novas
            int maxDuration = 0;
            var allStems = dbContext.Stems.Local.Where(s => s.TrackId == id && !deletedStemIds.Contains(s.StemId))
                .Concat(track.Stems.Where(s => !deletedStemIds.Contains(s.StemId)))
                .DistinctBy(s => s.StemId)
                .ToList();

            foreach (var stem in allStems)
            {
                var physicalPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", stem.AudioUrl.TrimStart('/'));
                if (System.IO.File.Exists(physicalPath))
                {
                    var durationDouble = await GetAudioDurationAsync(physicalPath);
                    var durationSecs = (int)Math.Round(durationDouble);
                    if (durationSecs > maxDuration)
                    {
                        maxDuration = durationSecs;
                    }
                }
            }
            track.Duration = maxDuration;

            await dbContext.SaveChangesAsync();
            await transaction.CommitAsync();

            var updatedTrack = await dbContext.Tracks
                .Include(t => t.Stems)
                .FirstOrDefaultAsync(t => t.TrackId == id);

            return Ok(updatedTrack);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            Console.WriteLine($"[UPDATE TRACK ERROR] Falha ao atualizar música: {ex.Message}");
            return StatusCode(500, new { ErrorMessage = "UPDATE_FAILED", Details = ex.Message });
        }
    }

    [HttpPost("{id}/RecordPlay")]
    public async Task<IActionResult> RecordPlay(Guid id, [FromBody] RecordPlayRequest request)
    {
        // 1. Identificar o Usuário / IP
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        string userKey;
        if (userIdClaim != null && Guid.TryParse(userIdClaim, out var userId))
        {
            userKey = $"user_{userId}";
        }
        else
        {
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown_ip";
            userKey = $"ip_{ip}";
        }

        // 2. Buscar a música no banco
        var track = await dbContext.Tracks.FirstOrDefaultAsync(t => t.TrackId == id);
        if (track == null)
        {
            return NotFound(new { ErrorMessage = "TRACK_NOT_FOUND" });
        }

        bool trackIncremented = false;
        bool playlistIncremented = false;
        bool albumIncremented = false;

        // 3. Validar rate limit / cooldown para a Música
        var trackCacheKey = $"play_cooldown:track:{id}:{userKey}";
        if (!memoryCache.TryGetValue(trackCacheKey, out _))
        {
            // Cooldown de Math.Max(track.Duration - 5, 30) segundos
            var cooldownSeconds = Math.Max(track.Duration - 5, 30);
            
            track.PlayCount++;
            trackIncremented = true;

            var cacheOptions = new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = TimeSpan.FromSeconds(cooldownSeconds)
            };
            memoryCache.Set(trackCacheKey, true, cacheOptions);
        }

        // 4. Validar rate limit / cooldown para a Playlist (se informada)
        if (request.PlaylistId.HasValue)
        {
            var playlistId = request.PlaylistId.Value;
            var playlistCacheKey = $"play_cooldown:playlist:{playlistId}:{userKey}";
            if (!memoryCache.TryGetValue(playlistCacheKey, out _))
            {
                var playlist = await dbContext.Playlists.FirstOrDefaultAsync(p => p.PlaylistId == playlistId);
                if (playlist != null)
                {
                    playlist.PlayCount++;
                    playlistIncremented = true;

                    var cacheOptions = new MemoryCacheEntryOptions
                    {
                        AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5)
                    };
                    memoryCache.Set(playlistCacheKey, true, cacheOptions);
                }
            }
        }

        // 5. Validar rate limit / cooldown para o Álbum (se informado)
        if (request.AlbumId.HasValue)
        {
            var albumId = request.AlbumId.Value;
            var albumCacheKey = $"play_cooldown:album:{albumId}:{userKey}";
            if (!memoryCache.TryGetValue(albumCacheKey, out _))
            {
                var album = await dbContext.Albums.FirstOrDefaultAsync(a => a.AlbumId == albumId);
                if (album != null)
                {
                    album.PlayCount++;
                    albumIncremented = true;

                    var cacheOptions = new MemoryCacheEntryOptions
                    {
                        AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5)
                    };
                    memoryCache.Set(albumCacheKey, true, cacheOptions);
                }
            }
        }

        // 6. Salvar as alterações se algum contador foi incrementado
        if (trackIncremented || playlistIncremented || albumIncremented)
        {
            await dbContext.SaveChangesAsync();
        }

        return Ok(new
        {
            Success = true,
            TrackIncremented = trackIncremented,
            PlaylistIncremented = playlistIncremented,
            AlbumIncremented = albumIncremented
        });
    }

    [AllowAnonymous]
    [HttpGet("{id}/original")]
    public IActionResult GetOriginal(Guid id)
    {
        var downloadsDir = configuration["EXTRACTOR_DOWNLOADS_DIR"] ?? "./mixer8-extractor/downloads";
        if (!Path.IsPathRooted(downloadsDir))
        {
            downloadsDir = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", downloadsDir));
        }

        var files = Directory.GetFiles(downloadsDir, $"{id}.*");
        var filePath = files.FirstOrDefault();
        if (string.IsNullOrEmpty(filePath) || !System.IO.File.Exists(filePath))
        {
            return NotFound(new { ErrorMessage = "ORIGINAL_FILE_NOT_FOUND" });
        }

        var ext = Path.GetExtension(filePath).ToLowerInvariant();
        var contentType = ext switch
        {
            ".opus" => "audio/opus",
            ".mp3" => "audio/mpeg",
            ".wav" => "audio/wav",
            ".flac" => "audio/flac",
            ".m4a" => "audio/mp4",
            _ => "application/octet-stream"
        };

        return PhysicalFile(filePath, contentType, enableRangeProcessing: true);
    }
}

public class RecordPlayRequest
{
    public Guid? PlaylistId { get; set; }
    public Guid? AlbumId { get; set; }
}

public class UploadTrackRequest
{
    public IFormFile File { get; set; } = null!;
    public string TrackTitle { get; set; } = null!;
    public string ArtistName { get; set; } = null!;
}

public class UploadDirectRequest
{
    public string TrackTitle { get; set; } = null!;
    public string ArtistName { get; set; } = null!;
    public IFormFile? CoverFile { get; set; }
    public List<IFormFile>? Files { get; set; } = new();
    public string? UploadIds { get; set; }
}

public class UploadChunkRequest
{
    public IFormFile File { get; set; } = null!;
    public string UploadId { get; set; } = null!;
    public int ChunkIndex { get; set; }
    public int TotalChunks { get; set; }
    public string FileName { get; set; } = null!;
}

public class UpdateTrackRequest
{
    public string TrackTitle { get; set; } = null!;
    public string ArtistName { get; set; } = null!;
    public IFormFile? CoverFile { get; set; }
    public string? DeleteStemIds { get; set; }
    public List<IFormFile> Files { get; set; } = new();
    public string? CoverUrl { get; set; }
}
