import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import api from './api';

/**
 * Hook para inicializar y gestionar el token FCM de notificaciones push
 * Tanto en Capacitor (Android APK) como preparar listeners para background/foreground.
 */
export function useFcmToken() {
  useEffect(() => {
    let isMounted = true;

    async function initPush() {
      // Notificaciones nativas vía Capacitor en Android
      if (Capacitor.isNativePlatform()) {
        try {
          // 1. Crear canal de alta prioridad en Android
          try {
            await PushNotifications.createChannel({
              id: 'fim_colectivo_alerts',
              name: 'Alertas Fim Colectivo',
              description: 'Notificaciones de solicitudes y reservas de colectivos',
              importance: 5, // IMPORTANCE_HIGH
              visibility: 1, // VISIBILITY_PUBLIC
              vibration: true,
              sound: 'default',
            });
          } catch (channelErr) {
            console.warn('[FCM] No se pudo crear canal (puede ya existir):', channelErr);
          }

          // 2. Verificar o solicitar permisos
          let permStatus = await PushNotifications.checkPermissions();
          if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
          }

          if (permStatus.receive !== 'granted') {
            console.warn('[FCM] Permiso de notificaciones denegado por el usuario.');
            return;
          }

          // 3. Registrar el dispositivo con FCM
          await PushNotifications.register();

          // 4. Listener para recibir el token FCM asignado
          await PushNotifications.addListener('registration', async (token) => {
            if (!isMounted) return;
            console.log('[FCM] Token de dispositivo obtenido:', token.value);
            try {
              await api.post('/fcm/token', { token: token.value });
              console.log('[FCM] Token sincronizado exitosamente con el backend.');
            } catch (apiErr) {
              console.error('[FCM] Error sincronizando token con backend:', apiErr);
            }
          });

          // 5. Listener para error en el registro
          await PushNotifications.addListener('registrationError', (err) => {
            console.warn('[FCM] Error en registro de notificaciones push:', err);
          });

          // 6. Listener cuando llega una notificación con la app en primer plano (foreground)
          await PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('[FCM] Notificación recibida en primer plano:', notification);
          });

          // 7. Listener cuando el usuario toca la notificación
          await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
            console.log('[FCM] Notificación pulsada por el usuario:', action);
          });

        } catch (error) {
          console.error('[FCM] Error inicializando PushNotifications:', error);
        }
      }
    }

    initPush();

    return () => {
      isMounted = false;
      if (Capacitor.isNativePlatform()) {
        try {
          PushNotifications.removeAllListeners();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, []);
}
