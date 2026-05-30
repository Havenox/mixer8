using dotenv.net;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Mixer8.Api.Infrastructure;
using System;
using System.Text;

// 1. Carrega o arquivo .env da pasta pai (para rodar fora do Docker / Baremetal)
var envPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "..", ".env");
if (!File.Exists(envPath))
{
    envPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", ".env");
}
if (!File.Exists(envPath))
{
    envPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", ".env");
}

if (File.Exists(envPath))
{
    DotEnv.Load(new DotEnvOptions(envFilePaths: new[] { envPath }));
}

var builder = WebApplication.CreateBuilder(args);

// Adiciona variáveis de ambiente ao Configuration
builder.Configuration.AddEnvironmentVariables();

// Configura a URL de escuta com base na porta definida no .env (resiliência baremetal)
var apiPort = builder.Configuration["API_PORT"] ?? "5000";
builder.WebHost.UseUrls($"http://*:{apiPort}");

// 2. Configura a String de Conexão com o PostgreSQL de forma resiliente e dinâmica
var connectionString = builder.Configuration["DB_CONNECTION_STRING"];
if (string.IsNullOrEmpty(connectionString) || connectionString.Contains("${"))
{
    var dbHost = builder.Configuration["DB_HOST"] ?? "localhost";
    var dbPort = builder.Configuration["DB_PORT"] ?? "5432";
    var dbName = builder.Configuration["DB_NAME"] ?? "mixer8_db";
    var dbUser = builder.Configuration["DB_USER"] ?? "postgres";
    var dbPass = builder.Configuration["DB_PASSWORD"] ?? "";
    connectionString = $"Host={dbHost};Port={dbPort};Database={dbName};Username={dbUser};Password={dbPass};";
}

builder.Services.AddDbContext<Mixer8DbContext>(options =>
    options.UseNpgsql(connectionString));

// 3. Configura a Autenticação Bearer JWT
var jwtSecret = builder.Configuration["JWT_SECRET"] ?? "sua_chave_secreta_jwt_aqui_minimo_32_caracteres";
var key = Encoding.ASCII.GetBytes(jwtSecret);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = false,
        ValidateAudience = false,
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();

// 4. Configura CORS de forma segura
builder.Services.AddCors(options =>
{
    options.AddPolicy("Mixer8CorsPolicy", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// 5. Configura controladores forçando a serialização PascalCase (Soberania do Backend)
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = null; // Mantém a grafia PascalCase
    });

builder.Services.AddOpenApi();

var app = builder.Build();

// 6. Roda Migrações automáticas de Banco de Dados na Inicialização (Resiliência) e Seed de usuários
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var db = services.GetRequiredService<Mixer8DbContext>();
        Console.WriteLine("[DB] Verificando e aplicando migrações pendentes no PostgreSQL homelab...");
        db.Database.Migrate();
        Console.WriteLine("[DB] Banco de dados inicializado com sucesso!");

        // Seed de usuários conforme especificação (admin, moderator, paiduser, user com senha 'mixer8')
        var seedUsers = new[]
        {
            new { Email = "admin@mixer8.com", Role = "Admin" },
            new { Email = "moderator@mixer8.com", Role = "Moderator" },
            new { Email = "paiduser@mixer8.com", Role = "PaidUser" },
            new { Email = "user@mixer8.com", Role = "User" }
        };

        bool seedApplied = false;
        foreach (var seed in seedUsers)
        {
            var normalizedEmail = seed.Email.ToLower().Trim();
            var exists = db.Users.Any(u => u.Email == normalizedEmail);
            if (!exists)
            {
                var newUser = new Mixer8.Api.Domain.User
                {
                    UserId = Guid.NewGuid(),
                    Email = normalizedEmail,
                    PasswordHash = SecurityHelper.HashPassword("mixer8"),
                    UserRole = seed.Role,
                    CreatedAt = DateTime.UtcNow
                };
                db.Users.Add(newUser);
                Console.WriteLine($"[DB SEED] Adicionando usuário semente: {normalizedEmail} ({seed.Role})");
                seedApplied = true;
            }
        }

        if (seedApplied)
        {
            db.SaveChanges();
            Console.WriteLine("[DB SEED] Usuários semente gravados com sucesso!");
        }

        // Seed de música de demonstração se a biblioteca de tracks estiver vazia
        var hasTracks = db.Tracks.Any();
        if (!hasTracks)
        {
            var demoTrackId = Guid.Parse("11111111-1111-1111-1111-111111111111");
            var demoTrack = new Mixer8.Api.Domain.Track
            {
                TrackId = demoTrackId,
                TrackTitle = "Demo Stems - Summer Breeze",
                ArtistName = "Mixer8 Collective",
                ExtractionStatus = "Pronto",
                UploadedBy = Guid.Empty,
                CreatedAt = DateTime.UtcNow,
                Stems = new List<Mixer8.Api.Domain.Stem>
                {
                    new Mixer8.Api.Domain.Stem { StemId = Guid.NewGuid(), TrackId = demoTrackId, StemType = "Vocals", AudioUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", CreatedAt = DateTime.UtcNow },
                    new Mixer8.Api.Domain.Stem { StemId = Guid.NewGuid(), TrackId = demoTrackId, StemType = "Drums", AudioUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", CreatedAt = DateTime.UtcNow },
                    new Mixer8.Api.Domain.Stem { StemId = Guid.NewGuid(), TrackId = demoTrackId, StemType = "Bass", AudioUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", CreatedAt = DateTime.UtcNow },
                    new Mixer8.Api.Domain.Stem { StemId = Guid.NewGuid(), TrackId = demoTrackId, StemType = "Piano", AudioUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3", CreatedAt = DateTime.UtcNow },
                    new Mixer8.Api.Domain.Stem { StemId = Guid.NewGuid(), TrackId = demoTrackId, StemType = "Others", AudioUrl = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3", CreatedAt = DateTime.UtcNow }
                }
            };
            db.Tracks.Add(demoTrack);
            db.SaveChanges();
            Console.WriteLine("[DB SEED] Música de demonstração (Demo Stems) gravada com sucesso!");
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[DB ERROR] Falha ao conectar, aplicar migrações ou realizar o seed: {ex.Message}");
    }
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("Mixer8CorsPolicy");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
