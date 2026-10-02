// Compatibilidad con columnas históricas mientras se planifica su retiro de la BD.
// Ninguna respuesta o evento debe exponer importes o datos bancarios. metodoPago es solo la opción comunicada al conductor.
const legacyFields = new Set([
  'tarifa', 'tarifaNoche', 'telefonoRutPay', 'mercadoPagoLink',
  'estimatedPrice', 'finalPrice', 'isDiscounted', 'paymentMethod', 'isPaid',
  'paymentStatus', 'mpPaymentId', 'mpCardToken', 'mpSubscriptionId',
  'membershipPaid', 'membershipPlan', 'membershipProgress', 'membershipGoal',
  'membershipDate', 'membershipExpiresAt', 'dailyCashTripsCount',
  'walletBalance', 'bankName', 'bankAccountType', 'bankAccountNumber',
  'bankAccountName', 'bankAccountRut', 'bankAccountEmail',
]);

export function withoutPaymentData<T>(value: T): T {
  if (Array.isArray(value)) return value.map(withoutPaymentData) as T;
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).filter(([key]) => !legacyFields.has(key))
        .map(([key, item]) => [key, withoutPaymentData(item)]),
    ) as T;
  }
  return value;
}
