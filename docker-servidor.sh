#!/bin/bash
set -e

echo "🐳 ==========================================================="
echo "    Desplegando Fim Colectivo con Docker en AWS"
echo "==========================================================="

APP_DIR="/var/www/fim-colectivo"
cd "$APP_DIR"

# 1. Comprobar si Docker está instalado
if ! command -v docker &> /dev/null; then
  echo "📦 Instalando Docker y Docker Compose..."
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl gnupg
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker $USER
fi

# 2. Detener procesos antiguos de PM2 para liberar puertos 3010 y 3011
echo "🛑 Liberando puertos 3010 y 3011 en PM2..."
pm2 delete fim-colectivo-api 2>/dev/null || true
pm2 delete fim-colectivo-web 2>/dev/null || true
pm2 save

# 3. Reconstruir y levantar contenedores en segundo plano
echo "🔨 Construyendo imágenes y levantando contenedores Docker..."
docker compose up -d --build

# 4. Estado final
echo ""
echo "✅ Contenedores Fim Colectivo en ejecución:"
docker compose ps

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  🚀 ¡FIM COLECTIVO CORRIENDO EN DOCKER EXITOSAMENTE!"
echo "  🌐 Web: https://colectivo.fimchile.cl (Puerto 3010)"
echo "  ⚙️ API: https://colectivo.fimchile.cl/api (Puerto 3011)"
echo ""
echo "  📋 Comandos útiles para el día a día:"
echo "    • Reiniciar:        docker compose restart"
echo "    • Recompilar todo:  docker compose up -d --build"
echo "    • Ver logs en vivo: docker compose logs -f"
echo "    • Detener:          docker compose down"
echo "═══════════════════════════════════════════════════════════════"
