using dotenv.net;
using Microsoft.EntityFrameworkCore;
using Mixer8.Extractor;
using Mixer8.Extractor.Infrastructure;
using System;
using System.IO;

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

var builder = Host.CreateApplicationBuilder(args);

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
    options.UseNpgsql(connectionString), ServiceLifetime.Singleton); // Usamos Singleton ou Factory para Background Workers de forma segura

builder.Services.AddHostedService<Worker>();

var host = builder.Build();
host.Run();
