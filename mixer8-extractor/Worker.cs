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
            var headlessStr = configuration["EXTRACTOR_HEADLESS"] ?? "true";
            bool isHeadless = !string.Equals(headlessStr, "false", StringComparison.OrdinalIgnoreCase);
            
            var slowMoStr = configuration["EXTRACTOR_SLOW_MO"] ?? "0";
            int slowMo = int.TryParse(slowMoStr, out var sm) ? sm : 0;

            var launchOptions = new BrowserTypeLaunchOptions
            {
                Headless = isHeadless,
                SlowMo = slowMo,
                Args = new[] 
                { 
                    "--no-sandbox", 
                    "--disable-setuid-sandbox", 
                    "--disable-dev-shm-usage",
                    "--disable-blink-features=AutomationControlled" // Anti-bot stealth
                }
            };

            var contextOptions = new BrowserNewContextOptions
            {
                UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                ViewportSize = new ViewportSize { Width = 1280, Height = 800 },
                Locale = "pt-BR",
                TimezoneId = "America/Sao_Paulo"
            };

            logger.LogInformation($"[WORKER] Lançando Chromium padrão (Headless: {isHeadless}, SlowMo: {slowMo}ms)...");
            Console.WriteLine("[BOT-PASSO] Lançando navegador limpo sem perfil persistente...");

            await using var browser = await playwright.Chromium.LaunchAsync(launchOptions);
            await using var context = await browser.NewContextAsync(contextOptions);
            var page = await context.NewPageAsync();

            // 4. Acessa a página de Upload Split
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Acessando a tela de Upload do Moises.ai", db, stoppingToken);
            logger.LogInformation("[WORKER] PASSO: Acessando a página de upload: https://studio.moises.ai/upload/split");
            Console.WriteLine("[BOT-PASSO] Acessando URL https://studio.moises.ai/upload/split...");
            
            await page.GotoAsync("https://studio.moises.ai/upload/split", new PageGotoOptions 
            { 
                Timeout = 60000, 
                WaitUntil = WaitUntilState.NetworkIdle 
            });

            logger.LogInformation($"[WORKER] PASSO: URL carregada com sucesso. URL Atual no navegador: {page.Url}");
            Console.WriteLine($"[BOT-PASSO] Página carregada! URL Atual: {page.Url}");

            // Pequeno delay anti-bot
            await Task.Delay(Random.Shared.Next(1000, 2000), stoppingToken);

            // 0.1. Tenta aceitar os cookies para desobstruir a tela se o banner estiver visível logo no início
            Console.WriteLine("[BOT-PASSO] Verificando termos da LGPD e cookies preventivamente...");
            await AcceptCookiesIfVisibleAsync(page, stoppingToken);

            // Verifica se precisamos logar analisando a presença do botão de e-mail ou campos de login
            Console.WriteLine("[BOT-PASSO] Analisando elementos da página para verificar estado de autenticação...");
            var emailBtnSelectors = new[]
            {
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

                // 4. Aguarda retornar para a tela de upload/split (verificando pela presença da caixa de upload)
                Console.WriteLine("[BOT-PASSO] Aguardando o carregamento da tela de Upload (localizando a caixa de upload)...");
                var dropzoneSelector = ".select-local-file_dropzone__, [class*='select-local-file_dropzone'], input[type='file']";
                await page.WaitForSelectorAsync(dropzoneSelector, new PageWaitForSelectorOptions { Timeout = 45000, State = WaitForSelectorState.Visible });
                
                logger.LogInformation("[WORKER SUCCESS] PASSO: Login automático concluído!");
                Console.WriteLine("[BOT-PASSO] Login automático efetuado com sucesso! Tela de Upload carregada.");
                
                await Task.Delay(2000, stoppingToken); // delay humano pós-login
            }
            else
            {
                Console.WriteLine("[BOT-PASSO] Sessão já estava ativa (usuário logado). Pulando login.");
            }

            // 5. Upload do Arquivo no Dropzone do Moises
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Enviando áudio original para o Moises.ai", db, stoppingToken);
            logger.LogInformation($"[WORKER] PASSO: Realizando upload do arquivo original para o Moises: {originalFile}");
            Console.WriteLine($"[BOT-PASSO] Iniciando upload do arquivo original: {originalFile}");

            // O Playwright seleciona e injeta o arquivo no input oculto de uploads
            var fileInputSelector = "input[type='file']";
            Console.WriteLine($"[BOT-PASSO] Aguardando localizador de upload de arquivos ('{fileInputSelector}')...");
            await page.WaitForSelectorAsync(fileInputSelector, new PageWaitForSelectorOptions { Timeout = 20000 });
            
            var fileInput = await page.QuerySelectorAsync(fileInputSelector);
            if (fileInput == null)
            {
                Console.WriteLine("[BOT-ERRO] Input de arquivo não encontrado na página.");
                throw new InvalidOperationException("[WORKER ERROR] Não foi possível localizar o input de arquivos do Moises.ai.");
            }
            
            Console.WriteLine("[BOT-PASSO] Injetando arquivo local no navegador...");
            await fileInput.SetInputFilesAsync(originalFile);

            logger.LogInformation("[WORKER] PASSO: Arquivo selecionado no navegador. Aguardando processamento da seleção...");
            Console.WriteLine("[BOT-PASSO] Arquivo selecionado! Aguardando 2 segundos para o upload inicial...");
            await Task.Delay(Random.Shared.Next(2000, 3000), stoppingToken);

            // Garante que o banner de cookies está aceito
            Console.WriteLine("[BOT-PASSO] Executando rotina preventiva de cookies antes do Envio...");
            await AcceptCookiesIfVisibleAsync(page, stoppingToken);

            // 6. Tela de Seleção de Stems
            // O Moises redireciona automaticamente para a tela de stems (split) ou habilita o botão de Enviar.
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Configurando divisão de stems (Moises)", db, stoppingToken);

            var submitButtonSelector = "button#upload_submit_button, button:has-text('Enviar'), button:has-text('Submit')";
            Console.WriteLine($"[BOT-PASSO] Aguardando a ativação do botão 'Enviar' ('{submitButtonSelector}')...");
            await page.WaitForSelectorAsync(submitButtonSelector, new PageWaitForSelectorOptions { Timeout = 60000 });
            
            Console.WriteLine("[BOT-PASSO] Botão 'Enviar' ativo! Aguardando delay anti-bot...");
            await Task.Delay(Random.Shared.Next(1500, 3000), stoppingToken); // delay humano anti-bot
            
            logger.LogInformation("[WORKER] PASSO: Clicando no botão 'Enviar' para iniciar a extração...");
            Console.WriteLine("[BOT-PASSO] Clicando no botão 'Enviar'...");
            await page.ClickAsync(submitButtonSelector);

            // 7. Retorno à Biblioteca
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Aguardando retorno para a Biblioteca", db, stoppingToken);
            logger.LogInformation("[WORKER] PASSO: Aguardando redirecionamento para a biblioteca...");
            Console.WriteLine("[BOT-PASSO] Aguardando processamento/upload e redirecionamento para a biblioteca (/library)...");
            
            await page.WaitForURLAsync("**/library**", new PageWaitForURLOptions { Timeout = 120000 });
            Console.WriteLine("[BOT-PASSO] Redirecionado com sucesso para a biblioteca!");
            await Task.Delay(Random.Shared.Next(3000, 5000), stoppingToken); // delay humano de carregamento

            // 8. Clicar no primeiro áudio da lista (mais recente)
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Identificando a música na Biblioteca", db, stoppingToken);
            logger.LogInformation("[WORKER] PASSO: Localizando a música mais recente na lista...");
            Console.WriteLine("[BOT-PASSO] Localizando a música mais recente no painel principal da biblioteca...");

            // Limpa cookies banner se reaparecer
            Console.WriteLine("[BOT-PASSO] Executando rotina preventiva de cookies na biblioteca...");
            await AcceptCookiesIfVisibleAsync(page, stoppingToken);

            // Aguarda a tabela/grade/flex list de faixas carregar usando o seletor moderno Radix UI
            var firstRowSelector = "span[class*='_titleText_'], div[class*='_titleText_'], .track-row:first-child, tr:first-child td, .track-list-item:first-child, td a";
            Console.WriteLine($"[BOT-PASSO] Aguardando a presença de itens na biblioteca ('{firstRowSelector}')...");
            await page.WaitForSelectorAsync(firstRowSelector, new PageWaitForSelectorOptions { Timeout = 45000 });
            
            logger.LogInformation("[WORKER] PASSO: Primeiro item da biblioteca localizado. Clicando...");
            Console.WriteLine("[BOT-PASSO] Primeiro item encontrado! Efetuando clique para abrir a DAW...");
            await page.ClickAsync(firstRowSelector);
            Console.WriteLine("[BOT-PASSO] Clique realizado. Aguardando carregamento da DAW...");
            await Task.Delay(Random.Shared.Next(2000, 4000), stoppingToken);

            // 9. DAW (Player): Aguardar o processamento das faixas
            await UpdateTrackStatusAsync(track.TrackId, "Processando: Aguardando separação de stems na DAW", db, stoppingToken);
            logger.LogInformation("[WORKER] PASSO: DAW / Player carregado. Monitorando processamento das stems...");
            Console.WriteLine("[BOT-PASSO] Carregou a DAW! Iniciando monitoramento do botão 'Exportar'...");

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
                
                var exportButton = page.Locator(exportButtonSelector).First;
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

            var exportAllSelector = "a[class*='download-task-drop_button__'], button:has-text('Exportar todos os canais'), a:has-text('Exportar todos os canais'), text=Exportar todos os canais";
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

                    var exportButton = page.Locator(exportButtonSelector).First;
                    await exportButton.WaitForAsync(new LocatorWaitForOptions { State = WaitForSelectorState.Visible, Timeout = 15000 });
                    await exportButton.ClickAsync();
                    
                    Console.WriteLine("[BOT-PASSO] Botão 'Exportar' clicado! Aguardando 2 segundos para o menu suspender...");
                    await Task.Delay(Random.Shared.Next(2000, 3000), stoppingToken);

                    logger.LogInformation($"[WORKER] PASSO: [Tentativa {retry}/{maxExportRetries}] Clicando em 'Exportar todos os canais' e aguardando download...");
                    Console.WriteLine($"[BOT-PASSO] [Tentativa {retry}/{maxExportRetries}] Localizando e clicando em 'Exportar todos os canais'...");
                    
                    var exportAllBtn = page.Locator(exportAllSelector).First;
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
}

