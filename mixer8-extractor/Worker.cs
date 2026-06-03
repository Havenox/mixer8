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
    private IPage? _activePage;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("[WORKER] Extrator de Stems iniciado em .NET 10.");

        // Tarefa paralela de depuração em runtime (permite tirar prints em tempo de execução via flag)
        _ = Task.Run(async () =>
        {
            var configDir = configuration["EXTRACTOR_CONFIG_DIR"] ?? "./mixer8-extractor/config";
            if (!Path.IsPathRooted(configDir))
            {
                var baseDir = AppContext.BaseDirectory;
                var resolved = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", configDir));
                if (!Directory.Exists(resolved)) resolved = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", configDir));
                if (!Directory.Exists(resolved)) resolved = Path.GetFullPath(Path.Combine(baseDir, "..", configDir));
                if (!Directory.Exists(resolved)) resolved = Path.GetFullPath(Path.Combine(baseDir, configDir));
                configDir = resolved;
            }

            var flagPath = Path.Combine(configDir, "take_screenshot.flag");
            var shotPath = Path.Combine(configDir, "screenshot_live.png");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    if (File.Exists(flagPath) && _activePage != null)
                    {
                        Console.WriteLine($"[BOT-DEBUG-LIVE] Flag de screenshot detectada. Capturando tela ativa...");
                        await _activePage.ScreenshotAsync(new PageScreenshotOptions { Path = shotPath, FullPage = true });
                        File.Delete(flagPath);
                        Console.WriteLine($"[BOT-DEBUG-LIVE] Captura efetuada com sucesso! Salva em: {shotPath}");
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[BOT-DEBUG-LIVE] Erro ao processar flag de screenshot: {ex.Message}");
                }
                await Task.Delay(2000, stoppingToken);
            }
        }, stoppingToken);

        // Consulta de depuração inicial para listar as últimas tracks e resetar a última para teste
        using (var scope = serviceProvider.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<Mixer8DbContext>();
            try
            {
                var tracks = await db.Tracks.OrderByDescending(t => t.CreatedAt).Take(5).ToListAsync(stoppingToken);
                Console.WriteLine("[BOT-DEBUG] === ÚLTIMAS 5 TRACKS NO BANCO DE DADOS ===");
                foreach (var t in tracks)
                {
                    Console.WriteLine($"[BOT-DEBUG] ID: {t.TrackId} | Title: {t.TrackTitle} | Status: {t.ExtractionStatus} | Created: {t.CreatedAt}");
                }
                Console.WriteLine("[BOT-DEBUG] =========================================");

                // Auto-reset da última track para facilitar teste contínuo
                var lastTrack = tracks.FirstOrDefault();
                if (lastTrack != null && (lastTrack.ExtractionStatus == "Falhou" || lastTrack.ExtractionStatus.StartsWith("Processando")))
                {
                    Console.WriteLine($"[BOT-DEBUG] Resetando track ID: {lastTrack.TrackId} ({lastTrack.TrackTitle}) de '{lastTrack.ExtractionStatus}' para 'Aguardando'...");
                    lastTrack.ExtractionStatus = "Aguardando";
                    await db.SaveChangesAsync(stoppingToken);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[BOT-DEBUG] Erro ao listar/resetar tracks de depuração: {ex.Message}");
            }
        }

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

        IPage? page = null;
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

            // Configurações do Navegador com Perfil Persistente
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

            var browserChannel = configuration["EXTRACTOR_BROWSER_CHANNEL"] ?? "";

            var contextOptions = new BrowserTypeLaunchPersistentContextOptions
            {
                Headless = isHeadless,
                SlowMo = slowMo,
                Channel = string.IsNullOrEmpty(browserChannel) ? null : browserChannel,
                Args = new[] 
                { 
                    "--no-sandbox", 
                    "--disable-setuid-sandbox", 
                    "--disable-dev-shm-usage",
                    "--disable-blink-features=AutomationControlled", // Anti-bot stealth
                    "--autoplay-policy=no-user-gesture-required",
                    "--use-gl=angle",
                    "--use-angle=gl",
                    "--ignore-gpu-blocklist",
                    "--enable-webgl"
                },
                UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                ViewportSize = new ViewportSize { Width = 1280, Height = 800 },
                Locale = "pt-BR",
                TimezoneId = "America/Sao_Paulo"
            };

            logger.LogInformation($"[WORKER] Lançando Chromium com Perfil Persistente (Headless: {isHeadless}, Canal: {browserChannel}, SlowMo: {slowMo}ms, Perfil: {userProfileDir})...");
            Console.WriteLine($"[BOT-PASSO] Lançando navegador com perfil persistente em: {userProfileDir}");

            var context = await playwright.Chromium.LaunchPersistentContextAsync(userProfileDir, contextOptions);
            
            // Garante que só temos 1 página aberta no perfil persistente e foca nela em primeiro plano
            var pages = context.Pages.ToList();
            page = pages.FirstOrDefault() ?? await context.NewPageAsync();
            _activePage = page;
            
            // Registra listeners para capturar erros e logs do console do navegador para logs informativos de erros
            page.Console += (sender, msg) => 
            {
                if (msg.Type == "error" || msg.Text.Contains("failed", StringComparison.OrdinalIgnoreCase) || msg.Text.Contains("error", StringComparison.OrdinalIgnoreCase))
                {
                    Console.WriteLine($"[BROWSER-CONSOLE] [{msg.Type.ToUpper()}] {msg.Text} (URL: {msg.Location})");
                }
            };
            page.PageError += (sender, exception) => 
            {
                Console.WriteLine($"[BROWSER-UNHANDLED-EXCEPTION] {exception}");
            };

            for (int i = 1; i < pages.Count; i++)
            {
                try { await pages[i].CloseAsync(); } catch { }
            }
            await page.BringToFrontAsync();

            // 4. Acessa a página de Upload Split
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Acessando a tela de Upload do Moises.ai", db, stoppingToken);
            logger.LogInformation("[WORKER] PASSO: Acessando a página de upload: https://studio.moises.ai/upload/split");
            Console.WriteLine("[BOT-PASSO] Acessando URL https://studio.moises.ai/upload/split...");
            
            try
            {
                Console.WriteLine("[BOT-PASSO] Enviando requisição de navegação (esperando até DOMContentLoaded)...");
                await page.GotoAsync("https://studio.moises.ai/upload/split", new PageGotoOptions 
                { 
                    Timeout = 30000, 
                    WaitUntil = WaitUntilState.DOMContentLoaded 
                });
                Console.WriteLine($"[BOT-PASSO] Navegação inicial concluída! URL atual: {page.Url}");
            }
            catch (Exception ex)
            {
                logger.LogWarning($"[WORKER WARNING] Navegação inicial para o Moises demorou ou disparou timeout de rede: {ex.Message}. Prosseguindo mesmo assim...");
                Console.WriteLine($"[BOT-PASSO] [Aviso] Timeout ou lentidão na rede detectada ({ex.Message}). Prosseguindo com o fluxo do bot.");
            }

            logger.LogInformation($"[WORKER] PASSO: URL carregada. URL Atual no navegador: {page.Url}");
            Console.WriteLine($"[BOT-PASSO] Estado do navegador pronto para analisar a DOM. URL Atual: {page.Url}");

            // Pequeno delay anti-bot
            await Task.Delay(Random.Shared.Next(1000, 2000), stoppingToken);

            // 0.1. Tenta aceitar os cookies para desobstruir a tela se o banner estiver visível logo no início
            Console.WriteLine("[BOT-PASSO] Verificando termos da LGPD e cookies preventivamente...");
            await AcceptCookiesIfVisibleAsync(page, stoppingToken);

            // 0.2. Aguarda a interface carregar elementos mínimos do estado deslogado ou logado para evitar checagens precoces
            var loginOrLoggedSelector = "button:has-text('e-mail'), button:has-text('email'), button:has-text('Continuar com'), button:has-text('Continue with'), button[class*='emailButton'], input[type='email'], input[placeholder*='e-mail'], div[class*='tab_container'], .tab_container, div[class*='select-local-file_dropzone']";
            Console.WriteLine("[BOT-PASSO] Aguardando a renderização da interface (botão de login ou tela de upload)...");
            try
            {
                await page.WaitForSelectorAsync(loginOrLoggedSelector, new PageWaitForSelectorOptions { State = WaitForSelectorState.Visible, Timeout = 15000 });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[BOT-PASSO] [Aviso] Timeout ao aguardar os elementos da interface: {ex.Message}. Prosseguindo com a análise de autenticação...");
            }

            // Verifica se precisamos logar analisando a presença do botão de e-mail ou campos de login
            Console.WriteLine("[BOT-PASSO] Analisando elementos da página para verificar estado de autenticação...");
            var emailBtnSelectors = new[]
            {
                "button:has-text('e-mail')",
                "button:has-text('email')",
                "button:has-text('Continuar com e-mail')",
                "button:has-text('Continue with email')",
                "button[class*='emailButton']",
                "button[class*='_emailButton_']"
            };

            bool precisaLogar = false;
            foreach (var selector in emailBtnSelectors)
            {
                var locator = page.Locator(selector).First;
                if (await locator.CountAsync() > 0 && await locator.IsVisibleAsync())
                {
                    precisaLogar = true;
                    Console.WriteLine($"[BOT-PASSO] Botão de autenticação localizado com seletor '{selector}'. Precisamos logar!");
                    break;
                }
            }

            if (!precisaLogar)
            {
                var emailSelector = "input[placeholder*='e-mail'], input[placeholder*='E-mail'], input[placeholder*='Digite seu e-mail'], input.rt-TextFieldInput[type='text'], input[type='email']";
                var emailInput = page.Locator(emailSelector).First;
                if (await emailInput.CountAsync() > 0 && await emailInput.IsVisibleAsync())
                {
                    precisaLogar = true;
                    Console.WriteLine("[BOT-PASSO] Campos de login já renderizados em tela. Precisamos logar!");
                }
            }

            if (precisaLogar)
            {
                logger.LogInformation("[WORKER] PASSO: Navegador abriu deslogado. Iniciando rotina de login automático...");
                Console.WriteLine("[BOT-PASSO] Estado deslogado confirmado. Iniciando login automático...");

                var extractorLogin = configuration["EXTRACTOR_LOGIN"]?.Trim('\r', '\n', ' ');
                var extractorPassword = configuration["EXTRACTOR_PASSWORD"]?.Trim('\r', '\n', ' ');

                if (string.IsNullOrWhiteSpace(extractorLogin) || string.IsNullOrWhiteSpace(extractorPassword) || extractorLogin.Contains("@exemplo.com"))
                {
                    Console.WriteLine("[BOT-ERRO] Credenciais EXTRACTOR_LOGIN/EXTRACTOR_PASSWORD não configuradas no .env.");
                    throw new UnauthorizedAccessException("[WORKER ERROR] A sessão expirou e as credenciais 'EXTRACTOR_LOGIN' e 'EXTRACTOR_PASSWORD' não estão configuradas no arquivo .env da raiz.");
                }

                await UpdateTrackStatusAsync(track.TrackId, "Processando: Efetuando login automático", db, stoppingToken);

                // Clica no botão "Continuar com e-mail" para exibir os inputs se ele estiver visível
                logger.LogInformation("[WORKER] PASSO: Procurando o botão 'Continuar com e-mail'...");
                Console.WriteLine("[BOT-PASSO] Procurando o botão 'Continuar com e-mail' na interface...");

                bool emailBtnClicked = false;
                foreach (var selector in emailBtnSelectors)
                {
                    try
                    {
                        var emailBtn = page.Locator(selector).First;
                        if (await emailBtn.CountAsync() > 0 && await emailBtn.IsVisibleAsync())
                        {
                            logger.LogInformation($"[WORKER] PASSO: Clicando no botão 'Continuar com e-mail' via seletor: {selector}");
                            Console.WriteLine($"[BOT-PASSO] Botão encontrado com seletor '{selector}'! Efetuando clique...");
                            await emailBtn.ClickAsync(new LocatorClickOptions { Timeout = 10000 });
                            emailBtnClicked = true;
                            Console.WriteLine("[BOT-PASSO] Clique realizado. Aguardando delay de carregamento...");
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
                    Console.WriteLine("[BOT-PASSO] Alerta: Botão de e-mail não clicado. Prosseguindo direto para inputs.");
                }

                // 1. Espera e preenche o e-mail limpando qualquer preenchimento automático anterior
                var emailSelector = "input[placeholder*='e-mail'], input[placeholder*='E-mail'], input[placeholder*='Digite seu e-mail'], input.rt-TextFieldInput[type='text'], input[type='email']";
                Console.WriteLine($"[BOT-PASSO] Aguardando a renderização do campo de e-mail ('{emailSelector}')...");
                await page.WaitForSelectorAsync(emailSelector, new PageWaitForSelectorOptions { Timeout = 20000 });
                Console.WriteLine("[BOT-PASSO] Campo de e-mail visível! Preenchendo login (limpando preenchimento anterior)...");
                
                await page.Locator(emailSelector).FillAsync(extractorLogin);
                Console.WriteLine("[BOT-PASSO] E-mail inserido com sucesso!");

                // 2. Preenche a senha limpando qualquer preenchimento automático anterior
                var passwordSelector = "input[type='password'], input[placeholder='Senha'], input[placeholder='Password']";
                Console.WriteLine($"[BOT-PASSO] Aguardando a renderização do campo de senha ('{passwordSelector}')...");
                await page.WaitForSelectorAsync(passwordSelector, new PageWaitForSelectorOptions { Timeout = 10000 });
                Console.WriteLine("[BOT-PASSO] Campo de senha visível! Preenchendo senha (limpando preenchimento anterior)...");

                await page.Locator(passwordSelector).FillAsync(extractorPassword);
                Console.WriteLine("[BOT-PASSO] Senha inserida com sucesso!");

                // 3. Submete o formulário
                var submitBtnSelector = "button[class*='_submitButton_'], button[type='submit']:has-text('Entrar'), button:has-text('Entrar'), button[type='submit']";
                Console.WriteLine($"[BOT-PASSO] Clicando no botão de submissão do formulário ('{submitBtnSelector}')...");
                await page.ClickAsync(submitBtnSelector);
                
                logger.LogInformation("[WORKER] PASSO: Submetendo credenciais...");
                Console.WriteLine("[BOT-PASSO] Credenciais submetidas. Aguardando processamento inicial...");
                await Task.Delay(Random.Shared.Next(1000, 2000), stoppingToken);

                // 4. Aguarda carregar a tela de upload pós-login por 10 segundos fixos
                Console.WriteLine("[BOT-PASSO] Credenciais submetidas com sucesso. Aguardando delay fixo de 10 segundos para o carregamento da tela de upload...");
                await Task.Delay(10000, stoppingToken);

                // Aceita cookies preventivamente se reaparecerem após o login
                await AcceptCookiesIfVisibleAsync(page, stoppingToken);

                logger.LogInformation("[WORKER SUCCESS] PASSO: Login automático concluído!");
                Console.WriteLine("[BOT-PASSO] Login automático efetuado com sucesso! Prosseguindo para o upload.");
            }
            else
            {
                Console.WriteLine("[BOT-PASSO] Sessão já estava ativa (usuário logado). Pulando login.");
                // Adiciona delay fixo para renderização de tela mesmo com sessão ativa
                Console.WriteLine("[BOT-PASSO] Aguardando delay fixo de 5 segundos para a renderização completa da tela de upload...");
                await Task.Delay(5000, stoppingToken);
            }

            // 5. Envio do Link na aba Armazenamento na Nuvem do Moises
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Configurando link de nuvem para o Moises.ai", db, stoppingToken);
            
            // Resolve a URL da API de forma agnóstica para montar o link da música original
            var apiUrl = configuration["API_URL"];
            if (string.IsNullOrEmpty(apiUrl))
            {
                var apiPort = configuration["API_PORT"] ?? "5000";
                apiUrl = $"http://localhost:{apiPort}";
            }
            apiUrl = apiUrl.TrimEnd('/');
            var publicTrackUrl = $"{apiUrl}/api/Tracks/{track.TrackId}/original";

            logger.LogInformation($"[WORKER] PASSO: Enviando URL da track original para o Moises: {publicTrackUrl}");
            Console.WriteLine($"[BOT-PASSO] URL agnóstica montada para envio: {publicTrackUrl}");

            // 5.1. Detecção dinâmica de IFrames ativos na página com retry resiliente
            Console.WriteLine("[BOT-PASSO] Verificando se a interface está embutida dentro de algum IFrame...");
            IFrame? interactionFrame = null;
            for (int waitIFrame = 0; waitIFrame < 10; waitIFrame++)
            {
                interactionFrame = await GetActiveUploadFrameAsync(page);
                if (interactionFrame != null) break;
                await Task.Delay(1000, stoppingToken);
            }
            
            if (interactionFrame != null)
            {
                Console.WriteLine($"[BOT-PASSO] Interface de upload localizada no IFrame: '{interactionFrame.Name}' (URL: {interactionFrame.Url})");
                Console.WriteLine("[BOT-PASSO] Atenção: As ações de clique e inserção serão direcionadas para o IFrame detectado!");
            }
            else
            {
                Console.WriteLine("[BOT-PASSO] Nenhum IFrame secundário contendo a interface foi detectado. Usando a página principal.");
            }

            // Aguarda a renderização física do contêiner de abas na interface antes de interagir
            Console.WriteLine("[BOT-PASSO] Aguardando a renderização do contêiner de abas na interface do Moises...");
            var tabContainerSelector = "div[class*='tab_container'], .tab_container, div[class*='select-local-file_dropzone']";
            try
            {
                if (interactionFrame != null)
                {
                    await interactionFrame.WaitForSelectorAsync(tabContainerSelector, new FrameWaitForSelectorOptions { State = WaitForSelectorState.Visible, Timeout = 15000 });
                }
                else
                {
                    await page.WaitForSelectorAsync(tabContainerSelector, new PageWaitForSelectorOptions { State = WaitForSelectorState.Visible, Timeout = 15000 });
                }
                Console.WriteLine("[BOT-PASSO] Contêiner de abas renderizado com sucesso!");
            }
            catch (Exception ex)
            {
                logger.LogWarning($"[WORKER WARNING] O contêiner de abas não apareceu no tempo esperado: {ex.Message}. Tentando continuar mesmo assim...");
                Console.WriteLine($"[BOT-PASSO] [Aviso] Contêiner de abas não localizado na DOM ({ex.Message}). Continuando...");
            }

            // Clicando na aba "Arquivos locais" para garantir que estamos no local de upload correto
            Console.WriteLine("[BOT-PASSO] Garantindo que a aba 'Arquivos locais' está ativa...");
            var localTabSelectors = new[]
            {
                "div[class*='tab_container'] > div:nth-child(1)",
                "div[role='button']:has-text('Arquivos locais')",
                "div[class*='tab_tab']:has-text('Arquivos')",
                "div[class*='tab_tab']:has-text('locais')",
                "text=Arquivos locais"
            };

            bool localTabClicked = false;
            foreach (var selector in localTabSelectors)
            {
                try
                {
                    Console.WriteLine($"[BOT-PASSO] Tentando garantir aba ativa via seletor: '{selector}' (com tolerância de 2s)...");
                    var locator = interactionFrame != null ? interactionFrame.Locator(selector).First : page.Locator(selector).First;
                    await locator.ClickAsync(new LocatorClickOptions { Timeout = 2000 });
                    Console.WriteLine($"[BOT-PASSO] Aba selecionada via seletor: '{selector}'");
                    localTabClicked = true;
                    break;
                }
                catch (Exception ex)
                {
                    logger.LogDebug($"[WORKER DEBUG] Tentativa de clique rápido com '{selector}' falhou: {ex.Message}");
                }
            }

            if (!localTabClicked)
            {
                Console.WriteLine("[BOT-PASSO] Aba local não respondida por seletores rápidos. Forçando clique estrutural final...");
                try
                {
                    if (interactionFrame != null)
                    {
                        await interactionFrame.ClickAsync("div[class*='tab_container'] > div:nth-child(1)", new FrameClickOptions { Timeout = 5000 });
                    }
                    else
                    {
                        await page.ClickAsync("div[class*='tab_container'] > div:nth-child(1)", new PageClickOptions { Timeout = 5000 });
                    }
                }
                catch (Exception ex)
                {
                    logger.LogDebug($"[WORKER DEBUG] Falha ao forçar clique na aba local: {ex.Message}");
                }
            }

            await Task.Delay(Random.Shared.Next(1000, 1500), stoppingToken);

            // Preenche o input de arquivo local
            var fileInputSelector = "input[type='file']";
            Console.WriteLine($"[BOT-PASSO] Aguardando campo de entrada de arquivos locais ('{fileInputSelector}')...");
            if (interactionFrame != null)
            {
                await interactionFrame.WaitForSelectorAsync(fileInputSelector, new FrameWaitForSelectorOptions { State = WaitForSelectorState.Attached, Timeout = 20000 });
                Console.WriteLine($"[BOT-PASSO] Input de arquivo localizado! Injetando arquivo local: {originalFile}");
                await interactionFrame.Locator(fileInputSelector).SetInputFilesAsync(originalFile);
            }
            else
            {
                await page.WaitForSelectorAsync(fileInputSelector, new PageWaitForSelectorOptions { State = WaitForSelectorState.Attached, Timeout = 20000 });
                Console.WriteLine($"[BOT-PASSO] Input de arquivo localizado! Injetando arquivo local: {originalFile}");
                await page.Locator(fileInputSelector).SetInputFilesAsync(originalFile);
            }
            
            logger.LogInformation("[WORKER] PASSO: Arquivo original enviado para o Moises. Aguardando processamento e validação...");
            Console.WriteLine("[BOT-PASSO] Arquivo enviado! Aguardando o progresso de upload local...");
            await Task.Delay(Random.Shared.Next(5000, 7000), stoppingToken);

            // 6. Tela de Seleção de Stems
            // O Moises redireciona automaticamente para a tela de stems (split) ou habilita o botão de Enviar.
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Configurando divisão de stems (Moises)", db, stoppingToken);

            // Diagnóstico de elementos contendo 'Enviar' para depurar qual é o elemento real do botão
            try
            {
                Console.WriteLine("[BOT-DEBUG] Analisando elementos do DOM contendo o texto 'Enviar'...");
                var evalScript = @"() => {
                    const results = [];
                    const elements = document.querySelectorAll('button, div, a, span, p');
                    for (const el of elements) {
                        if (el.textContent && el.textContent.trim().toLowerCase().startsWith('enviar') || el.innerText && el.innerText.trim().toLowerCase() === 'enviar') {
                            results.push({
                                tagName: el.tagName,
                                id: el.id,
                                className: el.className,
                                text: el.textContent ? el.textContent.trim() : '',
                                isVisible: el.offsetWidth > 0 && el.offsetHeight > 0,
                                html: el.outerHTML.substring(0, 300)
                            });
                        }
                    }
                    return JSON.stringify(results, null, 2);
                }";

                var analysisResult = interactionFrame != null 
                    ? await interactionFrame.EvaluateAsync<string>(evalScript)
                    : await page.EvaluateAsync<string>(evalScript);
                Console.WriteLine($"[BOT-DEBUG] Resultado da busca por 'Enviar':\n{analysisResult}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[BOT-DEBUG] Falha ao rodar JS de diagnóstico: {ex.Message}");
            }

            var submitButtonSelector = "button#upload_submit_button, button:has-text('Enviar'), button:has-text('Submit'), button[class*='submit'], button[class*='Submit'], button[type='submit']";
            Console.WriteLine($"[BOT-PASSO] Aguardando a ativação do botão 'Enviar' ('{submitButtonSelector}')...");
            
            if (interactionFrame != null)
            {
                await interactionFrame.WaitForSelectorAsync(submitButtonSelector, new FrameWaitForSelectorOptions { Timeout = 120000 });
                Console.WriteLine("[BOT-PASSO] Botão 'Enviar' ativo no IFrame! Clicando...");
                await interactionFrame.ClickAsync(submitButtonSelector);
                
                // Força um clique via JS caso o clique nativo do Playwright tenha falhado por alguma interceptação/sobreposição de camada
                try
                {
                    Console.WriteLine("[BOT-PASSO] Clicando via JS Evaluate no botão 'Enviar' por garantia...");
                    await interactionFrame.EvaluateAsync(@"() => {
                        const btn = document.querySelector('button#upload_submit_button') || document.querySelector('button[id*=\'submit\']');
                        if (btn) {
                            btn.click();
                        } else {
                            const buttons = Array.from(document.querySelectorAll('button'));
                            const target = buttons.find(b => b.textContent && b.textContent.includes('Enviar'));
                            if (target) target.click();
                        }
                    }");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[BOT-DEBUG] Aviso ao tentar clique via JS: {ex.Message}");
                }
            }
            else
            {
                await page.WaitForSelectorAsync(submitButtonSelector, new PageWaitForSelectorOptions { Timeout = 120000 });
                Console.WriteLine("[BOT-PASSO] Botão 'Enviar' ativo na página principal! Clicando...");
                await page.ClickAsync(submitButtonSelector);
                
                try
                {
                    Console.WriteLine("[BOT-PASSO] Clicando via JS Evaluate no botão 'Enviar' da página principal por garantia...");
                    await page.EvaluateAsync(@"() => {
                        const btn = document.querySelector('button#upload_submit_button') || document.querySelector('button[id*=\'submit\']');
                        if (btn) {
                            btn.click();
                        } else {
                            const buttons = Array.from(document.querySelectorAll('button'));
                            const target = buttons.find(b => b.textContent && b.textContent.includes('Enviar'));
                            if (target) target.click();
                        }
                    }");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[BOT-DEBUG] Aviso ao tentar clique via JS na página principal: {ex.Message}");
                }
            }

            // 7. Retorno à Biblioteca
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Aguardando retorno para a Biblioteca", db, stoppingToken);
            logger.LogInformation("[WORKER] PASSO: Aguardando redirecionamento para a biblioteca...");
            Console.WriteLine("[BOT-PASSO] Aguardando processamento/upload e redirecionamento para a biblioteca (/library)...");
            
            bool redirecionou = false;
            int waitLibrarySeconds = 120;
            for (int i = 0; i < waitLibrarySeconds / 5; i++)
            {
                await Task.Delay(5000, stoppingToken);

                // Verifica se a página principal ou o iframe navegaram para /library
                var mainUrl = page.Url;
                var frameUrl = interactionFrame != null ? interactionFrame.Url : "";
                
                Console.WriteLine($"[BOT-PASSO] [Aguardando Redirecionamento - Passo {i}] URL Principal: {mainUrl} | URL IFrame: {frameUrl}");

                if (mainUrl.Contains("/library") || frameUrl.Contains("/library"))
                {
                    redirecionou = true;
                    Console.WriteLine("[BOT-PASSO] Redirecionamento para /library detectado com sucesso!");
                    break;
                }
            }

            if (!redirecionou)
            {
                throw new TimeoutException("[WORKER ERROR] O redirecionamento para a biblioteca (/library) não ocorreu dentro de 120 segundos.");
            }

            await Task.Delay(Random.Shared.Next(3000, 5000), stoppingToken); // delay humano de carregamento

            // 8. Clicar no primeiro áudio da lista (mais recente)
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Identificando a música na Biblioteca", db, stoppingToken);
            logger.LogInformation("[WORKER] PASSO: Localizando a música mais recente na lista...");
            Console.WriteLine("[BOT-PASSO] Localizando a música mais recente no painel principal da biblioteca...");

            // Limpa cookies banner se reaparecer
            Console.WriteLine("[BOT-PASSO] Executando rotina preventiva de cookies na biblioteca...");
            await AcceptCookiesIfVisibleAsync(page, stoppingToken);

            // Determina seletores específicos e robustos para o botão que abre a DAW
            string firstRowSelector = $"tr.rt-TableRow:has-text(\"{track.TrackId}\") button[class*='_rowActionButton_']";
            Console.WriteLine($"[BOT-PASSO] Procurando o botão específico da DAW para a track pelo ID ('{firstRowSelector}')...");
            
            var targetButton = page.Locator(firstRowSelector).First;
            if (await targetButton.CountAsync() == 0)
            {
                Console.WriteLine("[BOT-PASSO] Faixa com ID específico não encontrada na biblioteca. Tentando localizar pelo título...");
                firstRowSelector = $"tr.rt-TableRow:has-text(\"{track.TrackTitle}\") button[class*='_rowActionButton_']";
                targetButton = page.Locator(firstRowSelector).First;
            }

            if (await targetButton.CountAsync() == 0)
            {
                Console.WriteLine("[BOT-PASSO] Fallback: Tentando localizar pelo primeiro botão de ação de linha genérico...");
                firstRowSelector = "tr.rt-TableRow:first-child button[class*='_rowActionButton_']";
                targetButton = page.Locator(firstRowSelector).First;
            }

            if (await targetButton.CountAsync() == 0)
            {
                Console.WriteLine("[BOT-PASSO] Segundo Fallback: Tentando localizar qualquer span de título...");
                firstRowSelector = "span[class*='_titleText_']";
                targetButton = page.Locator(firstRowSelector).First;
            }

            Console.WriteLine($"[BOT-PASSO] Aguardando a presença de itens na biblioteca usando o seletor resoluto ('{firstRowSelector}')...");
            await page.WaitForSelectorAsync(firstRowSelector, new PageWaitForSelectorOptions { Timeout = 45000 });
            
            logger.LogInformation("[WORKER] PASSO: Primeiro item da biblioteca localizado. Clicando...");
            Console.WriteLine("[BOT-PASSO] Item encontrado! Efetuando clique para abrir a DAW...");
            await targetButton.ClickAsync();
            Console.WriteLine("[BOT-PASSO] Clique realizado. Aguardando carregamento da DAW...");
            await Task.Delay(Random.Shared.Next(2000, 4000), stoppingToken);

            // 9. DAW (Player): Aguardar o processamento das faixas
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Aguardando separação de stems na DAW", db, stoppingToken);
            logger.LogInformation("[WORKER] PASSO: DAW / Player carregado. Monitorando processamento das stems...");
            
            // 9.1. Detecção dinâmica de IFrames ativos na página da DAW (Player2) com retry resiliente
            Console.WriteLine("[BOT-PASSO] Verificando se o Player/DAW está rodando dentro de um IFrame...");
            IFrame? playerFrame = null;
            for (int waitIFrame = 0; waitIFrame < 15; waitIFrame++)
            {
                playerFrame = await GetActivePlayerFrameAsync(page);
                if (playerFrame != null) break;
                await Task.Delay(1000, stoppingToken);
            }

            if (playerFrame != null)
            {
                Console.WriteLine($"[BOT-PASSO] [DAW] Interface localizada no IFrame: '{playerFrame.Name}' (URL: {playerFrame.Url})");
                Console.WriteLine("[BOT-PASSO] [DAW] As interações do player serão direcionadas para o IFrame correspondente.");
            }
            else
            {
                Console.WriteLine("[BOT-PASSO] [DAW] Nenhum IFrame com o player foi detectado. Usando a página principal.");
            }

            // Calcula o atraso fixo inicial com base no tamanho do arquivo original (proporcional à duração)
            long fileSizeBytes = 0;
            try
            {
                if (File.Exists(originalFile))
                {
                    fileSizeBytes = new FileInfo(originalFile).Length;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[BOT-DEBUG] Falha ao ler tamanho do arquivo original: {ex.Message}");
            }

            var waitTimeBaseStr = configuration["EXTRACTOR_WAIT_TIME_BASE_SECONDS"] ?? "180";
            int waitTimeBase = int.TryParse(waitTimeBaseStr, out var wtb) ? wtb : 180;

            int delayMs = waitTimeBase * 1000;
            if (fileSizeBytes > 15 * 1024 * 1024) // > 15 MB
            {
                delayMs = (waitTimeBase + 120) * 1000;
                Console.WriteLine($"[BOT-PASSO] Arquivo grande detectado ({fileSizeBytes / (1024.0 * 1024.0):F2} MB). Definindo tempo de espera para {delayMs / 1000} segundos.");
            }
            else if (fileSizeBytes > 8 * 1024 * 1024) // > 8 MB
            {
                delayMs = (waitTimeBase + 60) * 1000;
                Console.WriteLine($"[BOT-PASSO] Arquivo médio-grande detectado ({fileSizeBytes / (1024.0 * 1024.0):F2} MB). Definindo tempo de espera para {delayMs / 1000} segundos.");
            }
            else
            {
                Console.WriteLine($"[BOT-PASSO] Arquivo padrão/pequeno detectado ({fileSizeBytes / (1024.0 * 1024.0):F2} MB). Definindo tempo de espera padrão de {delayMs / 1000} segundos.");
            }

            Console.WriteLine($"[BOT-PASSO] Aguardando atraso fixo de {delayMs / 1000} segundos para que o Moises conclua o processamento de todas as stems...");
            await Task.Delay(delayMs, stoppingToken);

            // Realiza um F5/refresh na página para carregar as stems prontas e reestruturar a DOM de forma limpa
            try
            {
                Console.WriteLine("[BOT-PASSO] Executando F5 (recarregando a página) para atualizar o estado do player de áudio...");
                await page.ReloadAsync(new PageReloadOptions 
                { 
                    Timeout = 30000, 
                    WaitUntil = WaitUntilState.DOMContentLoaded 
                });
                Console.WriteLine("[BOT-PASSO] Recarregamento concluído! Aguardando 30 segundos para inicialização e renderização completa da interface...");
                await Task.Delay(30000, stoppingToken);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[BOT-PASSO] [Aviso] Timeout ou lentidão ao recarregar a página ({ex.Message}). Continuando mesmo assim...");
            }

            Console.WriteLine("[BOT-PASSO] Iniciando monitoramento do botão 'Exportar'...");

            // Monitoramos a presença e a ativação do botão "Exportar" que é habilitado quando pronto
            var exportButtonSelector = "button[class*='download-task_buttonExport__'], button:has-text('Exportar'), button:has-text('Export')";
            
            logger.LogInformation("[WORKER] PASSO: Monitorando o botão de Exportar na DAW. Limite de espera de 15 minutos...");
            
            bool dawPronto = false;
            int tentativasDAW = 90; // 90 * 10s = 15 minutos
            while (!dawPronto && tentativasDAW > 0)
            {
                tentativasDAW--;
                Console.WriteLine($"[BOT-PASSO] Verificando botão 'Exportar' (Tempo restante máximo: {tentativasDAW * 10}s)...");
                await Task.Delay(10000, stoppingToken);
                
                // Atualiza o frame dinamicamente para evitar referências desalocadas/remontadas pela SPA
                playerFrame = await GetActivePlayerFrameAsync(page);

                var exportButton = playerFrame != null ? playerFrame.Locator(exportButtonSelector).First : page.Locator(exportButtonSelector).First;
                if (await exportButton.CountAsync() > 0)
                {
                    bool isEnabled = await exportButton.IsEnabledAsync();
                    if (isEnabled)
                    {
                        dawPronto = true;
                        logger.LogInformation("[WORKER] PASSO: Status: Áudio processado e botão 'Exportar' ativo!");
                        Console.WriteLine("[BOT-PASSO] Sucesso: Botão 'Exportar' ficou ativo e habilitado!");
                    }
                    else
                    {
                        logger.LogInformation($"[WORKER] PASSO: Status: Faixas ainda em processamento na DAW... (Tentativas restantes: {tentativasDAW})");
                        Console.WriteLine("[BOT-PASSO] Faixas continuam carregando/processando na DAW...");
                    }
                }
                else
                {
                    logger.LogInformation($"[WORKER] PASSO: Status: DAW carregando interface... (Tentativas restantes: {tentativasDAW})");
                    Console.WriteLine("[BOT-PASSO] Interface da DAW ainda carregando elementos básicos...");
                }
            }

            if (!dawPronto)
            {
                Console.WriteLine("[BOT-ERRO] Limite de processamento excedido (15 min).");
                throw new TimeoutException("[WORKER ERROR] O processamento das stems demorou mais que o esperado (limite de 15 min).");
            }

            // 10. Menu de Exportação e Download com Retry resiliente
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Exportando stems selecionadas", db, stoppingToken);
            Console.WriteLine("[BOT-PASSO] Iniciando processo de exportação...");

            var exportAllSelector = "a:has-text('Exportar todos os canais'), button:has-text('Exportar todos os canais'), a:has-text('todos os canais'), a[class*='download-task-drop_button']:has-text('Exportar')";
            IDownload? download = null;
            int maxExportRetries = 3;

            for (int retry = 1; retry <= maxExportRetries; retry++)
            {
                try
                {
                    logger.LogInformation($"[WORKER] PASSO: [Tentativa {retry}/{maxExportRetries}] Clicando no botão 'Exportar'...");
                    Console.WriteLine($"[BOT-PASSO] [Tentativa {retry}/{maxExportRetries}] Aguardando e clicando em 'Exportar'...");
                    
                    // Garante que o banner de cookies está aceito
                    await AcceptCookiesIfVisibleAsync(page, stoppingToken);

                    // Atualiza o frame dinamicamente caso tenha ocorrido reload ou redirecionamento na DAW
                    playerFrame = await GetActivePlayerFrameAsync(page);

                    var exportButton = playerFrame != null ? playerFrame.Locator(exportButtonSelector).First : page.Locator(exportButtonSelector).First;
                    await exportButton.WaitForAsync(new LocatorWaitForOptions { State = WaitForSelectorState.Visible, Timeout = 15000 });
                    await exportButton.ClickAsync();
                    
                    Console.WriteLine("[BOT-PASSO] Botão 'Exportar' clicado! Aguardando 2 segundos para o menu suspender...");
                    await Task.Delay(Random.Shared.Next(2000, 3000), stoppingToken);

                    // Seleciona o formato MP3 no menu de exportação
                    var mp3ButtonSelector = "button:has-text('MP3'), button:text('MP3'), button[class*='styles_button']:has-text('MP3')";
                    try
                    {
                        Console.WriteLine("[BOT-PASSO] Tentando selecionar o formato 'MP3' no menu de exportação...");
                        var mp3Button = playerFrame != null ? playerFrame.Locator(mp3ButtonSelector).First : page.Locator(mp3ButtonSelector).First;
                        await mp3Button.WaitForAsync(new LocatorWaitForOptions { State = WaitForSelectorState.Visible, Timeout = 5000 });
                        await mp3Button.ClickAsync();
                        Console.WriteLine("[BOT-PASSO] Formato 'MP3' selecionado com sucesso!");
                        await Task.Delay(1000, stoppingToken);
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[BOT-DEBUG] Botão de formato MP3 já selecionado ou indisponível: {ex.Message}");
                    }

                    logger.LogInformation($"[WORKER] PASSO: [Tentativa {retry}/{maxExportRetries}] Clicando em 'Exportar todos os canais' e aguardando download...");
                    Console.WriteLine($"[BOT-PASSO] [Tentativa {retry}/{maxExportRetries}] Localizando e clicando em 'Exportar todos os canais'...");
                    
                    var exportAllBtn = playerFrame != null ? playerFrame.Locator(exportAllSelector).First : page.Locator(exportAllSelector).First;
                    await exportAllBtn.WaitForAsync(new LocatorWaitForOptions { State = WaitForSelectorState.Visible, Timeout = 15000 });
                    
                    // Intercepta o download
                    Console.WriteLine("[BOT-PASSO] Preparando escuta de download com limite de 120 segundos...");
                    var downloadTask = page.WaitForDownloadAsync(new PageWaitForDownloadOptions { Timeout = 120000 });
                    await exportAllBtn.ClickAsync();
                    
                    download = await downloadTask;
                    Console.WriteLine("[BOT-PASSO] Sucesso: Download iniciado no navegador!");
                    break; // Download iniciado com sucesso! Sai do loop.
                }
                catch (Exception ex)
                {
                    logger.LogWarning($"[WORKER WARNING] PASSO: [Tentativa {retry}/{maxExportRetries}] Falha ao exportar/iniciar download: {ex.Message}. Resetando...");
                    Console.WriteLine($"[BOT-PASSO] Falha na tentativa {retry} de download: {ex.Message}. Redefinindo visual...");
                    
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
                Console.WriteLine("[BOT-ERRO] Não foi possível iniciar o download após as 3 tentativas.");
                throw new TimeoutException("[WORKER ERROR] Falha ao iniciar o download das stems após várias retentativas na DAW.");
            }

            var zipPath = Path.Combine(downloadsDir, $"{track.TrackId}_stems.zip");
            logger.LogInformation($"[WORKER] PASSO: Download iniciado! Gravando arquivo ZIP em: {zipPath}");
            Console.WriteLine($"[BOT-PASSO] Efetuando gravação do download do ZIP em: {zipPath}...");
            await download.SaveAsAsync(zipPath);

            logger.LogInformation($"[WORKER SUCCESS] PASSO: Download do ZIP de stems finalizado com sucesso: {zipPath}");
            Console.WriteLine($"[BOT-PASSO] Sucesso: ZIP gravado com êxito em disco!");

            // Fecha o contexto do navegador com segurança
            await context.DisposeAsync();

            // Etapa 11: Invoca o endpoint do backend para que ele processe e converta tudo para Opus
            apiUrl = configuration["API_URL"];
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
        finally
        {
            _activePage = null;
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
            Console.WriteLine("[BOT-PASSO] Verificando existência de banner de consentimento de cookies (Osano)...");
            
            // Aguarda brevemente a renderização do banner se ele estiver carregando
            var bannerSelector = ".osano-cm-window__dialog, .osano-cm-dialog, .osano-cm-accept";
            try
            {
                var banner = await page.WaitForSelectorAsync(bannerSelector, new PageWaitForSelectorOptions { Timeout = 3000, State = WaitForSelectorState.Visible });
                if (banner != null)
                {
                    Console.WriteLine("[BOT-PASSO] Banner de cookies detectado em tela.");
                }
            }
            catch
            {
                // Se der timeout, assumimos que o banner já foi aceito anteriormente ou está ausente
                Console.WriteLine("[BOT-PASSO] Sem banner de cookies visível por enquanto.");
            }

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
                    Console.WriteLine($"[BOT-PASSO] Clicando no botão Aceitar do banner ({selector})...");
                    await locator.ClickAsync(new LocatorClickOptions { Timeout = 5000 });
                    Console.WriteLine("[BOT-PASSO] Sucesso: Botão Aceitar clicado com êxito!");
                    await Task.Delay(Random.Shared.Next(1000, 1500), stoppingToken);
                    break;
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogDebug($"[WORKER DEBUG] Erro ou banner de cookies ausente/já fechado: {ex.Message}");
            Console.WriteLine($"[BOT-PASSO] Info: Verificação de cookies finalizada: {ex.Message}");
        }
    }

    private async Task<IFrame?> GetActivePlayerFrameAsync(IPage page)
    {
        var framesList = page.Frames.ToList();
        foreach (var frame in framesList)
        {
            if (frame == page.MainFrame) continue;
            if (frame.Url.Contains("/player2/") || frame.Url.Contains("/player/"))
            {
                return frame;
            }
        }
        foreach (var frame in framesList)
        {
            if (frame == page.MainFrame) continue;
            try
            {
                var content = await frame.ContentAsync();
                if (content.Contains("Exportar", StringComparison.OrdinalIgnoreCase) || 
                    content.Contains("Export", StringComparison.OrdinalIgnoreCase) ||
                    content.Contains("Separando faixas", StringComparison.OrdinalIgnoreCase) ||
                    content.Contains("Vocais", StringComparison.OrdinalIgnoreCase) ||
                    content.Contains("Vocals", StringComparison.OrdinalIgnoreCase) ||
                    content.Contains("buttonExport", StringComparison.OrdinalIgnoreCase))
                {
                    return frame;
                }
            }
            catch {}
        }
        return null;
    }

    private async Task<IFrame?> GetActiveUploadFrameAsync(IPage page)
    {
        var framesList = page.Frames.ToList();
        foreach (var frame in framesList)
        {
            if (frame == page.MainFrame) continue;
            if (frame.Url.Contains("/upload/split/"))
            {
                return frame;
            }
        }
        foreach (var frame in framesList)
        {
            if (frame == page.MainFrame) continue;
            try
            {
                var content = await frame.ContentAsync();
                if (content.Contains("Armazenado na nuvem", StringComparison.OrdinalIgnoreCase) || 
                    content.Contains("Arquivos locais", StringComparison.OrdinalIgnoreCase) ||
                    content.Contains("tab_container", StringComparison.OrdinalIgnoreCase) ||
                    content.Contains("url_text_box", StringComparison.OrdinalIgnoreCase))
                {
                    return frame;
                }
            }
            catch {}
        }
        return null;
    }
}

