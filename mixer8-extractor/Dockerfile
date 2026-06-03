# Estágio de Build (.NET 10 SDK)
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build-env
WORKDIR /app

# Copia os arquivos de projeto e restaura as dependências
COPY Mixer8.Extractor.csproj ./
RUN dotnet restore

# Copia todo o restante e compila/publica em modo Release
COPY . ./
RUN dotnet publish -c Release -o out

# Estágio de Runtime (.NET 10 Runtime + Playwright Chromium dependencies)
FROM mcr.microsoft.com/dotnet/runtime:10.0
WORKDIR /app

# Instalação do curl e Node.js para possibilitar a execução da CLI do Playwright
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    --no-install-recommends && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Copia primeiro apenas o driver do Playwright para cachear o download do Chrome
COPY --from=build-env /app/out/.playwright ./.playwright

# Executa o script de instalação do Playwright que baixa o Google Chrome Oficial 
# e instala automaticamente todas as dependências de sistema (apt-get) necessárias.
# Essa etapa será cacheada pelo Docker e só rodará de novo se você atualizar a versão do Playwright.
RUN node .playwright/package/cli.js install --with-deps chrome

# Agora sim, copia o restante dos binários compilados (que mudam frequentemente)
COPY --from=build-env /app/out .

# Definição de volumes para persistência de cookies de sessão (config) e downloads
VOLUME [ "/app/config", "/app/downloads" ]

ENTRYPOINT ["dotnet", "Mixer8.Extractor.dll"]
