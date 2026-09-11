import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// Todas las rutas requieren ser admin
router.use(requireAuth, requireRole('admin'));

// ─── ESTADÍSTICAS GENERALES ───────────────────────────────────────────────
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [
      totalDrivers, pendingDrivers, activeDrivers,
      totalPassengers, totalTrips, completedTrips,
      membershipsPaid,
    ] = await Promise.all([
      prisma.driver.count(),
      prisma.driver.count({ where: { status: 'pending' } }),
      prisma.driver.count({ where: { status: 'active', isOnline: true } }),
      prisma.user.count({ where: { role: 'passenger' } }),
      prisma.trip.count(),
      prisma.trip.count({ where: { status: 'completed' } }),
      prisma.driver.count({ where: { membershipPaid: true } }),
    ]);

    const membershipRevenue = membershipsPaid * 100000;

    const recentTrips = await prisma.trip.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        passenger: { select: { name: true } },
        driver: { select: { name: true } },
      },
    });

    return res.json({
      stats: {
        totalDrivers, pendingDrivers, activeDrivers,
        totalPassengers, totalTrips, completedTrips,
        membershipsPaid, membershipRevenue,
      },
      recentTrips,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// ─── CONDUCTORES PENDIENTES DE VALIDACIÓN ────────────────────────────────
router.get('/drivers/pending', async (_req: Request, res: Response) => {
  try {
    const drivers = await prisma.driver.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, name: true, email: true, phone: true,
        rut: true, birthDate: true, address: true,
        idFrontUrl: true, idBackUrl: true,
        licenseNumber: true, licenseUrl: true,
        vehicleBrand: true, vehicleModel: true, vehicleYear: true,
        vehiclePlate: true, vehiclePhotoUrl: true, tagNumber: true,
        membershipPaid: true, createdAt: true,
      },
    });
    return res.json({ drivers });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno' });
  }
});

// ─── TODOS LOS CONDUCTORES ────────────────────────────────────────────────
router.get('/drivers', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const drivers = await prisma.driver.findMany({
      where: status ? { status: String(status) } : undefined,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, email: true, phone: true,
        rut: true, status: true, membershipPaid: true,
        vehicleBrand: true, vehicleModel: true, vehiclePlate: true,
        totalRating: true, totalTrips: true, isOnline: true,
        createdAt: true,
      },
    });
    return res.json({ drivers });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno' });
  }
});

// ─── DETALLE DE UN CONDUCTOR ──────────────────────────────────────────────
router.get('/drivers/:id', async (req: Request, res: Response) => {
  try {
    const driver = await prisma.driver.findUnique({
      where: { id: String(req.params.id) },
      include: {
        trips: {
          orderBy: { createdAt: 'desc' },
          include: { passenger: { select: { name: true } } }
        }
      }
    });
    if (!driver) return res.status(404).json({ error: 'No encontrado' });
    return res.json({ driver });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno' });
  }
});

// ─── APROBAR CONDUCTOR ────────────────────────────────────────────────────
router.post('/drivers/:id/approve', async (req: Request, res: Response) => {
  try {
    const driver = await prisma.driver.update({
      where: { id: String(req.params.id) },
      data: { status: 'approved', adminNotes: null },
    });
    return res.json({ message: 'Conductor aprobado', driver });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno' });
  }
});

// ─── RECHAZAR CONDUCTOR ───────────────────────────────────────────────────
router.post('/drivers/:id/reject', async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const driver = await prisma.driver.update({
      where: { id: String(req.params.id) },
      data: { status: 'rejected', adminNotes: reason },
    });
    return res.json({ message: 'Conductor rechazado', driver });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno' });
  }
});

// ─── MARCAR MEMBRESÍA COMO PAGADA ─────────────────────────────────────────
router.post('/drivers/:id/membership-paid', async (req: Request, res: Response) => {
  try {
    const driver = await prisma.driver.update({
      where: { id: String(req.params.id) },
      data: {
        membershipPaid: true,
        membershipDate: new Date(),
        status: 'active',
      },
    });
    return res.json({ message: 'Membresía confirmada. Conductor activado.', driver });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno' });
  }
});

// ─── SUSPENDER CONDUCTOR ──────────────────────────────────────────────────
router.post('/drivers/:id/suspend', async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const driver = await prisma.driver.update({
      where: { id: String(req.params.id) },
      data: { status: 'suspended', isOnline: false, adminNotes: reason },
    });
    return res.json({ message: 'Conductor suspendido', driver });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno' });
  }
});

// ─── PASAJEROS ────────────────────────────────────────────────────────────
router.get('/passengers', async (_req: Request, res: Response) => {
  try {
    const passengers = await prisma.user.findMany({
      where: { role: 'passenger' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, email: true, phone: true,
        rut: true, isVerified: true, createdAt: true,
      },
    });
    return res.json({ passengers });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno' });
  }
});

// ─── REPORTE DE INGRESOS (DIARIO) ─────────────────────────────────────────
router.get('/revenue-report', async (req: Request, res: Response) => {
  try {
    const { date } = req.query; // YYYY-MM-DD
    const targetDate = date ? new Date(String(date)) : new Date();
    
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const trips = await prisma.trip.findMany({
      where: {
        status: 'completed',
        completedAt: { gte: startOfDay, lte: endOfDay },
      },
      include: {
        driver: { select: { name: true } },
      },
    });

    // Agrupar por conductor y método de pago
    const stats: Record<string, any> = {};

    trips.forEach(t => {
      const key = `${t.driverId}_${t.paymentMethod}`;
      const amount = t.finalPrice || t.estimatedPrice;
      
      if (!stats[key]) {
        stats[key] = {
          driverId: t.driverId,
          driverName: t.driver?.name || 'Desconocido',
          paymentMethod: t.paymentMethod,
          totalAmount: 0,
          tripCount: 0,
        };
      }
      stats[key].totalAmount += amount;
      stats[key].tripCount += 1;
    });

    return res.json({ report: Object.values(stats) });
  } catch (err) {
    return res.status(500).json({ error: 'Error al generar reporte' });
  }
});

export default router;
