import { Router } from 'express';
import prisma from '../utils/prisma';
import { preapproval } from '../utils/mercadopago';
import { MercadoPagoConfig, Preference } from 'mercadopago';
import dotenv from 'dotenv';
dotenv.config();

const client = new MercadoPagoConfig({ 
  accessToken: process.env.MP_ACCESS_TOKEN || '', 
  options: { timeout: 5000 } 
});

const preference = new Preference(client);

const router = Router();

// 1. Crear la suscripción (Preapproval)
router.post('/subscribe', async (req, res) => {
  try {
    const { driverId, email } = req.body;

    if (!driverId || !email) {
      return res.status(400).json({ error: 'Faltan datos del conductor' });
    }

    // Comprobar si el conductor ya tiene una membresía activa pagada
    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) return res.status(404).json({ error: 'Conductor no encontrado' });

    if (driver.membershipPaid) {
      return res.status(400).json({ error: 'El conductor ya tiene su membresía pagada' });
    }

    // Configurar la suscripción
    const subscriptionData = {
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: 100000,
        currency_id: 'CLP',
      },
      back_url: 'https://fim.cl/driver', // En producción sería https://tu-dominio.com/driver
      reason: 'Suscripción Mensual Conductor Fim',
      payer_email: email, // El email de prueba o del usuario
    };

    const response = await preapproval.create({ body: subscriptionData });

    // Guardamos el ID de la suscripción pendiente en la BD
    if (response.id) {
      await prisma.driver.update({
        where: { id: driverId },
        data: { mpSubscriptionId: response.id },
      });
    }

    // Devolvemos el link de pago (init_point) al frontend
    res.json({ init_point: response.init_point });
  } catch (error) {
    console.error('Error al crear suscripción en Mercado Pago:', error);
    res.status(500).json({ error: 'Error interno del servidor al conectar con Mercado Pago' });
  }
});

// 2. Webhook (IPN) - Recibe las notificaciones de Mercado Pago
router.post('/webhook', async (req, res) => {
  try {
    // Mercado Pago envía notificaciones POST aquí
    console.log('🔔 Webhook de Mercado Pago recibido:', req.query, req.body);
    
    // El query o body contiene `type` y `data.id`
    // Para suscripciones, suele ser topic=preapproval o type=subscription_preapproval
    const type = req.query.type || req.query.topic;
    const dataId = req.query['data.id'] || req.query.id;

    if ((type === 'subscription_preapproval' || type === 'preapproval') && dataId) {
      // Obtenemos los detalles reales de la suscripción desde MP
      const subscriptionInfo = await preapproval.get({ id: String(dataId) });

      if (subscriptionInfo && subscriptionInfo.status === 'authorized') {
        // Encontramos al conductor por el mpSubscriptionId
        const driver = await prisma.driver.findFirst({
          where: { mpSubscriptionId: String(dataId) }
        });

        if (driver) {
          // Calculamos la fecha de expiración (1 mes desde hoy)
          const expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + 1);

          await prisma.driver.update({
            where: { id: driver.id },
            data: {
              membershipPaid: true,
              membershipDate: new Date(),
              membershipExpiresAt: expiresAt,
              status: 'active' // ¡Activar al conductor!
            }
          });
          console.log(`✅ Conductor ${driver.id} activado vía Mercado Pago.`);
        }
      }
    }

    // Siempre responder 200 OK a Mercado Pago rápidamente
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error procesando Webhook de suscripciones:', error);
    res.status(500).send('Internal Error');
  }
});

// Endpoint para SIMULAR el pago exitoso de la membresía en Desarrollo
router.post('/simulate-subscription', async (req, res) => {
  try {
    const { driverId } = req.body;
    if (!driverId) return res.status(400).json({ error: 'Falta driverId' });

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);

    await prisma.driver.update({
      where: { id: driverId },
      data: {
        membershipPaid: true,
        membershipDate: new Date(),
        membershipExpiresAt: expiresAt,
        status: 'active'
      }
    });

    console.log(`✅ SIMULACRO: Conductor ${driverId} activado manualmente.`);
    res.json({ success: true, message: 'Pago simulado correctamente' });
  } catch (error) {
    console.error('Error al simular suscripción:', error);
    res.status(500).json({ error: 'Error simulando suscripción' });
  }
});

// ─── PAGOS POR VIAJE (RECAUDACIÓN CENTRALIZADA) ─────────────────────────

// 3. Crear preferencia de pago para un viaje específico
router.post('/trip/:id/pay', async (req, res) => {
  try {
    const { id } = req.params;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: { passenger: true, driver: true }
    });

    if (!trip) return res.status(404).json({ error: 'Viaje no encontrado' });
    if (trip.paymentStatus === 'paid' || trip.isPaid) {
      return res.status(400).json({ error: 'El viaje ya fue pagado' });
    }

    const price = trip.finalPrice || trip.estimatedPrice;

    // Crear la preferencia en Mercado Pago
    const response = await preference.create({
      body: {
        items: [
          {
            id: trip.id,
            title: `Viaje Fim - ${trip.destAddress}`,
            quantity: 1,
            unit_price: price,
            currency_id: 'CLP',
          }
        ],
        payer: {
          email: trip.passenger.email,
        },
        back_urls: {
          success: 'https://fim.cl/passenger/payment-success',
          failure: 'https://fim.cl/passenger/payment-failure',
          pending: 'https://fim.cl/passenger/payment-pending'
        },
        auto_return: 'approved',
        notification_url: 'https://fim.cl/api/payments/trip-webhook', // URL real requerida en prod
        external_reference: trip.id,
      }
    });

    res.json({ init_point: response.init_point, preferenceId: response.id });
  } catch (error) {
    console.error('Error al crear preferencia de viaje:', error);
    res.status(500).json({ error: 'Error interno al generar pago del viaje' });
  }
});

// 4. Webhook para pagos de viajes
router.post('/trip-webhook', async (req, res) => {
  try {
    // Aquí recibimos la notificación de Mercado Pago cuando un pasajero paga el viaje.
    // NOTA: En desarrollo local sin ngrok, este webhook no será llamado por Mercado Pago.
    // Para probar en local, el frontend tendrá que llamar a un endpoint de confirmación manual,
    // o podemos simular este webhook enviando un POST manualmente.
    
    const paymentId = req.query['data.id'] || req.body?.data?.id;
    const type = req.query.type || req.body?.type;

    if (type === 'payment' && paymentId) {
      // Idealmente aquí consultamos a la API de MP usando Payment.get({ id: paymentId })
      // para validar que el pago esté aprobado y obtener el external_reference (tripId).
      // Simularemos la lógica asumiendo que llega el external_reference en el body para pruebas.
      
      const tripId = req.body?.external_reference || req.query.external_reference;
      
      if (tripId) {
        const trip = await prisma.trip.findUnique({ where: { id: tripId as string } });
        
        if (trip && !trip.isPaid && trip.driverId) {
          // 1. Marcar viaje como pagado
          await prisma.trip.update({
            where: { id: trip.id },
            data: { isPaid: true, paymentStatus: 'paid', mpPaymentId: String(paymentId) }
          });
          
          // 2. Sumar saldo a la billetera del conductor
          const price = trip.finalPrice || trip.estimatedPrice;
          await prisma.driver.update({
            where: { id: trip.driverId },
            data: { walletBalance: { increment: price } }
          });
          
          console.log(`✅ Pago de viaje ${trip.id} procesado. $${price} sumados a la billetera del conductor ${trip.driverId}.`);
        }
      }
    }
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error procesando webhook de viaje:', error);
    res.status(500).send('Internal Error');
  }
});

// 5. Endpoint de simulacro de pago (Solo para Desarrollo)
// Ya que ngrok no está configurado, el frontend llamará a esto tras volver del checkout
router.post('/trip/:id/simulate-payment', async (req, res) => {
  try {
    const { id } = req.params;
    const trip = await prisma.trip.findUnique({ where: { id } });
    
    if (trip && !trip.isPaid && trip.driverId) {
      const price = trip.finalPrice || trip.estimatedPrice;
      
      await prisma.trip.update({
        where: { id: trip.id },
        data: { isPaid: true, paymentStatus: 'paid' }
      });
      
      await prisma.driver.update({
        where: { id: trip.driverId },
        data: { walletBalance: { increment: price } }
      });
      
      console.log(`✅ SIMULACRO: Viaje ${trip.id} pagado. $${price} a la billetera.`);
      return res.json({ success: true, message: 'Pago simulado correctamente' });
    }
    res.json({ success: false, message: 'Viaje no válido o ya pagado' });
  } catch (err) {
    res.status(500).json({ error: 'Error simulando pago' });
  }
});

export default router;
