/**
 * geolocalizacion.ts
 * 
 * Wrapper de geolocalización multiplataforma para Fim Colectivo.
 * Usa el plugin nativo @capacitor/geolocation en Android (APK) y
 * navigator.geolocation estándar en la web.
 * 
 * Esto soluciona el problema de que navigator.geolocation falla o
 * queda en silencio en WebViews de Android Capacitor.
 */

const COORDENADAS_FALLBACK = { latitud: -33.4489, longitud: -70.6693 };

/**
 * Detecta si la app está corriendo como APK nativa de Capacitor
 */
function esNativo(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // Capacitor expone window.Capacitor cuando está activo
    const cap = (window as any).Capacitor;
    return cap && cap.isNativePlatform && cap.isNativePlatform();
  } catch {
    return false;
  }
}

export interface PosicionGeo {
  latitud: number;
  longitud: number;
}

/**
 * Obtiene la posición actual del dispositivo.
 * En Android nativo: usa @capacitor/geolocation (nativo, no WebView).
 * En web: usa navigator.geolocation estándar.
 * 
 * Siempre resuelve con una posición (usa fallback si falla).
 */
export async function obtenerPosicionActual(opciones?: {
  altaPresicion?: boolean;
  timeout?: number;
  usarFallback?: boolean;
}): Promise<PosicionGeo> {
  const altaPresicion = opciones?.altaPresicion ?? true;
  const timeout = opciones?.timeout ?? 10000;
  const usarFallback = opciones?.usarFallback ?? true;

  // --- Android nativo: plugin @capacitor/geolocation ---
  if (esNativo()) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');

      // Solicitar permisos explícitamente antes de obtener posición
      const permiso = await Geolocation.requestPermissions();
      if (permiso.location !== 'granted' && permiso.coarseLocation !== 'granted') {
        console.warn('[GPS] Permisos de geolocalización denegados en Android.');
        if (usarFallback) return COORDENADAS_FALLBACK;
        throw new Error('Permisos de GPS denegados');
      }

      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: altaPresicion,
        timeout,
      });

      return {
        latitud: pos.coords.latitude,
        longitud: pos.coords.longitude,
      };
    } catch (err) {
      console.warn('[GPS Nativo] Error al obtener posición:', err);
      if (usarFallback) return COORDENADAS_FALLBACK;
      throw err;
    }
  }

  // --- Web: navigator.geolocation estándar ---
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      resolve(usarFallback ? COORDENADAS_FALLBACK : { latitud: 0, longitud: 0 });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitud: pos.coords.latitude,
          longitud: pos.coords.longitude,
        });
      },
      (err) => {
        console.warn('[GPS Web] Error al obtener posición:', err.message);
        resolve(usarFallback ? COORDENADAS_FALLBACK : { latitud: 0, longitud: 0 });
      },
      {
        enableHighAccuracy: altaPresicion,
        timeout,
        maximumAge: 5000,
      }
    );
  });
}

/**
 * Versión con callback de watchPosition — rastreo continuo.
 * En Android nativo: usa @capacitor/geolocation watchPosition.
 * En web: usa navigator.geolocation.watchPosition estándar.
 * 
 * Retorna una función para detener el seguimiento.
 */
export async function iniciarRastreoGps(
  onPosicion: (pos: PosicionGeo) => void,
  onError?: (err: unknown) => void
): Promise<() => void> {

  // --- Android nativo ---
  if (esNativo()) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');

      // Solicitar permisos si aún no se dieron
      await Geolocation.requestPermissions().catch(() => {});

      const watchId = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 10000 },
        (position, err) => {
          if (err) {
            console.warn('[GPS Nativo Watch] Error:', err);
            if (onError) onError(err);
            return;
          }
          if (position) {
            onPosicion({
              latitud: position.coords.latitude,
              longitud: position.coords.longitude,
            });
          }
        }
      );

      // Retornar función de limpieza
      return () => {
        Geolocation.clearWatch({ id: watchId }).catch(() => {});
      };
    } catch (err) {
      console.warn('[GPS Nativo] Error al iniciar rastreo:', err);
      if (onError) onError(err);
      return () => {};
    }
  }

  // --- Web: watchPosition estándar ---
  if (typeof window === 'undefined' || !('geolocation' in navigator)) {
    return () => {};
  }

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      onPosicion({
        latitud: pos.coords.latitude,
        longitud: pos.coords.longitude,
      });
    },
    (err) => {
      console.warn('[GPS Web Watch] Error:', err);
      if (onError) onError(err);
    },
    { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
  );

  return () => {
    navigator.geolocation.clearWatch(watchId);
  };
}
