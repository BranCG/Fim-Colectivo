'use client';

import Link from 'next/link';
import Logo from '@/components/Logo';
import { IconoColectivo, IconoMicrofono, IconoAsiento, IconoTarjeta, IconoAuto } from '@/components/icons/Iconos';

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#09090F', color: '#F8FAFC', padding: '40px 20px', boxSizing: 'border-box' }}>
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
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '9999px',
              color: '#FBBF24',
              fontSize: '0.8rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              marginBottom: '14px',
            }}
          >
            <IconoAuto size={15} color="#FBBF24" />
            REGULACIÓN TRANSPORTE PÚBLICO CHILENO
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 2.8rem)', fontWeight: 900, margin: '0 0 10px', letterSpacing: '-0.02em' }}>
            Términos y Condiciones del Servicio
          </h1>
          <p style={{ color: '#94A3B8', fontSize: '0.95rem', margin: 0 }}>
            Plataforma Tecnológica FIM Colectivo • Última actualización: Septiembre, 2026
          </p>
        </div>

        {/* Contenido Legal y Operativo de Colectivos */}
        <section
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            lineHeight: 1.7,
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            padding: '36px 28px',
            boxSizing: 'border-box',
          }}
        >
          {/* Cláusula 1 */}
          <div>
            <h2 style={{ color: '#F59E0B', fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconoColectivo size={20} color="#F59E0B" />
              1. Naturaleza del Servicio y Objeto de FIM Colectivo
            </h2>
            <p style={{ color: '#CBD5E1', fontSize: '0.95rem', margin: 0 }}>
              FIM Colectivo es una plataforma tecnológica de software como servicio (SaaS) desarrollada para optimizar, coordinar y digitalizar la operación de <strong>Taxis Colectivos de Chile</strong>, regulados por el Ministerio de Transportes y Telecomunicaciones (MTT).
              FIM Colectivo no es una empresa de transporte privado individual ni compite con servicios tipo Uber o aplicaciones de arriendo particular; actúa como un facilitador de información en tiempo real, geolocalización satelital y reserva de asientos en ruta para líneas autorizadas inscritas en el Registro Nacional de Servicios de Transporte de Pasajeros.
            </p>
          </div>

          {/* Cláusula 2 */}
          <div>
            <h2 style={{ color: '#F59E0B', fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconoAuto size={20} color="#F59E0B" />
              2. Líneas Autorizadas, Trazados Oficiales y Paradas
            </h2>
            <p style={{ color: '#CBD5E1', fontSize: '0.95rem', margin: 0 }}>
              Los servicios se prestan rigurosamente a lo largo de los trazados oficiales autorizados para cada línea de colectivos, respetando los sentidos de <strong>Ida</strong> y <strong>Vuelta</strong>. Los pasajeros pueden solicitar y reservar asientos en cualquier parada formal o punto de subida habilitado dentro del recorrido del móvil. El conductor no realizará desvíos fuera de la cartola oficial de su línea.
            </p>
          </div>

          {/* Cláusula 3 */}
          <div>
            <h2 style={{ color: '#F59E0B', fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconoAsiento size={20} color="#F59E0B" />
              3. Capacidad Reglamentaria de 4 Asientos y Gestión de Cupos
            </h2>
            <p style={{ color: '#CBD5E1', fontSize: '0.95rem', margin: 0 }}>
              Conforme al Decreto Supremo N° 212 del MTT, los taxis colectivos operan con un cupo máximo reglamentario de <strong>4 asientos para pasajeros</strong>. La aplicación proporciona un panel de control y visualización de asientos en tiempo real mediante tres estados:
            </p>
            <ul style={{ paddingLeft: '20px', margin: '10px 0 0', color: '#94A3B8', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li><strong style={{ color: '#10B981' }}>Asiento Libre (Verde):</strong> Disponible para ser reservado en la aplicación o tomado por pasajeros en la vía pública.</li>
              <li><strong style={{ color: '#F59E0B' }}>Asiento Reservado (Naranjo):</strong> Solicitud confirmada de un pasajero que espera el móvil en una parada cercana.</li>
              <li><strong style={{ color: '#EF4444' }}>Asiento A Bordo (Rojo):</strong> Pasajero que ya abordó el vehículo y viaja hacia su destino.</li>
            </ul>
          </div>

          {/* Cláusula 4 */}
          <div>
            <h2 style={{ color: '#F59E0B', fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconoTarjeta size={20} color="#F59E0B" />
              4. Tarifas Oficiales y Medios de Pago Directos
            </h2>
            <p style={{ color: '#CBD5E1', fontSize: '0.95rem', margin: 0 }}>
              La tarifa a pagar corresponde íntegramente a la tarifa oficial y regulada fijada por la línea de colectivos para el respectivo tramo (diurno, nocturno o festivo). FIM Colectivo <strong>no cobra comisiones por pasaje ni aplica tarifas dinámicas</strong> al valor de la carrera.
              El pasajero puede pagar con dinero en efectivo físico exacto al momento de abordar o realizar un pago electrónico directo mediante transferencia a la CuentaRUT del conductor a través de <strong>RutPay BancoEstado</strong> o pasarelas habilitadas (MercadoPago), sin intermediarios ni retenciones semanales.
            </p>
          </div>

          {/* Cláusula 5 */}
          <div>
            <h2 style={{ color: '#F59E0B', fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconoMicrofono size={20} color="#F59E0B" />
              5. Cumplimiento Estricto de la Ley No Chat (Ley 21.377)
            </h2>
            <p style={{ color: '#CBD5E1', fontSize: '0.95rem', margin: 0 }}>
              FIM Colectivo está construida bajo los más rigurosos estándares de seguridad vial. En cumplimiento de la <strong>Ley 21.377 (Ley No Chat)</strong>, que prohíbe manipular dispositivos telefónicos o desviar la atención mientras se conduce, la aplicación cuenta con un motor auditivo neuronal que reproduce por voz las solicitudes de los pasajeros (<em>&quot;Reserva de Juan, 1 asiento, a 2 min. ¿Tomamos?&quot;</em>) y permite al chofer confirmar exclusivamente con su voz diciendo <em>&quot;SÍ&quot;</em> o <em>&quot;DALE&quot;</em> sin tocar la pantalla en ningún momento.
            </p>
          </div>

          {/* Cláusula 6 */}
          <div>
            <h2 style={{ color: '#F59E0B', fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px' }}>
              6. Convivencia, Seguridad y Respeto Mutuo
            </h2>
            <p style={{ color: '#CBD5E1', fontSize: '0.95rem', margin: 0 }}>
              Es deber de todos los integrantes de la comunidad FIM Colectivo mantener un trato digno, respetuoso y cordial. No se tolera ningún tipo de agresión física o verbal, acoso, ni actos discriminatorios fundados en género, raza, orientación sexual, nacionalidad o condición social. La transgresión de estas normas implicará la suspensión inmediata y definitiva de la cuenta en la plataforma.
            </p>
          </div>

          {/* Cláusula 7 */}
          <div>
            <h2 style={{ color: '#F59E0B', fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px' }}>
              7. Objetos Olvidados y Asistencia
            </h2>
            <p style={{ color: '#CBD5E1', fontSize: '0.95rem', margin: 0 }}>
              En caso de que un pasajero olvide pertenencias personales dentro de un colectivo, FIM Colectivo facilitará los canales de comunicación y trazabilidad del viaje entre el pasajero y el conductor o la administración de la línea para gestionar su devolución en la garita o terminal oficial.
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
              background: '#1E293B',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#F8FAFC',
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
