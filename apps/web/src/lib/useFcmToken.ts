import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import api from './api';

/**
 * Envía el token FCM almacenado localmente al backend si hay sesión activa
 */
export async function syncFcmTokenWithBackend() {
  if (typeof window === 'undefined') return;
  const fcmToken = localStorage.getItem('fim_fcm_token');
  const sessionToken = localStorage.getItem('fim_colectivo_token');

  if (fcmToken && sessionToken) {
    try {
      await api.post('/fcm/token', { token: fcmToken });
      console.log('[FCM] Token de dispositivo sincronizado con el backend.');
    } catch (err) {
      console.error('[FCM] Error sincronizando token con backend:', err);
    }
  }
}

/**
 * Hook para inicializar y gestionar notificaciones push en Android (Capacitor)
 */
export function useFcmToken() {
  useEffect(() => {
    let isMounted = true;

    async function initPush() {
      if (!Capacitor.isNativePlatform()) {
        return;
      }

      try {
        // 1. Crear canal de notificación de alta prioridad
        try {
          await PushNotifications.createChannel({
            id: 'fim_colectivo_alerts',
            name: 'Alertas Fim Colectivo',
            description: 'Notificaciones prioritarias de solicitudes y reservas de colectivos',
            importance: 5, // IMPORTANCE_HIGH (suena y muestra banner emergente)
            visibility: 1, // VISIBILITY_PUBLIC
            vibration: true,
            sound: 'default',
          });
        } catch (channelErr) {
          console.warn('[FCM] Canal ya configurado o advertencia:', channelErr);
        }

        // 2. Limpiar listeners previos y registrar nuevos ANTES de PushNotifications.register()
        try {
          await PushNotifications.removeAllListeners();
        } catch {
          // ignore
        }

        await PushNotifications.addListener('registration', async (token) => {
          if (!isMounted) return;
          console.log('[FCM] Token obtenido de Firebase:', token.value);
          localStorage.setItem('fim_fcm_token', token.value);
          await syncFcmTokenWithBackend();
        });

        await PushNotifications.addListener('registrationError', (err) => {
          console.warn('[FCM] Error registrando con Firebase FCM:', err);
        });

        await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('[FCM] Notificación recibida en primer plano:', notification);
        });

        await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          console.log('[FCM] Notificación pulsada por usuario:', action);
        });

        // 3. Solicitar permisos de notificación
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive !== 'granted') {
          permStatus = await PushNotifications.requestPermissions();
        }

        // 4. Registrar el dispositivo para obtener el token
        await PushNotifications.register();

        // 5. Intentar sincronización si ya existía un token guardado previamente
        await syncFcmTokenWithBackend();

      } catch (error) {
        console.error('[FCM] Error en inicialización de notificaciones push:', error);
      }
    }

    initPush();

    return () => {
      isMounted = false;
    };
  }, []);
}
