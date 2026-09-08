import Link from 'next/link';
import Logo from '@/components/Logo';

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '40px 24px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <Logo />
          <h1 style={{ marginTop: '24px', fontSize: '2.5rem', fontWeight: 900 }}>Términos y Condiciones</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>Última actualización: 18 de Mayo, 2026</p>
        </div>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '32px', lineHeight: 1.7 }}>
          <div>
            <h2 style={{ color: 'var(--accent)', marginBottom: '12px' }}>1. Naturaleza del Servicio y Rol Colaborativo</h2>
            <p>
              Fim es una plataforma tecnológica de tipo SaaS (Software como Servicio) diseñada para conectar de manera segura y eficiente a conductores independientes y pasajeros. 
              Si bien Fim actúa como un intermediario y facilitador tecnológico y no como una empresa de transporte directo con flota propia, asumimos con total seriedad y responsabilidad nuestro rol en la comunidad. Nos comprometemos a promover las mejores prácticas viales, asegurar un entorno de respeto y brindar el soporte tecnológico necesario para resguardar el bienestar de todos los usuarios en cada trayecto.
            </p>
          </div>

          <div>
            <h2 style={{ color: 'var(--accent)', marginBottom: '12px' }}>2. Pagos, Transparencia y Cumplimiento Tributario</h2>
            <p>
              Fim opera bajo un modelo disruptivo de 0% de comisión por viaje, asegurando que el 100% del valor del viaje sea percibido directamente por el conductor independiente. Los pagos se procesan de forma inmediata a las cuentas de los conductores (a través de efectivo físico o pasarelas digitales seguras como Mercado Pago). Fim solo percibe ingresos mediante suscripciones fijas de membresía de acceso. 
              Para garantizar la formalidad y transparencia del servicio ante la legislación chilena, orientamos activamente a nuestros conductores colaboradores en sus obligaciones tributarias de emisión de boletas de honorarios o documentos fiscales pertinentes, apoyando el correcto cumplimiento de las normas del Servicio de Impuestos Internos (SII).
            </p>
          </div>

          <div>
            <h2 style={{ color: 'var(--accent)', marginBottom: '12px' }}>3. Resguardo Legal y Estándares de Calidad</h2>
            <p>
              Con el propósito de brindar viajes cómodos y confiables, todos los conductores registrados en Fim se comprometen a mantener los más altos estándares de calidad y seguridad vial exigidos por el Ministerio de Transportes y Telecomunicaciones de Chile. Esto incluye poseer una licencia de conducir profesional idónea, revisión técnica al día, seguros obligatorios del vehículo (SOAP) y mantener las condiciones técnicas y estéticas del móvil en óptimo estado de funcionamiento.
            </p>
          </div>

          <div>
            <h2 style={{ color: 'var(--accent)', marginBottom: '12px' }}>4. Nuestro Compromiso Activo con la Seguridad e Integridad</h2>
            <p style={{ marginBottom: '12px' }}>
              En <strong>Fim</strong>, la seguridad, dignidad e integridad de cada persona —tanto pasajeros como conductores— es nuestra prioridad absoluta. No toleramos bajo ninguna circunstancia actos de acoso, discriminación (por género, orientación sexual, raza, nacionalidad, religión o cualquier otra condición), violencia física, verbal o psicológica, ni ninguna conducta que ponga en riesgo la seguridad de quienes usan nuestra aplicación.
            </p>
            <p style={{ marginBottom: '12px' }}>
              Nos comprometemos a actuar de manera empática, justa y proactiva ante cualquier reporte que atente contra las personas. Para ello, aplicamos los siguientes resguardos de seguridad activa:
            </p>
            <ul style={{ paddingLeft: '20px', margin: '12px 0', display: 'flex', flexDirection: 'column', gap: '10px', listStyleType: 'disc' }}>
              <li>
                <strong>Monitoreo y Alertas de Emergencia:</strong> Ofrecemos herramientas de soporte y reportes de seguridad en tiempo real directamente en la aplicación para atender de forma inmediata y prioritaria cualquier incidente durante los viajes.
              </li>
              <li>
                <strong>Investigación Inmediata y Bloqueo:</strong> Al recibir un reporte que comprometa la integridad de un usuario, Fim activará un protocolo de revisión interno. De forma preventiva, la cuenta reportada podrá ser suspendida de inmediato, procediendo al bloqueo permanente si se comprueba una infracción de gravedad.
              </li>
              <li>
                <strong>Colaboración Total con la Justicia:</strong> Ante delitos graves o situaciones de violencia física, Fim colaborará activamente y de manera transparente con Carabineros de Chile, la Policía de Investigaciones (PDI) y el Ministerio Público, entregando toda la información de posicionamiento GPS, datos de cuentas y registros del viaje que sean requeridos legalmente para ayudar en las investigaciones.
              </li>
              <li>
                <strong>Acompañamiento y Apoyo Humano:</strong> Nos comprometemos a no dejar solas a las víctimas. Ante un incidente, nuestro equipo de soporte brindará acompañamiento y la orientación correspondiente para canalizar las denuncias en los organismos policiales y judiciales pertinentes.
              </li>
            </ul>
          </div>

          <div>
            <h2 style={{ color: 'var(--accent)', marginBottom: '12px' }}>5. Uso de la Plataforma e Innovación Tecnológica</h2>
            <p>
              El uso de la aplicación Fim es de carácter personal, intransferible y seguro. Continuamos invirtiendo recursos en el desarrollo de nuevas capas de cifrado, filtros automáticos de seguridad y algoritmos predictivos para asegurar la privacidad de los datos personales y garantizar trayectos cada vez más tranquilos, transparentes y confiables para toda la comunidad.
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
