# =========================================================================
# 1. Estágio de Build (.NET 10 SDK)
# =========================================================================
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build-env
WORKDIR /app

# Copia os arquivos de projeto e restaura as dependências (.csproj em cache)
COPY Mixer8.Extractor.csproj ./
RUN dotnet restore

# Copia todo o código-fonte e compila em modo Release
COPY . ./
RUN dotnet publish -c Release -o out

# =========================================================================
# 2. Estágio de Runtime (.NET 10 Runtime + Playwright Chrome)
# =========================================================================
FROM mcr.microsoft.com/dotnet/runtime:10.0
WORKDIR /app

ENV PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright

# Instalação do Node.js + Playwright CLI + Google Chrome Oficial e dependências Linux
# Esta camada é 100% estática e imutável (fica em cache eterno para alterações de C#)
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    --no-install-recommends && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    npx -y playwright@1.49.0 install --with-deps chrome && \
    rm -rf /var/lib/apt/lists/*

# Copia os binários compilados (única camada que reexecuta ao alterar o C# - ~0.2s)
COPY --from=build-env /app/out .

# Definição de volumes para persistência de cookies de sessão (config) e downloads
VOLUME [ "/app/config", "/app/downloads" ]

ENTRYPOINT ["dotnet", "Mixer8.Extractor.dll"]
