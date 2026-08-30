# =========================================================================
# 1. Estágio de Build (Node 20 Alpine)
# =========================================================================
FROM node:20-alpine AS build-env
WORKDIR /app

# Declara argumentos de build para expor as variáveis do host
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Copia arquivos do package manager e instala dependências (camada em cache se package*.json não mudar)
COPY package*.json ./
RUN npm install

# Copia todo o código-fonte e compila a SPA
COPY . ./
RUN npm run build

# =========================================================================
# 2. Estágio de Produção (Nginx Alpine)
# =========================================================================
FROM nginx:alpine
# Copia o arquivo de configuração do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Copia os arquivos estáticos compilados para o diretório de serviço do Nginx
COPY --from=build-env /app/dist /usr/share/nginx/html

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
