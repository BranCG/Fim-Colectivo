import type { PrismaClient, Prisma } from '@prisma/client';

export const activeReservationStates = ['pendiente_chofer', 'reservado', 'abordado', 'pagando', 'pagado', 'parada_solicitada'];
const occupiedStates = ['reservado', 'abordado', 'pagando', 'pagado'];
export type ReservationAction = 'accept' | 'reject' | 'board' | 'notify-method' | 'acknowledge-method' | 'request-stop' | 'complete' | 'cancel';

export class ReservationFlowError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function validatePickup(lat: unknown, lng: unknown, seats: unknown) {
  if (typeof lat !== 'number' || !Number.isFinite(lat) || Math.abs(lat) > 90 ||
      typeof lng !== 'number' || !Number.isFinite(lng) || Math.abs(lng) > 180) {
    throw new ReservationFlowError(400, 'Activa tu ubicación GPS antes de reservar.');
  }
  if (!Number.isInteger(seats) || Number(seats) < 1 || Number(seats) > 4) {
    throw new ReservationFlowError(400, 'La cantidad de asientos debe estar entre 1 y 4.');
  }
}

// PostgreSQL resuelve las solicitudes simultáneas como operaciones en serie.
// Se reintenta la transacción completa si otro dispositivo modifica los mismos cupos.
export async function reservationTransaction<T>(db: PrismaClient, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(work, { isolationLevel: 'Serializable' });
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2034' || attempt >= 4) throw error;
    }
  }
}

// El contador manual representa también personas que suben sin usar la app.
// Nunca puede borrar los cupos de reservas que siguen ocupando asiento.
export async function updateOccupiedSeats(db: PrismaClient, driverId: string, seats: unknown) {
  if (typeof seats !== 'number' || !Number.isInteger(seats) || seats < 0) {
    throw new ReservationFlowError(400, 'Indica una cantidad entera de asientos.');
  }
  return reservationTransaction(db, async tx => {
    const driver = await tx.driver.findUniqueOrThrow({ where: { id: driverId } });
    const reserved = await tx.reservaAsiento.aggregate({
      where: { conductorId: driverId, estado: { in: occupiedStates } },
      _sum: { cantidadAsientos: true },
    });
    if (seats > driver.asientosTotales || seats < (reserved._sum.cantidadAsientos || 0)) {
      throw new ReservationFlowError(409, 'Los asientos reservados se liberan al cancelar o solicitar parada.');
    }
    return tx.driver.update({ where: { id: driverId }, data: { asientosOcupados: seats },
      select: { id: true, lineaId: true, asientosTotales: true, asientosOcupados: true, sentidoRuta: true, lastLat: true, lastLng: true } });
  });
}

export async function transitionReservation(db: PrismaClient, input: {
  id: string;
  actorId: string;
  role: 'passenger' | 'driver' | 'admin';
  action: ReservationAction;
  method?: unknown;
}) {
  return reservationTransaction(db, async (tx) => {
    const reserva = await tx.reservaAsiento.findUnique({
      where: { id: input.id },
      include: {
        pasajero: { select: { id: true, name: true, phone: true } },
        conductor: { select: { id: true, name: true, phone: true, vehiclePlate: true, vehicleBrand: true, vehicleModel: true, lastLat: true, lastLng: true } },
        linea: true,
      },
    });
    if (!reserva) throw new ReservationFlowError(404, 'Reserva no encontrada.');
    const passengerAction = ['notify-method', 'request-stop'].includes(input.action);
    const authorized = input.action === 'cancel'
      ? (input.role === 'passenger' && reserva.pasajeroId === input.actorId) || (input.role === 'driver' && reserva.conductorId === input.actorId)
      : passengerAction
        ? input.role === 'passenger' && reserva.pasajeroId === input.actorId
        : input.role === 'driver' && reserva.conductorId === input.actorId;
    if (!authorized) throw new ReservationFlowError(403, 'Esta reserva no te corresponde.');

    let chofer = await tx.driver.findUniqueOrThrow({ where: { id: reserva.conductorId } });
    let estado = reserva.estado;
    let method = reserva.metodoPago;
    let delta = 0;
    const requireState = (...states: string[]) => {
      if (!states.includes(reserva.estado)) throw new ReservationFlowError(409, 'La reserva ya cambió de estado. Actualiza la pantalla.');
    };

    switch (input.action) {
      case 'accept':
        if (occupiedStates.includes(estado) || estado === 'parada_solicitada') break;
        requireState('pendiente_chofer');
        if (!chofer.isOnline || chofer.status !== 'active' || chofer.lineaId !== reserva.lineaId) {
          throw new ReservationFlowError(409, 'El conductor no está disponible en esta línea.');
        }
        if (chofer.asientosOcupados + reserva.cantidadAsientos > chofer.asientosTotales) {
          throw new ReservationFlowError(409, 'Ya no quedan suficientes asientos libres.');
        }
        estado = 'reservado';
        delta = reserva.cantidadAsientos;
        break;
      case 'reject':
        if (estado === 'rechazado') break;
        requireState('pendiente_chofer');
        estado = 'rechazado';
        break;
      case 'board':
        if (['abordado', 'pagando', 'pagado', 'parada_solicitada'].includes(estado)) break;
        requireState('reservado');
        estado = 'abordado';
        break;
      case 'notify-method':
        if (input.method !== 'efectivo' && input.method !== 'rutpay') {
          throw new ReservationFlowError(400, 'Elige efectivo o RutPay.');
        }
        if (estado === 'pagando' && method === input.method) break;
        requireState('abordado');
        method = input.method;
        estado = 'pagando'; // Aviso pendiente; no se procesa una transacción monetaria.
        break;
      case 'acknowledge-method':
        if (['pagado', 'parada_solicitada', 'completado'].includes(estado)) break;
        requireState('pagando');
        estado = 'pagado'; // Acuse del conductor, conservando compatibilidad con clientes anteriores.
        break;
      case 'request-stop':
        if (['parada_solicitada', 'completado'].includes(estado)) break;
        requireState('pagado');
        estado = 'parada_solicitada';
        delta = -reserva.cantidadAsientos;
        break;
      case 'complete':
        if (estado === 'completado') break;
        requireState('parada_solicitada', 'abordado', 'pagando', 'pagado');
        estado = 'completado';
        delta = occupiedStates.includes(reserva.estado) ? -reserva.cantidadAsientos : 0;
        break;
      case 'cancel':
        if (['cancelado', 'rechazado', 'completado'].includes(estado)) break;
        requireState('pendiente_chofer', 'reservado');
        estado = 'cancelado';
        delta = reserva.estado === 'reservado' ? -reserva.cantidadAsientos : 0;
        break;
    }

    const changed = estado !== reserva.estado || method !== reserva.metodoPago;
    if (!changed) return { reserva, chofer, changed };
    if (delta) {
      chofer = await tx.driver.update({
        where: { id: chofer.id },
        data: { asientosOcupados: Math.max(0, chofer.asientosOcupados + delta) },
      });
    }
    const updated = await tx.reservaAsiento.update({
      where: { id: reserva.id }, data: { estado, metodoPago: method },
    });
    return { reserva: { ...reserva, ...updated }, chofer, changed };
  });
}
