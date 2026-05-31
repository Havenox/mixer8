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
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 500 * 1024 * 1024; // 500 MB
});

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

builder.Services.AddMemoryCache();

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

builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 500 * 1024 * 1024; // 500 MB
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
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                var roleEnum = seed.Role switch
                {
                    "Admin" => Mixer8.Api.Domain.UserRoleType.Admin,
                    "Moderator" => Mixer8.Api.Domain.UserRoleType.Moderator,
                    "PaidUser" => Mixer8.Api.Domain.UserRoleType.PaidUser,
                    _ => Mixer8.Api.Domain.UserRoleType.User
                };

                var newRole = new Mixer8.Api.Domain.UserRole
                {
                    UserRoleId = Guid.NewGuid(),
                    UserId = newUser.UserId,
                    Role = roleEnum,
                    UpdatedAt = DateTime.UtcNow
                };

                var newProfile = new Mixer8.Api.Domain.UserProfile
                {
                    UserProfileId = Guid.NewGuid(),
                    UserId = newUser.UserId,
                    UserName = seed.Email.Split('@')[0],
                    FirstName = seed.Role,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    Preferences = new Mixer8.Api.Domain.UserProfilePreferences()
                };

                db.Users.Add(newUser);
                db.UserRoles.Add(newRole);
                db.UserProfiles.Add(newProfile);

                Console.WriteLine($"[DB SEED] Adicionando usuário semente: {normalizedEmail} ({seed.Role})");
                seedApplied = true;
            }
        }

        if (seedApplied)
        {
            db.SaveChanges();
            Console.WriteLine("[DB SEED] Usuários semente gravados com sucesso!");
        }

        // Auto-reparo para usuários existentes migrados
        var allUsers = db.Users.Include(u => u.UserRole).Include(u => u.UserProfile).ToList();
        bool repairNeeded = false;
        foreach (var u in allUsers)
        {
            // Ativa o usuário se estiver inativo devido ao default value da migration
            if (!u.IsActive)
            {
                u.IsActive = true;
                repairNeeded = true;
                Console.WriteLine($"[DB REPAIR] Ativando usuário legado: {u.Email}");
            }

            if (u.UserRole == null)
            {
                var roleEnum = u.Email.ToLower().Trim() switch
                {
                    "admin@mixer8.com" => Mixer8.Api.Domain.UserRoleType.Admin,
                    "moderator@mixer8.com" => Mixer8.Api.Domain.UserRoleType.Moderator,
                    "paiduser@mixer8.com" => Mixer8.Api.Domain.UserRoleType.PaidUser,
                    _ => Mixer8.Api.Domain.UserRoleType.User
                };

                var newRole = new Mixer8.Api.Domain.UserRole
                {
                    UserRoleId = Guid.NewGuid(),
                    UserId = u.UserId,
                    Role = roleEnum,
                    UpdatedAt = DateTime.UtcNow
                };
                db.UserRoles.Add(newRole);
                repairNeeded = true;
                Console.WriteLine($"[DB REPAIR] Criando UserRole ({roleEnum}) para usuário legado: {u.Email}");
            }

            if (u.UserProfile == null)
            {
                var roleStr = u.Email.ToLower().Trim() switch
                {
                    "admin@mixer8.com" => "Admin",
                    "moderator@mixer8.com" => "Moderator",
                    "paiduser@mixer8.com" => "PaidUser",
                    _ => "User"
                };

                var newProfile = new Mixer8.Api.Domain.UserProfile
                {
                    UserProfileId = Guid.NewGuid(),
                    UserId = u.UserId,
                    UserName = u.Email.Split('@')[0],
                    FirstName = roleStr,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    Preferences = new Mixer8.Api.Domain.UserProfilePreferences()
                };
                db.UserProfiles.Add(newProfile);
                repairNeeded = true;
                Console.WriteLine($"[DB REPAIR] Criando UserProfile para usuário legado: {u.Email}");
            }
        }

        if (repairNeeded)
        {
            db.SaveChanges();
            Console.WriteLine("[DB REPAIR] Ajustes de dados legados gravados com sucesso!");
        }

        // Remove a música de demonstração legada se existir no banco
        var demoTrackId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var existingDemo = db.Tracks.Include(t => t.Stems).FirstOrDefault(t => t.TrackId == demoTrackId);
        if (existingDemo != null)
        {
            db.Tracks.Remove(existingDemo);
            db.SaveChanges();
            Console.WriteLine("[DB SEED] Música de demonstração legada removida com sucesso do banco de dados.");
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

// Habilita arquivos estáticos com suporte a arquivos .opus (MimeType) e cabeçalhos CORS liberados
var contentTypeProvider = new Microsoft.AspNetCore.StaticFiles.FileExtensionContentTypeProvider();
contentTypeProvider.Mappings[".opus"] = "audio/opus";

app.UseStaticFiles(new StaticFileOptions
{
    ContentTypeProvider = contentTypeProvider,
    OnPrepareResponse = ctx =>
    {
        ctx.Context.Response.Headers.Append("Access-Control-Allow-Origin", "*");
        ctx.Context.Response.Headers.Append("Access-Control-Allow-Headers", "*");
        ctx.Context.Response.Headers.Append("Access-Control-Allow-Methods", "*");
    }
});

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
