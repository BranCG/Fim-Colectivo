'use client';

import { useState } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import {
  IconoColectivo,
  IconoAsiento,
  IconoPasajero,
  IconoReloj,
  IconoMicrofono,
  IconoAuto,
  IconoTarjeta,
} from '@/components/icons/Iconos';

export default function Home() {
  const [rolActivo, setRolActivo] = useState<'pasajero' | 'conductor'>('pasajero');
  const [faqAbierta, setFaqAbierta] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setFaqAbierta(faqAbierta === index ? null : index);
  };

  return (
    <main style={{ minHeight: '100vh', background: '#09090F', color: '#F8FAFC', overflowX: 'hidden' }}>
      
      {/* ─── CINTILLO INSTITUCIONAL SUPERIOR ─── */}
      <div
        style={{
          background: 'linear-gradient(90deg, #D97706 0%, #F59E0B 50%, #B45309 100%)',
          color: '#111827',
          textAlign: 'center',
          padding: '8px 16px',
          fontSize: '0.8rem',
          fontWeight: 800,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          zIndex: 101,
          position: 'relative',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <IconoAuto size={15} color="#111827" />
          SISTEMA OFICIAL DE TAXIS COLECTIVOS DE CHILE
        </span>
        <span style={{ opacity: 0.6 }}>•</span>
        <span>CONDUCCIÓN MANOS LIBRES LEY 21.377 (NO CHAT)</span>
      </div>

      {/* ─── NAVBAR ELEGANTE ─── */}
      <nav
        style={{
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(16px)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(9, 9, 15, 0.85)',
          maxWidth: '100vw',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Logo width="110" height="38" />
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/login"
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#F8FAFC',
              fontSize: '0.85rem',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'all 0.2s ease',
              background: 'rgba(255, 255, 255, 0.03)',
            }}
          >
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              color: '#0F172A',
              fontSize: '0.85rem',
              fontWeight: 800,
              textDecoration: 'none',
              boxShadow: '0 2px 10px rgba(245, 158, 11, 0.25)',
            }}
          >
            Registrarse
          </Link>
        </div>
      </nav>

      {/* ─── HERO PRINCIPAL ─── */}
      <section
        style={{
          position: 'relative',
          padding: '50px 20px 40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          maxWidth: '1000px',
          margin: '0 auto',
        }}
      >
        {/* Luces de fondo decorativas */}
        <div
          style={{
            position: 'absolute',
            top: '-60px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(90vw, 650px)',
            height: '350px',
            background: 'radial-gradient(circle, rgba(245, 158, 11, 0.12) 0%, rgba(56, 189, 248, 0.05) 50%, transparent 70%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* Badge superior de colectivo */}
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
            fontWeight: 700,
            marginBottom: '20px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <IconoColectivo size={15} color="#FBBF24" />
          <span>TRANSPORTE PÚBLICO CHILENO • LÍNEAS EN VIVO</span>
        </div>

        {/* Título Principal */}
        <h1
          style={{
            fontSize: 'clamp(2rem, 6vw, 3.8rem)',
            fontWeight: 900,
            lineHeight: 1.15,
            letterSpacing: '-0.03em',
            margin: '0 0 20px 0',
            position: 'relative',
            zIndex: 1,
          }}
        >
          El Taxi Colectivo de siempre,{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 50%, #38BDF8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            ahora en tu teléfono
          </span>{' '}
          y en tiempo real.
        </h1>

        {/* Bajada Informativa */}
        <p
          style={{
            fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
            lineHeight: 1.6,
            color: '#94A3B8',
            maxWidth: '760px',
            margin: '0 auto 32px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          FIM Colectivo digitaliza las líneas urbanas y rurales de Chile. El{' '}
          <strong style={{ color: '#F1F5F9' }}>pasajero</strong> sabe en cuántos minutos llega su colectivo y asegura su asiento en camino sin esperas a ciegas en la esquina. El{' '}
          <strong style={{ color: '#F1F5F9' }}>conductor</strong> llena sus 4 asientos con avisos por voz 100% manos libres según la Ley No Chat.
        </p>

        {/* Botones de Entrada Directa a las Apps */}
        <div
          style={{
            display: 'flex',
            gap: '14px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            width: '100%',
            maxWidth: '560px',
            marginBottom: '40px',
            position: 'relative',
            zIndex: 2,
          }}
        >
          <Link
            href="/passenger"
            style={{
              flex: '1 1 240px',
              padding: '16px 20px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '1rem',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: '0 4px 18px rgba(16, 185, 129, 0.3)',
              transition: 'transform 0.2s ease',
            }}
          >
            <IconoPasajero size={20} color="#FFFFFF" />
            <span>SOY PASAJERO</span>
          </Link>

          <Link
            href="/driver"
            style={{
              flex: '1 1 240px',
              padding: '16px 20px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              color: '#0F172A',
              fontWeight: 800,
              fontSize: '1rem',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: '0 4px 18px rgba(245, 158, 11, 0.3)',
              transition: 'transform 0.2s ease',
            }}
          >
            <IconoAuto size={20} color="#0F172A" />
            <span>SOY CONDUCTOR</span>
          </Link>
        </div>

        {/* Barra de Estadísticas y Características del Colectivo */}
        <div
          style={{
            width: '100%',
            maxWidth: '850px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '18px',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#FBBF24' }}>
              <IconoReloj size={18} color="#FBBF24" />
              <span style={{ fontSize: '1.25rem', fontWeight: 900 }}>ETA Minutos</span>
            </div>
            <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Tiempo de llegada exacto por GPS</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10B981' }}>
              <IconoAsiento size={18} color="#10B981" />
              <span style={{ fontSize: '1.25rem', fontWeight: 900 }}>4 Asientos</span>
            </div>
            <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Control en vivo: libre, reserva, abordo</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38BDF8' }}>
              <IconoMicrofono size={18} color="#38BDF8" />
              <span style={{ fontSize: '1.25rem', fontWeight: 900 }}>Manos Libres</span>
            </div>
            <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Ley 21.377: confirma con un &quot;SÍ&quot;</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#A78BFA' }}>
              <IconoTarjeta size={18} color="#A78BFA" />
              <span style={{ fontSize: '1.25rem', fontWeight: 900 }}>RutPay & Efectivo</span>
            </div>
            <span style={{ fontSize: '0.8rem', color: '#94A3B8' }}>Pago directo a tu CuentaRUT o billete</span>
          </div>
        </div>
      </section>

      {/* ─── PESTAÑAS INTERACTIVAS: CÓMO FUNCIONA EL COLECTIVO DIGITAL ─── */}
      <section
        style={{
          padding: '60px 20px',
          maxWidth: '1000px',
          margin: '0 auto',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span
            style={{
              color: '#F59E0B',
              fontSize: '0.85rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}
          >
            GUÍA PASO A PASO
          </span>
          <h2 style={{ fontSize: 'clamp(1.7rem, 4vw, 2.5rem)', fontWeight: 900, margin: '8px 0 16px' }}>
            ¿Cómo funciona FIM Colectivo?
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '0.95rem', maxWidth: '600px', margin: '0 auto 24px' }}>
            Elige tu rol para conocer cómo la aplicación optimiza cada viaje en el taxi colectivo chileno:
          </p>

          {/* Toggle de Selección de Rol */}
          <div
            style={{
              display: 'inline-flex',
              background: '#1E293B',
              borderRadius: '9999px',
              padding: '4px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              gap: '4px',
            }}
          >
            <button
              onClick={() => setRolActivo('pasajero')}
              style={{
                padding: '10px 24px',
                borderRadius: '9999px',
                border: 'none',
                background: rolActivo === 'pasajero' ? '#10B981' : 'transparent',
                color: rolActivo === 'pasajero' ? '#FFFFFF' : '#94A3B8',
                fontWeight: 800,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
              }}
            >
              <IconoPasajero size={16} color={rolActivo === 'pasajero' ? '#FFFFFF' : '#94A3B8'} />
              PARA EL PASAJERO
            </button>
            <button
              onClick={() => setRolActivo('conductor')}
              style={{
                padding: '10px 24px',
                borderRadius: '9999px',
                border: 'none',
                background: rolActivo === 'conductor' ? '#F59E0B' : 'transparent',
                color: rolActivo === 'conductor' ? '#0F172A' : '#94A3B8',
                fontWeight: 800,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
              }}
            >
              <IconoAuto size={16} color={rolActivo === 'conductor' ? '#0F172A' : '#94A3B8'} />
              PARA EL CONDUCTOR
            </button>
          </div>
        </div>

        {/* Contenido: Modo Pasajero */}
        {rolActivo === 'pasajero' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '20px',
            }}
          >
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10B981',
                  fontWeight: 900,
                  fontSize: '1.1rem',
                }}
              >
                1
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#F1F5F9', margin: 0 }}>
                Elige tu Línea y Parada
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#94A3B8', lineHeight: 1.6, margin: 0 }}>
                Abre el mapa, selecciona tu línea autorizada (ej. Línea 104, Línea 23) y tu sentido de recorrido (Ida o Vuelta).
              </p>
            </div>

            <div
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10B981',
                  fontWeight: 900,
                  fontSize: '1.1rem',
                }}
              >
                2
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#F1F5F9', margin: 0 }}>
                Ve tu Colectivo y su ETA
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#94A3B8', lineHeight: 1.6, margin: 0 }}>
                Mira el sedán de colectivo avanzando en el mapa en vivo con su patente y los minutos exactos que le faltan para llegar a recogerte.
              </p>
            </div>

            <div
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10B981',
                  fontWeight: 900,
                  fontSize: '1.1rem',
                }}
              >
                3
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#F1F5F9', margin: 0 }}>
                Reserva tu Asiento en Ruta
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#94A3B8', lineHeight: 1.6, margin: 0 }}>
                Solicita 1 o más asientos antes de que pase el móvil. El conductor recibe el aviso por voz y te asegura el cupo sin que nadie te lo quite.
              </p>
            </div>

            <div
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#10B981',
                  fontWeight: 900,
                  fontSize: '1.1rem',
                }}
              >
                4
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#F1F5F9', margin: 0 }}>
                Paga en Efectivo o RutPay
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#94A3B8', lineHeight: 1.6, margin: 0 }}>
                Sube al colectivo y paga con tu tarifa oficial en efectivo o envía una transferencia directa por RutPay BancoEstado al número del chofer sin andar con monedas.
              </p>
            </div>
          </div>
        )}

        {/* Contenido: Modo Conductor */}
        {rolActivo === 'conductor' && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '20px',
            }}
          >
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#F59E0B',
                  fontWeight: 900,
                  fontSize: '1.1rem',
                }}
              >
                1
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#F1F5F9', margin: 0 }}>
                Inicia Turno y Transmite GPS
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#94A3B8', lineHeight: 1.6, margin: 0 }}>
                Presiona &quot;En Servicio&quot; en tu línea asignada. Tu colectivo aparece automáticamente en el mapa para todos los pasajeros de tu recorrido.
              </p>
            </div>

            <div
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#F59E0B',
                  fontWeight: 900,
                  fontSize: '1.1rem',
                }}
              >
                2
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#F1F5F9', margin: 0 }}>
                Alertas por Voz (Ley No Chat)
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#94A3B8', lineHeight: 1.6, margin: 0 }}>
                Al entrar un pasajero, tu teléfono lee en voz alta: <em>&quot;Reserva de Juan, 1 asiento, a 2 min. ¿Tomamos?&quot;</em>. Cumples la Ley 21.377 sin tocar el celular.
              </p>
            </div>

            <div
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#F59E0B',
                  fontWeight: 900,
                  fontSize: '1.1rem',
                }}
              >
                3
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#F1F5F9', margin: 0 }}>
                Acepta con un Simple &quot;SÍ&quot;
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#94A3B8', lineHeight: 1.6, margin: 0 }}>
                Solo di <strong>&quot;SÍ&quot;</strong> o <strong>&quot;DALE&quot;</strong>. El sistema procesa tu voz en menos de 150 ms, silencia la locución y confirma el asiento al pasajero.
              </p>
            </div>

            <div
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '16px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#F59E0B',
                  fontWeight: 900,
                  fontSize: '1.1rem',
                }}
              >
                4
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#F1F5F9', margin: 0 }}>
                Control de 4 Asientos y Recaudación
              </h3>
              <p style={{ fontSize: '0.9rem', color: '#94A3B8', lineHeight: 1.6, margin: 0 }}>
                Visualiza los 4 asientos en verde (libre), naranjo (reservado) o rojo (a bordo). Recibe pagos en efectivo o por RutPay directo a tu cuenta sin comisiones abusivas.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ─── COMPARATIVA VISUAL: ANTES VS CON FIM COLECTIVO ─── */}
      <section
        style={{
          padding: '60px 20px',
          background: 'rgba(15, 23, 42, 0.4)',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <span style={{ color: '#38BDF8', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              TRANSFORMACIÓN DIGITAL DEL GREMIO
            </span>
            <h2 style={{ fontSize: 'clamp(1.7rem, 4vw, 2.4rem)', fontWeight: 900, margin: '8px 0' }}>
              El Colectivo Tradicional vs. FIM Colectivo
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '24px',
            }}
          >
            {/* Tarjeta Pasajeros */}
            <div
              style={{
                background: '#0F172A',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10B981', fontWeight: 800, fontSize: '1.1rem' }}>
                <IconoPasajero size={20} color="#10B981" />
                <span>Experiencia del Pasajero</span>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ color: '#EF4444', fontWeight: 900, fontSize: '1.1rem' }}>✕</span>
                  <div style={{ fontSize: '0.9rem', color: '#94A3B8' }}>
                    <strong style={{ color: '#F1F5F9' }}>Antes:</strong> Esperar hasta 40 minutos en la esquina con lluvia, frío o de noche sin saber si pasará el colectivo.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ color: '#10B981', fontWeight: 900, fontSize: '1.1rem' }}>✓</span>
                  <div style={{ fontSize: '0.9rem', color: '#F1F5F9' }}>
                    <strong style={{ color: '#10B981' }}>Con FIM:</strong> Ves en el mapa que viene a ~4 minutos, sabes la patente y sales justo a tiempo a la parada.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ color: '#EF4444', fontWeight: 900, fontSize: '1.1rem' }}>✕</span>
                  <div style={{ fontSize: '0.9rem', color: '#94A3B8' }}>
                    <strong style={{ color: '#F1F5F9' }}>Antes:</strong> Hacer parar con la mano y ver que el chofer te hace señas de que viene lleno.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ color: '#10B981', fontWeight: 900, fontSize: '1.1rem' }}>✓</span>
                  <div style={{ fontSize: '0.9rem', color: '#F1F5F9' }}>
                    <strong style={{ color: '#10B981' }}>Con FIM:</strong> Ves cuántos asientos libres trae el colectivo y aseguras tu cupo antes de que pase.
                  </div>
                </div>
              </div>
            </div>

            {/* Tarjeta Conductores */}
            <div
              style={{
                background: '#0F172A',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#F59E0B', fontWeight: 800, fontSize: '1.1rem' }}>
                <IconoAuto size={20} color="#F59E0B" />
                <span>Experiencia del Conductor</span>
              </div>

              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ color: '#EF4444', fontWeight: 900, fontSize: '1.1rem' }}>✕</span>
                  <div style={{ fontSize: '0.9rem', color: '#94A3B8' }}>
                    <strong style={{ color: '#F1F5F9' }}>Antes:</strong> Vueltas vacías consumiendo bencina y esperando ver si alguien levanta la mano.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ color: '#10B981', fontWeight: 900, fontSize: '1.1rem' }}>✓</span>
                  <div style={{ fontSize: '0.9rem', color: '#F1F5F9' }}>
                    <strong style={{ color: '#10B981' }}>Con FIM:</strong> Los pasajeros te reservan en ruta y optimizas el llenado de tus 4 cupos en cada viaje.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ color: '#EF4444', fontWeight: 900, fontSize: '1.1rem' }}>✕</span>
                  <div style={{ fontSize: '0.9rem', color: '#94A3B8' }}>
                    <strong style={{ color: '#F1F5F9' }}>Antes:</strong> Distracción o multas por manipular el celular al volante (Ley No Chat).
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ color: '#10B981', fontWeight: 900, fontSize: '1.1rem' }}>✓</span>
                  <div style={{ fontSize: '0.9rem', color: '#F1F5F9' }}>
                    <strong style={{ color: '#10B981' }}>Con FIM:</strong> Asistente auditivo neuronal lee la reserva y confirmas con tu voz diciendo <em>&quot;SÍ&quot;</em> sin mirar la pantalla.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SEGURIDAD Y MARCO LEGAL ─── */}
      <section
        style={{
          padding: '60px 20px',
          maxWidth: '950px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '20px',
            padding: '36px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              padding: '10px 18px',
              borderRadius: '9999px',
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38BDF8',
              fontSize: '0.85rem',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <IconoMicrofono size={16} color="#38BDF8" />
            CUMPLIMIENTO ESTRICTO LEY NO CHAT (LEY 21.377)
          </div>

          <h3 style={{ fontSize: 'clamp(1.4rem, 3.5vw, 2rem)', fontWeight: 900, color: '#F8FAFC', margin: 0 }}>
            Tecnología diseñada para la seguridad del conductor y pasajeros
          </h3>

          <p style={{ fontSize: '0.95rem', color: '#94A3B8', maxWidth: '700px', lineHeight: 1.7, margin: 0 }}>
            La Ley 21.377 sanciona drásticamente la manipulación de dispositivos móviles mientras se conduce. FIM Colectivo incorpora una arquitectura de interacción por audio y reconocimiento fonético que permite a los colectiveros operar sus turnos sin tocar ni mirar su teléfono en ningún momento del recorrido.
          </p>
        </div>
      </section>

      {/* ─── PREGUNTAS FRECUENTES (FAQ) ─── */}
      <section
        style={{
          padding: '50px 20px 80px',
          maxWidth: '850px',
          margin: '0 auto',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)', fontWeight: 900, margin: '0 0 10px' }}>
            Preguntas Frecuentes sobre FIM Colectivo
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '0.9rem', margin: 0 }}>
            Todo lo que necesitas saber como usuario o conductor de línea
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            {
              q: '¿FIM Colectivo es una aplicación de viajes privados tipo Uber o DiDi?',
              a: 'No. FIM Colectivo está 100% dedicada y adaptada al servicio de Taxis Colectivos de Chile. Opera respetando las líneas autorizadas, paradas habituales, sentidos de recorrido (Ida y Vuelta) y tarifas oficiales reguladas por el Ministerio de Transportes.',
            },
            {
              q: '¿El pasajero puede seguir pagando con monedas o billetes?',
              a: 'Sí, absolutamente. El pasajero puede pagar con efectivo tradicional al subir o bien utilizar pagos directos por RutPay de BancoEstado o MercadoPago escaneando o enviando al número de teléfono del conductor sin recargos.',
            },
            {
              q: '¿Cómo funciona la confirmación por voz para los conductores?',
              a: 'Al aproximarse a un pasajero que solicita cupo, el sistema emite una locución concisa mediante síntesis de voz en español chileno. El conductor simplemente responde con un "SÍ" o "DALE" y la reserva queda aceptada de inmediato, sin desviar la mirada del camino.',
            },
            {
              q: '¿Qué pasa cuando el conductor termina su jornada o descanso?',
              a: 'El conductor pulsa el botón "Fuera de Servicio", lo cual apaga inmediatamente la transmisión GPS y lo retira en tiempo real del mapa de todos los pasajeros. Los pasajeros no podrán solicitarle cupos mientras se encuentre fuera de turno.',
            },
            {
              q: '¿Se cobra comisión por cada pasaje que toma el colectivo?',
              a: 'El dinero del pasaje pagado por los pasajeros entra directamente al bolsillo del conductor. No existen descuentos ocultos ni retenciones semanales por cada pasaje recaudado.',
            },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                background: '#0F172A',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => toggleFaq(idx)}
                style={{
                  width: '100%',
                  padding: '18px 20px',
                  background: 'transparent',
                  border: 'none',
                  color: '#F8FAFC',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  textAlign: 'left',
                  gap: '12px',
                }}
              >
                <span>{item.q}</span>
                <span style={{ fontSize: '1.2rem', color: '#F59E0B', transform: faqAbierta === idx ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
                  +
                </span>
              </button>
              {faqAbierta === idx && (
                <div
                  style={{
                    padding: '0 20px 18px',
                    color: '#94A3B8',
                    fontSize: '0.9rem',
                    lineHeight: 1.6,
                    borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                    paddingTop: '12px',
                  }}
                >
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ─── CALL TO ACTION FINAL DUAL ─── */}
      <section
        style={{
          padding: '60px 20px',
          textAlign: 'center',
          background: 'linear-gradient(180deg, rgba(9, 9, 15, 0) 0%, rgba(245, 158, 11, 0.08) 100%)',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 900, marginBottom: '16px' }}>
            Súbete a la nueva era del Taxi Colectivo chileno
          </h2>
          <p style={{ color: '#94A3B8', fontSize: '1rem', marginBottom: '32px', lineHeight: 1.6 }}>
            Accede inmediatamente desde tu celular como pasajero o conductor y experimenta la puntualidad y comodidad que tu viaje necesita.
          </p>

          <div
            style={{
              display: 'flex',
              gap: '14px',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <Link
              href="/passenger"
              style={{
                padding: '14px 28px',
                borderRadius: '10px',
                background: '#10B981',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '0.95rem',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.25)',
              }}
            >
              <IconoPasajero size={18} color="#FFFFFF" />
              ABRIR MODO PASAJERO
            </Link>

            <Link
              href="/driver"
              style={{
                padding: '14px 28px',
                borderRadius: '10px',
                background: '#F59E0B',
                color: '#0F172A',
                fontWeight: 800,
                fontSize: '0.95rem',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.25)',
              }}
            >
              <IconoAuto size={18} color="#0F172A" />
              INICIAR TURNO CHOFER
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FOOTER INSTITUCIONAL ─── */}
      <footer
        style={{
          padding: '36px 20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          textAlign: 'center',
          color: '#64748B',
          fontSize: '0.85rem',
          maxWidth: '1000px',
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <Logo width="100" height="34" />
        </div>
        <p style={{ margin: '0 0 14px' }}>
          © 2026 FIM Colectivo. Plataforma tecnológica para líneas de taxis colectivos de Chile.
        </p>
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/terms" style={{ color: '#94A3B8', textDecoration: 'none' }}>
            Términos del Servicio
          </Link>
          <Link href="/privacy" style={{ color: '#94A3B8', textDecoration: 'none' }}>
            Políticas de Privacidad
          </Link>
          <Link href="/login" style={{ color: '#94A3B8', textDecoration: 'none' }}>
            Acceso Conductores
          </Link>
        </div>
      </footer>
    </main>
  );
}
