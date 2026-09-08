# ─── API DOCKERFILE ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependencias del sistema necesarias para Prisma
RUN apk add --no-cache openssl libc6-compat

# Copiar manifiestos de paquetes
COPY package*.json ./
COPY packages/database/package*.json ./packages/database/
COPY apps/api/package*.json ./apps/api/

# Instalar dependencias completas para compilar
RUN npm install

# Copiar esquema de prisma y generar cliente
COPY packages/database ./packages/database
RUN npx prisma generate --schema=./packages/database/schema.prisma

# Copiar código fuente de la API y compilar
COPY apps/api ./apps/api
RUN npm run build --workspace=@fim-colectivo/api

# ─── RUNNER DE PRODUCCIÓN ──────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

ENV NODE_ENV=production
ENV PORT=3011

# Copiar dependencias y artefactos compilados
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/database ./packages/database
COPY --from=builder /app/apps/api/package*.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 3011

CMD ["node", "apps/api/dist/index.js"]
