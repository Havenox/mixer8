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
# 2. Estágio de Runtime (.NET 10 Runtime + yt-dlp + Deno + FFmpeg Estático)
# =========================================================================
FROM mcr.microsoft.com/dotnet/runtime:10.0
WORKDIR /app

# Copia o binário estático do Deno (solucionador JS recomendado pelo yt-dlp)
COPY --from=denoland/deno:bin /deno /usr/local/bin/deno

# Copia os binários estáticos do FFmpeg e FFprobe (Zero pacotes X11/Mesa/LLVM)
COPY --from=mwader/static-ffmpeg:latest /ffmpeg /usr/local/bin/ffmpeg
COPY --from=mwader/static-ffmpeg:latest /ffprobe /usr/local/bin/ffprobe

# Troca o espelho internacional lento pelo espelho brasileiro de alta velocidade (UFSCar),
# forçando IPv4 para baixar o Python3 mínimo em segundos sem timeouts de rede.
RUN (sed -i 's|http://archive.ubuntu.com/ubuntu/|http://mirror.ufscar.br/ubuntu/|g' /etc/apt/sources.list.d/ubuntu.sources 2>/dev/null || true) && \
    (sed -i 's|http://security.ubuntu.com/ubuntu/|http://mirror.ufscar.br/ubuntu/|g' /etc/apt/sources.list.d/ubuntu.sources 2>/dev/null || true) && \
    (sed -i 's|http://archive.ubuntu.com/ubuntu/|http://mirror.ufscar.br/ubuntu/|g' /etc/apt/sources.list 2>/dev/null || true) && \
    (sed -i 's|http://security.ubuntu.com/ubuntu/|http://mirror.ufscar.br/ubuntu/|g' /etc/apt/sources.list 2>/dev/null || true) && \
    echo 'Acquire::ForceIPv4 "true";' > /etc/apt/apt.conf.d/99force-ipv4 && \
    apt-get update && \
    apt-get install -y python3 python3-pip python3-venv --no-install-recommends && \
    python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir --timeout 120 --retries 10 yt-dlp yt-dlp-ejs curl-cffi && \
    ln -s /opt/venv/bin/yt-dlp /usr/local/bin/yt-dlp && \
    rm -rf /var/lib/apt/lists/*

# Copia apenas os binários compilados (.NET)
COPY --from=build-env /app/out .

ENTRYPOINT ["dotnet", "mixer8-downloader.dll"]
