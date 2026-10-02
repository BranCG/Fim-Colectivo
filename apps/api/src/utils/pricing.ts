// Estimación de duración en minutos (avg speed 25 km/h en Santiago)
export function estimateDuration(distanceKm: number): number {
  const avgSpeedKmh = 25;
  return Math.ceil((distanceKm / avgSpeedKmh) * 60);
}

// Distancia en km entre dos coordenadas (Haversine formula)
export function calculateDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // Radio tierra en km
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
