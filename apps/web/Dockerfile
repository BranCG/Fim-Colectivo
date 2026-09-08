# ─── WEB DOCKERFILE ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat

# Copiar manifiestos
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/

# Instalar dependencias
RUN npm install

# Copiar código fuente web y asegurar directorio public
COPY apps/web ./apps/web
RUN mkdir -p /app/apps/web/public

# Argumentos y variables de compilación Next.js
ARG NEXT_PUBLIC_API_URL=https://colectivo.fimchile.cl
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

# Compilar Next.js
RUN npm run build --workspace=@fim-colectivo/web

# ─── RUNNER DE PRODUCCIÓN ──────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production
ENV PORT=3010
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/package*.json ./apps/web/
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/next.config.js ./apps/web/

EXPOSE 3010

CMD ["npm", "run", "start", "--workspace=@fim-colectivo/web"]
