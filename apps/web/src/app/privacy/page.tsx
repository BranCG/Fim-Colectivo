'use client';

import Link from 'next/link';
import Logo from '@/components/Logo';
import { IconoGps, IconoMicrofono, IconoTarjeta, IconoAuto } from '@/components/icons/Iconos';

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A', color: '#FFFFFF', padding: '40px 20px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '850px', margin: '0 auto' }}>
        
        {/* Encabezado */}
        <div style={{ marginBottom: '36px', textAlign: 'center' }}>
          <Link href="/" style={{ display: 'inline-block', marginBottom: '20px' }}>
            <Logo width="120" height="42" />
          </Link>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              background: 'rgba(250, 204, 21, 0.15)',
              border: '1px solid rgba(250, 204, 21, 0.4)',
              borderRadius: '9999px',
              color: '#FACC15',
              fontSize: '0.8rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              marginBottom: '14px',
            }}
          >
            <IconoAuto size={15} color="#FACC15" />
            PROTECCIÓN DE DATOS • LEY N° 19.628 (CHILE)
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 2.8rem)', fontWeight: 900, margin: '0 0 10px', letterSpacing: '-0.02em', color: '#FFFFFF' }}>
            Políticas de Privacidad
          </h1>
          <p style={{ color: '#A3A3A3', fontSize: '0.95rem', margin: 0 }}>
            FIM Colectivo • Plataforma de Taxis Colectivos de Chile • Última actualización: Septiembre, 2026
          </p>
        </div>

        {/* Contenido de Privacidad */}
        <section
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            lineHeight: 1.7,
            background: '#121212',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '20px',
            padding: '36px 28px',
            boxSizing: 'border-box',
          }}
        >
          {/* Sección 1 */}
          <div>
            <h2 style={{ color: '#FACC15', fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconoAuto size={20} color="#FACC15" />
              1. Responsable del Tratamiento y Ámbito de Aplicación
            </h2>
            <p style={{ color: '#D4D4D4', fontSize: '0.95rem', margin: 0 }}>
              FIM Colectivo se compromete al resguardo ético, transparente y seguro de los datos personales de todos los conductores de taxis colectivos y pasajeros que utilizan nuestra aplicación móvil y web, en estricto apego a la <strong>Ley N° 19.628 sobre Protección de la Vida Privada</strong> de la República de Chile.
            </p>
          </div>

          {/* Sección 2 */}
          <div>
            <h2 style={{ color: '#FACC15', fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconoGps size={20} color="#FACC15" />
              2. Geolocalización en Tiempo Real y Respeto a la Privacidad
            </h2>
            <div style={{ color: '#D4D4D4', fontSize: '0.95rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ margin: 0 }}>
                <strong>Para el Conductor de Colectivo:</strong> La ubicación geográfica satelital (GPS) del móvil se transmite única y exclusivamente mientras el chofer mantenga encendido el estado <em>&quot;En Servicio&quot;</em> dentro de su línea de colectivo. En el instante exacto en que el conductor pulsa <em>&quot;Fuera de Servicio&quot;</em> o cierra la aplicación, el rastreo GPS se cancela de inmediato y el móvil desaparece del mapa público de pasajeros. <strong>FIM Colectivo jamás rastrea la posición de un conductor en sus horarios de descanso o fuera de turno.</strong>
              </p>
              <p style={{ margin: 0 }}>
                <strong>Para el Pasajero:</strong> La posición GPS del pasajero solo se solicita para ubicar su parada más cercana en el mapa y calcular el tiempo estimado de llegada (ETA) del colectivo. No se almacenan historiales de ubicación ajenos a los trayectos solicitados.
              </p>
            </div>
          </div>

          {/* Sección 3 */}
          <div>
            <h2 style={{ color: '#FACC15', fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconoMicrofono size={20} color="#FACC15" />
              3. Privacidad en Reconocimiento de Voz y Micrófono (Ley No Chat)
            </h2>
            <p style={{ color: '#D4D4D4', fontSize: '0.95rem', margin: 0 }}>
              El permiso de micrófono en la aplicación del conductor se utiliza estrictamente para el reconocimiento fonético instantáneo de comandos operativos de conducción segura (<em>&quot;SÍ&quot;</em>, <em>&quot;NO&quot;</em>, <em>&quot;A BORDO&quot;</em>), previniendo la manipulación física del celular al volante según lo estipula la <strong>Ley 21.377</strong>.
              <strong> FIM Colectivo no graba, no almacena audios, no transcribe conversaciones privadas ni realiza escuchas pasivas en el habitáculo del vehículo.</strong>
            </p>
          </div>

          {/* Sección 4 */}
          <div>
            <h2 style={{ color: '#FACC15', fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconoTarjeta size={20} color="#FACC15" />
              4. Datos de Cobro, RutPay y Canales de Pago
            </h2>
            <p style={{ color: '#D4D4D4', fontSize: '0.95rem', margin: 0 }}>
              Para facilitar el pago sin efectivo, el conductor puede registrar voluntariamente su número de teléfono asociado a <strong>RutPay BancoEstado</strong> o su enlace de MercadoPago. Esta información solo se exhibe de manera temporal al pasajero con reserva activa para que efectúe la transferencia directa del valor del pasaje al chofer. FIM Colectivo <strong>no almacena números de tarjeta de crédito, claves secretas ni coordenadas bancarias</strong>.
            </p>
          </div>

          {/* Sección 5 */}
          <div>
            <h2 style={{ color: '#FACC15', fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px' }}>
              5. Confidencialidad y No Comercialización de Datos
            </h2>
            <p style={{ color: '#D4D4D4', fontSize: '0.95rem', margin: 0 }}>
              FIM Colectivo <strong>no vende, no alquila ni comercializa</strong> los datos personales o registros de viaje de conductores o pasajeros a empresas de publicidad ni a intermediarios comerciales de ningún tipo. La información se utiliza con el único propósito de coordinar el servicio de transporte en la línea seleccionada.
            </p>
          </div>

          {/* Sección 6 */}
          <div>
            <h2 style={{ color: '#FACC15', fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px' }}>
              6. Derechos de los Titulares y Supresión de Cuenta
            </h2>
            <p style={{ color: '#D4D4D4', fontSize: '0.95rem', margin: 0 }}>
              Todo usuario tiene el derecho de consultar, rectificar o solicitar la eliminación total y definitiva de su cuenta y registros personales en cualquier momento a través del soporte oficial de FIM Colectivo.
            </p>
          </div>
        </section>

        {/* Botón de Regreso */}
        <div style={{ marginTop: '40px', textAlign: 'center' }}>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 28px',
              borderRadius: '10px',
              background: '#171717',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#FFFFFF',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '0.95rem',
            }}
          >
            ← Volver a FIM Colectivo
          </Link>
        </div>
      </div>
    </div>
  );
}
