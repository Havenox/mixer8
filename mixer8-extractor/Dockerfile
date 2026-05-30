# Estágio de Build
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build-env
WORKDIR /app

# Copia os arquivos de projeto e restaura as dependências
COPY Mixer8.Extractor.csproj ./
RUN dotnet restore

# Copia todo o restante e compila/publica
COPY . ./
RUN dotnet publish -c Release -o out

# Estágio de Runtime
FROM mcr.microsoft.com/dotnet/runtime:10.0
WORKDIR /app

COPY --from=build-env /app/out .

ENTRYPOINT ["dotnet", "Mixer8.Extractor.dll"]
