import type { PrismaClient } from '@prisma/client';
import type { Server } from 'socket.io';
import { ReservationFlowError } from './reservationFlow';

export const LOCATION_LEASE_MS = 90_000;

export async function recordDriverLocation(db: PrismaClient, driverId: string, lat: unknown, lng: unknown, capturedAt: unknown, now = new Date()) {
  if (typeof lat !== 'number' || !Number.isFinite(lat) || Math.abs(lat) > 90 ||
      typeof lng !== 'number' || !Number.isFinite(lng) || Math.abs(lng) > 180 ||
      typeof capturedAt !== 'number' || !Number.isFinite(capturedAt) ||
      now.getTime() - capturedAt > 60_000 || capturedAt - now.getTime() > 30_000) {
    throw new ReservationFlowError(400, 'Se necesita una ubicación GPS reciente y válida.');
  }
  // Una ubicación retrasada nunca vuelve a conectar a quien terminó su turno.
  const result = await db.driver.updateMany({
    where: { id: driverId, isOnline: true, status: 'active' },
    data: { lastLat: lat, lastLng: lng, lastSeen: now },
  });
  if (!result.count) throw new ReservationFlowError(409, 'El conductor está fuera de servicio.');
  return db.driver.findUniqueOrThrow({ where: { id: driverId }, select: {
    id: true, lineaId: true, isOnline: true, lastLat: true, lastLng: true, lastSeen: true,
    asientosOcupados: true, asientosTotales: true, sentidoRuta: true, name: true, vehiclePlate: true,
  } });
}

export function publishDriverLocation(io: Server, driver: Awaited<ReturnType<typeof recordDriverLocation>>) {
  if (!driver.isOnline || !driver.lineaId) return;
  io.to('linea:' + driver.lineaId).emit('colectivo:actualizacion-ubicacion', {
    conductorId: driver.id, lineaId: driver.lineaId, nombre: driver.name, patente: driver.vehiclePlate,
    latitud: driver.lastLat, longitud: driver.lastLng, lastSeen: driver.lastSeen,
    asientosOcupados: driver.asientosOcupados, asientosTotales: driver.asientosTotales, sentidoRuta: driver.sentidoRuta,
  });
}

export async function expireDriverLocations(db: PrismaClient, now = new Date()) {
  const cutoff = new Date(now.getTime() - LOCATION_LEASE_MS);
  const stale = { isOnline: true, OR: [{ lastSeen: { lt: cutoff } }, { lastSeen: null }] };
  const candidates = await db.driver.findMany({ where: stale, select: { id: true, lineaId: true } });
  const expired = [];
  for (const driver of candidates) {
    // Repetir la condición evita que una actualización concurrente pierda el turno.
    const changed = await db.driver.updateMany({ where: { id: driver.id, ...stale }, data: { isOnline: false } });
    if (changed.count) expired.push(driver);
  }
  return expired;
}
