#!/bin/bash
# Script de deploy HSQ Portal v2
set -e
echo '🚀 Iniciando deploy HSQ Portal...'
cd /docker/hsq-portal

# Build das imagens
echo '📦 Building imagens...'
docker build --no-cache -t hsq-portal-hsq-web:latest ./web
docker compose build --no-cache hsq-api

# Parar containers antigos
echo '⏹️  Parando containers...'
docker compose stop hsq-web nginx
docker compose rm -f hsq-web

# Remover volume antigo do frontend
echo '🗑️  Limpando volume HTML...'
docker volume rm hsq-portal_html-data 2>/dev/null || true

# Subir tudo
echo '▶️  Subindo containers...'
docker compose up -d

# Aguardar inicialização
sleep 10

# Copiar novo build para o volume
echo '📋 Atualizando arquivos estáticos...'
docker create --name hsq-temp-deploy hsq-portal-hsq-web:latest
docker cp hsq-temp-deploy:/usr/share/nginx/html/. /tmp/hsq-dist-deploy/
docker rm hsq-temp-deploy
docker cp /tmp/hsq-dist-deploy/. hsq-web:/usr/share/nginx/html/
rm -rf /tmp/hsq-dist-deploy

# Reload nginx
docker exec hsq-nginx nginx -s reload

echo '✅ Deploy concluído!'
docker ps | grep hsq
