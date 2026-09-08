#!/bin/bash
set -e

echo "🚀 Iniciando despliegue de Fim Colectivo en AWS..."

# 1. Directorio del proyecto
APP_DIR="/var/www/fim-colectivo"

if [ ! -d "$APP_DIR" ]; then
  echo "📥 Clonando repositorio..."
  sudo git clone https://github.com/BranCG/Fim-Colectivo.git "$APP_DIR"
  sudo chown -R $USER:$USER "$APP_DIR"
else
  echo "🔄 Actualizando repositorio existente..."
  cd "$APP_DIR"
  git pull origin main
fi

cd "$APP_DIR"

# 2. Configurar .env del Backend (apps/api/.env)
echo "⚙️ Configurando variables de entorno de la API..."
cat << 'EOF' > apps/api/.env
PORT=3011
DATABASE_URL="postgresql://postgres:Facu31052027..@db.sqnzjhhgovnelrbqwtyw.supabase.co:5432/postgres"
JWT_SECRET="fim-colectivo-super-secret-jwt-key-2026-prod"
JWT_REFRESH_SECRET="fim-colectivo-refresh-secret-2026-prod"
CLIENT_URL="https://colectivo.fimchile.cl"
ADMIN_URL="https://colectivo.fimchile.cl/admin"
UPLOAD_DIR="./uploads"
MP_ACCESS_TOKEN=""
EOF

# 3. Configurar .env de la Base de Datos (packages/database/.env)
cat << 'EOF' > packages/database/.env
DATABASE_URL="postgresql://postgres:Facu31052027..@db.sqnzjhhgovnelrbqwtyw.supabase.co:5432/postgres"
EOF

# 4. Configurar .env del Frontend Web (apps/web/.env.production)
cat << 'EOF' > apps/web/.env.production
NEXT_PUBLIC_API_URL="https://colectivo.fimchile.cl"
EOF

# 5. Instalar dependencias
echo "📦 Instalando dependencias del monorepo..."
npm install

# 6. Sincronizar Prisma y crear tablas en Supabase
echo "🗄️ Creando tablas en Supabase PostgreSQL..."
npx prisma generate --schema=./packages/database/schema.prisma
npx prisma db push --schema=./packages/database/schema.prisma --accept-data-loss

# 7. Sembrar datos iniciales (Líneas 10 y 21, Admin, Chofer, Pasajero)
echo "🌱 Sembrando datos iniciales en Supabase..."
npm run db:seed

# 8. Compilar aplicaciones Web y API
echo "🔨 Compilando aplicaciones..."
npm run build --workspaces

# 9. Iniciar o reiniciar con PM2 sin tocar Fim principal ni MC Simulator
echo "⚡ Levantando procesos con PM2 en puertos 3010 y 3011..."
pm2 delete fim-colectivo-api 2>/dev/null || true
pm2 delete fim-colectivo-web 2>/dev/null || true

pm2 start "npm run start --workspace=@fim-colectivo/api" --name "fim-colectivo-api"
pm2 start "npm run start --workspace=@fim-colectivo/web" --name "fim-colectivo-web"
pm2 save

# 10. Configurar Nginx para colectivo.fimchile.cl
echo "🌐 Configurando Nginx para colectivo.fimchile.cl..."
sudo cp nginx-colectivo.conf /etc/nginx/sites-available/colectivo.fimchile.cl
sudo ln -sf /etc/nginx/sites-available/colectivo.fimchile.cl /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ ¡DESPLIEGUE EXITOSO DE FIM COLECTIVO EN EL SERVIDOR!"
echo "  🌐 URL: https://colectivo.fimchile.cl"
echo "  🔒 Fim Principal y MC Simulator siguen intactos en sus puertos"
echo "═══════════════════════════════════════════════════════════════"
