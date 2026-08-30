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
# 2. Estágio de Runtime Oficial do Playwright (.NET 10 + Chrome + Libs Linux)
# Utiliza a imagem oficial da Microsoft onde o Chrome, Node e todas as
# 120+ bibliotecas do Linux já vêm 100% pré-instaladas de fábrica (Zero apt-get)
# =========================================================================
FROM mcr.microsoft.com/playwright/dotnet:v1.49.0-noble
WORKDIR /app

# Atualiza o runtime do .NET para o .NET 10.0 a partir da imagem oficial Microsoft
COPY --from=mcr.microsoft.com/dotnet/runtime:10.0 /usr/share/dotnet /usr/share/dotnet

# Instala a distribuição oficial do Google Chrome (/opt/google/chrome/chrome) com codecs proprietários
# A imagem noble já contém todas as dependências do SO, instalando o Chrome diretamente em poucos segundos
RUN (sed -i 's|http://archive.ubuntu.com/ubuntu/|http://mirror.ufscar.br/ubuntu/|g' /etc/apt/sources.list.d/ubuntu.sources 2>/dev/null || true) && \
    (sed -i 's|http://security.ubuntu.com/ubuntu/|http://mirror.ufscar.br/ubuntu/|g' /etc/apt/sources.list.d/ubuntu.sources 2>/dev/null || true) && \
    (sed -i 's|http://archive.ubuntu.com/ubuntu/|http://mirror.ufscar.br/ubuntu/|g' /etc/apt/sources.list 2>/dev/null || true) && \
    (sed -i 's|http://security.ubuntu.com/ubuntu/|http://mirror.ufscar.br/ubuntu/|g' /etc/apt/sources.list 2>/dev/null || true) && \
    echo 'Acquire::ForceIPv4 "true";' > /etc/apt/apt.conf.d/99force-ipv4 && \
    (curl -4 -fsSL --retry 10 --retry-delay 2 --retry-connrefused --connect-timeout 15 -o /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb || \
     wget -4 --tries=10 --timeout=15 -O /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb) && \
    apt-get update && \
    apt-get install -y /tmp/chrome.deb --no-install-recommends && \
    rm -rf /tmp/chrome.deb /var/lib/apt/lists/*

# Copia apenas os binários compilados (.NET)
COPY --from=build-env /app/out .

# Definição de volumes para persistência de cookies de sessão (config) e downloads
VOLUME [ "/app/config", "/app/downloads" ]

ENTRYPOINT ["dotnet", "Mixer8.Extractor.dll"]
