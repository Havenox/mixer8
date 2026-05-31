# Estágio de Build
FROM node:20-alpine AS build-env
WORKDIR /app

# Declara argumentos de build para expor as variáveis do host
ARG VITE_API_URL
ARG VITE_EXTRACTOR_URL

# Define as variáveis de ambiente necessárias para a compilação do Vite
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_EXTRACTOR_URL=$VITE_EXTRACTOR_URL

# Copia arquivos do package manager e instala dependências
COPY package*.json ./
RUN npm install

# Copia todo o restante e compila a SPA
COPY . ./
RUN npm run build

# Estágio de Produção
FROM nginx:alpine
# Copia o arquivo de configuração do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Copia os arquivos estáticos para o diretório de arquivos do Nginx
COPY --from=build-env /app/dist /usr/share/nginx/html

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
