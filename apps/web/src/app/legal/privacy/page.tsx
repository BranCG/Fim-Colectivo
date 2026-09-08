import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '40px 24px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <Link href="/" style={{ color: 'var(--accent)', textDecoration: 'none', marginBottom: '24px', display: 'inline-block' }}>← Volver al inicio</Link>
        <h1 style={{ fontSize: '2rem', marginBottom: '32px' }}>Política de Privacidad</h1>
        
        <div style={{ color: 'var(--text-secondary)', lineHeight: '1.8', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '8px' }}>1. Protección y Manejo de tus Datos</h2>
            <p>Tus datos están seguros con nosotros. Toda la información personal, documentos de identidad y registros de ubicación se manejan y almacenan bajo estrictos estándares de seguridad de la información (basados en normativas ISO/IEC 27001) y en total cumplimiento con la Ley sobre Protección de la Vida Privada vigente en Chile.</p>
          </div>

          <div>
            <h2 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '8px' }}>2. Uso de la Información</h2>
            <p>Utilizamos tus datos exclusivamente para validar tu identidad, garantizar la seguridad de la comunidad y mejorar el servicio de la plataforma. Como indicamos en nuestros términos, tu información personal y documentos de identidad solo serán compartidos con terceros en caso de un requerimiento legal o judicial oficial por parte de las autoridades competentes.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
