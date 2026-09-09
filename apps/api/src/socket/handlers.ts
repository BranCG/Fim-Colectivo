import { Server, Socket } from 'socket.io';
import prisma from '../utils/prisma';
import { calculateDistance } from '../utils/pricing';

// ─── Mapa de conductores online ───────────────────────────────────────────
// driverId -> { socketId, lat, lng }
export const onlineDrivers = new Map<string, { socketId: string; lat: number; lng: number }>();

// ─── Mapa de viajes activos con búsqueda ─────────────────────────────────
// tripId -> { passengerId, passengerSocketId, driversNotified: Set<driverId> }
const activeSearches = new Map<string, {
  passengerId: string;
  passengerSocketId: string;
  driversNotified: Set<string>;
  timer?: NodeJS.Timeout;
}>();

export function setupSocketHandlers(io: Server) {

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Conectado: ${socket.id}`);

    // ─── CONDUCTOR: se conecta y anuncia su posición ───────────────────────
    socket.on('driver:online', async ({ driverId, lat, lng }: { driverId: string; lat: number; lng: number }) => {
      onlineDrivers.set(driverId, { socketId: socket.id, lat, lng });
      socket.data.driverId = driverId;
      socket.join(`driver:${driverId}`);

      await prisma.driver.update({
        where: { id: driverId },
        data: { isOnline: true, lastLat: lat, lastLng: lng, lastSeen: new Date() },
      }).catch(console.error);

      console.log(`[Socket] Conductor ${driverId} en línea en (${lat}, ${lng})`);
    });

    // ─── CONDUCTOR: actualiza posición ────────────────────────────────────
    socket.on('driver:location', async ({ driverId, lat, lng }: { driverId: string; lat: number; lng: number }) => {
      onlineDrivers.set(driverId, { socketId: socket.id, lat, lng });

      await prisma.driver.update({
        where: { id: driverId },
        data: { lastLat: lat, lastLng: lng, lastSeen: new Date() },
      }).catch(console.error);

      // Si tiene un viaje activo, notificar al pasajero con posición
      const activeTrip = await prisma.trip.findFirst({
        where: {
          driverId,
          status: { in: ['driver_assigned', 'driver_arrived', 'in_progress'] },
        },
      }).catch(() => null);

      if (activeTrip) {
        io.to(`trip:${activeTrip.id}`).emit('driver:moved', { lat, lng });
      }

      // Si el conductor es de colectivo y tiene línea asignada, emitir a todos los pasajeros de la línea
      const chofer = await prisma.driver.findUnique({
        where: { id: driverId },
        select: { id: true, lineaId: true, asientosOcupados: true, asientosTotales: true, sentidoRuta: true, vehiclePlate: true, name: true },
      }).catch(() => null);

      if (chofer?.lineaId) {
        const payloadUbicacion = {
          conductorId: chofer.id,
          lineaId: chofer.lineaId,
          latitud: lat,
          longitud: lng,
          asientosOcupados: chofer.asientosOcupados,
          asientosTotales: chofer.asientosTotales,
          sentidoRuta: chofer.sentidoRuta,
          patente: chofer.vehiclePlate,
          nombre: chofer.name,
        };
        // Emitir en español y alias para compatibilidad
        io.to(`linea:${chofer.lineaId}`).emit('colectivo:actualizacion-ubicacion', payloadUbicacion);
        io.to(`linea:${chofer.lineaId}`).emit('colectivo:location-update', payloadUbicacion);
      }
    });

    // ─── COLECTIVOS: Suscripción a canal de línea y pasajero (en español) ─
    socket.on('colectivo:unirse-linea', ({ lineaId }: { lineaId: string }) => {
      socket.join(`linea:${lineaId}`);
    });

    socket.on('colectivo:salir-linea', ({ lineaId }: { lineaId: string }) => {
      socket.leave(`linea:${lineaId}`);
    });

    socket.on('colectivo:join-line', ({ lineId, lineaId }: { lineId?: string; lineaId?: string }) => {
      const id = lineaId || lineId;
      if (id) socket.join(`linea:${id}`);
    });

    socket.on('pasajero:unirse', ({ pasajeroId }: { pasajeroId: string }) => {
      socket.join(`pasajero:${pasajeroId}`);
      socket.data.pasajeroId = pasajeroId;
    });

    socket.on('passenger:join', ({ passengerId, pasajeroId }: { passengerId?: string; pasajeroId?: string }) => {
      const id = pasajeroId || passengerId;
      if (id) {
        socket.join(`pasajero:${id}`);
        socket.data.pasajeroId = id;
      }
    });

    // ─── CONDUCTOR: Suscripción a canal individual de chofer ──────────────
    socket.on('conductor:unirse', ({ conductorId, driverId }: { conductorId?: string; driverId?: string }) => {
      const id = conductorId || driverId;
      if (id) {
        socket.join(`driver:${id}`);
        socket.data.driverId = id;
        console.log(`[Socket] Conductor unido a canal driver:${id}`);
      }
    });

    socket.on('driver:join', ({ driverId, conductorId }: { driverId?: string; conductorId?: string }) => {
      const id = driverId || conductorId;
      if (id) {
        socket.join(`driver:${id}`);
        socket.data.driverId = id;
        console.log(`[Socket] Driver joined channel driver:${id}`);
      }
    });

    // ─── PASAJERO: se une a su sala de viaje ──────────────────────────────
    socket.on('passenger:join-trip', ({ tripId }: { tripId: string }) => {
      socket.join(`trip:${tripId}`);
      socket.data.tripId = tripId;
    });

    // ─── PASAJERO: solicita un viaje ──────────────────────────────────────
    socket.on('trip:search', async ({ tripId, passengerId, originLat, originLng }: {
      tripId: string;
      passengerId: string;
      originLat: number;
      originLng: number;
    }) => {
      console.log(`[Socket] Solicitud de viaje recibida: Trip=${tripId}, Pax=${passengerId} en (${originLat}, ${originLng})`);
      console.log(`[Socket] Conductores online actualmente: ${onlineDrivers.size}`);

      socket.join(`trip:${tripId}`);

      activeSearches.set(tripId, {
        passengerId,
        passengerSocketId: socket.id,
        driversNotified: new Set(),
      });

      await findAndNotifyDriver(io, tripId, originLat, originLng);
    });

    // ─── CONDUCTOR: acepta el viaje ───────────────────────────────────────
    socket.on('driver:accept', async ({ tripId, driverId }: { tripId: string; driverId: string }) => {
      const search = activeSearches.get(tripId);
      if (!search) return; // Ya fue tomado

      // Limpiar timer de timeout
      if (search.timer) clearTimeout(search.timer);
      activeSearches.delete(tripId);

      try {
        // Asignar conductor al viaje
        const trip = await prisma.trip.update({
          where: { id: tripId },
          data: {
            driverId,
            status: 'driver_assigned',
            acceptedAt: new Date(),
            otpCode: Math.floor(1000 + Math.random() * 9000).toString(), // 4 dígitos
          },
          include: {
            driver: {
              select: {
                id: true, name: true, phone: true,
                vehicleBrand: true, vehicleModel: true,
                vehiclePlate: true, vehiclePhotoUrl: true,
                totalRating: true, totalTrips: true,
                lastLat: true, lastLng: true,
                mercadoPagoLink: true,
              },
            },
            passenger: { select: { id: true, name: true, phone: true } },
          },
        });

        socket.join(`trip:${tripId}`);

        // Notificar al pasajero que fue aceptado
        io.to(`trip:${tripId}`).emit('trip:accepted', { trip });
        // Notificar al conductor confirmación
        socket.emit('trip:confirmed', { trip });

        console.log(`[Socket] Viaje ${tripId} aceptado por conductor ${driverId}`);
      } catch (err) {
        console.error('[Socket] Error aceptando viaje:', err);
      }
    });

    // ─── CONDUCTOR: rechaza el viaje (buscar otro conductor) ──────────────
    socket.on('driver:reject', async ({ tripId, driverId, originLat, originLng }: {
      tripId: string; driverId: string; originLat: number; originLng: number;
    }) => {
      const search = activeSearches.get(tripId);
      if (!search) return;

      search.driversNotified.add(driverId);
      if (search.timer) clearTimeout(search.timer);

      // Buscar siguiente conductor disponible
      await findAndNotifyDriver(io, tripId, originLat, originLng);
    });

    // ─── CONDUCTOR: inició viaje (requiere OTP) ──────────────────────────
    socket.on('driver:start-trip', async ({ tripId, otpCode }: { tripId: string; otpCode: string }) => {
      try {
        const trip = await prisma.trip.findUnique({ where: { id: tripId } });
        if (!trip) return;

        if (trip.otpCode !== otpCode) {
          return socket.emit('error', { message: 'Código de seguridad incorrecto. Pídelo al pasajero.' });
        }

        const updated = await prisma.trip.update({
          where: { id: tripId },
          data: { status: 'in_progress', startedAt: new Date() },
        });

        io.to(`trip:${tripId}`).emit('trip:started', { trip: updated });
        console.log(`[Socket] Viaje ${tripId} iniciado con éxito`);
      } catch (err) {
        console.error('[Socket] Error iniciando viaje:', err);
      }
    });

    // ─── CONDUCTOR: llegó al punto de recogida ────────────────────────────
    socket.on('driver:arrived', async ({ tripId }: { tripId: string }) => {
      await prisma.trip.update({
        where: { id: tripId },
        data: { status: 'driver_arrived', driverArrivedAt: new Date() },
      }).catch(console.error);

      io.to(`trip:${tripId}`).emit('trip:driver-arrived', { tripId });
    });

    // ─── CONDUCTOR: solicita pago al pasajero ───────────────────────────
    socket.on('trip:request-payment', ({ tripId }: { tripId: string }) => {
      console.log(`[Socket] Conductor solicita pago para viaje ${tripId}`);
      io.to(`trip:${tripId}`).emit('trip:payment-requested');
    });

    // ─── CHAT EN VIVO: Mensajes de texto ──────────────────────────────────
    socket.on('trip:message', (data: { tripId: string, senderId: string, senderName: string, text: string }) => {
      console.log(`[Socket] Mensaje de chat recibido para viaje ${data.tripId} de ${data.senderName}: ${data.text}`);
      io.to(`trip:${data.tripId}`).emit('trip:message', {
        ...data,
        timestamp: new Date().toISOString()
      });
    });

    // ─── PASAJERO: confirma que envió el pago ─────────────────────────────
    socket.on('trip:passenger-confirmed-payment', ({ tripId, receiptUrl }: { tripId: string, receiptUrl?: string }) => {
      console.log(`[Socket] Pasajero confirma pago para viaje ${tripId}`);
      io.to(`trip:${tripId}`).emit('trip:passenger-confirmed-payment', { receiptUrl });
    });

    // ─── REPORTE DE SEGURIDAD ─────────────────────────────────────────────
    socket.on('safety:report', async (data: { tripId: string, reporterId: string, reportedUserId: string, reason: string, description: string }) => {
      try {
        console.warn(`🚨 [REPORTE DE SEGURIDAD] Viaje: ${data.tripId} | Reportado por: ${data.reporterId} | Hacia: ${data.reportedUserId} | Razón: ${data.reason} | Descripción: ${data.description}`);
        console.log(`[Socket] REPORTE DE SEGURIDAD RECIBIDO para viaje ${data.tripId}`);
        socket.emit('safety:report-received', { success: true });
      } catch (err) {
        console.error('[Socket] Error al guardar reporte:', err);
      }
    });

    // ─── CONDUCTOR: completó el viaje ──────────────────────────────────────
    socket.on('trip:complete', async ({ tripId }: { tripId: string }) => {
      try {
        const trip = await prisma.trip.update({
          where: { id: tripId },
          data: {
            status: 'completed',
            completedAt: new Date(),
          },
        });

        // Actualizar estadísticas del conductor y billetera si es tarjeta
        await prisma.driver.update({
          where: { id: trip.driverId! },
          data: {
            totalTrips: { increment: 1 },
            walletBalance: trip.paymentMethod === 'card' 
              ? { increment: trip.estimatedPrice } 
              : undefined
          }
        });

        io.to(`trip:${tripId}`).emit('trip:completed', {
          tripId,
          finalPrice: trip.estimatedPrice,
          paymentMethod: trip.paymentMethod,
        });

        console.log(`[Socket] Viaje ${tripId} completado. Precio: $${trip.estimatedPrice}`);
      } catch (err) {
        console.error('[Socket] Error completando viaje:', err);
      }
    });

    // ─── CONDUCTOR: Pasa a fuera de servicio voluntariamente ───────────────
    socket.on('driver:offline', async ({ driverId }: { driverId?: string }) => {
      const dId = driverId || socket.data.driverId;
      if (dId) {
        onlineDrivers.delete(dId);
        const chofer = await prisma.driver.update({
          where: { id: dId },
          data: { isOnline: false },
          select: { id: true, lineaId: true },
        }).catch(console.error);

        if (chofer && chofer.lineaId) {
          io.to(`linea:${chofer.lineaId}`).emit('colectivo:conductor-offline', {
            conductorId: chofer.id,
            lineaId: chofer.lineaId,
          });
        }
        console.log(`[Socket] Conductor ${dId} fuera de servicio`);
      }
    });

    // ─── DESCONEXIÓN ──────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      const driverId = socket.data.driverId;
      if (driverId) {
        onlineDrivers.delete(driverId);
        const chofer = await prisma.driver.update({
          where: { id: driverId },
          data: { isOnline: false },
          select: { id: true, lineaId: true },
        }).catch(console.error);

        if (chofer && chofer.lineaId) {
          io.to(`linea:${chofer.lineaId}`).emit('colectivo:conductor-offline', {
            conductorId: chofer.id,
            lineaId: chofer.lineaId,
          });
        }
        console.log(`[Socket] Conductor ${driverId} desconectado`);
      }
    });
  });
}

// ─── BUSCAR Y NOTIFICAR AL CONDUCTOR MÁS CERCANO ─────────────────────────
async function findAndNotifyDriver(
  io: Server,
  tripId: string,
  originLat: number,
  originLng: number,
) {
  const search = activeSearches.get(tripId);
  if (!search) return;

  // Obtener conductores activos no notificados aún
  const availableDrivers = Array.from(onlineDrivers.entries())
    .filter(([dId]) => !search.driversNotified.has(dId))
    .map(([dId, data]) => ({
      driverId: dId,
      socketId: data.socketId,
      distance: calculateDistance(originLat, originLng, data.lat, data.lng),
      lat: data.lat,
      lng: data.lng,
    }))
    .sort((a, b) => a.distance - b.distance);

  console.log(`[Socket] Conductores disponibles filtrados: ${availableDrivers.length}`);
  availableDrivers.forEach(d => console.log(` - Conductor ${d.driverId} a ${d.distance.toFixed(2)}km`));

  if (availableDrivers.length === 0) {
    // No hay conductores disponibles
    await prisma.trip.update({
      where: { id: tripId },
      data: { status: 'cancelled', cancelReason: 'Sin conductores disponibles', cancelledAt: new Date() },
    }).catch(console.error);

    io.to(`trip:${tripId}`).emit('trip:no-drivers', { tripId });
    activeSearches.delete(tripId);
    return;
  }

  const nearest = availableDrivers[0];
  search.driversNotified.add(nearest.driverId);

  // Obtener datos del viaje para enviarlo al conductor
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { passenger: { select: { name: true, phone: true } } },
  }).catch(() => null);

  if (!trip) return;

  // Notificar al conductor con timer de 30 segundos
  io.to(nearest.socketId).emit('trip:request', {
    trip: {
      ...trip,
      driverDistance: nearest.distance,
    },
  });

  // Si el conductor no responde en 30 segundos, pasar al siguiente
  search.timer = setTimeout(() => {
    const currentSearch = activeSearches.get(tripId);
    if (currentSearch) {
      findAndNotifyDriver(io, tripId, originLat, originLng);
    }
  }, 30000);
}
