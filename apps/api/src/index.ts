import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

// Routes
import authRoutes from './routes/auth';
import driverRoutes from './routes/drivers';
import tripRoutes from './routes/trips';
import adminRoutes from './routes/admin';
import uploadRoutes from './routes/uploads';
import paymentRoutes from './routes/payments.routes';
import colectivosRoutes from './routes/colectivos';

import prisma from './utils/prisma';

// Socket handler
import { setupSocketHandlers } from './socket/handlers';

const app = express();
const httpServer = createServer(app);

// ─── CORS configuration for local testing and Cloudflare subdomains ────────
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true);
    const isLocal = /^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin);
    const isFimDomain = /^https?:\/\/([a-z0-9-]+\.)*fimchile\.cl(:\d+)?$/.test(origin);
    const isCapacitor = origin === 'capacitor://localhost' || origin === 'http://localhost' || origin === 'https://localhost';
    
    if (isLocal || isFimDomain || isCapacitor || origin === process.env.CLIENT_URL || origin === process.env.ADMIN_URL) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

// ─── Socket.io ────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    ...corsOptions,
    methods: ['GET', 'POST'],
  },
});

// ─── Middleware ────────────────────────────────────────────────────────────
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

import client from 'prom-client';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Prometheus Default Metrics
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ prefix: 'fim_colectivo_' });

// Custom Prometheus Gauge for active socket connections
const activeSocketsGauge = new client.Gauge({
  name: 'fim_colectivo_active_sockets',
  help: 'Número de conexiones activas Socket.io (conductores/pasajeros en vivo)',
});

// Custom HTTP request counter
const httpRequestCounter = new client.Counter({
  name: 'fim_colectivo_http_requests_total',
  help: 'Total de peticiones HTTP procesadas',
  labelNames: ['method', 'route', 'status_code'],
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Middleware para métricas HTTP
app.use((req, res, next) => {
  res.on('finish', () => {
    const route = req.route ? req.route.path : req.path;
    httpRequestCounter.inc({ method: req.method, route, status_code: res.statusCode });
  });
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/colectivos', colectivosRoutes);

// Health check extendido con estado de BD y memoria
app.get('/api/health', async (_, res) => {
  let dbStatus = 'disconnected';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (error) {
    dbStatus = 'error';
  }

  const memoryUsage = process.memoryUsage();
  res.json({
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    service: 'Fim Colectivo API',
    database: dbStatus,
    uptimeSeconds: Math.floor(process.uptime()),
    memory: {
      rssMB: Math.round(memoryUsage.rss / 1024 / 1024),
      heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
    },
    timestamp: new Date().toISOString(),
  });
});

// Prometheus Metrics Endpoint
app.get('/api/metrics', async (_, res) => {
  try {
    activeSocketsGauge.set(io.sockets.sockets.size);
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

// ─── Socket.io handlers ───────────────────────────────────────────────────
setupSocketHandlers(io);

// ─── Start server ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3011;
httpServer.listen(PORT, async () => {
  // Resetear estados online residuales para garantizar que choferes no conectados no aparezcan como fantasmas
  try {
    await prisma.driver.updateMany({
      where: { isOnline: true },
      data: { isOnline: false },
    });
    console.log('[Startup] Estado de conductores reseteado a fuera de servicio.');
  } catch (err) {
    console.error('[Startup] Error reseteando estado de conductores:', err);
  }

  console.log(`
╔═══════════════════════════════════╗
║       FIM COLECTIVO API           ║
║     Running on port ${PORT}         ║
║     http://localhost:${PORT}        ║
╚═══════════════════════════════════╝
  `);
});

export { io };
