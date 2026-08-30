# =========================================================================
# 1. Estágio de Build (.NET 10 SDK)
# =========================================================================
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build-env
WORKDIR /app

# Copia os arquivos de projeto e restaura as dependências (.csproj em cache)
COPY Mixer8.Waveformer.csproj ./
RUN dotnet restore

# Copia todo o código-fonte e compila em modo Release
COPY . ./
RUN dotnet publish -c Release -o out

# =========================================================================
# 2. Estágio de Runtime (.NET 10 Runtime + FFmpeg)
# =========================================================================
FROM mcr.microsoft.com/dotnet/runtime:10.0
WORKDIR /app

# Instalação do FFmpeg para decodificação de áudio PCM (camada 100% cacheada)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Copia os binários compilados (.NET)
COPY --from=build-env /app/out .

ENTRYPOINT ["dotnet", "Mixer8.Waveformer.dll"]
