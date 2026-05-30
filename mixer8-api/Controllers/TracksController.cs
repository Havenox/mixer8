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
    private static readonly string[] AllowedAudioExtensions = { ".mp3", ".wav", ".ogg", ".aac", ".flac", ".opus", ".m4a", ".wma" };
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var tracks = await dbContext.Tracks
            .Include(t => t.Stems)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();

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
        
        if (!AllowedAudioExtensions.Contains(fileExtension))
        {
            return BadRequest(new { ErrorMessage = "INVALID_AUDIO_FORMAT" });
        }

        // O nome do arquivo no disco será o próprio ID do banco, evitando conflitos de caracteres especiais
        var fileName = $"{trackId}{fileExtension}";
        var filePath = Path.Combine(downloadsDir, fileName);

        // Salva fisicamente o arquivo original recebido via upload
        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await request.File.CopyToAsync(stream);
        }

        var track = new Track
        {
            TrackId = trackId,
            TrackTitle = request.TrackTitle.Trim(),
            ArtistName = request.ArtistName.Trim(),
            UploadedBy = userId,
            ExtractionStatus = "Aguardando", // Disponível para o Worker capturar
            CreatedAt = DateTime.UtcNow
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
            if (coverExt == ".jpg" || coverExt == ".jpeg" || coverExt == ".png")
            {
                var coverPath = Path.Combine(trackDir, "cover.jpg");
                using (var stream = new FileStream(coverPath, FileMode.Create))
                {
                    await request.CoverFile.CopyToAsync(stream);
                }
                coverUrl = $"/stems/{trackId}/cover.jpg";
            }
        }

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
                            if (!AllowedAudioExtensions.Contains(entryExt)) continue;

                            var stemType = MapFileNameToStemType(entry.Name);
                            var stemFileName = $"{stemType}.opus";
                            var stemPath = Path.Combine(trackDir, stemFileName);

                            using (var entryStream = entry.Open())
                            {
                                var success = await ConvertToOpusAsync(entryStream, stemPath, stemType);
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
            else if (AllowedAudioExtensions.Contains(ext))
            {
                var stemType = MapFileNameToStemType(file.FileName);
                var stemFileName = $"{stemType}.opus";
                var stemPath = Path.Combine(trackDir, stemFileName);

                using (var stream = file.OpenReadStream())
                {
                    var success = await ConvertToOpusAsync(stream, stemPath, stemType);
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

        var track = new Track
        {
            TrackId = trackId,
            TrackTitle = request.TrackTitle.Trim(),
            ArtistName = request.ArtistName.Trim(),
            UploadedBy = userId,
            ExtractionStatus = "Pronto", // Salvo diretamente no status final
            CreatedAt = DateTime.UtcNow,
            Stems = stemsList,
            CoverUrl = coverUrl
        };

        dbContext.Tracks.Add(track);
        await dbContext.SaveChangesAsync();

        return Ok(track);
    }

    private static string MapFileNameToStemType(string fileName)
    {
        var lower = fileName.ToLowerInvariant();
        if (lower.Contains("vocals") || lower.Contains("vocais") || lower.Contains("voz"))
            return "Vocais";
        if (lower.Contains("drums") || lower.Contains("bateria") || lower.Contains("percussion"))
            return "Bateria";
        if (lower.Contains("bass") || lower.Contains("baixo"))
            return "Baixo";
        if (lower.Contains("guitar") || lower.Contains("guitarra"))
            return "Guitarra";
        if (lower.Contains("keyboard") || lower.Contains("teclado"))
            return "Teclado";
        if (lower.Contains("piano"))
            return "Piano";
        if (lower.Contains("sopro") || lower.Contains("wind") || lower.Contains("brass") || lower.Contains("horns"))
            return "Sopro";
        if (lower.Contains("strings") || lower.Contains("cordas") || lower.Contains("violin") || lower.Contains("cello"))
            return "Cordas";
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
                    if (!AllowedAudioExtensions.Contains(entryExt)) continue;

                    var stemType = MapFileNameToStemType(entry.Name);
                    var stemFileName = $"{stemType}.opus";
                    var stemPath = Path.Combine(trackDir, stemFileName);

                    using (var entryStream = entry.Open())
                    {
                        var success = await ConvertToOpusAsync(entryStream, stemPath, stemType);
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

        dbContext.Stems.AddRange(stemsList);
        track.ExtractionStatus = "Pronto";
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

    private static async Task<bool> ConvertToOpusAsync(Stream inputStream, string outputFilePath, string stemType)
    {
        bool forceMono = stemType == "Vocais" || stemType == "Baixo" || stemType == "Metrônomo";
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
