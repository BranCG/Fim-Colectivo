'use client';

import React, { useEffect, useState, useRef } from 'react';
import { hablarTexto, iniciarEscuchaVoz, reproducirSonido, detenerVoz } from '@/lib/voice';
import { IconoCheck, IconoCruz, IconoAsiento, IconoReloj } from '@/components/icons/Iconos';

export interface DatosSolicitudDirigida {
  reservaId: string;
  nombrePasajero: string;
  cantidadAsientos: number;
  distanciaMetros: number;
  tiempoLimiteSegundos?: number;
  direccionSubida?: string;
  pasajeroNombre?: string;
  asientos?: number;
}

interface Props {
  solicitud: DatosSolicitudDirigida;
  alAceptar: (reservaId: string) => void;
  alRechazar: (reservaId: string) => void;
  alExpirar: (reservaId: string) => void;
}

export default function AlertaVozReserva({
  solicitud,
  alAceptar,
  alRechazar,
  alExpirar,
}: Props) {
  const tiempoTotal = solicitud.tiempoLimiteSegundos || 15;
  const [segundosRestantes, setSegundosRestantes] = useState(tiempoTotal);
  const [escuchandoVoz, setEscuchandoVoz] = useState(false);
  const [anunciandoVoz, setAnunciandoVoz] = useState(true);
  const [textoDetectado, setTextoDetectado] = useState('');
  const [comandoDetectado, setComandoDetectado] = useState<'si' | 'no' | null>(null);
  const [respondido, setRespondido] = useState(false);

  const escuchaRef = useRef<{ detener: () => void } | null>(null);

  // Estimación cuantitativa de llegada a recoger al pasajero
  const minutosLlegada = Math.max(1, Math.round((solicitud.distanciaMetros * 1.25) / 400));
  const textoDistancia = solicitud.distanciaMetros >= 1000
    ? `${(solicitud.distanciaMetros / 1000).toFixed(1)} km`
    : `${solicitud.distanciaMetros} m`;

  const nombre = (solicitud.nombrePasajero || 'Pasajero').split(' ')[0];
  const asientos = solicitud.cantidadAsientos || 1;
  const textoAsientos = asientos === 1 ? 'un asiento' : `${asientos} asientos`;
  const textoVoz = `${nombre}, ${textoAsientos}. ¿Tomamos?`;

  // 1. Al montar: Notificar por Chime y Text-to-Speech (TTS), luego activar micrófono
  useEffect(() => {
    // Sonido de alerta chime inicial
    reproducirSonido('alerta');

    // Iniciar escucha del micrófono
    escuchaRef.current = iniciarEscuchaVoz({
      onSi: () => {
        setComandoDetectado('si');
        setTextoDetectado('¡SÍ TOMAR!');
        manejarAceptar();
      },
      onNo: () => {
        setComandoDetectado('no');
        setTextoDetectado('¡NO PASAR!');
        manejarRechazar();
      },
      onEscuchando: (activo) => {
        setEscuchandoVoz(activo);
      },
      onTextoDetectado: (texto) => {
        setTextoDetectado(texto);
      },
    });

    // Permitir que el doble tono de aviso de reserva suene limpio antes de iniciar la locución
    const timerInicioVoz = setTimeout(() => {
      hablarTexto(textoVoz, () => {
        setAnunciandoVoz(false);
      });
    }, 300);

    return () => {
      clearTimeout(timerInicioVoz);
      detenerVoz();
      if (escuchaRef.current) {
        try {
          escuchaRef.current.detener();
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitud]);

  // 2. Temporizador regresivo de 15 segundos
  useEffect(() => {
    if (respondido) return;

    const intervalo = setInterval(() => {
      setSegundosRestantes((prev) => {
        if (prev <= 1) {
          clearInterval(intervalo);
          manejarExpiracion();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [respondido]);

  // Acciones de respuesta
  const manejarAceptar = () => {
    if (respondido) return;
    setRespondido(true);
    detenerVoz();
    if (escuchaRef.current) {
      try {
        escuchaRef.current.detener();
      } catch {}
    }

    try {
      reproducirSonido('exito');
    } catch {}

    try {
      alAceptar(solicitud.reservaId);
    } catch (err) {
      console.error('Error en alAceptar:', err);
    }
  };

  const manejarRechazar = () => {
    if (respondido) return;
    setRespondido(true);
    detenerVoz();
    if (escuchaRef.current) {
      try {
        escuchaRef.current.detener();
      } catch {}
    }

    try {
      reproducirSonido('rechazo');
    } catch {}

    try {
      alRechazar(solicitud.reservaId);
    } catch (err) {
      console.error('Error en alRechazar:', err);
    }
  };

  const manejarExpiracion = () => {
    if (respondido) return;
    setRespondido(true);
    detenerVoz();
    if (escuchaRef.current) {
      try {
        escuchaRef.current.detener();
      } catch {}
    }

    try {
      reproducirSonido('rechazo');
    } catch {}

    try {
      alExpirar(solicitud.reservaId);
    } catch (err) {
      console.error('Error en alExpirar:', err);
    }
  };

  const porcentajeTiempo = (segundosRestantes / tiempoTotal) * 100;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#000000',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        userSelect: 'none',
      }}
    >
      {/* ── BARRA SUPERIOR DE CONTEXTO Y TEMPORIZADOR ── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          padding: '12px 16px',
          background: 'rgba(10, 10, 10, 0.95)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#FACC15',
              boxShadow: '0 0 12px #FACC15',
              animation: 'fimPulse 1.2s infinite ease-out',
            }}
          />
          <div>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#FFFFFF', letterSpacing: '-0.2px' }}>
              NUEVO PASAJERO EN RUTA
            </div>
            <div style={{ fontSize: '11px', color: '#A3A3A3' }}>
              {solicitud.direccionSubida || 'En tu trayectoria'}
            </div>
          </div>
        </div>

        {/* Indicador de Escucha por Voz */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: anunciandoVoz ? 'rgba(255, 255, 255, 0.08)' : escuchandoVoz ? 'rgba(250, 204, 21, 0.2)' : 'rgba(255, 255, 255, 0.08)',
            border: anunciandoVoz ? '1px solid rgba(255, 255, 255, 0.2)' : escuchandoVoz ? '1.5px solid #FACC15' : '1px solid rgba(255, 255, 255, 0.1)',
            padding: '5px 12px',
            borderRadius: '20px',
            maxWidth: '60%',
          }}
        >
          {anunciandoVoz ? (
            <span style={{ fontSize: '13px' }}>🔊</span>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={escuchandoVoz ? '#FACC15' : '#A3A3A3'} strokeWidth="2.5">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          )}
          <span style={{ fontSize: '11px', fontWeight: '800', color: anunciandoVoz ? '#D4D4D4' : escuchandoVoz ? '#FACC15' : '#A3A3A3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {anunciandoVoz ? 'ANUNCIANDO...' : textoDetectado ? `"${textoDetectado}"` : 'DI "SÍ" O "NO"'}
          </span>
        </div>
      </div>

      {/* ── BOTÓN GIGANTE SUPERIOR: SÍ (ACEPTAR / TOMAR) EN AMARILLO COLECTIVO ── */}
      <button
        type="button"
        onClick={manejarAceptar}
        style={{
          flex: 1.2,
          width: '100%',
          background: '#FACC15',
          border: 'none',
          color: '#000000',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px 20px 20px',
          cursor: 'pointer',
          touchAction: 'manipulation',
          transition: 'all 0.1s ease',
          boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.15)',
        }}
      >
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.15)',
            borderRadius: '50%',
            width: '80px',
            height: '80px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
          }}
        >
          <IconoCheck size={48} color="#000000" />
        </div>

        <div style={{ fontSize: '38px', fontWeight: '900', letterSpacing: '1px', textTransform: 'uppercase' }}>
          SÍ — TOMAR
        </div>

        <div
          style={{
            marginTop: '8px',
            fontSize: '15px',
            fontWeight: '700',
            background: 'rgba(0, 0, 0, 0.15)',
            color: '#000000',
            padding: '6px 14px',
            borderRadius: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: '6px',
            maxWidth: '92%',
            textAlign: 'center',
          }}
        >
          <span>{solicitud.nombrePasajero.split(' ')[0]}</span>
          <span>•</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <IconoReloj size={15} color="#000000" />
            <span>LLEGAS EN ~{minutosLlegada} MIN ({textoDistancia})</span>
          </span>
          <span>•</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <IconoAsiento size={16} color="#000000" />
            {solicitud.cantidadAsientos} as.
          </span>
        </div>

        <div style={{ fontSize: '13px', color: 'rgba(0,0,0,0.7)', marginTop: '8px', fontWeight: '700' }}>
          Toca cualquier parte superior o di en voz alta: "SÍ"
        </div>
      </button>

      {/* ── FRANJA CENTRAL: RETROALIMENTACIÓN DE VOZ EN VIVO + TEMPORIZADOR ── */}
      <div
        style={{
          background: '#0D0D0D',
          padding: '12px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          borderTop: '2px solid #FACC15',
          borderBottom: '2px solid #FACC15',
          boxShadow: comandoDetectado === 'si'
            ? '0 0 35px rgba(250, 204, 21, 0.7)'
            : comandoDetectado === 'no'
            ? '0 0 35px rgba(239, 68, 68, 0.7)'
            : '0 0 20px rgba(0, 0, 0, 0.9)',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: comandoDetectado === 'si' ? '#22C55E' : comandoDetectado === 'no' ? '#EF4444' : anunciandoVoz ? '#3B82F6' : '#FACC15',
                boxShadow: comandoDetectado ? '0 0 14px currentColor' : anunciandoVoz ? '0 0 10px #3B82F6' : '0 0 10px #FACC15',
                flexShrink: 0,
                animation: 'fimPulse 1s infinite ease-out',
              }}
            />
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div style={{ fontSize: '10px', fontWeight: '800', color: '#A3A3A3', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                {comandoDetectado
                  ? 'COMANDO RECONOCIDO'
                  : anunciandoVoz
                  ? 'ANUNCIANDO PASAJERO:'
                  : 'MICRÓFONO EN VIVO (DI TU RESPUESTA):'}
              </div>
              <div
                style={{
                  fontSize: '17px',
                  fontWeight: '900',
                  color: comandoDetectado === 'si'
                    ? '#FACC15'
                    : comandoDetectado === 'no'
                    ? '#EF4444'
                    : anunciandoVoz
                    ? '#E5E5E5'
                    : textoDetectado
                    ? '#FFFFFF'
                    : '#FACC15',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textShadow: (textoDetectado || !anunciandoVoz) ? '0 0 10px rgba(250, 204, 21, 0.4)' : 'none',
                }}
              >
                {comandoDetectado === 'si'
                  ? '✓ ¡SÍ DETECTADO!'
                  : comandoDetectado === 'no'
                  ? '✕ ¡PASO DETECTADO!'
                  : anunciandoVoz
                  ? `🔊 ${nombre}, ${textoAsientos}. ¿Tomamos?`
                  : textoDetectado
                  ? `"${textoDetectado}"`
                  : '🎙️ Escuchando... Di "SÍ" o "NO"'}
              </div>
            </div>
          </div>

          <div
            style={{
              fontSize: '18px',
              fontWeight: '900',
              color: '#FACC15',
              padding: '4px 10px',
              borderRadius: '8px',
              background: 'rgba(250, 204, 21, 0.15)',
              border: '1px solid #FACC15',
              flexShrink: 0,
            }}
          >
            {segundosRestantes}s
          </div>
        </div>

        {/* Barra de progreso de tiempo restante */}
        <div
          style={{
            height: '6px',
            borderRadius: '3px',
            background: 'rgba(255, 255, 255, 0.15)',
            overflow: 'hidden',
            width: '100%',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${porcentajeTiempo}%`,
              background: '#FACC15',
              transition: 'width 1s linear',
            }}
          />
        </div>
      </div>

      {/* ── BOTÓN GIGANTE INFERIOR: NO (PASAR AL SIGUIENTE MÓVIL) ── */}
      <button
        type="button"
        onClick={manejarRechazar}
        style={{
          flex: 0.9,
          width: '100%',
          background: '#121212',
          border: 'none',
          color: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          cursor: 'pointer',
          touchAction: 'manipulation',
          transition: 'all 0.1s ease',
          boxShadow: 'inset 0 -4px 20px rgba(0,0,0,0.5)',
        }}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            width: '64px',
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '10px',
            boxShadow: '0 6px 18px rgba(0, 0, 0, 0.4)',
          }}
        >
          <IconoCruz size={36} color="#FFFFFF" />
        </div>

        <div style={{ fontSize: '30px', fontWeight: '900', letterSpacing: '1px', textTransform: 'uppercase' }}>
          NO — PASAR AL SIGUIENTE
        </div>

        <div style={{ fontSize: '13px', color: '#A3A3A3', marginTop: '6px', fontWeight: '600' }}>
          Toca cualquier parte inferior o di en voz alta: "NO"
        </div>
      </button>
    </div>
  );
}
