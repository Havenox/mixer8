# =========================================================================
# 1. Estágio de Build (.NET 10 SDK)
# =========================================================================
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build-env
WORKDIR /app

# Copia os arquivos de projeto e restaura as dependências (.csproj em cache)
COPY mixer8-downloader.csproj ./
RUN dotnet restore

# Copia todo o código-fonte e compila em modo Release
COPY . ./
RUN dotnet publish -c Release -o out

# =========================================================================
# 2. Estágio de Runtime (.NET 10 Runtime + yt-dlp + Deno)
# =========================================================================
FROM mcr.microsoft.com/dotnet/runtime:10.0
WORKDIR /app

# Copia o binário estático do Deno (solucionador JS recomendado pelo yt-dlp)
COPY --from=denoland/deno:bin /deno /usr/local/bin/deno

# Instala ffmpeg, python3, pip, yt-dlp, curl-cffi e yt-dlp-ejs (camada 100% cacheada)
RUN apt-get update && \
    apt-get install -y ffmpeg python3 python3-pip python3-venv --no-install-recommends && \
    python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --upgrade pip yt-dlp yt-dlp-ejs curl-cffi && \
    ln -s /opt/venv/bin/yt-dlp /usr/local/bin/yt-dlp && \
    rm -rf /var/lib/apt/lists/*

# Copia apenas os binários compilados (.NET)
COPY --from=build-env /app/out .

ENTRYPOINT ["dotnet", "mixer8-downloader.dll"]
