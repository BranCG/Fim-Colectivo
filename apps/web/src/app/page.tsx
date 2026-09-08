'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import SplashScreen from '@/components/SplashScreen';

export default function Home() {
  const [tripsPerWeek, setTripsPerWeek] = useState(60);
  const [avgPrice, setAvgPrice] = useState(6000);
  const [loss, setLoss] = useState(0);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [showFimPagos, setShowFimPagos] = useState(false);

  useEffect(() => {
    // Calculamos pérdida mensual (4 semanas) asumiendo 25% de comisión
    const calculatedLoss = Math.round(tripsPerWeek * 4 * avgPrice * 0.25);
    setLoss(calculatedLoss);
  }, [tripsPerWeek, avgPrice]);

  const formatCLP = (val: number) => {
    return '$' + val.toLocaleString('es-CL');
  };

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <SplashScreen />
      
      {/* Hero Section */}
      <section style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Background gradient */}
        <div style={{
          position: 'absolute',
          top: '-200px',
          left: '-200px',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(0,229,160,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-100px',
          right: '-100px',
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(0,229,160,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Promo Ribbon */}
        <div style={{
          background: 'linear-gradient(90deg, #FFD700 0%, #FFA500 100%)',
          color: '#000',
          textAlign: 'center',
          padding: '8px 24px',
          fontSize: '0.9rem',
          fontWeight: 800,
          position: 'relative',
          zIndex: 101,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          letterSpacing: '0.05em'
        }}>
          ¡PROMO LANZAMIENTO! 50% DCTO EN TU 1er VIAJE (TOPE $8.000)
        </div>

        {/* Navbar */}
        <nav style={{
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          backdropFilter: 'blur(10px)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(9, 9, 15, 0.8)',
        }}>
          <Logo />
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Link href="/login" className="btn btn-secondary btn-sm">Iniciar sesión</Link>
            <Link href="/register" className="btn btn-primary btn-sm">Registrarse</Link>
          </div>
        </nav>

        {/* Hero Content */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 24px',
          textAlign: 'center',
          gap: '32px',
          maxWidth: '800px',
          margin: '0 auto',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 16px',
            background: 'var(--accent-light)',
            border: '1px solid var(--border-accent)',
            borderRadius: 'var(--radius-full)',
            color: 'var(--accent)',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}>
            Disponible en Santiago
          </div>

          <h1 style={{ 
            fontSize: 'clamp(2.5rem, 8vw, 4.5rem)', 
            fontWeight: 900, 
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            marginBottom: '16px'
          }}>
            La red de conductores independientes <span className="text-gradient">más rentable</span> de Chile.
          </h1>

          <p style={{ 
            fontSize: 'clamp(1.1rem, 2vw, 1.4rem)', 
            maxWidth: '750px', 
            lineHeight: 1.6, 
            color: 'var(--text-secondary)',
            marginBottom: '32px'
          }}>
            ¿Trabajas todo el día para que una aplicación se quede con parte de cada viaje? En Fim eso se acabó: aquí el viaje es 100% tuyo.<br />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem', display: 'block', marginTop: '8px' }}>
              Sin comisiones por carrera ni descuentos escondidos. Pagas tu membresía y todo lo demás va directo a tu cuenta.
            </span>
          </p>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center', position: 'relative', zIndex: 10 }}>
            <Link href="/register?role=driver" className="btn btn-primary btn-lg" style={{ padding: 0, minWidth: '240px', overflow: 'hidden' }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', height: '100%', padding: '12px 24px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
                Quiero Conducir
              </span>
            </Link>
            <Link href="/register?role=passenger" className="btn btn-accent btn-lg" style={{ padding: 0, minWidth: '240px', overflow: 'hidden', background: 'var(--accent-light)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', height: '100%', padding: '12px 24px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/><path d="M12 10V6"/><path d="M9 6h6"/></svg>
                Quiero Viajar
              </span>
            </Link>
          </div>
        </div>

        {/* Stats Bar */}
        <div style={{
          borderTop: '1px solid var(--border)',
          padding: '24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          maxWidth: '600px',
          margin: '0 auto',
          width: '100%',
        }}>
          {[
            { value: '0%', label: 'Comisión por carrera' },
            { value: '~20%', label: 'Tarifa más económica' },
            { value: 'INSTANTE', label: 'Liquidez para conductores' },
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--accent)' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Promo Pasajero Section */}
      <section style={{ 
        padding: '60px 24px', 
        background: 'linear-gradient(135deg, rgba(0,229,160,0.1) 0%, rgba(9,9,15,1) 100%)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>Beneficio Pasajeros</div>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 900, marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
            50% DCTO en tu primer viaje 
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '24px' }}>
            Regístrate hoy y disfruta de un viaje a mitad de precio. <br />
            <span style={{ display: 'inline-block', background: 'rgba(255,165,0,0.1)', color: 'var(--warning)', padding: '4px 12px', borderRadius: '4px', fontWeight: 800, marginTop: '8px' }}>
              TOPE MÁXIMO DE DESCUENTO: $8.000
            </span><br />
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'block', marginTop: '8px' }}>Válido solo para nuevos pasajeros registrados hasta el 15 de Junio.</span>
          </p>
          <Link href="/register?role=passenger" className="btn btn-accent btn-lg" style={{ boxShadow: '0 0 20px rgba(0,229,160,0.3)' }}>
            Obtener mi descuento ahora
          </Link>
        </div>
      </section>

      {/* Sección Libertad Económica */}
      <section style={{ padding: '80px 24px', background: 'linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 100%)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '12px' }}>LIBERTAD ECONÓMICA</div>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '24px', letterSpacing: '-0.02em' }}>
            Toma el control absoluto de tus ingresos
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', lineHeight: '1.8', maxWidth: '750px', margin: '0 auto 48px' }}>
            No comenzaste a manejar para hacer rica a una aplicación, sino para generar dinero para ti y tu familia. Es hora de recuperar el control total de tu trabajo.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '32px' }}>
            <div className="card" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ color: 'var(--accent)', fontSize: '1.5rem', fontWeight: 900 }}>100% Para Ti</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>El viaje es tuyo</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Sin porcentajes. Sin comisiones por carrera. Sin trabajar para enriquecer a otros. Pagas tu acceso y cada peso que generas entra directo a tu cuenta.
              </p>
            </div>
            <div className="card" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ color: 'var(--accent)', fontSize: '1.5rem', fontWeight: 900 }}>Cero Pérdidas</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Deja de regalar dinero</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Cada viaje que haces en otras apps deja miles de pesos al día en manos de intermediarios. Fim nació para que si tú haces el viaje, tú te quedes con el 100%.
              </p>
            </div>
            <div className="card" style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ color: 'var(--accent)', fontSize: '1.5rem', fontWeight: 900 }}>Control Absoluto</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Trabaja para ti</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Conduce bajo tus propias reglas y recibe pagos directos mediante Mercado Pago. Olvídate de los descuentos escondidos y las esperas semanales de dinero.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Calculadora de Pérdida */}
      <section id="calculator" style={{ padding: '100px 24px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '48px', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '20px', lineHeight: 1.2, fontWeight: 800 }}>
              ¿Cuánto dinero <span style={{ color: '#ff4757' }}>estás perdiendo</span> en comisiones?
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: '32px' }}>
              En otras aplicaciones, el 25% o más de tu trabajo se lo quedan ellos. Calcula cuánto queda en tu bolsillo con Fim.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  Viajes por semana <span style={{ color: 'var(--accent)', fontWeight: 800 }}>{tripsPerWeek}</span>
                </label>
                <input 
                  type="range" 
                  min="10" 
                  max="150" 
                  value={tripsPerWeek}
                  onChange={(e) => setTripsPerWeek(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Valor promedio por viaje ($)</label>
                <input 
                  type="number" 
                  value={avgPrice}
                  onChange={(e) => setAvgPrice(parseInt(e.target.value) || 0)}
                  className="form-input" 
                  style={{ fontSize: '1.2rem', padding: '12px' }}
                />
              </div>
            </div>
          </div>

          <div style={{ 
            background: 'var(--bg-primary)', 
            padding: '48px', 
            borderRadius: 'var(--radius-lg)', 
            border: '2px solid var(--border)',
            textAlign: 'center',
            boxShadow: '0 30px 60px rgba(0,0,0,0.4)',
            position: 'relative',
            overflow: 'hidden'
          }}>
             <div style={{ 
              position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: '#ff4757'
            }} />
            <div style={{ fontSize: '0.9rem', color: '#ff4757', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.1em' }}>Pérdida mensual estimada</div>
            <div style={{ fontSize: '4rem', fontWeight: 900, marginBottom: '24px', color: '#ff4757', letterSpacing: '-0.02em' }}>{formatCLP(loss)}</div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '28px', fontSize: '1rem' }}>Con Fim, este dinero es <strong>100% tuyo</strong>.</p>
              <Link href="/register?role=driver" className="btn btn-primary btn-block btn-lg" style={{ fontSize: '1.1rem' }}>Empezar a ganar de verdad</Link>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works - Interactive Timeline */}
      <section style={{ padding: '80px 24px', maxWidth: '900px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '16px' }}>
          ¿Cómo funciona?
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '40px', fontSize: '1rem' }}>
          Selecciona cada paso para ver los detalles
        </p>
        
        {/* Horizontal Step Buttons */}
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginBottom: '32px', alignItems: 'center' }}>
          {[1, 2, 3].map((step) => (
            <button
              key={step}
              onClick={() => setActiveStep(activeStep === step ? null : step)}
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                border: activeStep === step ? '3px solid var(--accent)' : '2px solid var(--border)',
                background: activeStep === step ? 'var(--accent)' : 'var(--bg-secondary)',
                color: activeStep === step ? '#000' : 'var(--text-primary)',
                fontWeight: 900,
                fontSize: '1.3rem',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: activeStep === step ? '0 0 25px rgba(0,229,160,0.4)' : '0 4px 12px rgba(0,0,0,0.2)',
                transform: activeStep === step ? 'scale(1.15)' : 'scale(1)',
                flexShrink: 0,
              }}
            >
              {step}
            </button>
          ))}
        </div>

        {/* Step 1 Content */}
        {activeStep === 1 && (
          <div className="card" style={{ 
            maxWidth: '600px', margin: '0 auto', textAlign: 'center', 
            border: '1px solid var(--border)', animation: 'fadeIn 0.4s ease',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px'
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <h3 style={{ fontSize: '1.3rem', color: 'var(--accent)' }}>Pide y Viaja Seguro</h3>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              Ingresa tu destino, ve el precio real y valida el inicio con tu código OTP de seguridad. Todo transparente desde el primer momento.
            </p>
          </div>
        )}

        {/* Step 2 Content */}
        {activeStep === 2 && (
          <div className="card" style={{ 
            maxWidth: '600px', margin: '0 auto', textAlign: 'center', 
            border: '1px solid var(--border)', animation: 'fadeIn 0.4s ease',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px'
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
            <h3 style={{ fontSize: '1.3rem', color: 'var(--accent)' }}>Pagos Sin Vueltas</h3>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              Efectivo, Débito o Crédito. Pagas directo al conductor vía Mercado Pago, sin comisiones<br />intermedias. El 100% va al conductor.
            </p>
          </div>
        )}

        {/* Step 3 Content */}
        {activeStep === 3 && (
          <div className="card" style={{ 
            maxWidth: '600px', margin: '0 auto', textAlign: 'center', 
            border: '2px solid var(--accent)', animation: 'fadeIn 0.4s ease',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
            boxShadow: '0 0 20px rgba(0,229,160,0.1)'
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            <h3 style={{ fontSize: '1.3rem', color: 'var(--accent)' }}>Ganancia Inmediata</h3>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
              Conductores: Reciban el 100% de su trabajo en su cuenta al instante de terminar el viaje. Sin esperas, sin retenciones.
            </p>
          </div>
        )}
      </section>

      {/* Membresías */}
      <section style={{ padding: '80px 24px', maxWidth: '1000px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '12px' }}>Elige tu Plan de Conductor</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '32px', maxWidth: '600px', margin: '0 auto 32px' }}>
          En Fim no te cobramos comisión por carrera. Tú eliges cómo pagar tu acceso a la plataforma.
        </p>
        
        {/* Horizontal Plan Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '32px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedPlan(selectedPlan === 'black' ? null : 'black')}
            style={{
              padding: '14px 32px',
              borderRadius: 'var(--radius-full)',
              border: selectedPlan === 'black' ? '2px solid #FFD700' : '2px solid rgba(255,215,0,0.3)',
              background: selectedPlan === 'black' ? 'linear-gradient(135deg, #1a1a00 0%, #3d3d00 100%)' : 'transparent',
              color: '#FFD700',
              fontWeight: 900,
              fontSize: '1rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              letterSpacing: '0.1em',
              boxShadow: selectedPlan === 'black' ? '0 0 20px rgba(255,215,0,0.3)' : 'none',
              minWidth: '120px',
            }}
          >
            BLACK
          </button>
          <button
            onClick={() => setSelectedPlan(selectedPlan === 'comfort' ? null : 'comfort')}
            style={{
              padding: '14px 32px',
              borderRadius: 'var(--radius-full)',
              border: selectedPlan === 'comfort' ? '2px solid #4A90D9' : '2px solid rgba(74,144,217,0.3)',
              background: selectedPlan === 'comfort' ? 'linear-gradient(135deg, #0a1a2e 0%, #1a3a5e 100%)' : 'transparent',
              color: '#4A90D9',
              fontWeight: 900,
              fontSize: '1rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              letterSpacing: '0.1em',
              boxShadow: selectedPlan === 'comfort' ? '0 0 20px rgba(74,144,217,0.3)' : 'none',
              minWidth: '120px',
            }}
          >
            COMFORT
          </button>
          <button
            onClick={() => setSelectedPlan(selectedPlan === 'flex' ? null : 'flex')}
            style={{
              padding: '14px 32px',
              borderRadius: 'var(--radius-full)',
              border: selectedPlan === 'flex' ? '2px solid #00E5A0' : '2px solid rgba(0,229,160,0.3)',
              background: selectedPlan === 'flex' ? 'linear-gradient(135deg, #001a10 0%, #003d26 100%)' : 'transparent',
              color: '#00E5A0',
              fontWeight: 900,
              fontSize: '1rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              letterSpacing: '0.1em',
              boxShadow: selectedPlan === 'flex' ? '0 0 20px rgba(0,229,160,0.3)' : 'none',
              minWidth: '120px',
            }}
          >
            FLEX
          </button>
        </div>

        {/* Plan Card - BLACK */}
        {selectedPlan === 'black' && (
          <div className="card" style={{ 
            display: 'flex', flexDirection: 'column', gap: '20px', 
            border: '2px solid #FFD700', 
            boxShadow: '0 0 30px rgba(255,215,0,0.15)',
            maxWidth: '500px', margin: '0 auto',
            animation: 'fadeIn 0.4s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500)', width: '12px', height: '40px', borderRadius: '6px' }} />
              <h3 style={{ fontSize: '1.5rem', color: '#FFD700' }}>Plan Black</h3>
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 900 }}>$100.000 <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 400 }}>/mes</span></div>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
              Acceso total e inmediato. La opción más premium para conductores de alto rendimiento.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
              <li>✦ <strong>Un solo pago:</strong> Olvida las cuotas por 30 días completos.</li>
              <li>✦ <strong>Ganancias 100% Líquidas:</strong> Recibe todo al instante.</li>
              <li>✦ <strong>Sin Retenciones:</strong> Viajes con tarjeta van a tu cuenta.</li>
              <li>✦ <strong>Prioridad VIP:</strong> Mayor visibilidad en el mapa.</li>
            </ul>
            <Link href="/register?role=driver" className="btn btn-block" style={{ marginTop: 'auto', background: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#000', fontWeight: 800 }}>Pagar Plan Black →</Link>
          </div>
        )}

        {/* Plan Card - COMFORT */}
        {selectedPlan === 'comfort' && (
          <div className="card" style={{ 
            display: 'flex', flexDirection: 'column', gap: '20px', 
            border: '2px solid #4A90D9', 
            boxShadow: '0 0 30px rgba(74,144,217,0.15)',
            maxWidth: '500px', margin: '0 auto',
            animation: 'fadeIn 0.4s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'linear-gradient(135deg, #4A90D9, #357ABD)', width: '12px', height: '40px', borderRadius: '6px' }} />
              <h3 style={{ fontSize: '1.5rem', color: '#4A90D9' }}>Plan Comfort</h3>
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 900 }}>$20.000 <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 400 }}>/día</span></div>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
              Activa tu cuenta cada mañana con un pago flexible. Ideal para quienes trabajan a su ritmo.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
              <li>✦ <strong>Compromiso 6 días:</strong> Pagas $20k por 6 días ($120k total).</li>
              <li>✦ <strong>Activación Diaria:</strong> Pagas al despertar y quedas libre.</li>
              <li>✦ <strong>Ganancia 100%:</strong> Todo lo que hagas en el día es para ti.</li>
              <li>✦ <strong>Sin Deudas:</strong> Si un día no trabajas, no pagas la cuota.</li>
            </ul>
            <Link href="/register?role=driver" className="btn btn-block" style={{ marginTop: 'auto', background: 'linear-gradient(135deg, #4A90D9, #357ABD)', color: '#fff', fontWeight: 800 }}>Empezar Comfort →</Link>
          </div>
        )}

        {/* Plan Card - FLEX */}
        {selectedPlan === 'flex' && (
          <div className="card" style={{ 
            display: 'flex', flexDirection: 'column', gap: '20px', 
            border: '2px solid #00E5A0', 
            boxShadow: '0 0 30px rgba(0,229,160,0.15)',
            maxWidth: '500px', margin: '0 auto',
            animation: 'fadeIn 0.4s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'linear-gradient(135deg, #00E5A0, #00B37E)', width: '12px', height: '40px', borderRadius: '6px' }} />
              <h3 style={{ fontSize: '1.5rem', color: '#00E5A0' }}>Plan Flex</h3>
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 900 }}>$15.000 <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 400 }}>/día</span></div>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
              El plan más accesible para empezar. Sin compromisos, paga solo cuando quieras conducir.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
              <li>✦ <strong>Día a Día:</strong> Activa solo los días que quieras.</li>
              <li>✦ <strong>Sin Contrato:</strong> Total libertad, sin compromisos mensuales.</li>
              <li>✦ <strong>100% Tuyo:</strong> Cada viaje que hagas va directo a tu bolsillo.</li>
              <li>✦ <strong>Ideal para Iniciar:</strong> Perfecto si recién comienzas en Fim.</li>
            </ul>
            <Link href="/register?role=driver" className="btn btn-block" style={{ marginTop: 'auto', background: 'linear-gradient(135deg, #00E5A0, #00B37E)', color: '#000', fontWeight: 800 }}>Empezar Flex →</Link>
          </div>
        )}
      </section>

      {/* Tutorial FIM Pagos - Toggle Button */}
      <section style={{ padding: '60px 24px', background: 'var(--bg-primary)', borderTop: '1px solid var(--border)' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <button
            onClick={() => setShowFimPagos(!showFimPagos)}
            style={{
              padding: '16px 40px',
              borderRadius: 'var(--radius-lg)',
              border: '2px solid var(--accent)',
              background: showFimPagos ? 'var(--accent)' : 'transparent',
              color: showFimPagos ? '#000' : 'var(--accent)',
              fontWeight: 900,
              fontSize: '1.1rem',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              letterSpacing: '0.05em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: showFimPagos ? '0 0 25px rgba(0,229,160,0.3)' : 'none',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            TUTORIAL FIM PAGOS
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.3s ease', transform: showFimPagos ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {/* Collapsible FIM Pagos Content */}
          {showFimPagos && (
            <div style={{ marginTop: '32px', animation: 'fadeIn 0.4s ease' }}>
              <h2 style={{ marginBottom: '32px', fontSize: '1.8rem' }}>¿Cómo funciona FIM Pagos?</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px' }}>
                {/* Paso 1 - Tarjeta de crédito */}
                <div className="card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', border: '1px solid var(--border)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" height="48" width="48">
                    <path fill="#ffef5e" d="M21.087 4.348H2.913c-.507.002-.993.204-1.351.562-.358.358-.56.844-.562 1.351V17.74c.002.507.204.993.562 1.351.358.358.844.56 1.351.562H21.087c.507 0 .994-.202 1.353-.56.359-.359.56-.846.56-1.353V6.261c0-.507-.201-.994-.56-1.353a1.913 1.913 0 0 0-1.353-.56Z" strokeWidth="1"/>
                    <path fill="#fff9bf" d="M2.913 4.348c-.507.002-.993.204-1.351.562-.358.358-.56.844-.562 1.351V17.74c.002.447.16.88.447 1.223.287.343.685.575 1.125.656L17.844 4.347" strokeWidth="1"/>
                    <path stroke="#1e1e1e" d="M21.087 4.348H2.913c-.507.002-.993.204-1.351.562-.358.358-.56.844-.562 1.351V17.74c.002.507.204.993.562 1.351.358.358.844.56 1.351.562H21.087c.507 0 .994-.202 1.353-.56.359-.359.56-.846.56-1.353V6.261c0-.507-.201-.994-.56-1.353a1.913 1.913 0 0 0-1.353-.56Z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1"/>
                    <path stroke="#1e1e1e" d="M1 8.17h22M5.348 16.78h4.304M14.348 16.78h4.348" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1"/>
                  </svg>
                  <h4 style={{ fontWeight: 700 }}>Paso 1</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Crea una cuenta en <strong>Mercado Pago</strong> (es gratis y personal).</p>
                </div>

                {/* Paso 2 - Link de cobro */}
                <div className="card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', border: '1px solid var(--border)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" height="48" width="48">
                    <path fill="#b2f0e6" d="M19.5 3H4.5A1.5 1.5 0 0 0 3 4.5v15A1.5 1.5 0 0 0 4.5 21h15a1.5 1.5 0 0 0 1.5-1.5v-15A1.5 1.5 0 0 0 19.5 3Z" strokeWidth="1"/>
                    <path fill="#e0faf5" d="M4.5 3A1.5 1.5 0 0 0 3 4.5v15c0 .398.158.78.44 1.06L18 6l-12.44-2.56A1.5 1.5 0 0 0 4.5 3Z" strokeWidth="1"/>
                    <path stroke="#1e1e1e" d="M19.5 3H4.5A1.5 1.5 0 0 0 3 4.5v15A1.5 1.5 0 0 0 4.5 21h15a1.5 1.5 0 0 0 1.5-1.5v-15A1.5 1.5 0 0 0 19.5 3Z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1"/>
                    <path stroke="#1e1e1e" d="M10.172 13.828a3.004 3.004 0 0 0 4.242 0l1.414-1.414a3 3 0 0 0 0-4.243 3 3 0 0 0-4.242 0l-.707.707M13.828 10.172a3 3 0 0 0-4.242 0l-1.414 1.414a3 3 0 0 0 0 4.243 3 3 0 0 0 4.242 0l.707-.707" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1"/>
                  </svg>
                  <h4 style={{ fontWeight: 700 }}>Paso 2</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Ve a <strong>Cobrar con Link</strong> y crea un link genérico o usa tu código QR.</p>
                </div>

                {/* Paso 3 - Perfil Fim */}
                <div className="card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', border: '1px solid var(--border)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" height="48" width="48">
                    <path fill="#c3aeff" d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" strokeWidth="1"/>
                    <path fill="#e0d5ff" d="M7.35 2.72A5 5 0 0 0 12 12a5 5 0 0 0 4.65-3.19L7.35 2.72Z" strokeWidth="1"/>
                    <path stroke="#1e1e1e" d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM3.41 22a8.998 8.998 0 0 1 17.18 0" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1"/>
                    <path stroke="#1e1e1e" d="M18 15.5l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1"/>
                  </svg>
                  <h4 style={{ fontWeight: 700 }}>Paso 3</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Pega ese link en tu perfil de <strong>Fim</strong> en la sección &quot;Cobro Directo&quot;.</p>
                </div>

                {/* Paso 4 - Pago directo */}
                <div className="card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', border: '1px solid var(--border)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" height="48" width="48">
                    <path fill="#ffdda1" d="M21.15 17.687a.837.837 0 0 0 0-.855l-.494-.989a.849.849 0 0 1 .06-.957l.294-.442a.992.992 0 0 0 0-1.062l-.603-.904h-7.829l-.603-3.94-1.089.725a2.25 2.25 0 0 0-.849.882l-3.157 5.128a1.8 1.8 0 0 1-.956.785l-3.212 1.203v4.783c0 .254.1.497.28.676.18.18.423.28.676.28h5.74l1.88-.752a2.7 2.7 0 0 1 1.063-.205h7.099l1.016-1.019a.84.84 0 0 0 .255-.456.84.84 0 0 0-.033-.37" strokeWidth="1"/>
                    <path fill="#ffeecc" d="M3.516 18.39l12.88-9.383-.567-3.703-1.087.725a2.25 2.25 0 0 0-.85.882l-3.156 5.128a1.8 1.8 0 0 1-.957.785l-3.212 1.203v4.783c0 .254.101.497.28.676.18.18.423.28.677.28h.45" strokeWidth="1"/>
                    <path stroke="#1e1e1e" d="M2.717 15.652v7.391M4.63 17.26l-1.913 1.043M20.407 12.913l-.603-.904h-7.829M11.975 12.009l-.603-3.94-1.089.725a2.25 2.25 0 0 0-.849.882l-3.157 5.128a1.8 1.8 0 0 1-.956.785l-3.212 1.203" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1"/>
                    <path stroke="#1e1e1e" d="M21.15 17.687a.837.837 0 0 0 0-.855l-.494-.989a.849.849 0 0 1 .06-.957l.294-.442a.992.992 0 0 0 0-1.062l-.603-.904M5.63 23.043h5.74l1.88-.752a2.7 2.7 0 0 1 1.063-.205h7.099l1.016-1.019a.84.84 0 0 0 .255-.456.84.84 0 0 0-.033-.37" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1"/>
                    <path stroke="#1e1e1e" d="M15 1.957a3.13 3.13 0 0 0-2.217.918L12 3.657l-.783-.782A3.13 3.13 0 0 0 6.787 7.305l4.78 4.78a.6.6 0 0 0 .868 0l4.78-4.78a3.13 3.13 0 0 0-.002-4.43 3.13 3.13 0 0 0-2.213-.918Z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1"/>
                  </svg>
                  <h4 style={{ fontWeight: 700 }}>Paso 4</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>¡Listo! Al terminar un viaje, el pasajero te paga <strong>directo a tu cuenta</strong>.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ padding: '100px 24px', textAlign: 'center', background: 'linear-gradient(rgba(9,9,15,0) 0%, rgba(0,229,160,0.05) 100%)' }}>
        <h2 style={{ fontSize: '2.5rem', marginBottom: '24px', fontWeight: 900 }}>Sé parte de la comunidad Fim</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '40px', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto 40px' }}>
          Ya sea para ganar más o para viajar mejor, Fim es la plataforma que estabas esperando.
        </p>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/register?role=driver" className="btn btn-primary btn-lg" style={{ minWidth: '240px' }}>
            Registrarme como Conductor
          </Link>
          <Link href="/register?role=passenger" className="btn btn-secondary btn-lg" style={{ minWidth: '240px' }}>
            Registrarme como Pasajero
          </Link>
        </div>
      </section>

      <footer style={{ padding: '48px 24px', borderTop: '1px solid var(--border)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        <p style={{ marginBottom: '16px' }}>© 2026 Fim Platform. La red de conductores más rentable de Chile.</p>
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
          <Link href="/terms" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>Términos y Condiciones</Link>
          <Link href="/privacy" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>Políticas de Privacidad</Link>
        </div>
      </footer>
    </main>
  );
}
