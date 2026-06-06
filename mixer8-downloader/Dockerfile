# Estágio de Build
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build-env
WORKDIR /app

# Copia os arquivos de projeto e restaura as dependências
COPY mixer8-downloader.csproj ./
RUN dotnet restore

# Copia todo o restante e compila/publica
COPY . ./
RUN dotnet publish -c Release -o out

# Estágio de Runtime
FROM mcr.microsoft.com/dotnet/runtime:10.0
WORKDIR /app

# Copia o binário estático do Deno (solucionador JS recomendado pelo yt-dlp)
COPY --from=denoland/deno:bin /deno /usr/local/bin/deno

# Instala ffmpeg, python3, pip, yt-dlp e o yt-dlp-ejs de forma limpa e atualizada
RUN apt-get update && \
    apt-get install -y ffmpeg python3 python3-pip python3-venv && \
    python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --upgrade pip yt-dlp yt-dlp-ejs && \
    ln -s /opt/venv/bin/yt-dlp /usr/local/bin/yt-dlp && \
    rm -rf /var/lib/apt/lists/*

COPY --from=build-env /app/out .

ENTRYPOINT ["dotnet", "mixer8-downloader.dll"]
