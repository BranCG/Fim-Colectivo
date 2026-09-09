'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api, { saveSession } from '@/lib/api';
import Logo from '@/components/Logo';
import {
  IconoAlerta,
  IconoPasajero,
  IconoAuto,
  IconoLlave,
} from '@/components/icons/Iconos';

type Role = 'driver' | 'passenger' | 'admin';

function ContenidoLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();

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
      setError(e.response?.data?.error || 'Credenciales incorrectas. Verifica correo y contraseña.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '400px',
        padding: '36px 28px',
        background: '#0A0A0A',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '18px',
        boxShadow: '0 24px 48px rgba(0, 0, 0, 0.9)',
        boxSizing: 'border-box',
      }}
    >
      {/* Logo y Encabezado limpio */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px', textAlign: 'center' }}>
        <Logo width="130" height="46" />
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#FFFFFF', margin: '14px 0 4px 0', letterSpacing: '-0.4px' }}>
          Iniciar Sesión
        </h1>
        <p style={{ color: '#A3A3A3', fontSize: '13px', margin: 0 }}>
          Ingresa a tu cuenta de Fim Colectivo
        </p>
      </div>

      {/* Selector de Rol Minimalista (Negro y Amarillo) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 0.8fr',
          gap: '4px',
          padding: '4px',
          background: '#000000',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          marginBottom: '22px',
        }}
      >
        <button
          type="button"
          id="role-driver"
          onClick={() => setRole('driver')}
          style={{
            padding: '9px 6px',
            border: 'none',
            borderRadius: '7px',
            cursor: 'pointer',
            fontWeight: role === 'driver' ? 800 : 600,
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
            background: role === 'driver' ? '#FACC15' : 'transparent',
            color: role === 'driver' ? '#000000' : '#A3A3A3',
          }}
        >
          <IconoAuto size={14} color={role === 'driver' ? '#000000' : '#A3A3A3'} />
          <span>Conductor</span>
        </button>

        <button
          type="button"
          id="role-passenger"
          onClick={() => setRole('passenger')}
          style={{
            padding: '9px 6px',
            border: 'none',
            borderRadius: '7px',
            cursor: 'pointer',
            fontWeight: role === 'passenger' ? 800 : 600,
            fontSize: '12.5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.15s ease',
            background: role === 'passenger' ? '#FACC15' : 'transparent',
            color: role === 'passenger' ? '#000000' : '#A3A3A3',
          }}
        >
          <IconoPasajero size={14} color={role === 'passenger' ? '#000000' : '#A3A3A3'} />
          <span>Pasajero</span>
        </button>

        <button
          type="button"
          id="role-admin"
          onClick={() => setRole('admin')}
          style={{
            padding: '9px 6px',
            border: 'none',
            borderRadius: '7px',
            cursor: 'pointer',
            fontWeight: role === 'admin' ? 800 : 600,
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            transition: 'all 0.15s ease',
            background: role === 'admin' ? '#FACC15' : 'transparent',
            color: role === 'admin' ? '#000000' : '#A3A3A3',
          }}
        >
          <IconoLlave size={13} color={role === 'admin' ? '#000000' : '#A3A3A3'} />
          <span>Admin</span>
        </button>
      </div>

      {/* Alerta de error limpia */}
      {error && (
        <div
          style={{
            marginBottom: '18px',
            padding: '10px 12px',
            background: '#171717',
            border: '1px solid #FACC15',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#FFFFFF',
            fontSize: '12.5px',
          }}
        >
          <IconoAlerta size={16} color="#FACC15" />
          <span>{error}</span>
        </div>
      )}

      {/* Formulario de Login */}
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#D4D4D4', fontWeight: 600 }}>
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
              borderRadius: '8px',
              background: '#000000',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              color: '#FFFFFF',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#FACC15')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)')}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#D4D4D4', fontWeight: 600 }}>
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
              borderRadius: '8px',
              background: '#000000',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              color: '#FFFFFF',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#FACC15')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.18)')}
          />
        </div>

        <button
          id="login-submit"
          type="submit"
          disabled={loading}
          style={{
            marginTop: '6px',
            padding: '13px',
            borderRadius: '8px',
            border: 'none',
            background: '#FACC15',
            color: '#000000',
            fontWeight: 800,
            fontSize: '14px',
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 16px rgba(250, 204, 21, 0.25)',
            transition: 'transform 0.1s, opacity 0.15s',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Ingresando...' : 'Iniciar Sesión'}
        </button>
      </form>

      {/* Enlace inferior minimalista */}
      <div style={{ marginTop: '22px', textAlign: 'center', color: '#A3A3A3', fontSize: '13px' }}>
        ¿No tienes cuenta?{' '}
        <Link
          href={`/register?role=${role}`}
          style={{
            color: '#FACC15',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          Regístrate gratis
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div
      style={{
        background: '#000000',
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
      <div style={{ position: 'absolute', top: '24px', left: '24px' }}>
        <Link
          href="/"
          style={{
            color: '#A3A3A3',
            fontSize: '13px',
            fontWeight: 600,
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#FFFFFF')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#A3A3A3')}
        >
          ← Volver al inicio
        </Link>
      </div>

      <Suspense fallback={<div style={{ color: '#FACC15', fontSize: '14px', fontWeight: 600 }}>Cargando Fim Colectivo...</div>}>
        <ContenidoLogin />
      </Suspense>
    </div>
  );
}
