using Microsoft.EntityFrameworkCore;
using Mixer8.Extractor.Domain;
using Mixer8.Extractor.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Playwright;
using System;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;

namespace Mixer8.Extractor;

/// <summary>
/// Worker Service de Background que consome a fila de extração de Stems
/// a partir do banco de dados PostgreSQL usando locks de concorrência.
/// </summary>
public class Worker(ILogger<Worker> logger, IServiceProvider serviceProvider, IConfiguration configuration) : BackgroundService
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
            // Sincroniza cookies do Moises.ai a partir do banco PostgreSQL
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Sincronizando cookies do Moises.ai", db, stoppingToken);

            var configDir = configuration["EXTRACTOR_CONFIG_DIR"] ?? "./mixer8-extractor/config";
            if (!Path.IsPathRooted(configDir))
            {
                var baseDir = AppContext.BaseDirectory;
                var resolved = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", configDir));
                if (!Directory.Exists(resolved))
                {
                    resolved = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", configDir));
                }
                if (!Directory.Exists(resolved))
                {
                    resolved = Path.GetFullPath(Path.Combine(baseDir, "..", configDir));
                }
                if (!Directory.Exists(resolved))
                {
                    resolved = Path.GetFullPath(Path.Combine(baseDir, configDir));
                }
                configDir = resolved;
            }

            if (!Directory.Exists(configDir))
            {
                Directory.CreateDirectory(configDir);
            }

            var filePath = Path.Combine(configDir, "auth.json");

            // Busca no banco o JSON de cookies mais atualizado
            var sessionSetting = await db.SystemSettings.FindAsync("MoisesSession_AuthJson");
            if (sessionSetting != null && !string.IsNullOrWhiteSpace(sessionSetting.Value))
            {
                bool precisaGravar = true;
                if (File.Exists(filePath))
                {
                    var conteudoLocal = await File.ReadAllTextAsync(filePath, stoppingToken);
                    if (conteudoLocal == sessionSetting.Value)
                    {
                        precisaGravar = false;
                    }
                }

                if (precisaGravar)
                {
                    logger.LogInformation("[WORKER] Novo arquivo de cookies detectado no banco de dados. Sincronizando em disco...");
                    await File.WriteAllTextAsync(filePath, sessionSetting.Value, stoppingToken);
                }
            }
            else
            {
                logger.LogWarning("[WORKER WARNING] Nenhuma sessão ativa 'MoisesSession_AuthJson' foi encontrada na tabela SystemSettings do banco PostgreSQL.");
            }

            // 1. Resolução resiliente do diretório de downloads
            var downloadsDir = configuration["EXTRACTOR_DOWNLOADS_DIR"] ?? "./mixer8-extractor/downloads";
            if (!Path.IsPathRooted(downloadsDir))
            {
                var baseDir = AppContext.BaseDirectory;
                var resolved = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", downloadsDir));
                if (!Directory.Exists(resolved))
                {
                    resolved = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", downloadsDir));
                }
                if (!Directory.Exists(resolved))
                {
                    resolved = Path.GetFullPath(Path.Combine(baseDir, "..", downloadsDir));
                }
                if (!Directory.Exists(resolved))
                {
                    resolved = Path.GetFullPath(Path.Combine(baseDir, downloadsDir));
                }
                downloadsDir = resolved;
            }

            if (!Directory.Exists(downloadsDir))
            {
                throw new DirectoryNotFoundException($"[WORKER ERROR] Diretório de downloads não encontrado: {downloadsDir}");
            }

            // 2. Busca o arquivo original carregado no upload (ex: downloads/{trackId}.mp3)
            var files = Directory.GetFiles(downloadsDir, $"{track.TrackId}.*");
            var originalFile = files.FirstOrDefault();

            if (string.IsNullOrEmpty(originalFile) || !File.Exists(originalFile))
            {
                throw new FileNotFoundException($"[WORKER ERROR] Arquivo original do upload não encontrado em {downloadsDir} com o ID {track.TrackId}");
            }

            // 3. Inicializa o Playwright
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Inicializando o Playwright", db, stoppingToken);
            using var playwright = await Playwright.CreateAsync();

            // Configurações do Navegador
            var configDirForProfile = configuration["EXTRACTOR_CONFIG_DIR"] ?? "./mixer8-extractor/config";
            if (!Path.IsPathRooted(configDirForProfile))
            {
                var baseDir = AppContext.BaseDirectory;
                var resolved = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", configDirForProfile));
                if (!Directory.Exists(resolved))
                {
                    resolved = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", configDirForProfile));
                }
                if (!Directory.Exists(resolved))
                {
                    resolved = Path.GetFullPath(Path.Combine(baseDir, "..", configDirForProfile));
                }
                if (!Directory.Exists(resolved))
                {
                    resolved = Path.GetFullPath(Path.Combine(baseDir, configDirForProfile));
                }
                configDirForProfile = resolved;
            }
            var userProfileDir = Path.Combine(configDirForProfile, "user_profile");
            if (!Directory.Exists(userProfileDir))
            {
                Directory.CreateDirectory(userProfileDir);
            }
            var headlessStr = configuration["EXTRACTOR_HEADLESS"] ?? "true";
            bool isHeadless = !string.Equals(headlessStr, "false", StringComparison.OrdinalIgnoreCase);
            
            var slowMoStr = configuration["EXTRACTOR_SLOW_MO"] ?? "0";
            int slowMo = int.TryParse(slowMoStr, out var sm) ? sm : 0;

            var contextOptions = new BrowserTypeLaunchPersistentContextOptions
            {
                Headless = isHeadless,
                SlowMo = slowMo,
                Args = new[] 
                { 
                    "--no-sandbox", 
                    "--disable-setuid-sandbox", 
                    "--disable-dev-shm-usage",
                    "--disable-web-security",
                    "--disable-blink-features=AutomationControlled", // Anti-bot stealth
                    "--use-gl=angle", 
                    "--use-angle=swiftshader"
                },
                UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                ViewportSize = new ViewportSize { Width = 1280, Height = 800 },
                Locale = "pt-BR",
                TimezoneId = "America/Sao_Paulo"
            };

            logger.LogInformation($"[WORKER] Lançando Chromium com Perfil Persistente (Headless: {isHeadless}, SlowMo: {slowMo}ms, Perfil: {userProfileDir})...");
            
            var context = await playwright.Chromium.LaunchPersistentContextAsync(userProfileDir, contextOptions);
            var page = context.Pages.FirstOrDefault() ?? await context.NewPageAsync();

            // 4. Acessa a página de Upload Split
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Acessando a tela de Upload do Moises.ai", db, stoppingToken);
            logger.LogInformation("[WORKER] Acessando a página de upload: https://studio.moises.ai/upload/split");
            
            await page.GotoAsync("https://studio.moises.ai/upload/split", new PageGotoOptions 
            { 
                Timeout = 60000, 
                WaitUntil = WaitUntilState.NetworkIdle 
            });

            // Pequeno delay anti-bot
            await Task.Delay(Random.Shared.Next(1000, 2000), stoppingToken);

            // Se redirecionou para o login, significa que os cookies expiraram
            if (page.Url.Contains("/login") || page.Url.Contains("/auth/login"))
            {
                throw new UnauthorizedAccessException("[WORKER ERROR] A sessão de cookies do Moises.ai expirou. É necessário reimportar a sessão no painel Admin.");
            }

            // 5. Upload do Arquivo no Dropzone do Moises
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Enviando áudio original para o Moises.ai", db, stoppingToken);
            logger.LogInformation($"[WORKER] Realizando upload do arquivo original para o Moises: {originalFile}");

            // O Playwright seleciona e injeta o arquivo no input oculto de uploads
            var fileInputSelector = "input[type='file']";
            await page.WaitForSelectorAsync(fileInputSelector, new PageWaitForSelectorOptions { Timeout = 20000 });
            var fileInput = await page.QuerySelectorAsync(fileInputSelector);
            if (fileInput == null)
            {
                throw new InvalidOperationException("[WORKER ERROR] Não foi possível localizar o input de arquivos do Moises.ai.");
            }
            await fileInput.SetInputFilesAsync(originalFile);

            logger.LogInformation("[WORKER] Arquivo selecionado no input do navegador. Aguardando processamento da seleção de stems...");

            // 6. Tela de Seleção de Stems
            // O Moises redireciona automaticamente para a tela de stems (split).
            // O padrão da conta do usuário já vem pré-selecionado (5 stems). Clicamos em "Enviar".
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Configurando divisão de stems (Moises)", db, stoppingToken);

            var submitButtonSelector = "button:has-text('Enviar'), button:has-text('Submit'), button:has(svg)";
            await page.WaitForSelectorAsync(submitButtonSelector, new PageWaitForSelectorOptions { Timeout = 60000 });
            await Task.Delay(Random.Shared.Next(1500, 3000), stoppingToken); // delay humano anti-bot
            
            logger.LogInformation("[WORKER] Clicando no botão 'Enviar' para iniciar a extração...");
            await page.ClickAsync(submitButtonSelector);

            // 7. Retorno à Biblioteca
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Aguardando retorno para a Biblioteca", db, stoppingToken);
            logger.LogInformation("[WORKER] Aguardando redirecionamento para a biblioteca...");
            
            await page.WaitForURLAsync("**/library**", new PageWaitForURLOptions { Timeout = 120000 });
            await Task.Delay(Random.Shared.Next(3000, 5000), stoppingToken); // delay humano de carregamento

            // 8. Clicar no primeiro áudio da lista (mais recente)
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Identificando a música na Biblioteca", db, stoppingToken);
            logger.LogInformation("[WORKER] Localizando a música mais recente na lista...");

            // Aguarda a tabela/grade de faixas carregar
            await page.WaitForSelectorAsync("table, .track-list, .track-row, tr, [role='row']", new PageWaitForSelectorOptions { Timeout = 45000 });
            
            // Clicamos na primeira linha ou no primeiro td clicável
            var firstRowSelector = ".track-row:first-child, tr:first-child td, .track-list-item:first-child, td a";
            await page.ClickAsync(firstRowSelector);
            await Task.Delay(Random.Shared.Next(2000, 4000), stoppingToken);

            // 9. DAW (Player): Aguardar o processamento das faixas
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Aguardando separação de stems na DAW", db, stoppingToken);
            logger.LogInformation("[WORKER] DAW / Player carregado. Monitorando processamento das stems...");

            // Monitoramos a presença e a ativação do botão "Exportar" que é habilitado quando pronto
            var exportButtonSelector = "button:has-text('Exportar'), button:has-text('Export')";
            
            logger.LogInformation("[WORKER] Monitorando o botão de Exportar na DAW. Limite de espera de 15 minutos...");
            
            bool dawPronto = false;
            int tentativasDAW = 90; // 90 * 10s = 15 minutos
            while (!dawPronto && tentativasDAW > 0)
            {
                tentativasDAW--;
                await Task.Delay(10000, stoppingToken);
                
                var exportButton = page.Locator(exportButtonSelector).First;
                if (await exportButton.CountAsync() > 0)
                {
                    bool isEnabled = await exportButton.IsEnabledAsync();
                    if (isEnabled)
                    {
                        dawPronto = true;
                        logger.LogInformation("[WORKER] Status: Áudio processado e botão 'Exportar' ativo!");
                    }
                    else
                    {
                        logger.LogInformation($"[WORKER] Status: Faixas ainda em processamento na DAW... (Tentativas restantes: {tentativasDAW})");
                    }
                }
                else
                {
                    logger.LogInformation($"[WORKER] Status: DAW carregando interface... (Tentativas restantes: {tentativasDAW})");
                }
            }

            if (!dawPronto)
            {
                throw new TimeoutException("[WORKER ERROR] O processamento das stems demorou mais que o esperado (limite de 15 min).");
            }

            // 10. Menu de Exportação e Download
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Exportando stems selecionadas", db, stoppingToken);
            logger.LogInformation("[WORKER] Clicando no botão 'Exportar'...");
            await page.ClickAsync(exportButtonSelector);
            await Task.Delay(Random.Shared.Next(1500, 2500), stoppingToken);

            // Clica na opção "Exportar todos os canais" / "Export all tracks"
            var exportAllSelector = "button:has-text('Exportar todos os canais'), button:has-text('Export all tracks'), text=Exportar todos os canais";
            logger.LogInformation("[WORKER] Solicitando exportação de todas as faixas...");
            
            // Intercepta o download
            var downloadTask = page.WaitForDownloadAsync();
            await page.ClickAsync(exportAllSelector);
            
            logger.LogInformation("[WORKER] Aguardando preparação do ZIP e início do download das stems...");
            var download = await downloadTask;
            
            var zipPath = Path.Combine(downloadsDir, $"{track.TrackId}_stems.zip");
            logger.LogInformation($"[WORKER] Download iniciado! Gravando arquivo ZIP em: {zipPath}");
            await download.SaveAsAsync(zipPath);

            logger.LogInformation($"[WORKER SUCCESS] Download do ZIP de stems finalizado com sucesso: {zipPath}");

            // Fecha o contexto do navegador com segurança
            await context.DisposeAsync();

            // Etapa 11: Invoca o endpoint do backend para que ele processe e converta tudo para Opus
            var apiUrl = configuration["API_URL"];
            if (string.IsNullOrEmpty(apiUrl))
            {
                var apiPort = configuration["API_PORT"] ?? "5000";
                apiUrl = $"http://localhost:{apiPort}";
            }
            apiUrl = apiUrl.TrimEnd('/');

            using var httpClient = new HttpClient();
            httpClient.Timeout = TimeSpan.FromMinutes(5);

            var requestUrl = $"{apiUrl}/api/Tracks/{track.TrackId}/ProcessStemsZip";
            logger.LogInformation($"[WORKER] Disparando requisição POST para: {requestUrl}");

            var response = await httpClient.PostAsync(requestUrl, null, stoppingToken);
            if (!response.IsSuccessStatusCode)
            {
                var errorContent = await response.Content.ReadAsStringAsync(stoppingToken);
                throw new Exception($"[WORKER ERROR] Chamada ao endpoint ProcessStemsZip falhou com status {response.StatusCode}. Erro: {errorContent}");
            }

            logger.LogInformation($"[WORKER SUCCESS] Música '{track.TrackTitle}' finalizada, stems convertidas para Opus e persistidas no banco com sucesso!");
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
