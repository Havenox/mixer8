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

// 6. Roda Migrações automáticas de Banco de Dados na Inicialização (Resiliência)
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var db = services.GetRequiredService<Mixer8DbContext>();
        Console.WriteLine("[DB] Verificando e aplicando migrações pendentes no PostgreSQL homelab...");
        db.Database.Migrate();
        Console.WriteLine("[DB] Banco de dados inicializado com sucesso!");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[DB ERROR] Falha ao conectar ou aplicar migrações: {ex.Message}");
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
