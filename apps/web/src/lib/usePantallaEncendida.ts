/**
 * usePantallaEncendida.ts
 *
 * Hook que activa el Screen Wake Lock API para mantener la pantalla encendida
 * mientras el componente esté montado (conductor o pasajero activos).
 *
 * En Android APK: el FLAG_KEEP_SCREEN_ON nativo ya cubre esto a nivel hardware.
 * En Web (navegador): usa navigator.wakeLock para evitar que el sistema suspenda.
 * Ambos mecanismos trabajan en paralelo para cobertura total.
 */

import { useEffect } from 'react';

export function usePantallaEncendida(activo: boolean = true) {
  useEffect(() => {
    if (!activo) return;
    if (typeof window === 'undefined') return;

    // Screen Wake Lock API — soportada en Chrome 84+, Firefox 126+, Safari 16.4+
    // y en Capacitor WebView (Android Chromium)
    if (!('wakeLock' in navigator)) return;

    let wakeLock: WakeLockSentinel | null = null;

    async function solicitarWakeLock() {
      try {
        wakeLock = await (navigator as any).wakeLock.request('screen');
        console.log('[WakeLock] Pantalla bloqueada — no se suspenderá.');

        wakeLock.addEventListener('release', () => {
          console.log('[WakeLock] Wake lock liberado.');
        });
      } catch (err) {
        // Error silencioso — el FLAG_KEEP_SCREEN_ON nativo sigue activo en APK
        console.warn('[WakeLock] No se pudo activar:', err);
      }
    }

    // Re-adquirir el wake lock si la pantalla se apaga y vuelve
    // (el sistema libera el wake lock al ir a segundo plano)
    function manejarVisibilidad() {
      if (document.visibilityState === 'visible') {
        solicitarWakeLock();
      }
    }

    solicitarWakeLock();
    document.addEventListener('visibilitychange', manejarVisibilidad);

    return () => {
      document.removeEventListener('visibilitychange', manejarVisibilidad);
      if (wakeLock) {
        wakeLock.release().catch(() => {});
        wakeLock = null;
      }
    };
  }, [activo]);
}
