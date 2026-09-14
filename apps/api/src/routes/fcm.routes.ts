/**
 * fcm.routes.ts — Endpoint para registrar/actualizar el token FCM del dispositivo
 *
 * El frontend llama a POST /api/fcm/token cada vez que abre la app
 * para mantener el token actualizado en la base de datos.
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import prisma from '../utils/prisma';

const router = Router();

/**
 * POST /api/fcm/token
 * Body: { token: string }
 * Header: Authorization: Bearer <jwt>
 *
 * Guarda o actualiza el FCM token del usuario/conductor autenticado.
 */
router.post('/token', requireAuth, async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    const usuario = (req as any).user;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token FCM requerido.' });
    }

    if (usuario.role === 'driver') {
      await prisma.driver.update({
        where: { id: usuario.id },
        data: { fcmToken: token },
      });
    } else {
      await prisma.user.update({
        where: { id: usuario.id },
        data: { fcmToken: token },
      });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('[FCM Route] Error al guardar token:', error);
    return res.status(500).json({ error: 'Error interno al guardar token FCM.' });
  }
});

export default router;
