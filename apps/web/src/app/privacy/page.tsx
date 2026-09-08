import Link from 'next/link';
import Logo from '@/components/Logo';

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '40px 24px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <Logo />
          <h1 style={{ marginTop: '24px', fontSize: '2.5rem', fontWeight: 900 }}>Políticas de Privacidad</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Última actualización: 14 de Mayo, 2026</p>
        </div>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '32px', lineHeight: 1.7 }}>
          <div>
            <h2 style={{ color: 'var(--accent)', marginBottom: '12px' }}>1. Recolección de Datos</h2>
            <p>
              En Fim recolectamos datos necesarios para la operación del servicio: nombre, teléfono, ubicación GPS en tiempo real (solo durante el viaje o modo online), y documentos de identidad/conducción para verificación de seguridad.
            </p>
          </div>

          <div>
            <h2 style={{ color: 'var(--accent)', marginBottom: '12px' }}>2. Uso de la Ubicación</h2>
            <p>
              La ubicación del conductor se comparte con el pasajero asignado solo para facilitar el encuentro y durante el transcurso del viaje. <strong>Fim no rastrea la ubicación del usuario cuando la aplicación está cerrada o en modo offline.</strong>
            </p>
          </div>

          <div>
            <h2 style={{ color: 'var(--accent)', marginBottom: '12px' }}>3. Datos de Pago</h2>
            <p>
              Fim no almacena números de tarjeta de crédito completos. Las transacciones se procesan de forma segura a través de socios como Mercado Pago. Los conductores solo proporcionan su email o link de cobro para recibir fondos directamente.
            </p>
          </div>

          <div>
            <h2 style={{ color: 'var(--accent)', marginBottom: '12px' }}>4. Compartición de Datos</h2>
            <p>
              No vendemos ni compartimos tus datos personales con terceros para fines publicitarios. Los datos solo se comparten entre pasajero y conductor para la prestación del servicio solicitado.
            </p>
          </div>

          <div>
            <h2 style={{ color: 'var(--accent)', marginBottom: '12px' }}>5. Derechos del Usuario</h2>
            <p>
              Tienes derecho a solicitar la eliminación de tu cuenta y tus datos en cualquier momento a través del soporte oficial de la aplicación.
            </p>
          </div>
        </section>

        <div style={{ marginTop: '60px', textAlign: 'center' }}>
          <Link href="/" className="btn btn-primary">Volver al Inicio</Link>
        </div>
      </div>
    </div>
  );
}
