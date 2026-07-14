# Estágio de Build (.NET 10 SDK)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build-env
WORKDIR /app

# Copia os arquivos de projeto e restaura as dependências
COPY Mixer8.Waveformer.csproj ./
RUN dotnet restore

# Copia todo o restante e compila/publica em modo Release
COPY . ./
RUN dotnet publish -c Release -o out

# Estágio de Runtime (.NET 10 Runtime + FFmpeg)
FROM mcr.microsoft.com/dotnet/runtime:10.0
WORKDIR /app

# Instalação do FFmpeg para decodificação de áudio PCM
RUN apt-get update && apt-get install -y \
    ffmpeg \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Copia os binários compilados
COPY --from=build-env /app/out .

ENTRYPOINT ["dotnet", "Mixer8.Waveformer.dll"]
