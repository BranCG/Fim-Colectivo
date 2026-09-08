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

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ─── Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/colectivos', colectivosRoutes);

// Health check
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'Fim Colectivo API' });
});

// ─── Socket.io handlers ───────────────────────────────────────────────────
setupSocketHandlers(io);

// ─── Start server ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3011;
httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════╗
║       FIM COLECTIVO API           ║
║     Running on port ${PORT}         ║
║     http://localhost:${PORT}        ║
╚═══════════════════════════════════╝
  `);
});

export { io };
