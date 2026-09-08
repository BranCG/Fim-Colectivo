import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { io } from '../index';
import { calculateDistance } from '../utils/pricing';

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

const router = Router();

// ─── PÚBLICO / PASAJERO: Listar todas las líneas activas ──────────────────
router.get('/lineas', async (peticion: Request, respuesta: Response) => {
  try {
    const lineas = await prisma.lineaColectivo.findMany({
      where: { activa: true },
      include: {
        paradas: {
          orderBy: { orden: 'asc' },
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
            telefonoRutPay: true,
            mercadoPagoLink: true,
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
      where: { id },
      include: {
        paradas: {
          orderBy: { orden: 'asc' },
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
            telefonoRutPay: true,
            mercadoPagoLink: true,
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
      metodoPago = 'efectivo',
      notas,
    } = peticion.body;

    if (!conductorId || !lineaId) {
      return respuesta.status(400).json({ error: 'Debe especificar el conductor y la línea' });
    }

    // Verificar conductor y disponibilidad de asientos
    const chofer = await prisma.driver.findUnique({
      where: { id: conductorId },
      include: { linea: true },
    });

    if (!chofer || !chofer.isOnline) {
      return respuesta.status(400).json({ error: 'El conductor no está disponible o se encuentra fuera de servicio' });
    }

    const asientosDisponibles = chofer.asientosTotales - chofer.asientosOcupados;
    if (asientosDisponibles < cantidadAsientos) {
      return respuesta.status(400).json({
        error: `Solo quedan ${asientosDisponibles} asiento(s) disponible(s) en este colectivo`,
      });
    }

    const valorTarifa = chofer.linea ? chofer.linea.tarifa * cantidadAsientos : 800 * cantidadAsientos;
    const nuevosOcupados = Math.min(chofer.asientosTotales, chofer.asientosOcupados + cantidadAsientos);

    // Crear la reserva de asiento y actualizar asientos ocupados en transacción
    const [nuevaReserva, choferActualizado] = await prisma.$transaction([
      prisma.reservaAsiento.create({
        data: {
          pasajeroId,
          conductorId,
          lineaId,
          cantidadAsientos,
          latitudSubida,
          longitudSubida,
          direccionSubida,
          tarifa: valorTarifa,
          metodoPago,
          notas,
          estado: 'reservado',
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
              telefonoRutPay: true,
              mercadoPagoLink: true,
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
      }),
      prisma.driver.update({
        where: { id: conductorId },
        data: { asientosOcupados: nuevosOcupados },
      }),
    ]);

    // Emitir cambio de asientos a la flota y al conductor
    if (chofer.lineaId) {
      io.to(`linea:${chofer.lineaId}`).emit('colectivo:cambio-asientos', {
        conductorId: chofer.id,
        asientosOcupados: choferActualizado.asientosOcupados,
        asientosTotales: choferActualizado.asientosTotales,
      });
    }
    io.to(`driver:${conductorId}`).emit('colectivo:cambio-asientos', {
      conductorId: chofer.id,
      asientosOcupados: choferActualizado.asientosOcupados,
      asientosTotales: choferActualizado.asientosTotales,
    });

    // Notificar al conductor por WebSocket en tiempo real
    io.to(`driver:${conductorId}`).emit('colectivo:nueva-reserva', {
      reserva: nuevaReserva,
      asientosOcupados: choferActualizado.asientosOcupados,
    });

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
      tiempoLimiteSegundos: 20,
      direccionSubida: nuevaReserva.direccionSubida,
    });

    respuesta.status(201).json({ reserva: nuevaReserva, asientosOcupados: choferActualizado.asientosOcupados });
  } catch (error) {
    console.error('Error al reservar asiento:', error);
    respuesta.status(500).json({ error: 'Error al realizar la reserva del asiento' });
  }
});

// ─── PASAJERO: Ver mis reservas activas ───────────────────────────────────
router.get('/reservas/mis-reservas', requireAuth, async (peticion: Request, respuesta: Response) => {
  try {
    const pasajeroId = peticion.user!.id;
    const reservas = await prisma.reservaAsiento.findMany({
      where: {
        pasajeroId,
        estado: { in: ['reservado', 'pendiente_chofer', 'abordado', 'pagando'] },
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
            telefonoRutPay: true,
            mercadoPagoLink: true,
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
          include: { paradas: { orderBy: { orden: 'asc' } } },
        },
        reservasAsiento: {
          where: { estado: { in: ['reservado', 'pendiente_chofer', 'abordado', 'pagando'] } },
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
      include: { linea: true },
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

    if (typeof asientosOcupados !== 'number' || asientosOcupados < 0 || asientosOcupados > 4) {
      return respuesta.status(400).json({ error: 'El número de asientos ocupados debe ser entre 0 y 4' });
    }

    const choferActualizado = await prisma.driver.update({
      where: { id: conductorId },
      data: { asientosOcupados },
      select: {
        id: true,
        lineaId: true,
        asientosTotales: true,
        asientosOcupados: true,
        sentidoRuta: true,
        lastLat: true,
        lastLng: true,
      },
    });

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
    console.error('Error al actualizar asientos:', error);
    respuesta.status(500).json({ error: 'Error al actualizar asientos' });
  }
});

// ─── CONDUCTOR: Cambiar sentido de ruta (Ida / Vuelta) ────────────────────
router.post('/conductor/sentido', requireAuth, requireRole('driver', 'admin'), async (peticion: Request, respuesta: Response) => {
  try {
    const conductorId = peticion.user!.id;
    const { sentidoRuta } = peticion.body;

    if (!['ida', 'vuelta'].includes(sentidoRuta)) {
      return respuesta.status(400).json({ error: 'Sentido no válido (debe ser "ida" o "vuelta")' });
    }

    const choferActualizado = await prisma.driver.update({
      where: { id: conductorId },
      data: { sentidoRuta },
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

// ─── CONDUCTOR: Marcar pasajero reservado como abordado ───────────────────
router.post('/reservas/:id/abordar', requireAuth, requireRole('driver', 'admin'), async (peticion: Request, respuesta: Response) => {
  try {
    const conductorId = peticion.user!.id;
    const { id } = peticion.params;

    const reserva = await prisma.reservaAsiento.findFirst({
      where: { id, conductorId },
    });

    if (!reserva) {
      return respuesta.status(404).json({ error: 'Reserva no encontrada' });
    }

    const choferActual = await prisma.driver.findUnique({ where: { id: conductorId } });
    const yaOcupabaAsiento = reserva.estado === 'reservado';
    const nuevosOcupados = yaOcupabaAsiento
      ? (choferActual?.asientosOcupados || 0)
      : Math.min(choferActual?.asientosTotales || 4, (choferActual?.asientosOcupados || 0) + reserva.cantidadAsientos);

    const [reservaActualizada, choferActualizado] = await prisma.$transaction([
      prisma.reservaAsiento.update({
        where: { id },
        data: { estado: 'abordado' },
      }),
      prisma.driver.update({
        where: { id: conductorId },
        data: { asientosOcupados: nuevosOcupados },
      }),
    ]);

    if (choferActualizado.lineaId) {
      io.to(`linea:${choferActualizado.lineaId}`).emit('colectivo:cambio-asientos', {
        conductorId: choferActualizado.id,
        asientosOcupados: choferActualizado.asientosOcupados,
        asientosTotales: choferActualizado.asientosTotales,
      });
    }

    io.to(`pasajero:${reserva.pasajeroId}`).emit('colectivo:reserva-abordada', { reservaId: id });

    respuesta.json({ reserva: reservaActualizada, chofer: choferActualizado });
  } catch (error) {
    console.error('Error al marcar abordaje:', error);
    respuesta.status(500).json({ error: 'Error al marcar abordaje' });
  }
});

// ─── PASAJERO: Solicitar pagar y descender del colectivo ─────────────────
router.post('/reservas/:id/solicitar-pago', requireAuth, async (peticion: Request, respuesta: Response) => {
  try {
    const pasajeroId = peticion.user!.id;
    const { id } = peticion.params;

    const reserva = await prisma.reservaAsiento.findFirst({
      where: { id, pasajeroId },
      include: {
        pasajero: { select: { id: true, name: true, phone: true } },
        conductor: { select: { id: true, name: true, vehiclePlate: true, telefonoRutPay: true, mercadoPagoLink: true } },
      },
    });

    if (!reserva) {
      return respuesta.status(404).json({ error: 'Reserva no encontrada o no autorizada' });
    }

    const reservaActualizada = await prisma.reservaAsiento.update({
      where: { id },
      data: { estado: 'pagando' },
      include: {
        pasajero: { select: { id: true, name: true, phone: true } },
        conductor: { select: { id: true, name: true, vehiclePlate: true, telefonoRutPay: true, mercadoPagoLink: true } },
      },
    });

    // Notificar al conductor con alerta por voz y pantalla
    io.to(`driver:${reserva.conductorId}`).emit('colectivo:pasajero-quiere-pagar', {
      reservaId: id,
      pasajeroNombre: reserva.pasajero.name,
      cantidadAsientos: reserva.cantidadAsientos,
      metodoPago: reserva.metodoPago,
    });

    io.to(`pasajero:${pasajeroId}`).emit('colectivo:pago-solicitado', {
      reservaId: id,
      estado: 'pagando',
    });

    respuesta.json({ ok: true, reserva: reservaActualizada });
  } catch (error) {
    console.error('Error al solicitar pago:', error);
    respuesta.status(500).json({ error: 'Error al procesar solicitud de pago' });
  }
});

// ─── CONDUCTOR: Aceptar pago y liberar asiento ────────────────────────────
router.post('/reservas/:id/confirmar-pago', requireAuth, requireRole('driver', 'admin'), async (peticion: Request, respuesta: Response) => {
  try {
    const conductorId = peticion.user!.id;
    const { id } = peticion.params;

    const reserva = await prisma.reservaAsiento.findFirst({
      where: { id, conductorId },
      include: {
        conductor: true,
        pasajero: { select: { id: true, name: true, phone: true } },
      },
    });

    if (!reserva) {
      return respuesta.status(404).json({ error: 'Reserva no encontrada para este conductor' });
    }

    const choferActual = await prisma.driver.findUnique({ where: { id: conductorId } });
    const nuevosOcupados = Math.max(0, (choferActual?.asientosOcupados || 0) - reserva.cantidadAsientos);

    const [reservaActualizada, choferActualizado] = await prisma.$transaction([
      prisma.reservaAsiento.update({
        where: { id },
        data: { estado: 'completado' },
        include: {
          pasajero: { select: { id: true, name: true, phone: true } },
        },
      }),
      prisma.driver.update({
        where: { id: conductorId },
        data: { asientosOcupados: nuevosOcupados },
      }),
    ]);

    // Notificar a la flota de la línea sobre el nuevo cupo liberado
    if (choferActualizado.lineaId) {
      io.to(`linea:${choferActualizado.lineaId}`).emit('colectivo:cambio-asientos', {
        conductorId: choferActualizado.id,
        asientosOcupados: choferActualizado.asientosOcupados,
        asientosTotales: choferActualizado.asientosTotales,
      });
    }

    // Notificar al pasajero que el pago fue recibido y el viaje culminó (liberando su pantalla)
    io.to(`pasajero:${reserva.pasajeroId}`).emit('colectivo:pago-confirmado', {
      reservaId: id,
      mensaje: '¡Pago confirmado por el conductor! Gracias por viajar.',
    });

    // Notificar al conductor confirmación
    io.to(`driver:${conductorId}`).emit('colectivo:pago-confirmado-chofer', {
      reservaId: id,
      asientosOcupados: nuevosOcupados,
    });

    respuesta.json({
      ok: true,
      reserva: reservaActualizada,
      asientosOcupados: nuevosOcupados,
      mensaje: 'Pago confirmado y asiento liberado exitosamente',
    });
  } catch (error) {
    console.error('Error al confirmar pago:', error);
    respuesta.status(500).json({ error: 'Error al confirmar pago del pasajero' });
  }
});

// ─── CONDUCTOR / PASAJERO: Cancelar reserva ────────────────────────────────
router.post('/reservas/:id/cancelar', requireAuth, async (peticion: Request, respuesta: Response) => {
  try {
    const { id } = peticion.params;
    const reserva = await prisma.reservaAsiento.findUnique({
      where: { id },
      include: { conductor: true },
    });

    if (!reserva) {
      return respuesta.status(404).json({ error: 'Reserva no encontrada' });
    }

    const reservaActualizada = await prisma.reservaAsiento.update({
      where: { id },
      data: { estado: 'cancelado' },
    });

    // Si ya había reservado, abordado o estaba pagando y se cancela, liberar el asiento
    if (['reservado', 'abordado', 'pagando'].includes(reserva.estado) && reserva.conductorId) {
      const choferActual = await prisma.driver.findUnique({ where: { id: reserva.conductorId } });
      if (choferActual) {
        const nuevosOcupados = Math.max(0, choferActual.asientosOcupados - reserva.cantidadAsientos);
        const choferActualizado = await prisma.driver.update({
          where: { id: reserva.conductorId },
          data: { asientosOcupados: nuevosOcupados },
        });

        if (choferActualizado.lineaId) {
          io.to(`linea:${choferActualizado.lineaId}`).emit('colectivo:cambio-asientos', {
            conductorId: choferActualizado.id,
            asientosOcupados: choferActualizado.asientosOcupados,
            asientosTotales: choferActualizado.asientosTotales,
          });
        }
        io.to(`driver:${reserva.conductorId}`).emit('colectivo:cambio-asientos', {
          conductorId: choferActualizado.id,
          asientosOcupados: choferActualizado.asientosOcupados,
          asientosTotales: choferActualizado.asientosTotales,
        });
      }
    }

    // Si la reserva estaba en proceso de despacho dirigido, cancelar el timer
    const solicitudActiva = solicitudesDirigidasActivas.get(id);
    if (solicitudActiva?.timer) {
      clearTimeout(solicitudActiva.timer);
      solicitudesDirigidasActivas.delete(id);
    }

    io.to(`driver:${reserva.conductorId}`).emit('colectivo:reserva-cancelada', { reservaId: id });
    io.to(`driver:${reserva.conductorId}`).emit('colectivo:solicitud-cancelada', { reservaId: id });
    io.to(`pasajero:${reserva.pasajeroId}`).emit('colectivo:reserva-cancelada', { reservaId: id });

    respuesta.json({ reserva: reservaActualizada, mensaje: 'Reserva cancelada' });
  } catch (error) {
    console.error('Error al cancelar reserva:', error);
    respuesta.status(500).json({ error: 'Error al cancelar la reserva' });
  }
});

// ─── CONDUCTOR: Configurar métodos de cobro (RutPay BancoEstado / MercadoPago)
router.put('/conductor/datos-pago', requireAuth, requireRole('driver', 'admin'), async (peticion: Request, respuesta: Response) => {
  try {
    const conductorId = peticion.user!.id;
    const { telefonoRutPay, linkMercadoPago } = peticion.body;

    const choferActualizado = await prisma.driver.update({
      where: { id: conductorId },
      data: {
        telefonoRutPay: telefonoRutPay !== undefined ? telefonoRutPay : undefined,
        mercadoPagoLink: linkMercadoPago !== undefined ? linkMercadoPago : undefined,
      },
      select: {
        id: true,
        name: true,
        telefonoRutPay: true,
        mercadoPagoLink: true,
      },
    });

    respuesta.json({ chofer: choferActualizado, mensaje: 'Datos de cobro actualizados' });
  } catch (error) {
    console.error('Error al guardar datos de pago:', error);
    respuesta.status(500).json({ error: 'Error al actualizar métodos de cobro' });
  }
});

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
    prisma.reservaAsiento.update({
      where: { id: reservaId },
      data: { estado: 'sin_conductores' },
    }).catch(console.error);

    io.to(`pasajero:${solicitud.pasajeroId}`).emit('colectivo:sin-conductores-disponibles', {
      reservaId,
      mensaje: 'Todos los colectivos en tránsito vienen con cupos completos. Se liberará un móvil en breve.',
    });

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
  }).then((chofer) => {
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
    prisma.reservaAsiento.update({
      where: { id: reservaId },
      data: {
        conductorId: driverId,
        estado: 'pendiente_chofer',
      },
    }).catch(console.error);

    // Emitir al chofer para activar TTS ("Nombre a X metros, X asientos, ¿lo tomamos?") y modal manos libres
    io.to(`driver:${driverId}`).emit('colectivo:solicitud-asignada', {
      reservaId,
      nombrePasajero: solicitud.nombrePasajero,
      cantidadAsientos: solicitud.cantidadAsientos,
      distanciaMetros,
      tiempoLimiteSegundos: 15,
      direccionSubida: solicitud.direccionSubida,
    });

    // Notificar al pasajero qué móvil en camino está evaluando
    io.to(`pasajero:${solicitud.pasajeroId}`).emit('colectivo:asignando-a-chofer', {
      reservaId,
      conductor: {
        id: chofer.id,
        nombre: chofer.name,
        patente: chofer.vehiclePlate,
        distanciaMetros,
      },
    });

    // Temporizador de 15 segundos antes de cascada automática
    solicitud.timer = setTimeout(() => {
      console.log(`[Colectivos] Conductor ${driverId} no respondió en 15s. Cascada hacia siguiente móvil en ruta...`);
      io.to(`driver:${driverId}`).emit('colectivo:solicitud-expirada', { reservaId });
      solicitud.conductorActualIndex++;
      despacharASiguienteConductor(reservaId);
    }, 15000);
  }).catch((err) => {
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
      metodoPago = 'efectivo',
      sentido = 'ida',
      notas,
    } = peticion.body;

    if (!lineaId || latitudSubida == null || longitudSubida == null) {
      return respuesta.status(400).json({ error: 'Debe indicar la línea y su ubicación de recogida' });
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
    const choferesConCupo = choferes.filter((c) => {
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
      .map((c) => {
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
      .sort((a, b) => {
        if (a.coincideSentido && !b.coincideSentido) return -1;
        if (!a.coincideSentido && b.coincideSentido) return 1;
        return a.distMetros - b.distMetros;
      });

    const primerCandidato = candidatosOrdenados[0];

    // 4. Crear la reserva en estado "pendiente_chofer"
    const nuevaReserva = await prisma.reservaAsiento.create({
      data: {
        pasajeroId,
        conductorId: primerCandidato.id,
        lineaId,
        cantidadAsientos,
        latitudSubida,
        longitudSubida,
        direccionSubida,
        metodoPago,
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
            telefonoRutPay: true,
            mercadoPagoLink: true,
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

    // 5. Registrar en el mapa activo de despacho
    const listaCandidatosIds = candidatosOrdenados.map((c) => c.id);
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
    console.error('Error al solicitar asignación dirigida:', error);
    respuesta.status(500).json({ error: 'Error al procesar la solicitud de colectivo' });
  }
});

// ─── CONDUCTOR: Responder a la solicitud asignada (SÍ o NO vía voz o botón gigante)
router.post('/reservas/:id/responder', requireAuth, requireRole('driver', 'admin'), async (peticion: Request, respuesta: Response) => {
  try {
    const conductorId = peticion.user!.id;
    const { id } = peticion.params;
    const { accion } = peticion.body; // 'aceptar' | 'rechazar'

    const reserva = await prisma.reservaAsiento.findUnique({
      where: { id },
      include: {
        conductor: { select: { id: true, name: true, vehiclePlate: true, phone: true, lastLat: true, lastLng: true, telefonoRutPay: true, mercadoPagoLink: true } },
        pasajero: { select: { id: true, name: true, phone: true } },
        linea: true,
      },
    });

    if (!reserva) {
      return respuesta.status(404).json({ error: 'Reserva no encontrada' });
    }

    const solicitud = solicitudesDirigidasActivas.get(id);

    if (accion === 'aceptar') {
      if (solicitud?.timer) clearTimeout(solicitud.timer);
      solicitudesDirigidasActivas.delete(id);

      const choferActual = await prisma.driver.findUnique({ where: { id: conductorId } });
      const nuevosOcupados = Math.min(
        choferActual?.asientosTotales || 4,
        (choferActual?.asientosOcupados || 0) + reserva.cantidadAsientos
      );

      const [reservaActualizada, choferActualizado] = await prisma.$transaction([
        prisma.reservaAsiento.update({
          where: { id },
          data: {
            conductorId,
            estado: 'reservado',
          },
          include: {
            conductor: { select: { id: true, name: true, vehiclePlate: true, phone: true, lastLat: true, lastLng: true, telefonoRutPay: true, mercadoPagoLink: true } },
            pasajero: { select: { id: true, name: true, phone: true } },
            linea: true,
          },
        }),
        prisma.driver.update({
          where: { id: conductorId },
          data: { asientosOcupados: nuevosOcupados },
        }),
      ]);

      // Emitir cambio de asientos a la flota de la línea y al conductor
      if (choferActualizado.lineaId) {
        io.to(`linea:${choferActualizado.lineaId}`).emit('colectivo:cambio-asientos', {
          conductorId: choferActualizado.id,
          asientosOcupados: choferActualizado.asientosOcupados,
          asientosTotales: choferActualizado.asientosTotales,
        });
      }
      io.to(`driver:${conductorId}`).emit('colectivo:cambio-asientos', {
        conductorId: choferActualizado.id,
        asientosOcupados: choferActualizado.asientosOcupados,
        asientosTotales: choferActualizado.asientosTotales,
      });

      // Notificar al pasajero confirmación inmediata
      io.to(`pasajero:${reserva.pasajeroId}`).emit('colectivo:reserva-aceptada', {
        reserva: reservaActualizada,
      });

      // Confirmar al conductor
      io.to(`driver:${conductorId}`).emit('colectivo:reserva-confirmada-chofer', {
        reserva: reservaActualizada,
        asientosOcupados: choferActualizado.asientosOcupados,
      });

      return respuesta.json({
        ok: true,
        reserva: reservaActualizada,
        asientosOcupados: choferActualizado.asientosOcupados,
      });
    } else {
      // Chofer rechazó ("NO" o botón rojo)
      if (solicitud?.timer) clearTimeout(solicitud.timer);

      if (solicitud) {
        solicitud.conductorActualIndex++;
        despacharASiguienteConductor(id);
      } else {
        await prisma.reservaAsiento.update({
          where: { id },
          data: { estado: 'rechazado' },
        });
        io.to(`pasajero:${reserva.pasajeroId}`).emit('colectivo:reserva-cancelada', { reservaId: id });
      }

      return respuesta.json({ ok: true, mensaje: 'Solicitud rechazada, asignada al siguiente móvil en tránsito' });
    }
  } catch (error) {
    console.error('Error al responder a la reserva:', error);
    respuesta.status(500).json({ error: 'Error al procesar respuesta del conductor' });
  }
});

export default router;
