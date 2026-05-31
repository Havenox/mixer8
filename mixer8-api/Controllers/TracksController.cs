using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Mixer8.Api.Domain;
using Mixer8.Api.Infrastructure;
using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace Mixer8.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TracksController(Mixer8DbContext dbContext, IConfiguration configuration) : ControllerBase
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
    [HttpPost("UploadDirect")]
    [DisableRequestSizeLimit]
    public async Task<IActionResult> UploadDirect([FromForm] UploadDirectRequest request)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (userIdClaim == null || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new { ErrorMessage = "INVALID_TOKEN_CLAIMS" });
        }

        if (string.IsNullOrWhiteSpace(request.TrackTitle) || string.IsNullOrWhiteSpace(request.ArtistName))
        {
            return BadRequest(new { ErrorMessage = "METADATA_REQUIRED" });
        }

        if (request.Files == null || request.Files.Count == 0)
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

        // Pré-calculando se é faixa única
        int validFileCount = 0;
        foreach (var file in request.Files)
        {
            if (file.Length == 0) continue;
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (ext == ".zip")
            {
                using var archiveStream = file.OpenReadStream();
                using var archive = new ZipArchive(archiveStream, ZipArchiveMode.Read);
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
        foreach (var file in request.Files)
        {
            if (file.Length == 0) continue;
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();

            if (ext == ".zip")
            {
                // Extração em memória segura e validação
                using (var archiveStream = file.OpenReadStream())
                {
                    using (var archive = new ZipArchive(archiveStream, ZipArchiveMode.Read))
                    {
                        foreach (var entry in archive.Entries)
                        {
                            if (string.IsNullOrEmpty(entry.Name) || entry.Length == 0) continue;

                            var entryExt = Path.GetExtension(entry.Name).ToLowerInvariant();
                            // Validador de tipo estrito de áudio: Apenas áudios permitidos são persistidos!
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

                            // Evita adicionar duplicatas na lista
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
            }
            else if (AllowedMediaExtensions.Contains(ext))
            {
                var stemType = MapFileNameToStemType(file.FileName);
                var stemFileName = $"{stemType}.opus";
                var stemPath = Path.Combine(trackDir, stemFileName);

                bool forceMono = ShouldForceMono(stemType, isSingleTrack);

                using (var stream = file.OpenReadStream())
                {
                    var success = await ConvertToOpusAsync(stream, stemPath, forceMono);
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
        }

        if (stemsList.Count == 0)
        {
            // Se nenhuma stem válida foi encontrada, apaga a pasta criada e retorna erro
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
            ExtractionStatus = "Pronto", // Salvo diretamente no status final
            CreatedAt = DateTime.UtcNow,
            Stems = stemsList,
            CoverUrl = coverUrl,
            Duration = maxDuration
        };

        dbContext.Tracks.Add(track);
        await dbContext.SaveChangesAsync();

        return Ok(track);
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
        try
        {
            process.Start();

            // Escreve a entrada in-memory de forma assíncrona na stdin do processo
            var copyTask = inputStream.CopyToAsync(process.StandardInput.BaseStream);
            await copyTask;
            process.StandardInput.Close();

            await process.WaitForExitAsync();

            if (process.ExitCode != 0)
            {
                string errorOutput = await process.StandardError.ReadToEndAsync();
                Console.WriteLine($"[FFMPEG ERROR] Conversão para Opus falhou com ExitCode {process.ExitCode}. Erro: {errorOutput}");
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
        try
        {
            process.Start();
            var output = await process.StandardOutput.ReadToEndAsync();
            var error = await process.StandardError.ReadToEndAsync();
            await process.WaitForExitAsync();

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
            if (request.CoverFile != null && request.CoverFile.Length > 0)
            {
                var coverExt = Path.GetExtension(request.CoverFile.FileName).ToLowerInvariant();
                var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };
                if (allowedExtensions.Contains(coverExt))
                {
                    // Remover capas antigas com extensões legadas para evitar arquivos órfãos
                    var oldExtensions = new[] { ".jpg", ".jpeg", ".png", ".webp" };
                    foreach (var oldExt in oldExtensions)
                    {
                        var oldFilePath = Path.Combine(trackDir, $"cover{oldExt}");
                        if (System.IO.File.Exists(oldFilePath))
                        {
                            System.IO.File.Delete(oldFilePath);
                        }
                    }

                    var coverPath = Path.Combine(trackDir, "cover.webp");
                    await ImageHelper.ProcessAndSaveImageAsync(request.CoverFile, coverPath);
                    track.CoverUrl = $"/stems/{id}/cover.webp";
                }
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
    public List<IFormFile> Files { get; set; } = new();
}

public class UpdateTrackRequest
{
    public string TrackTitle { get; set; } = null!;
    public string ArtistName { get; set; } = null!;
    public IFormFile? CoverFile { get; set; }
    public string? DeleteStemIds { get; set; }
    public List<IFormFile> Files { get; set; } = new();
}
