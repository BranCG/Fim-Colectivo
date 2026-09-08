import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// ─── ESTADO DEL CONDUCTOR (para el dashboard) ─────────────────────────────
router.get('/me', requireAuth, requireRole('driver'), async (req: Request, res: Response) => {
  try {
    const driver = await prisma.driver.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true, name: true, email: true, phone: true,
        status: true, membershipPaid: true, membershipDate: true,
        membershipPlan: true, membershipGoal: true, membershipProgress: true,
        dailyCashTripsCount: true,
        isOnline: true, lastLat: true, lastLng: true,
        vehicleBrand: true, vehicleModel: true, vehicleYear: true,
        vehiclePlate: true, vehiclePhotoUrl: true, tagNumber: true,
        totalRating: true, totalTrips: true,
        adminNotes: true, mercadoPagoLink: true, walletBalance: true,
      },
    });

    if (!driver) return res.status(404).json({ error: 'Conductor no encontrado' });
    return res.json({ driver });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno' });
  }
});

// ─── ACTUALIZAR POSICIÓN GPS ──────────────────────────────────────────────
router.post('/location', requireAuth, requireRole('driver'), async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.body;

    await prisma.driver.update({
      where: { id: req.user!.id },
      data: { lastLat: lat, lastLng: lng, lastSeen: new Date() },
    });

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Error al actualizar posición' });
  }
});

// ─── CAMBIAR ESTADO EN LÍNEA ──────────────────────────────────────────────
router.post('/toggle-online', requireAuth, requireRole('driver'), async (req: Request, res: Response) => {
  try {
    const { isOnline } = req.body;

    const driver = await prisma.driver.findUnique({ where: { id: req.user!.id } });
    if (!driver) return res.status(404).json({ error: 'No encontrado' });

    if (driver.status !== 'active') {
      return res.status(403).json({ error: 'Debes estar aprobado por un administrador' });
    }

    if (!driver.membershipPaid && driver.membershipPlan === 'PREPAID') {
      return res.status(403).json({ error: 'Debes pagar tu membresía prepago para activarte' });
    }

    const updated = await prisma.driver.update({
      where: { id: req.user!.id },
      data: { isOnline },
    });

    return res.json({ isOnline: updated.isOnline });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno' });
  }
});

// ─── VIAJE ACTIVO DEL CONDUCTOR ───────────────────────────────────────────
router.get('/active-trip', requireAuth, requireRole('driver'), async (req: Request, res: Response) => {
  try {
    const trip = await prisma.trip.findFirst({
      where: {
        driverId: req.user!.id,
        status: { in: ['driver_assigned', 'driver_arrived', 'in_progress'] },
      },
      include: {
        passenger: { select: { id: true, name: true, phone: true } },
      },
    });

    return res.json({ trip });
  } catch (err) {
    return res.status(500).json({ error: 'Error interno' });
  }
});

// ─── ACTUALIZAR LINK DE PAGO ─────────────────────────────────────────────
router.post('/payment-link', requireAuth, requireRole('driver'), async (req: Request, res: Response) => {
  try {
    const { mercadoPagoLink } = req.body;
    await prisma.driver.update({
      where: { id: req.user!.id },
      data: { mercadoPagoLink },
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Error al actualizar link de pago' });
  }
});

export default router;
