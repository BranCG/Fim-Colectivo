'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api, { saveSession } from '@/lib/api';
import Logo from '@/components/Logo';
import {
  IconoAlerta,
  IconoLlave,
  IconoColectivo,
  IconoPasajero,
  IconoAuto,
} from '@/components/icons/Iconos';

type Role = 'driver' | 'passenger' | 'admin';

function ContenidoLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Si viene ?role=driver o ?role=passenger en la URL, seleccionarlo por defecto
  const paramRole = searchParams.get('role');
  const rolInicial: Role = paramRole === 'driver' || paramRole === 'conductor'
    ? 'driver'
    : paramRole === 'admin'
    ? 'admin'
    : 'passenger';

  const [role, setRole] = useState<Role>(rolInicial);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (paramRole === 'driver' || paramRole === 'conductor') {
      setRole('driver');
    } else if (paramRole === 'passenger' || paramRole === 'pasajero') {
      setRole('passenger');
    } else if (paramRole === 'admin') {
      setRole('admin');
    }
  }, [paramRole]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let activeRole = role;
      const endpoint = activeRole === 'admin' ? '/auth/admin/login'
        : activeRole === 'driver' ? '/auth/driver/login'
        : '/auth/passenger/login';

      let res;
      try {
        res = await api.post(endpoint, { email, password });
      } catch (firstErr) {
        // Fallback inteligente: si intentó como pasajero y falló, probar como conductor automáticamente
        if (activeRole === 'passenger') {
          try {
            res = await api.post('/auth/driver/login', { email, password });
            activeRole = 'driver';
          } catch {
            throw firstErr;
          }
        } else if (activeRole === 'driver') {
          try {
            res = await api.post('/auth/passenger/login', { email, password });
            activeRole = 'passenger';
          } catch {
            throw firstErr;
          }
        } else {
          throw firstErr;
        }
      }

      const userData = res.data.user || res.data.driver;
      saveSession(res.data.accessToken, { ...userData, role: activeRole });

      if (activeRole === 'admin') router.push('/admin');
      else if (activeRole === 'driver') router.push('/driver');
      else router.push('/passenger');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Error al iniciar sesión. Revisa tus credenciales.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '36px 28px', boxShadow: '0 20px 40px rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.1)', background: '#0F172A', borderRadius: '18px' }}>
      
      {/* Cabecera del formulario */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '28px', textAlign: 'center' }}>
        <Logo width="150" height="52" />
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '9999px',
            color: '#FBBF24',
            fontSize: '0.75rem',
            fontWeight: 800,
            textTransform: 'uppercase',
          }}
        >
          <IconoColectivo size={14} color="#FBBF24" />
          <span>ACCESO TAXIS COLECTIVOS</span>
        </div>
        <p style={{ color: '#94A3B8', fontSize: '0.85rem', margin: 0 }}>
          Ingresa a tu cuenta para acceder a tu línea de colectivo
        </p>
      </div>

      {/* Selector de Rol */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr 0.8fr',
          gap: '4px',
          padding: '4px',
          background: 'rgba(15, 23, 42, 0.8)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          marginBottom: '16px',
        }}
      >
        <button
          type="button"
          id="role-driver"
          onClick={() => setRole('driver')}
          style={{
            padding: '10px 6px',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 800,
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
            background: role === 'driver' ? '#F59E0B' : 'transparent',
            color: role === 'driver' ? '#0F172A' : '#94A3B8',
            boxShadow: role === 'driver' ? '0 2px 8px rgba(245, 158, 11, 0.3)' : 'none',
          }}
        >
          <IconoAuto size={15} color={role === 'driver' ? '#0F172A' : '#94A3B8'} />
          Conductor
        </button>

        <button
          type="button"
          id="role-passenger"
          onClick={() => setRole('passenger')}
          style={{
            padding: '10px 6px',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 800,
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
            background: role === 'passenger' ? '#10B981' : 'transparent',
            color: role === 'passenger' ? '#FFFFFF' : '#94A3B8',
            boxShadow: role === 'passenger' ? '0 2px 8px rgba(16, 185, 129, 0.3)' : 'none',
          }}
        >
          <IconoPasajero size={15} color={role === 'passenger' ? '#FFFFFF' : '#94A3B8'} />
          Pasajero
        </button>

        <button
          type="button"
          id="role-admin"
          onClick={() => setRole('admin')}
          style={{
            padding: '10px 6px',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            transition: 'all 0.2s ease',
            background: role === 'admin' ? '#A78BFA' : 'transparent',
            color: role === 'admin' ? '#0F172A' : '#94A3B8',
          }}
        >
          <IconoLlave size={14} color={role === 'admin' ? '#0F172A' : '#94A3B8'} />
          Admin
        </button>
      </div>

      {/* Bajada explicativa del rol seleccionado */}
      <div
        style={{
          padding: '8px 12px',
          background: role === 'driver' ? 'rgba(245, 158, 11, 0.08)' : role === 'passenger' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(167, 139, 250, 0.08)',
          borderLeft: `3px solid ${role === 'driver' ? '#F59E0B' : role === 'passenger' ? '#10B981' : '#A78BFA'}`,
          borderRadius: '6px',
          marginBottom: '24px',
          fontSize: '0.8rem',
          color: '#CBD5E1',
          lineHeight: 1.5,
        }}
      >
        {role === 'driver' && (
          <span>Acceso para conductores: inicia tu turno en línea, transmite tu GPS y llena tus 4 asientos con voz manos libres.</span>
        )}
        {role === 'passenger' && (
          <span>Acceso para pasajeros: mira tus colectivos en el mapa, conoce los minutos de llegada y reserva tu asiento.</span>
        )}
        {role === 'admin' && (
          <span>Acceso administrativo para gestión y supervisión de flota de la línea de colectivos.</span>
        )}
      </div>

      {/* Alerta de error */}
      {error && (
        <div
          style={{
            marginBottom: '20px',
            padding: '12px 14px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#F87171',
            fontSize: '0.85rem',
          }}
        >
          <IconoAlerta size={18} color="#EF4444" />
          <span>{error}</span>
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: '#CBD5E1', fontWeight: 600 }}>
            Correo Electrónico
          </label>
          <input
            id="login-email"
            type="email"
            placeholder={role === 'driver' ? 'conductor@fimchile.cl' : 'pasajero@fimchile.cl'}
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '10px',
              background: '#09090F',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#F8FAFC',
              fontSize: '0.9rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: '#CBD5E1', fontWeight: 600 }}>
            Contraseña
          </label>
          <input
            id="login-password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: '10px',
              background: '#09090F',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#F8FAFC',
              fontSize: '0.9rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          id="login-submit"
          type="submit"
          disabled={loading}
          style={{
            marginTop: '8px',
            padding: '14px',
            borderRadius: '10px',
            border: 'none',
            background: role === 'driver'
              ? 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
              : role === 'passenger'
              ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
              : 'linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)',
            color: role === 'passenger' ? '#FFFFFF' : '#0F172A',
            fontWeight: 800,
            fontSize: '0.95rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
            transition: 'transform 0.2s ease',
          }}
        >
          {loading ? 'Verificando...' : `Iniciar Sesión como ${role === 'driver' ? 'Conductor' : role === 'passenger' ? 'Pasajero' : 'Admin'} →`}
        </button>
      </form>

      {/* Registro */}
      <div style={{ marginTop: '24px', textAlign: 'center', color: '#94A3B8', fontSize: '0.85rem' }}>
        ¿No tienes cuenta?{' '}
        <Link
          href={`/register?role=${role}`}
          style={{
            color: role === 'driver' ? '#F59E0B' : '#10B981',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          Regístrate gratis
        </Link>
      </div>

      {/* Cuentas de Prueba Oficiales */}
      <div
        style={{
          marginTop: '24px',
          padding: '12px 14px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '10px',
          border: '1px dashed rgba(255, 255, 255, 0.12)',
          fontSize: '0.78rem',
          color: '#94A3B8',
          lineHeight: 1.7,
        }}
      >
        <div style={{ fontWeight: 700, color: '#F1F5F9', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <IconoLlave size={14} color="#FBBF24" />
          <span>Cuentas activas de prueba (FIM Colectivo):</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
          <IconoColectivo size={13} color="#F59E0B" />
          <span><b>Chofer:</b> <code style={{ color: '#FBBF24' }}>conductor@fimchile.cl</code> / Clave: <code style={{ color: '#FBBF24' }}>test123</code></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
          <IconoPasajero size={13} color="#10B981" />
          <span><b>Pasajero:</b> <code style={{ color: '#34D399' }}>pasajero@fimchile.cl</code> / Clave: <code style={{ color: '#34D399' }}>test123</code></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <IconoLlave size={13} color="#A78BFA" />
          <span><b>Admin:</b> <code style={{ color: '#C084FC' }}>admin@fimchile.cl</code> / Clave: <code style={{ color: '#C084FC' }}>admin123</code></span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div
      style={{
        background: '#09090F',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '24px 16px',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', top: '20px', left: '20px' }}>
        <Link
          href="/"
          style={{
            color: '#94A3B8',
            fontSize: '0.85rem',
            fontWeight: 600,
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          ← Regresar al inicio
        </Link>
      </div>

      <Suspense fallback={<div style={{ color: '#94A3B8', fontSize: '0.9rem' }}>Cargando acceso FIM Colectivo...</div>}>
        <ContenidoLogin />
      </Suspense>
    </div>
  );
}
