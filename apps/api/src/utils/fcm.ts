/**
 * fcm.ts — Servicio Firebase Cloud Messaging para Fim Colectivo
 *
 * Inicializa firebase-admin y expone funciones para enviar notificaciones push
 * a conductores y pasajeros cuando la app está en background o cerrada.
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import prisma from './prisma';

import fs from 'fs';
import path from 'path';

// Inicializar firebase-admin una sola vez (singleton)
if (!getApps().length) {
  const possiblePaths = [
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    path.join(process.cwd(), 'firebase-service-account.json'),
    path.join(process.cwd(), 'serviceAccountKey.json'),
    path.join(__dirname, '../../firebase-service-account.json'),
    path.join(__dirname, '../../serviceAccountKey.json'),
  ].filter(Boolean) as string[];

  let foundPath = possiblePaths.find((p) => fs.existsSync(p));

  if (!foundPath) {
    const searchDirs = [
      process.cwd(),
      path.join(process.cwd(), 'apps/api'),
      path.join(__dirname, '../../'),
      path.join(__dirname, '../'),
    ];
    for (const dir of searchDirs) {
      if (fs.existsSync(dir)) {
        const candidate = fs.readdirSync(dir).find((f) => f.includes('firebase-adminsdk') && f.endsWith('.json'));
        if (candidate) {
          foundPath = path.join(dir, candidate);
          break;
        }
      }
    }
  }

  if (foundPath) {
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(foundPath, 'utf8'));
      initializeApp({
        credential: cert(serviceAccount),
      });
      console.log(`[FCM] Firebase Admin inicializado desde archivo: ${foundPath}`);
    } catch (e) {
      console.error('[FCM] Error al cargar archivo de credenciales de Firebase:', e);
    }
  } else {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && privateKey) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      });
      console.log('[FCM] Firebase Admin inicializado correctamente desde variables de entorno.');
    } else {
      console.warn('[FCM] Variables de entorno de Firebase o archivo firebase-service-account.json no configurados. Las notificaciones push estarán desactivadas.');
    }
  }
}

/**
 * Envía una notificación push a un token FCM específico.
 * Retorna true si fue exitoso, false si el token es inválido o hay error.
 */
export async function enviarNotificacion(
  fcmToken: string,
  titulo: string,
  cuerpo: string,
  datos?: Record<string, string>
): Promise<boolean> {
  if (!getApps().length || !fcmToken) return false;

  try {
    await getMessaging().send({
      token: fcmToken,
      notification: {
        title: titulo,
        body: cuerpo,
      },
      data: datos || {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'fim_colectivo_alerts',
          priority: 'max',
          defaultSound: true,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    });
    return true;
  } catch (error: any) {
    if (
      error?.errorInfo?.code === 'messaging/invalid-registration-token' ||
      error?.errorInfo?.code === 'messaging/registration-token-not-registered'
    ) {
      console.warn('[FCM] Token inválido/expirado:', fcmToken.slice(0, 20) + '...');
    } else {
      console.error('[FCM] Error enviando notificación:', error?.errorInfo?.code || error?.message);
    }
    return false;
  }
}

/**
 * Notifica a un conductor específico buscando su fcmToken en la DB.
 */
export async function notificarConductor(
  conductorId: string,
  titulo: string,
  cuerpo: string,
  datos?: Record<string, string>
): Promise<void> {
  try {
    const conductor = await prisma.driver.findUnique({
      where: { id: conductorId },
      select: { fcmToken: true },
    });
    if (conductor?.fcmToken) {
      await enviarNotificacion(conductor.fcmToken, titulo, cuerpo, datos);
    }
  } catch (err) {
    console.error('[FCM] Error al notificar conductor:', err);
  }
}

/**
 * Notifica a un pasajero específico buscando su fcmToken en la DB.
 */
export async function notificarPasajero(
  pasajeroId: string,
  titulo: string,
  cuerpo: string,
  datos?: Record<string, string>
): Promise<void> {
  try {
    const pasajero = await prisma.user.findUnique({
      where: { id: pasajeroId },
      select: { fcmToken: true },
    });
    if (pasajero?.fcmToken) {
      await enviarNotificacion(pasajero.fcmToken, titulo, cuerpo, datos);
    }
  } catch (err) {
    console.error('[FCM] Error al notificar pasajero:', err);
  }
}
