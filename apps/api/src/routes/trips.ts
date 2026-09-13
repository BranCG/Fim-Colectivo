import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { calculateDistance, calculateTripPrice, estimateDuration } from '../utils/pricing';

const router = Router();

// ─── SOLICITAR VIAJE ──────────────────────────────────────────────────────
router.post('/request', requireAuth, requireRole('passenger'), async (req: Request, res: Response) => {
  try {
    const {
      originLat, originLng, originAddress,
      destLat, destLng, destAddress,
      paymentMethod,
    } = req.body;

    const distanceKm = calculateDistance(originLat, originLng, destLat, destLng);
    const durationMin = estimateDuration(distanceKm);
    let estimatedPrice = calculateTripPrice(distanceKm, durationMin);

    // 50% de Descuento en el PRIMER viaje del pasajero (Tope $8.000)
    const pastTripsCount = await prisma.trip.count({ where: { passengerId: req.user!.id } });
    let isDiscounted = false;
    if (pastTripsCount === 0) {
      const discount = Math.min(Math.round(estimatedPrice * 0.5), 8000);
      estimatedPrice = estimatedPrice - discount;
      isDiscounted = true;
    }

    const trip = await prisma.trip.create({
      data: {
        passengerId: req.user!.id,
        originLat, originLng, originAddress,
        destLat, destLng, destAddress,
        distanceKm,
        durationMin,
        estimatedPrice,
        isDiscounted,
        paymentMethod: paymentMethod || 'cash',
        status: 'searching',
      },
      include: { passenger: { select: { id: true, name: true, phone: true } } },
    });

    return res.status(201).json({ trip });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error al crear el viaje' });
  }
});

// ─── PRECIO ESTIMADO (SIN CREAR VIAJE) ───────────────────────────────────
router.post('/estimate', requireAuth, async (req: Request, res: Response) => {
  try {
    const { originLat, originLng, destLat, destLng } = req.body;
    const distanceKm = calculateDistance(originLat, originLng, destLat, destLng);
    const durationMin = estimateDuration(distanceKm);
    let estimatedPrice = calculateTripPrice(distanceKm, durationMin);

    // 50% de Descuento en el PRIMER viaje del pasajero (Tope $8.000)
    const pastTripsCount = await prisma.trip.count({ where: { passengerId: req.user!.id } });
    let isDiscounted = false;
    if (pastTripsCount === 0) {
      const discount = Math.min(Math.round(estimatedPrice * 0.5), 8000);
      estimatedPrice = estimatedPrice - discount;
      isDiscounted = true;
    }

    return res.json({ distanceKm, durationMin, estimatedPrice, isDiscounted });
  } catch (err) {
    return res.status(500).json({ error: 'Error al calcular precio' });
  }
});

// ─── HISTORIAL PASAJERO ───────────────────────────────────────────────────
router.get('/my-trips', requireAuth, requireRole('passenger'), async (req: Request, res: Response) => {
  try {
    const trips = await prisma.trip.findMany({
      where: { passengerId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      include: {
        driver: { select: { id: true, name: true, phone: true, vehicleBrand: true, vehicleModel: true, vehiclePlate: true, totalRating: true } },
        rating: true,
      },
    });
    return res.json({ trips });
  } catch (err) {
    return res.status(500).json({ error: 'Error al obtener historial' });
  }
});

// ─── HISTORIAL CONDUCTOR ──────────────────────────────────────────────────
router.get('/driver-trips', requireAuth, requireRole('driver'), async (req: Request, res: Response) => {
  try {
    const trips = await prisma.trip.findMany({
      where: { driverId: req.user!.id, status: 'completed' },
      orderBy: { createdAt: 'desc' },
      include: {
        passenger: { select: { id: true, name: true, phone: true } },
        rating: true,
      },
    });

    const totalEarnings = trips.reduce((sum: number, t: any) => sum + (t.finalPrice || t.estimatedPrice), 0);

    return res.json({ trips, totalEarnings });
  } catch (err) {
    return res.status(500).json({ error: 'Error al obtener historial' });
  }
});

// ─── CANCELAR VIAJE ───────────────────────────────────────────────────────
router.post('/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const role = req.user!.role;

    const trip = await prisma.trip.findUnique({ where: { id: String(id) } });
    if (!trip) return res.status(404).json({ error: 'Viaje no encontrado' });

    if (!['searching', 'driver_assigned'].includes(trip.status)) {
      return res.status(400).json({ error: 'No se puede cancelar en este estado' });
    }

    const updated = await prisma.trip.update({
      where: { id: String(id) },
      data: {
        status: 'cancelled',
        cancelledBy: role,
        cancelReason: reason,
        cancelledAt: new Date(),
      },
    });

    return res.json({ trip: updated });
  } catch (err) {
    return res.status(500).json({ error: 'Error al cancelar' });
  }
});

// ─── CALIFICAR VIAJE ─────────────────────────────────────────────────────
router.post('/:id/rate', requireAuth, requireRole('passenger'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { driverScore, driverComment } = req.body;

    const trip = await prisma.trip.findUnique({
      where: { id: String(id) },
      include: { rating: true },
    });

    if (!trip || trip.passengerId !== req.user!.id) {
      return res.status(404).json({ error: 'Viaje no encontrado' });
    }
    if (trip.status !== 'completed') {
      return res.status(400).json({ error: 'Solo puedes calificar viajes completados' });
    }
    if ((trip as any).rating) {
      return res.status(409).json({ error: 'Ya calificaste este viaje' });
    }
    if (!trip.driverId) return res.status(400).json({ error: 'Sin conductor asignado' });

    const rating = await prisma.rating.create({
      data: {
        tripId: String(id),
        passengerId: req.user!.id,
        driverId: trip.driverId,
        driverScore,
        driverComment,
      },
    });

    // Actualizar rating promedio del conductor
    const allRatings = await prisma.rating.findMany({ where: { driverId: trip.driverId } });
    const avgRating = allRatings.reduce((s: number, r: any) => s + r.driverScore, 0) / allRatings.length;
    await prisma.driver.update({
      where: { id: trip.driverId },
      data: { totalRating: avgRating, totalTrips: { increment: 1 } },
    });

    return res.status(201).json({ rating });
  } catch (err) {
    return res.status(500).json({ error: 'Error al calificar' });
  }
});

export default router;
