// ─── Tarifas Fim (más baratas que Uber Chile ~15-20%) ────────────────────
export const FIM_PRICING = {
  baseFare: 900,          // CLP - tarifa base
  perKm: 410,             // CLP por kilómetro
  perMinute: 80,          // CLP por minuto
  bookingFee: 0,          // CLP - SIN cargo por reserva (diferenciador!)
  minimumFare: 2500,      // CLP mínimo
  membershipFee: 100000,  // CLP membresía conductor (mensual, se renueva cada 30 días)
};

// Función de cálculo de precio
export function calculateTripPrice(distanceKm: number, durationMin: number): number {
  const raw =
    FIM_PRICING.baseFare +
    FIM_PRICING.bookingFee +
    distanceKm * FIM_PRICING.perKm +
    durationMin * FIM_PRICING.perMinute;

  return Math.max(FIM_PRICING.minimumFare, Math.round(raw));
}

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

// Formatear precio en CLP
export function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount);
}
