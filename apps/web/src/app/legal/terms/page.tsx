import Link from 'next/link';

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '40px 24px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <Link href="/" style={{ color: 'var(--accent)', textDecoration: 'none', marginBottom: '24px', display: 'inline-block' }}>← Volver al inicio</Link>
        <h1 style={{ fontSize: '2rem', marginBottom: '32px' }}>Términos y Condiciones</h1>
        
        <div style={{ color: 'var(--text-secondary)', lineHeight: '1.8', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '8px' }}>1. El Rol de Fim y Límite de Responsabilidades</h2>
            <p>En Fim trabajamos día a día para conectar a personas que necesitan moverse con conductores dispuestos a llevarlos. Es importante aclarar que nuestra plataforma actúa únicamente como un intermediario tecnológico. Por ello, con el mayor de los respetos, te informamos que <strong>ni Fim ni el conductor asociado pueden hacerse responsables por la pérdida, daño u olvido de objetos personales</strong> dentro del vehículo. De igual manera, Fim no se hace responsable por daños, accidentes o robo de los automóviles de nuestros conductores asociados.</p>
          </div>

          <div>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '8px' }}>2. Seguridad y Convivencia en el Viaje</h2>
            <p>Queremos que cada viaje sea una experiencia grata.</p>
            <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
              <li style={{ marginBottom: '8px' }}><strong>Para el Conductor:</strong> Es tu absoluta responsabilidad conducir respetando las leyes de tránsito vigentes, portar una licencia válida y velar en todo momento por la seguridad e integridad física del pasajero.</li>
              <li><strong>Para el Pasajero:</strong> Te pedimos encarecidamente mantener un comportamiento respetuoso y velar también por la seguridad del conductor durante todo el trayecto.</li>
            </ul>
          </div>

          <div>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '8px' }}>3. Cero Tolerancia a la Discriminación y Violencia</h2>
            <p>En la comunidad Fim no hay espacio para el odio. Estamos estrictamente en contra de cualquier tipo de maltrato físico o psicológico, así como de la discriminación por motivos de etnia, género, religión, nacionalidad o cualquier otra condición. Romper esta regla significa la expulsión inmediata de la plataforma.</p>
          </div>

          <div>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '8px' }}>4. Pagos y Liquidaciones (Modelo SaaS)</h2>
            <ul style={{ paddingLeft: '20px', marginTop: '8px' }}>
              <li style={{ marginBottom: '8px' }}><strong>Membresía:</strong> El uso de Fim por parte de conductores independientes requiere el pago de una membresía (Plan Prepago o Progresivo). El incumplimiento en el pago resultará en la suspensión del acceso.</li>
              <li style={{ marginBottom: '8px' }}><strong>Cobro Directo e Inmediato:</strong> Fim NO es un recaudador ni intermediario financiero. El 100% de los ingresos por viajes pertenece al conductor y se recibe directamente en su cuenta de Mercado Pago o en efectivo en tiempo real. No existen cortes semanales ni retenciones por parte de Fim.</li>
              <li><strong>Pasajeros:</strong> Es responsabilidad del pasajero contar con los fondos necesarios. Los pagos se realizan directamente al conductor a través de los medios habilitados. Fim no asume deudas de pasajeros ni garantiza el pago, actuando únicamente como facilitador de la conexión.</li>
            </ul>
          </div>

          <div>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '8px' }}>5. Cooperación con las Autoridades</h2>
            <p>Tu seguridad es lo más importante. En caso de vulneración a nuestros términos de seguridad, accidente o acto delictivo, Fim se compromete firmemente a cooperar con la justicia. Entregaremos toda la información necesaria, registros de viaje y documentos personales a las autoridades pertinentes para apoyar a las víctimas y seguir el proceso judicial correspondiente.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
