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
                    "--disable-blink-features=AutomationControlled" // Anti-bot stealth
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

            // Se redirecionou para o login, tenta efetuar o login automático com as credenciais do .env
            if (page.Url.Contains("/login") || page.Url.Contains("/auth/login") || page.Url.Contains("/auth/"))
            {
                logger.LogInformation("[WORKER] Navegador abriu deslogado. Iniciando rotina de login automático...");

                var extractorLogin = configuration["EXTRACTOR_LOGIN"];
                var extractorPassword = configuration["EXTRACTOR_PASSWORD"];

                if (string.IsNullOrWhiteSpace(extractorLogin) || string.IsNullOrWhiteSpace(extractorPassword) || extractorLogin.Contains("@exemplo.com"))
                {
                    throw new UnauthorizedAccessException("[WORKER ERROR] A sessão expirou e as credenciais 'EXTRACTOR_LOGIN' e 'EXTRACTOR_PASSWORD' não estão configuradas no arquivo .env da raiz.");
                }

                await UpdateTrackStatusAsync(track.TrackId, "Processando: Efetuando login automático", db, stoppingToken);

                // 0.1. Tenta aceitar os cookies para desobstruir a tela se o banner estiver visível
                await AcceptCookiesIfVisibleAsync(page, stoppingToken);

                // 0.2. Clica no botão "Continuar com e-mail" para exibir os inputs
                logger.LogInformation("[WORKER] Procurando o botão 'Continuar com e-mail'...");
                var emailBtnSelectors = new[]
                {
                    "button:has-text('Continuar com e-mail')",
                    "button:has-text('Continue with email')",
                    "button[class*='emailButton']",
                    "button[class*='_emailButton_']"
                };

                bool emailBtnClicked = false;
                foreach (var selector in emailBtnSelectors)
                {
                    try
                    {
                        var emailBtn = page.Locator(selector).First;
                        if (await emailBtn.CountAsync() > 0 && await emailBtn.IsVisibleAsync())
                        {
                            logger.LogInformation($"[WORKER] Clicando no botão 'Continuar com e-mail' via seletor: {selector}");
                            await emailBtn.ClickAsync(new LocatorClickOptions { Timeout = 10000 });
                            emailBtnClicked = true;
                            await Task.Delay(Random.Shared.Next(1500, 2500), stoppingToken);
                            break;
                        }
                    }
                    catch (Exception ex)
                    {
                        logger.LogDebug($"[WORKER DEBUG] Tentativa com {selector} falhou: {ex.Message}");
                    }
                }

                if (!emailBtnClicked)
                {
                    logger.LogWarning("[WORKER WARNING] Não foi possível clicar no botão 'Continuar com e-mail' de forma explícita. Pode ser que já esteja na tela de credenciais.");
                }

                // 1. Espera e preenche o e-mail de forma humana
                var emailSelector = "input[type='email'], input[name='email'], input[placeholder*='email'], input[placeholder*='E-mail']";
                await page.WaitForSelectorAsync(emailSelector, new PageWaitForSelectorOptions { Timeout = 20000 });
                await page.FocusAsync(emailSelector);
                
                logger.LogInformation("[WORKER] Digitando login de forma cadenciada...");
                foreach (var c in extractorLogin)
                {
                    await page.Keyboard.TypeAsync(c.ToString());
                    await Task.Delay(Random.Shared.Next(40, 120), stoppingToken);
                }

                // 2. Preenche a senha de forma humana
                var passwordSelector = "input[type='password'], input[name='password']";
                await page.FocusAsync(passwordSelector);

                logger.LogInformation("[WORKER] Digitando senha...");
                foreach (var c in extractorPassword)
                {
                    await page.Keyboard.TypeAsync(c.ToString());
                    await Task.Delay(Random.Shared.Next(40, 120), stoppingToken);
                }

                // 3. Submete o formulário
                var submitBtnSelector = "button[type='submit'], button:has-text('Entrar'), button:has-text('Log in'), button:has-text('Login')";
                await page.ClickAsync(submitBtnSelector);
                
                logger.LogInformation("[WORKER] Submetendo credenciais...");
                await Task.Delay(Random.Shared.Next(1000, 2000), stoppingToken);

                // 4. Aguarda retornar para a tela de upload/split
                await page.WaitForURLAsync("**/upload/split**", new PageWaitForURLOptions { Timeout = 45000 });
                logger.LogInformation("[WORKER SUCCESS] Login automático concluído! Perfil físico de usuário atualizado.");
                
                await Task.Delay(3000, stoppingToken); // delay humano pós-login
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

            logger.LogInformation("[WORKER] Arquivo selecionado no input do navegador. Aguardando 2 segundos e preparando envio...");
            await Task.Delay(Random.Shared.Next(2000, 3000), stoppingToken);

            // Garante que o banner de cookies está aceito
            await AcceptCookiesIfVisibleAsync(page, stoppingToken);

            // 6. Tela de Seleção de Stems
            // O Moises redireciona automaticamente para a tela de stems (split) ou habilita o botão de Enviar.
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Configurando divisão de stems (Moises)", db, stoppingToken);

            var submitButtonSelector = "button#upload_submit_button, button:has-text('Enviar'), button:has-text('Submit')";
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

            // Limpa cookies banner se reaparecer
            await AcceptCookiesIfVisibleAsync(page, stoppingToken);

            // Aguarda a tabela/grade/flex list de faixas carregar usando o seletor moderno Radix UI
            var firstRowSelector = "span[class*='_titleText_'], div[class*='_titleText_'], .track-row:first-child, tr:first-child td, .track-list-item:first-child, td a";
            await page.WaitForSelectorAsync(firstRowSelector, new PageWaitForSelectorOptions { Timeout = 45000 });
            
            logger.LogInformation("[WORKER] Primeiro item da biblioteca localizado. Clicando...");
            await page.ClickAsync(firstRowSelector);
            await Task.Delay(Random.Shared.Next(2000, 4000), stoppingToken);

            // 9. DAW (Player): Aguardar o processamento das faixas
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Aguardando separação de stems na DAW", db, stoppingToken);
            logger.LogInformation("[WORKER] DAW / Player carregado. Monitorando processamento das stems...");

            // Monitoramos a presença e a ativação do botão "Exportar" que é habilitado quando pronto
            var exportButtonSelector = "button[class*='download-task_buttonExport__'], button:has-text('Exportar'), button:has-text('Export')";
            
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

            // 10. Menu de Exportação e Download com Retry resiliente
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Exportando stems selecionadas", db, stoppingToken);

            var exportAllSelector = "a[class*='download-task-drop_button__'], button:has-text('Exportar todos os canais'), a:has-text('Exportar todos os canais'), text=Exportar todos os canais";
            IDownload? download = null;
            int maxExportRetries = 3;

            for (int retry = 1; retry <= maxExportRetries; retry++)
            {
                try
                {
                    logger.LogInformation($"[WORKER] [Tentativa {retry}/{maxExportRetries}] Clicando no botão 'Exportar'...");
                    
                    // Garante que o banner de cookies está aceito
                    await AcceptCookiesIfVisibleAsync(page, stoppingToken);

                    var exportButton = page.Locator(exportButtonSelector).First;
                    await exportButton.WaitForAsync(new LocatorWaitForOptions { State = WaitForSelectorState.Visible, Timeout = 15000 });
                    await exportButton.ClickAsync();
                    await Task.Delay(Random.Shared.Next(2000, 3000), stoppingToken);

                    logger.LogInformation($"[WORKER] [Tentativa {retry}/{maxExportRetries}] Clicando em 'Exportar todos os canais' e aguardando download...");
                    
                    var exportAllBtn = page.Locator(exportAllSelector).First;
                    await exportAllBtn.WaitForAsync(new LocatorWaitForOptions { State = WaitForSelectorState.Visible, Timeout = 15000 });
                    
                    // Intercepta o download
                    var downloadTask = page.WaitForDownloadAsync(new PageWaitForDownloadOptions { Timeout = 120000 });
                    await exportAllBtn.ClickAsync();
                    
                    download = await downloadTask;
                    break; // Download iniciado com sucesso! Sai do loop.
                }
                catch (Exception ex)
                {
                    logger.LogWarning($"[WORKER WARNING] [Tentativa {retry}/{maxExportRetries}] Falha ao exportar/iniciar download: {ex.Message}. Resetando...");
                    
                    // Se falhou, clica em um ponto neutro da tela para fechar eventuais dropdowns abertos e aguarda
                    try
                    {
                        await page.Mouse.ClickAsync(10, 10);
                        await Task.Delay(2000, stoppingToken);
                    }
                    catch { }
                }
            }

            if (download == null)
            {
                throw new TimeoutException("[WORKER ERROR] Falha ao iniciar o download das stems após várias retentativas na DAW.");
            }

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

    private async Task AcceptCookiesIfVisibleAsync(IPage page, CancellationToken stoppingToken)
    {
        try
        {
            var cookieSelectors = new[] 
            { 
                "button.osano-cm-accept", 
                ".osano-cm-accept",
                "button.osano-cm-button--type_accept",
                "button:has-text('Aceitar')", 
                "button:has-text('Accept')",
                "button:has-text('Negar não essencial')"
            };

            foreach (var selector in cookieSelectors)
            {
                var locator = page.Locator(selector).First;
                if (await locator.CountAsync() > 0 && await locator.IsVisibleAsync())
                {
                    logger.LogInformation($"[WORKER] Banner de consentimento detectado ({selector}). Clicando em Aceitar...");
                    await locator.ClickAsync(new LocatorClickOptions { Timeout = 5000 });
                    await Task.Delay(Random.Shared.Next(1000, 1500), stoppingToken);
                    break;
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogDebug($"[WORKER DEBUG] Erro ou banner de cookies ausente/já fechado: {ex.Message}");
        }
    }
}

