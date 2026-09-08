import { Router, Request, Response } from 'express';
import prisma from '../utils/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { io } from '../index';

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

    // Crear la reserva de asiento
    const nuevaReserva = await prisma.reservaAsiento.create({
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
    });

    // Notificar al conductor por WebSocket en tiempo real
    io.to(`driver:${conductorId}`).emit('colectivo:nueva-reserva', { reserva: nuevaReserva });

    respuesta.status(201).json({ reserva: nuevaReserva });
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
        estado: { in: ['reservado', 'abordado'] },
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
          where: { estado: { in: ['reservado', 'abordado'] } },
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
    const nuevosOcupados = Math.min(4, (choferActual?.asientosOcupados || 0) + reserva.cantidadAsientos);

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

    // Si ya había abordado y se cancela, liberar el asiento
    if (reserva.estado === 'abordado') {
      await prisma.driver.update({
        where: { id: reserva.conductorId },
        data: {
          asientosOcupados: {
            set: Math.max(0, reserva.conductor.asientosOcupados - reserva.cantidadAsientos),
          },
        },
      });
    }

    io.to(`driver:${reserva.conductorId}`).emit('colectivo:reserva-cancelada', { reservaId: id });
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

export default router;
