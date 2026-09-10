// ─── UTILIDADES DE GEOLOCALIZACIÓN Y TIEMPO ESTIMADO DE LLEGADA (ETA) ─────────
// Proporciona cálculo de distancias reales en calle y minutos estimados de llegada
// para que pasajeros y conductores tengan certeza cuantitativa de su encuentro.

export interface InfoLlegada {
  minutos: number;
  distanciaMetros: number;
  distanciaKm: number;
  textoTiempo: string;     // Ej: "3 min", "Menos de 1 min"
  textoDistancia: string;  // Ej: "650 m", "1.4 km"
  resumen: string;         // Ej: "Llega en ~3 min (650 m)"
  esInmediato: boolean;    // Menor a 120 metros ("Llegando ahora")
}

/**
 * Distancia en kilómetros entre dos coordenadas geográficas (Fórmula de Haversine)
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calcula el tiempo estimado de llegada (ETA) y distancia de aproximación en ruta urbana
 * Factor de tortuosidad urbana en cuadrícula chilena: 1.25
 * Velocidad promedio en ciudad considerando paradas y semáforos: 24 km/h
 */
export function calcularInfoLlegada(
  lat1?: number | null,
  lng1?: number | null,
  lat2?: number | null,
  lng2?: number | null
): InfoLlegada | null {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) {
    return null;
  }

  // 1. Distancia en línea recta
  const distLineaKm = calculateDistance(lat1, lng1, lat2, lng2);

  // 2. Factor de corrección para calle y desvíos urbanos (+25%)
  const distCalleKm = distLineaKm * 1.25;
  const distanciaMetros = Math.round(distCalleKm * 1000);

  // 3. Estimación de minutos a velocidad media de colectivo urbano (24 km/h)
  // Tiempo (horas) = distancia / velocidad -> Minutos = (dist / 24) * 60
  const minutosCalculados = (distCalleKm / 24) * 60;
  const minutos = Math.max(1, Math.round(minutosCalculados));

  const esInmediato = distanciaMetros <= 120;

  let textoTiempo = `${minutos} min`;
  if (esInmediato) {
    textoTiempo = 'Llegando ahora';
  } else if (minutos <= 1) {
    textoTiempo = '~1 min';
  } else {
    textoTiempo = `~${minutos} min`;
  }

  let textoDistancia = '';
  if (distanciaMetros < 1000) {
    textoDistancia = `${distanciaMetros} m`;
  } else {
    textoDistancia = `${(distanciaMetros / 1000).toFixed(1)} km`;
  }

  let resumen = '';
  if (esInmediato) {
    resumen = `¡Colectivo en el punto! (${textoDistancia})`;
  } else {
    resumen = `Llega en ${textoTiempo} (${textoDistancia})`;
  }

  return {
    minutos,
    distanciaMetros,
    distanciaKm: Number((distanciaMetros / 1000).toFixed(2)),
    textoTiempo,
    textoDistancia,
    resumen,
    esInmediato,
  };
}
