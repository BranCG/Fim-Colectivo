'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api, { clearSession, getSession } from '@/lib/api';
import { connectSocket } from '@/lib/socket';

interface LineaColectivo {
  id: string;
  nombre: string;
  codigo: string;
  tarifa: number;
  color: string;
}

interface ReservaPasajero {
  id: string;
  pasajero: {
    id: string;
    name: string;
    phone: string;
  };
  cantidadAsientos: number;
  tarifa: number;
  metodoPago: string;
  direccionSubida?: string;
  estado: string;
}

export default function PaginaConductorColectivo() {
  const router = useRouter();
  const [choferSesion, setChoferSesion] = useState<any>(null);

  // Estados del colectivo
  const [lineasDisponibles, setLineasDisponibles] = useState<LineaColectivo[]>([]);
  const [lineaActual, setLineaActual] = useState<LineaColectivo | null>(null);
  const [enServicio, setEnServicio] = useState<boolean>(false);
  const [asientosOcupados, setAsientosOcupados] = useState<number>(0);
  const [sentidoRuta, setSentidoRuta] = useState<'ida' | 'vuelta'>('ida');

  // Reservas de pasajeros
  const [reservasPendientes, setReservasPendientes] = useState<ReservaPasajero[]>([]);

  // Configuración de cobros
  const [telefonoRutPay, setTelefonoRutPay] = useState<string>('');
  const [linkMercadoPago, setLinkMercadoPago] = useState<string>('');
  const [guardandoCobro, setGuardandoCobro] = useState<boolean>(false);

  // Mensajes de alerta y feedback
  const [mensajeExito, setMensajeExito] = useState<string>('');
  const [mensajeError, setMensajeError] = useState<string>('');

  // Referencia a rastreo GPS
  const watchIdRef = useRef<number | null>(null);

  // 1. Validar autenticación de chofer
  useEffect(() => {
    const sesion = getSession();
    if (!sesion) {
      router.push('/login');
      return;
    }
    setChoferSesion(sesion.user);
  }, [router]);

  // 2. Cargar datos del chofer y líneas disponibles
  const cargarDatosChofer = useCallback(async () => {
    try {
      const [resEstado, resLineas] = await Promise.all([
        api.get('/colectivos/conductor/estado').catch(() => null),
        api.get('/colectivos/lineas'),
      ]);

      const lineas: LineaColectivo[] = resLineas.data.lineas || [];
      setLineasDisponibles(lineas);

      if (resEstado?.data?.chofer) {
        const datos = resEstado.data.chofer;
        setEnServicio(datos.isOnline || false);
        setAsientosOcupados(datos.asientosOcupados || 0);
        setSentidoRuta(datos.sentidoRuta || 'ida');
        setTelefonoRutPay(datos.telefonoRutPay || '');
        setLinkMercadoPago(datos.mercadoPagoLink || '');

        if (datos.linea) {
          setLineaActual(datos.linea);
        } else if (lineas.length > 0) {
          setLineaActual(lineas[0]);
        }

        if (datos.reservasAsiento) {
          setReservasPendientes(datos.reservasAsiento);
        }
      } else if (lineas.length > 0) {
        setLineaActual(lineas[0]);
      }
    } catch (error) {
      console.error('Error al cargar datos del chofer:', error);
      setMensajeError('No se pudo sincronizar el estado del chofer.');
    }
  }, []);

  useEffect(() => {
    cargarDatosChofer();
  }, [cargarDatosChofer]);

  // 3. WebSockets y transmisión de ubicación en tiempo real
  useEffect(() => {
    if (!choferSesion?.id) return;

    const socket = connectSocket();

    // Evento al recibir una nueva reserva de asiento
    const manejarNuevaReserva = (datos: { reserva: any }) => {
      setReservasPendientes((prev) => [datos.reserva, ...prev]);
      setMensajeExito(`🔔 ¡Nueva reserva de asiento! Pasajero: ${datos.reserva.pasajero.name}`);
    };

    // Evento si el pasajero cancela
    const manejarReservaCancelada = (datos: { reservaId: string }) => {
      setReservasPendientes((prev) => prev.filter((r) => r.id !== datos.reservaId));
      setMensajeExito('ℹ️ Una reserva fue cancelada por el pasajero.');
    };

    socket.on('colectivo:nueva-reserva', manejarNuevaReserva);
    socket.on('colectivo:reserva-cancelada', manejarReservaCancelada);

    // Si está en servicio, transmitir ubicación GPS continua
    if (enServicio && typeof window !== 'undefined' && 'geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (posicion) => {
          socket.emit('driver:location', {
            driverId: choferSesion.id,
            lat: posicion.coords.latitude,
            lng: posicion.coords.longitude,
          });
        },
        (err) => console.warn('Error en GPS del chofer:', err),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    } else if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    return () => {
      socket.off('colectivo:nueva-reserva', manejarNuevaReserva);
      socket.off('colectivo:reserva-cancelada', manejarReservaCancelada);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enServicio, choferSesion]);

  // Alternar estado En Servicio / Fuera de Servicio
  const alternarServicio = async () => {
    const nuevoEstado = !enServicio;
    setEnServicio(nuevoEstado);

    const socket = connectSocket();
    if (nuevoEstado && typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        socket.emit('driver:online', {
          driverId: choferSesion.id,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      });
    }

    setMensajeExito(nuevoEstado ? '🟢 Turno iniciado: En servicio' : '🔴 Turno finalizado: Fuera de servicio');
  };

  // Asignar línea de colectivo
  const cambiarLineaColectivo = async (nuevaLineaId: string) => {
    try {
      await api.post('/colectivos/conductor/linea', { lineaId: nuevaLineaId });
      const lineaEncontrada = lineasDisponibles.find((l) => l.id === nuevaLineaId) || null;
      setLineaActual(lineaEncontrada);
      setMensajeExito(`Línea cambiada a ${lineaEncontrada?.nombre}`);
    } catch (error) {
      console.error('Error al cambiar línea:', error);
      setMensajeError('No se pudo cambiar la línea.');
    }
  };

  // Modificar asientos ocupados (+ / -)
  const modificarAsientos = async (delta: number) => {
    const nuevoTotal = Math.max(0, Math.min(4, asientosOcupados + delta));
    setAsientosOcupados(nuevoTotal);
    try {
      await api.post('/colectivos/conductor/asientos', { asientosOcupados: nuevoTotal });
    } catch (error) {
      console.error('Error al actualizar asientos:', error);
      setMensajeError('No se pudo actualizar la cantidad de asientos.');
    }
  };

  // Cambiar sentido de ruta (Ida <-> Vuelta)
  const alternarSentido = async () => {
    const nuevoSentido = sentidoRuta === 'ida' ? 'vuelta' : 'ida';
    setSentidoRuta(nuevoSentido);
    try {
      await api.post('/colectivos/conductor/sentido', { sentidoRuta: nuevoSentido });
      setMensajeExito(`Sentido cambiado a ${nuevoSentido.toUpperCase()}`);
    } catch (error) {
      console.error('Error al cambiar sentido:', error);
      setMensajeError('No se pudo cambiar el sentido de la ruta.');
    }
  };

  // Confirmar abordaje de un pasajero
  const confirmarAbordaje = async (reservaId: string) => {
    try {
      const res = await api.post(`/colectivos/reservas/${reservaId}/abordar`);
      setReservasPendientes((prev) => prev.filter((r) => r.id !== reservaId));
      if (res.data.chofer) {
        setAsientosOcupados(res.data.chofer.asientosOcupados);
      }
      setMensajeExito('✅ Abordaje confirmado. Asiento ocupado.');
    } catch (error) {
      console.error('Error al confirmar abordaje:', error);
      setMensajeError('No se pudo confirmar el abordaje.');
    }
  };

  // Cancelar reserva de pasajero
  const cancelarReservaPasajero = async (reservaId: string) => {
    try {
      await api.post(`/colectivos/reservas/${reservaId}/cancelar`);
      setReservasPendientes((prev) => prev.filter((r) => r.id !== reservaId));
      setMensajeExito('Reserva cancelada.');
    } catch (error) {
      console.error('Error al cancelar reserva:', error);
      setMensajeError('No se pudo cancelar la reserva.');
    }
  };

  // Guardar datos de cobro (RutPay y MercadoPago)
  const guardarDatosCobro = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardandoCobro(true);
    try {
      await api.put('/colectivos/conductor/datos-pago', {
        telefonoRutPay,
        linkMercadoPago,
      });
      setMensajeExito('✅ Métodos de cobro actualizados correctamente.');
    } catch (error) {
      console.error('Error al guardar datos de pago:', error);
      setMensajeError('No se pudieron actualizar los métodos de cobro.');
    } finally {
      setGuardandoCobro(false);
    }
  };

  // Cerrar sesión
  const cerrarSesionChofer = () => {
    clearSession();
    router.push('/login');
  };

  const asientosLibres = Math.max(0, 4 - asientosOcupados);

  return (
    <div style={{ minHeight: '100vh', background: '#0B1329', color: '#F1F5F9', padding: '16px' }}>
      {/* ── Encabezado ── */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '28px' }}>🚐</span>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800' }}>
              Panel <span style={{ color: '#F59E0B' }}>Chofer Colectivo</span>
            </h1>
            <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
              {choferSesion ? choferSesion.name : 'Conductor'}
            </p>
          </div>
        </div>

        <button
          onClick={cerrarSesionChofer}
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#F87171',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          Salir
        </button>
      </header>

      {/* ── Alertas ── */}
      {mensajeExito && (
        <div style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10B981', padding: '10px 14px', borderRadius: '8px', color: '#6EE7B7', marginBottom: '16px', fontSize: '13px' }}>
          {mensajeExito}
        </div>
      )}
      {mensajeError && (
        <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #EF4444', padding: '10px 14px', borderRadius: '8px', color: '#FCA5A5', marginBottom: '16px', fontSize: '13px' }}>
          {mensajeError}
        </div>
      )}

      {/* ── Botón Principal de Turno (En Servicio / Fuera de Servicio) ── */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={alternarServicio}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '800',
            border: 'none',
            cursor: 'pointer',
            background: enServicio
              ? 'linear-gradient(135deg, #10B981, #059669)'
              : 'linear-gradient(135deg, #334155, #1E293B)',
            color: '#FFFFFF',
            boxShadow: enServicio
              ? '0 6px 20px rgba(16, 185, 129, 0.4)'
              : '0 4px 12px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            letterSpacing: '0.5px',
          }}
        >
          <span style={{ fontSize: '20px' }}>{enServicio ? '🟢' : '⚪'}</span>
          {enServicio ? 'EN SERVICIO (TRANSMITIENDO GPS)' : 'FUERA DE SERVICIO (TOCA PARA INICIAR)'}
        </button>
      </div>

      {/* ── Control Rápido de Asientos (Grande e Intuitivo) ── */}
      <section style={{
        background: '#1E293B',
        borderRadius: '16px',
        padding: '20px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#F8FAFC' }}>
            Control de Asientos en Ruta
          </h2>
          <span style={{
            fontSize: '12px',
            fontWeight: '700',
            padding: '4px 10px',
            borderRadius: '12px',
            background: asientosLibres === 0 ? '#EF4444' : '#10B981',
            color: '#FFF',
          }}>
            {asientosLibres === 0 ? 'COLECTIVO LLENO' : `${asientosLibres} ASIENTOS LIBRES`}
          </span>
        </div>

        {/* Visualizador de los 4 Asientos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '18px' }}>
          {[1, 2, 3, 4].map((numeroAsiento) => {
            const estaOcupado = numeroAsiento <= asientosOcupados;
            return (
              <div
                key={numeroAsiento}
                style={{
                  height: '70px',
                  borderRadius: '12px',
                  background: estaOcupado ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                  border: estaOcupado ? '2px solid #EF4444' : '2px solid #10B981',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                }}
              >
                <span style={{ fontSize: '20px' }}>{estaOcupado ? '👤' : '💺'}</span>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: estaOcupado ? '#F87171' : '#34D399' }}>
                  {estaOcupado ? 'Ocupado' : 'Libre'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Botones Grandes de + y - */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => modificarAsientos(-1)}
            disabled={asientosOcupados <= 0}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: '12px',
              background: '#334155',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '18px',
              fontWeight: '800',
              cursor: asientosOcupados <= 0 ? 'not-allowed' : 'pointer',
              opacity: asientosOcupados <= 0 ? 0.4 : 1,
            }}
          >
            - Bajó Pasajero
          </button>
          <button
            onClick={() => modificarAsientos(1)}
            disabled={asientosOcupados >= 4}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: '12px',
              background: '#2563EB',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '18px',
              fontWeight: '800',
              cursor: asientosOcupados >= 4 ? 'not-allowed' : 'pointer',
              opacity: asientosOcupados >= 4 ? 0.4 : 1,
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
            }}
          >
            + Subió Pasajero
          </button>
        </div>
      </section>

      {/* ── Selección de Línea y Sentido de Ruta ── */}
      <section style={{
        background: '#1E293B',
        borderRadius: '16px',
        padding: '18px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        marginBottom: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}>
        <div>
          <label style={{ display: 'block', fontSize: '13px', color: '#94A3B8', marginBottom: '6px' }}>
            Línea Asignada:
          </label>
          <select
            value={lineaActual?.id || ''}
            onChange={(e) => cambiarLineaColectivo(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '10px',
              background: '#0F172A',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: '600',
            }}
          >
            {lineasDisponibles.map((linea) => (
              <option key={linea.id} value={linea.id}>
                {linea.nombre} (${linea.tarifa} CLP)
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '13px', color: '#94A3B8' }}>Sentido Actual:</span>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#38BDF8', textTransform: 'uppercase' }}>
              {sentidoRuta}
            </div>
          </div>
          <button
            onClick={alternarSentido}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              background: '#334155',
              color: '#F8FAFC',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            🔄 Cambiar a {sentidoRuta === 'ida' ? 'Vuelta' : 'Ida'}
          </button>
        </div>
      </section>

      {/* ── Reservas Solicitadas por Pasajeros ── */}
      <section style={{
        background: '#1E293B',
        borderRadius: '16px',
        padding: '18px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        marginBottom: '20px',
      }}>
        <h2 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '700' }}>
          Reservas de Asiento Activas ({reservasPendientes.length})
        </h2>

        {reservasPendientes.length === 0 ? (
          <p style={{ margin: 0, fontSize: '13px', color: '#64748B' }}>
            No hay solicitudes de reserva en este momento.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {reservasPendientes.map((reserva) => (
              <div
                key={reserva.id}
                style={{
                  background: '#0F172A',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700' }}>
                      {reserva.pasajero.name} ({reserva.cantidadAsientos} asiento/s)
                    </h4>
                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                      Pago: <b>{reserva.metodoPago.toUpperCase()}</b> • Tel: {reserva.pasajero.phone}
                    </span>
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: '800', color: '#38BDF8' }}>
                    ${reserva.tarifa} CLP
                  </span>
                </div>

                {reserva.direccionSubida && (
                  <p style={{ margin: 0, fontSize: '12px', color: '#CBD5E1' }}>
                    📍 Parada solicitada: {reserva.direccionSubida}
                  </p>
                )}

                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button
                    onClick={() => confirmarAbordaje(reserva.id)}
                    style={{
                      flex: 2,
                      padding: '8px',
                      borderRadius: '8px',
                      background: '#10B981',
                      color: '#FFF',
                      border: 'none',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    ✓ Marcar Abordaje
                  </button>
                  <button
                    onClick={() => cancelarReservaPasajero(reserva.id)}
                    style={{
                      flex: 1,
                      padding: '8px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.2)',
                      color: '#F87171',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    ✕ Cancelar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Métodos de Cobro del Chofer (RutPay BancoEstado y MercadoPago) ── */}
      <section style={{
        background: '#1E293B',
        borderRadius: '16px',
        padding: '18px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        marginBottom: '20px',
      }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '700' }}>
          Configuración de Cobro Directo
        </h2>
        <p style={{ margin: '0 0 14px 0', fontSize: '12px', color: '#94A3B8' }}>
          Los pasajeros podrán pagar directamente con transferencia RutPay o MercadoPago.
        </p>

        <form onSubmit={guardarDatosCobro} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#CBD5E1', marginBottom: '4px' }}>
              🏦 Teléfono o RUT para RutPay BancoEstado:
            </label>
            <input
              type="text"
              value={telefonoRutPay}
              onChange={(e) => setTelefonoRutPay(e.target.value)}
              placeholder="+56912345678 o 12.345.678-9"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                background: '#0F172A',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#FFF',
                fontSize: '13px',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#CBD5E1', marginBottom: '4px' }}>
              💳 Link Directo de MercadoPago (opcional):
            </label>
            <input
              type="text"
              value={linkMercadoPago}
              onChange={(e) => setLinkMercadoPago(e.target.value)}
              placeholder="https://mpago.li/..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                background: '#0F172A',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#FFF',
                fontSize: '13px',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={guardandoCobro}
            style={{
              padding: '10px',
              borderRadius: '8px',
              background: '#2563EB',
              color: '#FFF',
              border: 'none',
              fontWeight: '700',
              fontSize: '13px',
              cursor: guardandoCobro ? 'not-allowed' : 'pointer',
            }}
          >
            {guardandoCobro ? 'Guardando...' : 'Guardar Métodos de Cobro'}
          </button>
        </form>
      </section>
    </div>
  );
}
