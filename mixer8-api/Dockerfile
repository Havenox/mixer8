# Estágio de Build
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build-env
WORKDIR /app

# Copia os arquivos de projeto e restaura as dependências
COPY Mixer8.Api.csproj ./
RUN dotnet restore

# Copia todo o restante e compila/publica
COPY . ./
RUN dotnet publish -c Release -o out

# Estágio de Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app

# Instala ffmpeg no container final (necessário para a conversão de áudio para Opus)
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

COPY --from=build-env /app/out .

EXPOSE 5000
ENTRYPOINT ["dotnet", "Mixer8.Api.dll"]
