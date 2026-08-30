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
# 2. Estágio de Runtime (.NET 10 Runtime + FFmpeg Estático)
# Utiliza o binário estático do FFmpeg (Zero apt-get, 0 MB de pacotes X11/Mesa)
# =========================================================================
FROM mcr.microsoft.com/dotnet/runtime:10.0
WORKDIR /app

# Copia o binário estático do FFmpeg e FFprobe
COPY --from=mwader/static-ffmpeg:latest /ffmpeg /usr/local/bin/ffmpeg
COPY --from=mwader/static-ffmpeg:latest /ffprobe /usr/local/bin/ffprobe

# Copia os binários compilados (.NET)
COPY --from=build-env /app/out .

ENTRYPOINT ["dotnet", "Mixer8.Waveformer.dll"]
