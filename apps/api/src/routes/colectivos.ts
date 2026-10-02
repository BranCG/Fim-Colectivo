import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { io } from '../index';
import { calculateDistance } from '../utils/pricing';
import { onlineDrivers } from '../socket/handlers';
import { consultarPatenteMtt } from '../utils/mttValidator';
import { notificarConductor, notificarPasajero } from '../utils/fcm';
import { withoutPaymentData } from '../utils/withoutPaymentData';
import { transitionReservation, reservationTransaction, updateOccupiedSeats, activeReservationStates, validatePickup, ReservationFlowError, ReservationAction } from '../utils/reservationFlow';

// Mapa de solicitudes dirigidas en tránsito con cascada automática
export interface SolicitudDirigidaActiva {
  reservaId: string;
  lineaId: string;
  pasajeroId: string;
  nombrePasajero: string;
  cantidadAsientos: number;
  latitudSubida: number;
  longitudSubida: number;
  direccionSubida?: string;
  conductoresCandidatos: string[];
  conductorActualIndex: number;
  timer?: NodeJS.Timeout;
}

export const solicitudesDirigidasActivas = new Map<string, SolicitudDirigidaActiva>();

const router: Router = Router();

// ─── PÚBLICO / PASAJERO: Listar todas las líneas activas ──────────────────
router.get('/lineas', async (peticion: Request, respuesta: Response) => {
  try {
    const lineas = await prisma.lineaColectivo.findMany({
      where: { activa: true },
      include: {
        trazados: {
          where: { esActivo: true },
          select: {
            id: true,
            shapeId: true,
            sentido: true,
            origenTipo: true,
            distanciaMetros: true,
            confianza: true,
            estadoValidacion: true,
            esActivo: true,
            puntos: true,
            limites: true,
          },
        },
        _count: {
          select: { tramos: true },
        },
        conductores: {
          where: { isOnline: true, status: 'active' },
          select: {
            id: true,
            name: true,
            vehicleBrand: true,
            vehicleModel: true,
            vehiclePlate: true,
            asientosTotales: true,
            asientosOcupados: true,
            sentidoRuta: true,
            lastLat: true,
            lastLng: true,
            lastSeen: true,
            folioRuta: true,
            mttValidada: true,
          },
        },
      },
      orderBy: { codigo: 'asc' },
    });

    respuesta.json({ lineas });
  } catch (error) {
    console.error('Error al obtener líneas de colectivo:', error);
    respuesta.status(500).json({ error: 'Error al obtener líneas de colectivo' });
  }
});

// ─── PÚBLICO / PASAJERO: Detalle de una línea específica ───────────────────
router.get('/lineas/:id', async (peticion: Request, respuesta: Response) => {
  try {
    const { id } = peticion.params;
    const linea = await prisma.lineaColectivo.findUnique({
      where: { id: String(id) },
      include: {
        trazados: {
          where: { esActivo: true },
        },
        _count: {
          select: { tramos: true },
        },
        conductores: {
          where: { isOnline: true, status: 'active' },
          select: {
            id: true,
            name: true,
            vehicleBrand: true,
            vehicleModel: true,
            vehiclePlate: true,
            asientosTotales: true,
            asientosOcupados: true,
            sentidoRuta: true,
            lastLat: true,
            lastLng: true,
            lastSeen: true,
          },
        },
      },
    });

    if (!linea) {
      return respuesta.status(404).json({ error: 'Línea no encontrada' });
    }

    respuesta.json({ linea });
  } catch (error) {
    console.error('Error al obtener detalle de la línea:', error);
    respuesta.status(500).json({ error: 'Error al obtener detalles de la línea' });
  }
});

// ─── PÚBLICO / INSPECTOR GIS: Obtener tramos viales ordenados de una línea ───
router.get('/lineas/:id/tramos', async (peticion: Request, respuesta: Response) => {
  try {
    const { id } = peticion.params;
    const sentido = typeof peticion.query.sentido === 'string' ? peticion.query.sentido : 'ida';

    const tramos = await prisma.routeSegment.findMany({
      where: {
        lineaId: String(id),
        sentido: String(sentido),
      },
      orderBy: { orden: 'asc' },
    });

    respuesta.json({ tramos, cantidad: tramos.length });
  } catch (error) {
    console.error('Error al obtener tramos viales de la línea:', error);
    respuesta.status(500).json({ error: 'Error al obtener tramos viales de la línea' });
  }
});

// ─── VALIDACIÓN MTT: Validar patente de colectivo contra apps.mtt.cl ────────
router.post('/validar-patente-mtt', async (peticion: Request, respuesta: Response) => {
  try {
    const { patente, folio } = peticion.body;
    if (!patente) {
      return respuesta.status(400).json({ error: 'Debe ingresar una placa patente' });
    }

    const resultado = await consultarPatenteMtt(patente, folio);

    // Si viene autenticado un conductor con token, actualizar su perfil
    const authHeader = peticion.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.split(' ')[1];
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const jwt = require('jsonwebtoken');
        const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fim-colectivo-super-secret-jwt-key-2026');
        if (decoded && decoded.role === 'driver') {
          await prisma.driver.update({
            where: { id: decoded.id },
            data: {
              vehiclePlate: resultado.patente,
              mttValidada: resultado.valido,
              mttFechaValidacion: resultado.fechaConsulta,
              mttDetalle: JSON.stringify(resultado),
              ...(resultado.folio ? { folioRuta: resultado.folio } : {}),
            },
          });
        }
      } catch (errAuth) {
        // Ignorar si el token no es verificable
      }
    }

    return respuesta.json({ resultado });
  } catch (error: any) {
    console.error('Error en validación MTT:', error);
    return respuesta.status(500).json({ error: error.message || 'Error al validar patente en MTT' });
  }
});

// ─── PÚBLICO / PASAJERO: Buscar líneas por Folio, Calle o Comuna ───────────
router.get('/buscar', async (peticion: Request, respuesta: Response) => {
  try {
    const { q } = peticion.query;
    const termino = q ? String(q).trim() : '';

    const lineas = await prisma.lineaColectivo.findMany({
      where: {
        activa: true,
        ...(termino ? {
          OR: [
            { folio: { contains: termino, mode: 'insensitive' } },
            { codigo: { contains: termino, mode: 'insensitive' } },
            { nombre: { contains: termino, mode: 'insensitive' } },
            { comunas: { contains: termino, mode: 'insensitive' } },
            { callesIda: { contains: termino, mode: 'insensitive' } },
            { callesRegreso: { contains: termino, mode: 'insensitive' } },
          ],
        } : {}),
      },
      include: {
        paradas: { orderBy: { orden: 'asc' } },
        conductores: {
          where: { isOnline: true, status: 'active' },
          select: {
            id: true,
            name: true,
            vehiclePlate: true,
            asientosTotales: true,
            asientosOcupados: true,
            sentidoRuta: true,
            lastLat: true,
            lastLng: true,
            mttValidada: true,
            folioRuta: true,
          },
        },
      },
      orderBy: { codigo: 'asc' },
    });

    return respuesta.json({ lineas, total: lineas.length });
  } catch (error) {
    console.error('Error al buscar líneas:', error);
    return respuesta.status(500).json({ error: 'Error al buscar recorridos de colectivo' });
  }
});

// ─── PASAJERO: Reservar asiento en un colectivo ───────────────────────────
router.post('/reservar', requireAuth, async (peticion: Request, respuesta: Response) => {
  try {
    const pasajeroId = peticion.user!.id;
    const {
      conductorId,
      lineaId,
      cantidadAsientos = 1,
      latitudSubida,
      longitudSubida,
      direccionSubida,
      notas,
    } = peticion.body;

    validatePickup(latitudSubida, longitudSubida, cantidadAsientos);
    if (!conductorId || !lineaId) {
      return respuesta.status(400).json({ error: 'Debe especificar el conductor y la línea' });
    }

    // Verificar si el pasajero ya tiene una reserva activa
    const reservaExistente = await prisma.reservaAsiento.findFirst({
      where: {
        pasajeroId,
        estado: { in: activeReservationStates },
      },
    });
    if (reservaExistente) {
      return respuesta.status(400).json({
        error: 'Ya tienes una solicitud de asiento activa en curso.',
        reserva: reservaExistente,
      });
    }

    // Verificar conductor y disponibilidad de asientos
    const chofer = await prisma.driver.findUnique({
      where: { id: conductorId },
      include: { linea: true },
    });

    if (!chofer || !chofer.isOnline || chofer.status !== 'active' || chofer.lineaId !== lineaId) {
      return respuesta.status(400).json({ error: 'El conductor no está disponible o se encuentra fuera de servicio' });
    }

    const asientosDisponibles = chofer.asientosTotales - chofer.asientosOcupados;
    if (asientosDisponibles < cantidadAsientos) {
      return respuesta.status(400).json({
        error: `Solo quedan ${asientosDisponibles} asiento(s) disponible(s) en este colectivo`,
      });
    }

    // Crear la reserva de asiento en estado pendiente_chofer (sin ocupar asientos hasta que el chofer acepte)
    const nuevaReserva = await reservationTransaction(prisma, async (tx) => {
      const existing = await tx.reservaAsiento.findFirst({ where: { pasajeroId, estado: { in: activeReservationStates } } });
      if (existing) throw new ReservationFlowError(409, 'Ya tienes una reserva activa.');
      return tx.reservaAsiento.create({
        data: {
          pasajeroId,
          conductorId,
          lineaId,
          cantidadAsientos,
          latitudSubida,
          longitudSubida,
          direccionSubida,
          // Columnas legadas: no se calcula ni registra el valor del viaje.
          tarifa: 0,
          metodoPago: 'none',
          notas,
          estado: 'pendiente_chofer',
        },
        include: {
          linea: true,
          conductor: {
            select: {
              id: true,
              name: true,
              phone: true,
              vehiclePlate: true,
              vehicleBrand: true,
              vehicleModel: true,
            },
          },
          pasajero: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
      });
    });

    // Notificar al conductor por WebSocket en tiempo real (canal privado y canal de línea)
    io.to(`driver:${conductorId}`).emit('colectivo:nueva-reserva', {
      reserva: withoutPaymentData(nuevaReserva),
    });
    if (lineaId) {
      io.to(`linea:${lineaId}`).emit('colectivo:nueva-reserva', {
        conductorId,
        reserva: withoutPaymentData(nuevaReserva),
      });
    }

    // Emitir también solicitud con voz al conductor
    const distKm = chofer.lastLat && chofer.lastLng && latitudSubida && longitudSubida
      ? calculateDistance(chofer.lastLat, chofer.lastLng, latitudSubida, longitudSubida)
      : 0.35;
    const distanciaMetros = Math.max(50, Math.round(distKm * 1000));

    io.to(`driver:${conductorId}`).emit('colectivo:solicitud-asignada', {
      reservaId: nuevaReserva.id,
      nombrePasajero: nuevaReserva.pasajero.name,
      cantidadAsientos: nuevaReserva.cantidadAsientos,
      distanciaMetros,
      tiempoLimiteSegundos: 30,
      direccionSubida: nuevaReserva.direccionSubida,
    });
    if (lineaId) {
      io.to(`linea:${lineaId}`).emit('colectivo:solicitud-asignada', {
        conductorId,
        reservaId: nuevaReserva.id,
        nombrePasajero: nuevaReserva.pasajero.name,
        cantidadAsientos: nuevaReserva.cantidadAsientos,
        distanciaMetros,
        tiempoLimiteSegundos: 30,
        direccionSubida: nuevaReserva.direccionSubida,
      });
    }

    // FCM: notificar al conductor por push (para cuando la app está en background)
    notificarConductor(
      conductorId,
      'Nueva solicitud de asiento',
      `${nuevaReserva.pasajero.name} solicita ${cantidadAsientos} asiento(s)${direccionSubida ? ` en ${direccionSubida}` : ''}`,
      { reservaId: nuevaReserva.id, tipo: 'nueva_reserva' }
    );

    respuesta.status(201).json({ reserva: nuevaReserva });
  } catch (error) {
    if (error instanceof ReservationFlowError) return respuesta.status(error.status).json({ error: error.message });
    console.error('Error al reservar asiento:', error);
    respuesta.status(500).json({ error: 'Error al realizar la reserva del asiento' });
  }
});

// ─── PASAJERO: Ver mis reservas activas ───────────────────────────────────
router.get('/reservas/:id/estado', requireAuth, async (req: Request, res: Response) => {
  try {
    const reserva = await prisma.reservaAsiento.findFirst({
      where: { id: String(req.params.id), pasajeroId: req.user!.id },
      include: { linea: true, conductor: { select: {
        id: true, name: true, phone: true, vehiclePlate: true,
        vehicleBrand: true, vehicleModel: true, lastLat: true, lastLng: true,
      } } },
    });
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada.' });
    return res.json({ reserva });
  } catch (error) { return flowError(error, res); }
});

router.get('/reservas/mis-reservas', requireAuth, async (peticion: Request, respuesta: Response) => {
  try {
    const pasajeroId = peticion.user!.id;
    const reservas = await prisma.reservaAsiento.findMany({
      where: {
        pasajeroId,
        estado: { in: activeReservationStates },
      },
      include: {
        linea: {
          include: {
            trazados: {
              where: { esActivo: true },
              select: {
                id: true,
                shapeId: true,
                sentido: true,
                origenTipo: true,
                distanciaMetros: true,
                confianza: true,
                estadoValidacion: true,
                esActivo: true,
                puntos: true,
                limites: true,
              },
            },
          },
        },
        conductor: {
          select: {
            id: true,
            name: true,
            phone: true,
            vehiclePlate: true,
            vehicleBrand: true,
            vehicleModel: true,
            lastLat: true,
            lastLng: true,
          },
        },
      },
      orderBy: { fechaCreacion: 'desc' },
    });

    respuesta.json({ reservas });
  } catch (error) {
    console.error('Error al obtener reservas del pasajero:', error);
    respuesta.status(500).json({ error: 'Error al consultar reservas' });
  }
});

// ─── CONDUCTOR: Obtener estado actual (línea, asientos, reservas) ─────────
router.get('/conductor/estado', requireAuth, requireRole('driver', 'admin'), async (peticion: Request, respuesta: Response) => {
  try {
    const conductorId = peticion.user!.id;
    const chofer = await prisma.driver.findUnique({
      where: { id: conductorId },
      include: {
        linea: {
          include: {
            trazados: {
              where: { esActivo: true },
              select: {
                id: true,
                shapeId: true,
                sentido: true,
                origenTipo: true,
                distanciaMetros: true,
                confianza: true,
                estadoValidacion: true,
                esActivo: true,
                puntos: true,
                limites: true,
              },
            },
            paradas: { orderBy: { orden: 'asc' } },
          },
        },
        reservasAsiento: {
          where: { estado: { in: activeReservationStates } },
          include: {
            pasajero: { select: { id: true, name: true, phone: true } },
          },
          orderBy: { fechaCreacion: 'asc' },
        },
      },
    });

    if (!chofer) {
      return respuesta.status(404).json({ error: 'Conductor no encontrado' });
    }

    respuesta.json({ chofer });
  } catch (error) {
    console.error('Error al obtener estado del chofer:', error);
    respuesta.status(500).json({ error: 'Error al consultar estado' });
  }
});

// ─── CONDUCTOR: Asignar o cambiar de línea de colectivo ───────────────────
router.post('/conductor/linea', requireAuth, requireRole('driver', 'admin'), async (peticion: Request, respuesta: Response) => {
  try {
    const conductorId = peticion.user!.id;
    const { lineaId } = peticion.body;

    const linea = await prisma.lineaColectivo.findUnique({ where: { id: lineaId } });
    if (!linea) {
      return respuesta.status(404).json({ error: 'Línea de colectivo no encontrada' });
    }

    const choferActualizado = await prisma.driver.update({
      where: { id: conductorId },
      data: { lineaId },
      include: {
        linea: {
          include: {
            trazados: {
              where: { esActivo: true },
              select: {
                id: true,
                shapeId: true,
                sentido: true,
                origenTipo: true,
                distanciaMetros: true,
                confianza: true,
                estadoValidacion: true,
                esActivo: true,
                puntos: true,
                limites: true,
              },
            },
            paradas: { orderBy: { orden: 'asc' } },
          },
        },
      },
    });

    respuesta.json({ chofer: choferActualizado, mensaje: `Asignado correctamente a ${linea.nombre}` });
  } catch (error) {
    console.error('Error al actualizar línea del chofer:', error);
    respuesta.status(500).json({ error: 'Error al cambiar de línea' });
  }
});

// ─── CONDUCTOR: Actualizar asientos ocupados (bloqueo / subida en ruta) ────
router.post('/conductor/asientos', requireAuth, requireRole('driver', 'admin'), async (peticion: Request, respuesta: Response) => {
  try {
    const conductorId = peticion.user!.id;
    const { asientosOcupados } = peticion.body;

    const choferActualizado = await updateOccupiedSeats(prisma, conductorId, asientosOcupados);

    // Transmitir cambio de asientos en tiempo real a todos los pasajeros de la línea
    if (choferActualizado.lineaId) {
      io.to(`linea:${choferActualizado.lineaId}`).emit('colectivo:cambio-asientos', {
        conductorId: choferActualizado.id,
        asientosOcupados: choferActualizado.asientosOcupados,
        asientosTotales: choferActualizado.asientosTotales,
      });
    }

    respuesta.json({ chofer: choferActualizado });
  } catch (error) {
    if (error instanceof ReservationFlowError) return respuesta.status(error.status).json({ error: error.message });
    console.error('Error al actualizar asientos:', error);
    respuesta.status(500).json({ error: 'Error al actualizar asientos' });
  }
});

// ─── CONDUCTOR: Cambiar sentido de ruta (Ida / Vuelta) ────────────────────
router.post('/conductor/sentido', requireAuth, requireRole('driver', 'admin'), async (peticion: Request, respuesta: Response) => {
  try {
    const conductorId = peticion.user!.id;
    const { sentidoRuta } = peticion.body;
    let sentidoNormalizado = (sentidoRuta || '').toLowerCase().trim();
    if (sentidoNormalizado === 'regreso') sentidoNormalizado = 'vuelta';

    if (!['ida', 'vuelta'].includes(sentidoNormalizado)) {
      return respuesta.status(400).json({ error: 'Sentido no válido (debe ser "ida", "vuelta" o "regreso")' });
    }

    const choferActualizado = await prisma.driver.update({
      where: { id: conductorId },
      data: { sentidoRuta: sentidoNormalizado },
      select: { id: true, lineaId: true, sentidoRuta: true },
    });

    if (choferActualizado.lineaId) {
      io.to(`linea:${choferActualizado.lineaId}`).emit('colectivo:cambio-sentido', {
        conductorId: choferActualizado.id,
        sentidoRuta: choferActualizado.sentidoRuta,
      });
    }

    respuesta.json({ chofer: choferActualizado });
  } catch (error) {
    console.error('Error al cambiar sentido de ruta:', error);
    respuesta.status(500).json({ error: 'Error al cambiar sentido' });
  }
});

// ─── CONDUCTOR: Cambiar estado de servicio (En servicio / Fuera de servicio) ─
router.post('/conductor/servicio', requireAuth, requireRole('driver', 'admin'), async (peticion: Request, respuesta: Response) => {
  try {
    const conductorId = peticion.user!.id;
    const { enServicio } = peticion.body;

    const isOnline = Boolean(enServicio);

    const choferActualizado = await prisma.driver.update({
      where: { id: conductorId },
      data: { isOnline },
      select: {
        id: true,
        lineaId: true,
        isOnline: true,
        asientosTotales: true,
        asientosOcupados: true,
        sentidoRuta: true,
        lastLat: true,
        lastLng: true,
        vehiclePlate: true,
        name: true,
      },
    });

    if (!isOnline) {
      onlineDrivers.delete(conductorId);
    }

    if (choferActualizado.lineaId) {
      if (!isOnline) {
        // Notificar a todos los pasajeros de la línea que el móvil se retiró del servicio
        io.to(`linea:${choferActualizado.lineaId}`).emit('colectivo:conductor-offline', {
          conductorId: choferActualizado.id,
          lineaId: choferActualizado.lineaId,
        });
      } else {
        // Notificar a la línea que el móvil entró en servicio
        io.to(`linea:${choferActualizado.lineaId}`).emit('colectivo:conductor-online', {
          conductorId: choferActualizado.id,
          lineaId: choferActualizado.lineaId,
          asientosOcupados: choferActualizado.asientosOcupados,
          asientosTotales: choferActualizado.asientosTotales,
          sentidoRuta: choferActualizado.sentidoRuta,
          patente: choferActualizado.vehiclePlate,
          nombre: choferActualizado.name,
          latitud: choferActualizado.lastLat,
          longitud: choferActualizado.lastLng,
        });
      }
    }

    respuesta.json({
      ok: true,
      chofer: choferActualizado,
      mensaje: isOnline ? 'Conductor en servicio' : 'Conductor fuera de servicio',
    });
  } catch (error) {
    console.error('Error al cambiar estado de servicio:', error);
    respuesta.status(500).json({ error: 'Error al cambiar estado de servicio' });
  }
});


// Las transiciones y los cupos se guardan juntos antes de emitir avisos.
function publishReservation(result: Awaited<ReturnType<typeof transitionReservation>>) {
  const { reserva, chofer, changed } = result;
  if (!changed) return;
  io.to('driver:' + reserva.conductorId).to('pasajero:' + reserva.pasajeroId)
    .emit('colectivo:reserva-actualizada', { reserva: withoutPaymentData(reserva), asientosOcupados: chofer.asientosOcupados });
  io.to('driver:' + chofer.id).to('linea:' + reserva.lineaId).emit('colectivo:cambio-asientos', {
    conductorId: chofer.id, asientosOcupados: chofer.asientosOcupados, asientosTotales: chofer.asientosTotales,
  });
}

function flowError(error: unknown, res: Response) {
  if (error instanceof ReservationFlowError) return res.status(error.status).json({ error: error.message });
  console.error('Error actualizando reserva:', error);
  return res.status(500).json({ error: 'No se pudo actualizar la reserva. Intenta nuevamente.' });
}

function reservationHandler(action: ReservationAction) {
  return async (req: Request, res: Response) => {
    try {
      const result = await transitionReservation(prisma, {
        id: String(req.params.id), actorId: req.user!.id, role: req.user!.role, action, method: req.body?.metodoPago,
      });
      const { reserva, chofer, changed } = result;
      publishReservation(result);
      if (changed) {
        const base = { reservaId: reserva.id, pasajeroId: reserva.pasajeroId, conductorId: reserva.conductorId };
        if (action === 'board') {
          io.to('pasajero:' + reserva.pasajeroId).emit('colectivo:reserva-abordada', base);
          notificarPasajero(reserva.pasajeroId, 'A bordo', 'Indica si pagarás en efectivo o con RutPay.', { tipo: 'reserva_abordada', reservaId: reserva.id }).catch(console.error);
        } else if (action === 'notify-method') {
          const nombre = reserva.pasajero.name;
          const metodo = reserva.metodoPago === 'rutpay' ? 'RutPay' : 'efectivo';
          io.to('driver:' + reserva.conductorId).emit('colectivo:pasajero-quiere-pagar', {
            ...base, pasajeroNombre: nombre, cantidadAsientos: reserva.cantidadAsientos, metodoPago: reserva.metodoPago,
          });
          notificarConductor(reserva.conductorId, 'Aviso del pasajero', nombre + ' paga con ' + metodo + '. ¿Aceptas?', { tipo: 'aviso_metodo', reservaId: reserva.id }).catch(console.error);
        } else if (action === 'acknowledge-method') {
          io.to('pasajero:' + reserva.pasajeroId).emit('colectivo:pago-confirmado', base);
        } else if (action === 'request-stop') {
          const nombre = reserva.pasajero.name.trim().split(' ')[0];
          io.to('driver:' + reserva.conductorId).emit('colectivo:solicitud-parada', { ...base, pasajeroNombre: nombre });
          notificarConductor(reserva.conductorId, 'Solicitud de parada', 'Deja a ' + nombre + ' en la siguiente parada.', { tipo: 'solicitud_parada', reservaId: reserva.id }).catch(console.error);
        } else if (action === 'complete') {
          io.to('pasajero:' + reserva.pasajeroId).emit('colectivo:viaje-finalizado', base);
        } else if (action === 'cancel') {
          const pending = solicitudesDirigidasActivas.get(reserva.id);
          if (pending?.timer) clearTimeout(pending.timer);
          solicitudesDirigidasActivas.delete(reserva.id);
          io.to('driver:' + reserva.conductorId).to('pasajero:' + reserva.pasajeroId).emit('colectivo:reserva-cancelada', base);
        }
      }
      return res.json({ ok: true, reserva, chofer: { id: chofer.id, asientosOcupados: chofer.asientosOcupados }, asientosOcupados: chofer.asientosOcupados });
    } catch (error) { return flowError(error, res); }
  };
}

router.post('/reservas/:id/abordar', requireAuth, requireRole('driver'), reservationHandler('board'));
// Estos nombres conservan compatibilidad. Solo notifican el método y su acuse, sin cobrar.
router.post('/reservas/:id/solicitar-pago', requireAuth, requireRole('passenger'), reservationHandler('notify-method'));
router.post('/reservas/:id/confirmar-pago', requireAuth, requireRole('driver'), reservationHandler('acknowledge-method'));
router.post('/reservas/:id/solicitar-parada', requireAuth, requireRole('passenger'), reservationHandler('request-stop'));
router.post('/reservas/:id/liberar-asiento', requireAuth, requireRole('driver'), reservationHandler('complete'));
router.post('/reservas/:id/cancelar', requireAuth, reservationHandler('cancel'));

// ─── FUNCIÓN CENTRAL DE CASCADA: Despachar solicitud al siguiente chofer en ruta
export function despacharASiguienteConductor(reservaId: string) {
  const solicitud = solicitudesDirigidasActivas.get(reservaId);
  if (!solicitud) return;

  if (solicitud.timer) {
    clearTimeout(solicitud.timer);
    solicitud.timer = undefined;
  }

  if (solicitud.conductorActualIndex >= solicitud.conductoresCandidatos.length) {
    // Se agotaron los móviles en tránsito sin aceptación
    prisma.reservaAsiento.updateMany({
      where: { id: reservaId, estado: { in: ['pendiente_chofer', 'rechazado'] } },
      data: { estado: 'sin_conductores' },
    }).then(result => {
      if (!result.count) return;
      io.to(`pasajero:${solicitud.pasajeroId}`).emit('colectivo:sin-conductores-disponibles', {
        reservaId,
        mensaje: 'Los colectivos no pudieron aceptar tu solicitud. Puedes solicitar otro automóvil en el mapa.',
      });
      if (solicitud.lineaId) {
        io.to(`linea:${solicitud.lineaId}`).emit('colectivo:sin-conductores-disponibles', {
          reservaId,
          pasajeroId: solicitud.pasajeroId,
          mensaje: 'Los colectivos no pudieron aceptar tu solicitud. Puedes solicitar otro automóvil en el mapa.',
        });
      }
    }).catch(console.error);

    solicitudesDirigidasActivas.delete(reservaId);
    return;
  }

  const driverId = solicitud.conductoresCandidatos[solicitud.conductorActualIndex];

  // Verificar en base de datos que el chofer siga en línea y con cupo suficiente
  prisma.driver.findUnique({
    where: { id: driverId },
    select: {
      id: true,
      name: true,
      isOnline: true,
      asientosTotales: true,
      asientosOcupados: true,
      vehiclePlate: true,
      lastLat: true,
      lastLng: true,
    },
  }).then(async (chofer: any) => {
    if (solicitudesDirigidasActivas.get(reservaId) !== solicitud || solicitud.conductoresCandidatos[solicitud.conductorActualIndex] !== driverId) return;
    if (!chofer || !chofer.isOnline || (chofer.asientosTotales - chofer.asientosOcupados) < solicitud.cantidadAsientos) {
      // Chofer ya no califica, pasar de inmediato al siguiente
      solicitud.conductorActualIndex++;
      despacharASiguienteConductor(reservaId);
      return;
    }

    const distKm = chofer.lastLat && chofer.lastLng
      ? calculateDistance(chofer.lastLat, chofer.lastLng, solicitud.latitudSubida, solicitud.longitudSubida)
      : 0.35;
    const distanciaMetros = Math.max(50, Math.round(distKm * 1000));

    // Actualizar la reserva al conductor actual
    const assigned = await prisma.reservaAsiento.updateMany({
      where: { id: reservaId, estado: { in: ['pendiente_chofer', 'rechazado'] } },
      data: { conductorId: driverId, estado: 'pendiente_chofer' },
    });
    if (!assigned.count) return;

    // Emitir al chofer para activar TTS ("Nombre a X metros, X asientos, ¿lo tomamos?") y modal manos libres
    io.to(`driver:${driverId}`).emit('colectivo:solicitud-asignada', {
      conductorId: driverId,
      reservaId,
      nombrePasajero: solicitud.nombrePasajero,
      cantidadAsientos: solicitud.cantidadAsientos,
      distanciaMetros,
      tiempoLimiteSegundos: 30,
      direccionSubida: solicitud.direccionSubida,
    });
    if (solicitud.lineaId) {
      io.to(`linea:${solicitud.lineaId}`).emit('colectivo:solicitud-asignada', {
        conductorId: driverId,
        reservaId,
        nombrePasajero: solicitud.nombrePasajero,
        cantidadAsientos: solicitud.cantidadAsientos,
        distanciaMetros,
        tiempoLimiteSegundos: 30,
        direccionSubida: solicitud.direccionSubida,
      });
    }

    // FCM: notificar al conductor por push si tiene la app minimizada
    notificarConductor(
      driverId,
      'Nueva solicitud de viaje',
      `${solicitud.nombrePasajero} solicita ${solicitud.cantidadAsientos} asiento(s)${solicitud.direccionSubida ? ` en ${solicitud.direccionSubida}` : ''}`,
      {
        reservaId,
        tipo: 'solicitud_dirigida',
        nombrePasajero: solicitud.nombrePasajero,
        cantidadAsientos: String(solicitud.cantidadAsientos),
      }
    ).catch((err) => console.error('[FCM] Error notificando conductor asignado:', err));

    // Notificar al pasajero qué móvil en camino está evaluando
    io.to(`pasajero:${solicitud.pasajeroId}`).emit('colectivo:asignando-a-chofer', {
      pasajeroId: solicitud.pasajeroId,
      reservaId,
      conductor: {
        id: chofer.id,
        nombre: chofer.name,
        patente: chofer.vehiclePlate,
        distanciaMetros,
      },
    });
    if (solicitud.lineaId) {
      io.to(`linea:${solicitud.lineaId}`).emit('colectivo:asignando-a-chofer', {
        pasajeroId: solicitud.pasajeroId,
        reservaId,
        conductor: {
          id: chofer.id,
          nombre: chofer.name,
          patente: chofer.vehiclePlate,
          distanciaMetros,
        },
      });
    }

    // Temporizador de 30 segundos antes de cascada automática
    solicitud.timer = setTimeout(() => {
      if (solicitudesDirigidasActivas.get(reservaId) !== solicitud) return;
      console.log(`[Colectivos] Conductor ${driverId} no respondió en 30s. Cascada hacia siguiente móvil en ruta...`);
      io.to(`driver:${driverId}`).emit('colectivo:solicitud-expirada', { reservaId });
      solicitud.conductorActualIndex++;
      despacharASiguienteConductor(reservaId);
    }, 30000);
  }).catch((err: any) => {
    console.error('Error al despachar a chofer:', err);
    solicitud.conductorActualIndex++;
    despacharASiguienteConductor(reservaId);
  });
}

// ─── PASAJERO: Solicitar asignación dirigida al primer móvil en tránsito ──────
router.post('/solicitar-dirigido', requireAuth, async (peticion: Request, respuesta: Response) => {
  try {
    const pasajeroId = peticion.user!.id;
    const {
      lineaId,
      latitudSubida,
      longitudSubida,
      direccionSubida,
      cantidadAsientos = 1,
      sentido = 'ida',
      notas,
    } = peticion.body;

    validatePickup(latitudSubida, longitudSubida, cantidadAsientos);
    if (!lineaId || latitudSubida == null || longitudSubida == null) {
      return respuesta.status(400).json({ error: 'Debe indicar la línea y su ubicación de recogida' });
    }

    // Verificar si el pasajero ya tiene una reserva activa
    const reservaActiva = await prisma.reservaAsiento.findFirst({
      where: {
        pasajeroId,
        estado: { in: activeReservationStates },
      },
    });
    if (reservaActiva) {
      return respuesta.status(400).json({
        error: 'Ya tienes una solicitud de asiento activa en curso.',
        reserva: reservaActiva,
      });
    }

    const pasajero = await prisma.user.findUnique({
      where: { id: pasajeroId },
      select: { id: true, name: true, phone: true },
    });
    if (!pasajero) return respuesta.status(404).json({ error: 'Pasajero no encontrado' });

    // 1. Buscar choferes online en la línea
    const choferes = await prisma.driver.findMany({
      where: {
        lineaId,
        isOnline: true,
        status: 'active',
      },
      include: {
        linea: true,
      },
    });

    // 2. Filtrar los que tienen cupo disponible suficiente
    const choferesConCupo = choferes.filter((c: any) => {
      const disponibles = c.asientosTotales - c.asientosOcupados;
      return disponibles >= cantidadAsientos && c.lastLat != null && c.lastLng != null;
    });

    if (choferesConCupo.length === 0) {
      return respuesta.status(404).json({
        error: 'No hay colectivos en tránsito con cupos disponibles en este momento.',
        sinConductores: true,
      });
    }

    // 3. Ordenar choferes: mismo sentido primero y por distancia de aproximación
    const candidatosOrdenados = choferesConCupo
      .map((c: any) => {
        const distKm = calculateDistance(c.lastLat!, c.lastLng!, latitudSubida, longitudSubida);
        const distMetros = Math.round(distKm * 1000);
        const coincideSentido = c.sentidoRuta === sentido;
        return {
          id: c.id,
          chofer: c,
          distMetros,
          coincideSentido,
        };
      })
      .sort((a: any, b: any) => {
        if (a.coincideSentido && !b.coincideSentido) return -1;
        if (!a.coincideSentido && b.coincideSentido) return 1;
        return a.distMetros - b.distMetros;
      });

    const primerCandidato = candidatosOrdenados[0];

    // 4. Crear la reserva en estado "pendiente_chofer"
    const nuevaReserva = await reservationTransaction(prisma, async (tx) => {
      const existing = await tx.reservaAsiento.findFirst({ where: { pasajeroId, estado: { in: activeReservationStates } } });
      if (existing) throw new ReservationFlowError(409, 'Ya tienes una reserva activa.');
      return tx.reservaAsiento.create({
        data: {
          pasajeroId,
          conductorId: primerCandidato.id,
          lineaId,
          cantidadAsientos,
          latitudSubida,
          longitudSubida,
          direccionSubida,
          tarifa: 0,
          metodoPago: 'none',
          notas,
          estado: 'pendiente_chofer',
        },
        include: {
          linea: true,
          conductor: {
            select: {
              id: true,
              name: true,
              phone: true,
              vehiclePlate: true,
              vehicleBrand: true,
              vehicleModel: true,
              lastLat: true,
              lastLng: true,
            },
          },
          pasajero: {
            select: {
              id: true,
              name: true,
              phone: true,
            },
          },
        },
      });
    });

    // 5. Registrar en el mapa activo de despacho
    const listaCandidatosIds = candidatosOrdenados.map((c: any) => c.id);
    solicitudesDirigidasActivas.set(nuevaReserva.id, {
      reservaId: nuevaReserva.id,
      lineaId,
      pasajeroId,
      nombrePasajero: pasajero.name,
      cantidadAsientos,
      latitudSubida,
      longitudSubida,
      direccionSubida,
      conductoresCandidatos: listaCandidatosIds,
      conductorActualIndex: 0,
    });

    // 6. Despachar al primer chofer
    despacharASiguienteConductor(nuevaReserva.id);

    respuesta.status(201).json({
      reserva: nuevaReserva,
      conductorAsignado: {
        id: primerCandidato.id,
        nombre: primerCandidato.chofer.name,
        patente: primerCandidato.chofer.vehiclePlate,
        distanciaMetros: primerCandidato.distMetros,
      },
    });
  } catch (error) {
    if (error instanceof ReservationFlowError) return respuesta.status(error.status).json({ error: error.message });
    console.error('Error al solicitar asignación dirigida:', error);
    respuesta.status(500).json({ error: 'Error al procesar la solicitud de colectivo' });
  }
});

// ─── CONDUCTOR: Responder a una reserva por voz o botón ──────────────────
router.post('/reservas/:id/responder', requireAuth, requireRole('driver'), async (req: Request, res: Response) => {
  try {
    const { accion } = req.body;
    if (accion !== 'aceptar' && accion !== 'rechazar') return res.status(400).json({ error: 'Respuesta inválida.' });
    const result = await transitionReservation(prisma, {
      id: String(req.params.id), actorId: req.user!.id, role: req.user!.role,
      action: accion === 'aceptar' ? 'accept' : 'reject',
    });
    const { reserva, chofer, changed } = result;
    if (changed) {
      const solicitud = solicitudesDirigidasActivas.get(reserva.id);
      if (solicitud?.timer) clearTimeout(solicitud.timer);
      if (accion === 'rechazar' && solicitud) {
        solicitud.conductorActualIndex++;
        despacharASiguienteConductor(reserva.id);
      } else {
        solicitudesDirigidasActivas.delete(reserva.id);
        publishReservation(result);
        if (accion === 'aceptar') {
          io.to('pasajero:' + reserva.pasajeroId).emit('colectivo:reserva-aceptada', { reserva: withoutPaymentData(reserva) });
          io.to('driver:' + chofer.id).emit('colectivo:reserva-confirmada-chofer', { reserva: withoutPaymentData(reserva), asientosOcupados: chofer.asientosOcupados });
          notificarPasajero(reserva.pasajeroId, 'Reserva aceptada', chofer.name + ' viene a recogerte.', { tipo: 'reserva_aceptada', reservaId: reserva.id }).catch(console.error);
        } else {
          io.to('pasajero:' + reserva.pasajeroId).emit('colectivo:reserva-cancelada', { reservaId: reserva.id, pasajeroId: reserva.pasajeroId, mensaje: 'El conductor rechazó la reserva.' });
        }
      }
    }
    return res.json({ ok: true, reserva, asientosOcupados: chofer.asientosOcupados });
  } catch (error) { return flowError(error, res); }
});

// ─── ENDPOINT STREAMING TTS EN ESPAÑOL / CHILENO (MANOS LIBRES LEY 21.377) ──
router.get('/tts', async (req: Request, res: Response) => {
  try {
    const texto = String(req.query.texto || '').trim();
    if (!texto) {
      return res.status(400).json({ error: 'El parámetro texto es obligatorio' });
    }

    const textoSeguro = encodeURIComponent(texto.slice(0, 250));
    const lang = String(req.query.lang || 'es');
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${textoSeguro}&tl=${lang}&client=tw-ob`;

    const respuestaTTS = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'audio/mpeg, audio/*;q=0.9',
      },
    });

    if (!respuestaTTS.ok) {
      return res.status(respuestaTTS.status).json({ error: 'Error al consultar servicio TTS externo' });
    }

    const arrayBuffer = await respuestaTTS.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Accept-Ranges', 'bytes');
    return res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error('Error en /tts:', error);
    return res.status(500).json({ error: 'Error interno al generar audio TTS' });
  }
});

export default router;
