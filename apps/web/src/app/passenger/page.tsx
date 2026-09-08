'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import api, { clearSession, getSession } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import { Linea, ConductorColectivo } from '@/components/map/ColectivoMap';
import {
  IconoColectivo,
  IconoCheck,
  IconoCruz,
  IconoAlerta,
  IconoGps,
  IconoPuntoEstado,
  IconoBanco,
  IconoTarjeta,
  IconoEfectivo,
  IconoAsiento,
} from '@/components/icons/Iconos';

// Cargar mapa de colectivos de forma dinámica para evitar problemas con SSR en Next.js
const ColectivoMap = dynamic(() => import('@/components/map/ColectivoMap'), { ssr: false });

interface ReservaActiva {
  id: string;
  linea: { nombre: string; tarifa: number };
  conductor: {
    id: string;
    name: string;
    phone: string;
    vehiclePlate: string;
    vehicleBrand: string;
    vehicleModel: string;
    telefonoRutPay?: string | null;
    mercadoPagoLink?: string | null;
  };
  cantidadAsientos: number;
  tarifa: number;
  estado: string; // "reservado", "abordado", "completado"
  metodoPago: string;
}

export default function PaginaPasajeroColectivo() {
  const router = useRouter();
  const [usuarioSesion, setUsuarioSesion] = useState<any>(null);

  // Estados de líneas y colectivos
  const [listaLineas, setListaLineas] = useState<Linea[]>([]);
  const [lineaSeleccionada, setLineaSeleccionada] = useState<Linea | null>(null);
  const [conductoresEnVivo, setConductoresEnVivo] = useState<ConductorColectivo[]>([]);
  const [conductorElegido, setConductorElegido] = useState<ConductorColectivo | null>(null);

  // Estados de reserva
  const [cantidadAsientos, setCantidadAsientos] = useState<number>(1);
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'rutpay' | 'mercadopago'>('efectivo');
  const [reservaActiva, setReservaActiva] = useState<ReservaActiva | null>(null);
  const [cargandoReserva, setCargandoReserva] = useState(false);

  // Estados de pago y bajada
  const [mostrarModalPago, setMostrarModalPago] = useState<boolean>(false);
  const [solicitandoPago, setSolicitandoPago] = useState<boolean>(false);
  const [telefonoCopiado, setTelefonoCopiado] = useState<boolean>(false);

  // Estado de asignación dirigida al primer móvil en tránsito
  const [buscandoMovil, setBuscandoMovil] = useState(false);
  const [movilAsignadoPreview, setMovilAsignadoPreview] = useState<{
    nombre: string;
    patente: string;
    distanciaMetros: number;
  } | null>(null);

  // Ubicación del pasajero
  const [ubicacionPasajero, setUbicacionPasajero] = useState<{
    latitud: number;
    longitud: number;
    direccion?: string;
  } | null>(null);
  const [disparadorCentrado, setDisparadorCentrado] = useState(0);

  // Feedback y mensajes
  const [mensajeAlerta, setMensajeAlerta] = useState<string>('');
  const [mensajeError, setMensajeError] = useState<string>('');

  // Cálculo en tiempo real de asientos libres en la línea seleccionada
  const totalAsientosLibres = useMemo(() => {
    return conductoresEnVivo.reduce(
      (acc, c) => acc + Math.max(0, (c.asientosTotales || 4) - c.asientosOcupados),
      0
    );
  }, [conductoresEnVivo]);

  // 1. Validar autenticación
  useEffect(() => {
    const sesion = getSession();
    if (!sesion) {
      router.push('/login');
      return;
    }
    setUsuarioSesion(sesion.user);
  }, [router]);

  // 2. Obtener geolocalización del pasajero
  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (posicion) => {
          setUbicacionPasajero({
            latitud: posicion.coords.latitude,
            longitud: posicion.coords.longitude,
          });
        },
        (error) => {
          console.warn('Geolocalización desactivada o denegada:', error);
          // Coordenadas por defecto (Centro de Santiago de Chile)
          setUbicacionPasajero({ latitud: -33.4489, longitud: -70.6693 });
        },
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // 3. Cargar líneas de colectivo y reservas activas
  const cargarLineasYReservas = useCallback(async () => {
    try {
      const [respuestaLineas, respuestaReservas] = await Promise.all([
        api.get('/colectivos/lineas'),
        api.get('/colectivos/reservas/mis-reservas').catch(() => ({ data: { reservas: [] } })),
      ]);

      const lineasObtenidas: Linea[] = respuestaLineas.data.lineas || [];
      setListaLineas(lineasObtenidas);

      if (lineasObtenidas.length > 0 && !lineaSeleccionada) {
        setLineaSeleccionada(lineasObtenidas[0]);
      }

      // Si tiene una reserva en curso
      if (respuestaReservas.data?.reservas && respuestaReservas.data.reservas.length > 0) {
        setReservaActiva(respuestaReservas.data.reservas[0]);
      }
    } catch (error) {
      console.error('Error al cargar líneas:', error);
      setMensajeError('No se pudieron obtener las líneas de colectivo disponibles.');
    }
  }, [lineaSeleccionada]);

  useEffect(() => {
    cargarLineasYReservas();
  }, [cargarLineasYReservas]);

  // 4. Conexión WebSocket en tiempo real
  useEffect(() => {
    const socket = connectSocket();

    if (usuarioSesion?.id) {
      socket.emit('pasajero:unirse', { pasajeroId: usuarioSesion.id });
    }

    if (lineaSeleccionada?.id) {
      socket.emit('colectivo:unirse-linea', { lineaId: lineaSeleccionada.id });

      // Cargar los conductores iniciales de la línea
      api.get(`/colectivos/lineas/${lineaSeleccionada.id}`).then((res) => {
        const conductores = res.data.linea?.conductores || [];
        const mapeados: ConductorColectivo[] = conductores.map((c: any) => ({
          conductorId: c.id,
          nombre: c.name,
          patente: c.vehiclePlate,
          latitud: c.lastLat,
          longitud: c.lastLng,
          asientosOcupados: c.asientosOcupados,
          asientosTotales: c.asientosTotales,
          sentidoRuta: c.sentidoRuta,
          telefonoRutPay: c.telefonoRutPay,
          mercadoPagoLink: c.mercadoPagoLink,
        }));
        setConductoresEnVivo(mapeados);
      });
    }

    // Evento: Actualización de posición de un colectivo de la línea
    const manejarActualizacionUbicacion = (datos: any) => {
      setConductoresEnVivo((prev) => {
        const indice = prev.findIndex((c) => c.conductorId === datos.conductorId);
        const actualizado: ConductorColectivo = {
          conductorId: datos.conductorId,
          nombre: datos.nombre,
          patente: datos.patente,
          latitud: datos.latitud,
          longitud: datos.longitud,
          asientosOcupados: datos.asientosOcupados,
          asientosTotales: datos.asientosTotales,
          sentidoRuta: datos.sentidoRuta,
        };
        if (indice >= 0) {
          const copia = [...prev];
          copia[indice] = { ...copia[indice], ...actualizado };
          return copia;
        }
        return [...prev, actualizado];
      });
    };

    // Evento: Conductor cambia cantidad de asientos disponibles
    const manejarCambioAsientos = (datos: any) => {
      setConductoresEnVivo((prev) =>
        prev.map((chofer) =>
          chofer.conductorId === datos.conductorId
            ? { ...chofer, asientosOcupados: datos.asientosOcupados }
            : chofer
        )
      );
      if (conductorElegido?.conductorId === datos.conductorId) {
        setConductorElegido((prev) =>
          prev ? { ...prev, asientosOcupados: datos.asientosOcupados } : null
        );
      }
    };

    // Evento: Pasajero abordó el colectivo
    const manejarReservaAbordada = () => {
      setMensajeAlerta('¡Has abordado el colectivo! El chofer confirmó tu asiento.');
      setReservaActiva((prev) => (prev ? { ...prev, estado: 'abordado' } : null));
    };

    // Evento: Reserva cancelada
    const manejarReservaCancelada = () => {
      setMensajeAlerta('La reserva de asiento fue cancelada.');
      setReservaActiva(null);
      setConductorElegido(null);
      setMostrarModalPago(false);
    };

    // Evento: Conductor confirmó el pago y liberó el asiento
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const manejarPagoConfirmado = (datos: any) => {
      setMensajeAlerta(datos.mensaje || '¡Pago confirmado por el conductor! Asiento liberado. Gracias por viajar.');
      setReservaActiva(null);
      setConductorElegido(null);
      setMostrarModalPago(false);
    };

    socket.on('colectivo:actualizacion-ubicacion', manejarActualizacionUbicacion);
    socket.on('colectivo:cambio-asientos', manejarCambioAsientos);
    socket.on('colectivo:reserva-abordada', manejarReservaAbordada);
    socket.on('colectivo:reserva-cancelada', manejarReservaCancelada);
    socket.on('colectivo:pago-confirmado', manejarPagoConfirmado);

    // Eventos de asignación dirigida al primer móvil en camino
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const manejarAsignandoAChofer = (datos: any) => {
      setMovilAsignadoPreview(datos.conductor);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const manejarReservaAceptada = (datos: any) => {
      setReservaActiva(datos.reserva);
      setBuscandoMovil(false);
      setMovilAsignadoPreview(null);
      setMensajeAlerta('¡Móvil confirmado! El chofer aceptó tu solicitud y viene en camino.');
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const manejarSinConductores = (datos: any) => {
      setBuscandoMovil(false);
      setMovilAsignadoPreview(null);
      setMensajeError(datos.mensaje || 'Todos los colectivos en tránsito vienen completos.');
    };

    socket.on('colectivo:asignando-a-chofer', manejarAsignandoAChofer);
    socket.on('colectivo:reserva-aceptada', manejarReservaAceptada);
    socket.on('colectivo:sin-conductores-disponibles', manejarSinConductores);

    return () => {
      if (lineaSeleccionada?.id) {
        socket.emit('colectivo:salir-linea', { lineaId: lineaSeleccionada.id });
      }
      socket.off('colectivo:actualizacion-ubicacion', manejarActualizacionUbicacion);
      socket.off('colectivo:cambio-asientos', manejarCambioAsientos);
      socket.off('colectivo:reserva-abordada', manejarReservaAbordada);
      socket.off('colectivo:reserva-cancelada', manejarReservaCancelada);
      socket.off('colectivo:pago-confirmado', manejarPagoConfirmado);
      socket.off('colectivo:asignando-a-chofer', manejarAsignandoAChofer);
      socket.off('colectivo:reserva-aceptada', manejarReservaAceptada);
      socket.off('colectivo:sin-conductores-disponibles', manejarSinConductores);
    };
  }, [lineaSeleccionada, usuarioSesion, conductorElegido]);

  // Manejar cambio de línea
  const seleccionarLinea = (linea: Linea) => {
    setLineaSeleccionada(linea);
    setConductorElegido(null);
    setConductoresEnVivo([]);
  };

  // Enviar solicitud de reserva de asiento
  const solicitarReservaAsiento = async () => {
    if (!conductorElegido || !lineaSeleccionada) return;

    setCargandoReserva(true);
    setMensajeError('');
    try {
      const res = await api.post('/colectivos/reservar', {
        conductorId: conductorElegido.conductorId,
        lineaId: lineaSeleccionada.id,
        cantidadAsientos,
        latitudSubida: ubicacionPasajero?.latitud,
        longitudSubida: ubicacionPasajero?.longitud,
        metodoPago,
      });

      setReservaActiva(res.data.reserva);
      setMensajeAlerta('Asiento reservado con éxito. Espera al colectivo en tu recorrido.');
    } catch (error: any) {
      console.error('Error al reservar:', error);
      setMensajeError(error.response?.data?.error || 'No se pudo reservar el asiento.');
    } finally {
      setCargandoReserva(false);
    }
  };

  // Cancelar reserva actual
  const cancelarReserva = async () => {
    if (!reservaActiva) return;
    try {
      await api.post(`/colectivos/reservas/${reservaActiva.id}/cancelar`);
      setReservaActiva(null);
      setConductorElegido(null);
      setMostrarModalPago(false);
      setMensajeAlerta('Reserva cancelada correctamente.');
    } catch (error) {
      console.error('Error al cancelar reserva:', error);
      setMensajeError('No se pudo cancelar la reserva.');
    }
  };

  // Solicitar pagar y descender
  const notificarPagoChofer = async () => {
    if (!reservaActiva) return;
    try {
      setSolicitandoPago(true);
      await api.post(`/colectivos/reservas/${reservaActiva.id}/solicitar-pago`);
      setReservaActiva((prev) => (prev ? { ...prev, estado: 'pagando' } : null));
      setMensajeAlerta('Solicitud de pago enviada al conductor con aviso de voz.');
    } catch (error) {
      console.error('Error al solicitar pago:', error);
      setMensajeError('No se pudo enviar la solicitud de pago.');
    } finally {
      setSolicitandoPago(false);
    }
  };

  // Solicitar asignación dirigida al primer móvil en tránsito (Regla Federación)
  const solicitarProximoColectivo = async () => {
    if (!lineaSeleccionada) return;
    setBuscandoMovil(true);
    setMensajeError('');
    setMovilAsignadoPreview(null);
    try {
      const res = await api.post('/colectivos/solicitar-dirigido', {
        lineaId: lineaSeleccionada.id,
        latitudSubida: ubicacionPasajero?.latitud || -33.4372,
        longitudSubida: ubicacionPasajero?.longitud || -70.6506,
        cantidadAsientos,
        metodoPago,
        sentido: 'ida',
      });
      if (res.data?.conductorAsignado) {
        setMovilAsignadoPreview(res.data.conductorAsignado);
      }
    } catch (error: any) {
      console.error('Error al solicitar próximo colectivo:', error);
      setBuscandoMovil(false);
      setMensajeError(error.response?.data?.error || 'No hay colectivos con cupos disponibles en este momento.');
    }
  };

  // Cerrar sesión
  const cerrarSesionUsuario = () => {
    clearSession();
    router.push('/login');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0F172A', color: '#F8FAFC' }}>
      {/* ── Barra Superior / Encabezado ── */}
      <header style={{
        padding: '12px 16px',
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IconoColectivo size={22} color="#38BDF8" />
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>
              Fim <span style={{ color: '#38BDF8' }}>Colectivo</span>
            </h1>
            <p style={{ fontSize: '11px', margin: 0, color: '#94A3B8' }}>
              {usuarioSesion ? `Hola, ${usuarioSesion.name}` : 'Transporte Colectivo en Vivo'}
            </p>
          </div>
        </div>

        <button
          onClick={cerrarSesionUsuario}
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

      {/* ── Selector de Líneas de Colectivo (Pills horizontales) ── */}
      <div style={{
        padding: '10px 16px',
        background: '#1E293B',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        zIndex: 5,
      }}>
        {listaLineas.map((linea) => {
          const esActiva = lineaSeleccionada?.id === linea.id;
          return (
            <button
              key={linea.id}
              onClick={() => seleccionarLinea(linea)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '24px',
                border: esActiva ? `2px solid ${linea.color}` : '1px solid rgba(255, 255, 255, 0.15)',
                background: esActiva ? `${linea.color}22` : 'rgba(30, 41, 59, 0.8)',
                color: esActiva ? '#FFFFFF' : '#CBD5E1',
                fontSize: '13px',
                fontWeight: esActiva ? '700' : '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <span style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: linea.color,
                display: 'inline-block',
              }} />
              {linea.nombre}
            </button>
          );
        })}
      </div>

      {/* ── Banner de Alerta o Error ── */}
      {mensajeAlerta && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.2)',
          borderBottom: '1px solid #10B981',
          padding: '8px 16px',
          color: '#6EE7B7',
          fontSize: '12px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconoCheck size={16} color="#10B981" />
            <span>{mensajeAlerta}</span>
          </div>
          <button onClick={() => setMensajeAlerta('')} style={{ background: 'none', border: 'none', color: '#6EE7B7', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><IconoCruz size={14} color="#6EE7B7" /></button>
        </div>
      )}
      {mensajeError && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.2)',
          borderBottom: '1px solid #EF4444',
          padding: '8px 16px',
          color: '#FCA5A5',
          fontSize: '12px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconoAlerta size={16} color="#EF4444" />
            <span>{mensajeError}</span>
          </div>
          <button onClick={() => setMensajeError('')} style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><IconoCruz size={14} color="#FCA5A5" /></button>
        </div>
      )}

      {/* ── Mapa Interactivo Principal ── */}
      <div style={{ flex: 1, position: 'relative' }}>
        <ColectivoMap
          ubicacionUsuario={ubicacionPasajero}
          lineaSeleccionada={lineaSeleccionada}
          conductoresEnVivo={conductoresEnVivo}
          conductorSeleccionadoId={conductorElegido?.conductorId}
          alSeleccionarConductor={(chofer) => setConductorElegido(chofer)}
          disparadorCentrado={disparadorCentrado}
        />

        {/* Botón flotante para recentrar ubicación */}
        <button
          onClick={() => setDisparadorCentrado((prev) => prev + 1)}
          style={{
            position: 'absolute',
            right: '16px',
            bottom: '16px',
            zIndex: 1000,
            background: '#1E293B',
            color: '#38BDF8',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
            cursor: 'pointer',
          }}
          title="Centrar en mi posición"
        >
          <IconoGps size={20} color="#38BDF8" />
        </button>
      </div>

      {/* ── Panel Inferior: Colectivo Seleccionado o Reserva Activa ── */}
      <div style={{
        padding: '16px',
        background: '#1E293B',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)',
        zIndex: 10,
      }}>
        {/* Caso 1: Reserva Activa */}
        {reservaActiva ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{
                  fontSize: '10px',
                  fontWeight: '700',
                  color: reservaActiva.estado === 'abordado' ? '#10B981' : '#F59E0B',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  <IconoPuntoEstado activo={reservaActiva.estado === 'abordado'} size={8} />
                  <span>{reservaActiva.estado === 'abordado' ? 'A Bordo' : 'Asiento Reservado'}</span>
                </span>
                <h3 style={{ margin: '2px 0 0 0', fontSize: '16px', fontWeight: '800' }}>
                  {reservaActiva.conductor.name} ({reservaActiva.conductor.vehiclePlate})
                </h3>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  fontSize: '13px',
                  fontWeight: '800',
                  color: '#38BDF8',
                  background: 'rgba(56, 189, 248, 0.15)',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}>
                  <IconoAsiento size={14} color="#38BDF8" />
                  {reservaActiva.cantidadAsientos} asiento{reservaActiva.cantidadAsientos > 1 ? 's' : ''}
                </span>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px' }}>Asiento reservado</div>
              </div>
            </div>

            {/* Opciones de Pago directo BancoEstado RutPay / MercadoPago */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              padding: '10px',
              borderRadius: '8px',
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}>
              <div style={{ color: '#94A3B8' }}>Método de pago: <b style={{ color: '#F8FAFC' }}>{reservaActiva.metodoPago.toUpperCase()}</b></div>
              {reservaActiva.conductor.telefonoRutPay && (
                <div style={{ color: '#E2E8F0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <IconoBanco size={14} color="#FBBF24" />
                  <span><b>RutPay BancoEstado:</b> <code>{reservaActiva.conductor.telefonoRutPay}</code></span>
                </div>
              )}
              {reservaActiva.conductor.mercadoPagoLink && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <IconoTarjeta size={14} color="#38BDF8" />
                  <a href={reservaActiva.conductor.mercadoPagoLink} target="_blank" rel="noreferrer" style={{ color: '#38BDF8', textDecoration: 'underline' }}>
                    Pagar con MercadoPago aquí
                  </a>
                </div>
              )}
            </div>

            {/* BOTONES PRINCIPALES DE ACCIÓN: PAGAR / BAJARME */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setMostrarModalPago(true)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  background: reservaActiva.estado === 'pagando'
                    ? 'rgba(56, 189, 248, 0.2)'
                    : 'linear-gradient(180deg, #2563EB 0%, #1D4ED8 100%)',
                  color: '#FFFFFF',
                  border: reservaActiva.estado === 'pagando' ? '1px solid #38BDF8' : 'none',
                  fontWeight: '800',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)',
                }}
              >
                <IconoTarjeta size={16} color="#FFFFFF" />
                <span>
                  {reservaActiva.estado === 'pagando'
                    ? 'Esperando Confirmación del Chofer...'
                    : 'PAGAR Y BAJARME'}
                </span>
              </button>

              {reservaActiva.estado !== 'abordado' && reservaActiva.estado !== 'pagando' && (
                <button
                  onClick={cancelarReserva}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#F87171',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        ) : conductorElegido ? (
          /* Caso 2: Colectivo Seleccionado para reservar */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#94A3B8' }}>Colectivo seleccionado</span>
                <h3 style={{ margin: '2px 0 0 0', fontSize: '16px', fontWeight: '800' }}>
                  {conductorElegido.nombre} — {conductorElegido.patente}
                </h3>
                <span style={{
                  fontSize: '11px',
                  color: conductorElegido.asientosOcupados >= 4 ? '#EF4444' : '#10B981',
                  fontWeight: '700',
                }}>
                  {4 - conductorElegido.asientosOcupados} de 4 asientos disponibles
                </span>
              </div>
              <button
                onClick={() => setConductorElegido(null)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <IconoCruz size={16} color="#94A3B8" />
              </button>
            </div>

            {/* Selector de Asientos */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0F172A', padding: '8px 12px', borderRadius: '8px' }}>
              <span style={{ fontSize: '13px', color: '#E2E8F0' }}>Asientos a reservar:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setCantidadAsientos((prev) => Math.max(1, prev - 1))}
                  style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#334155', color: '#FFF', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  -
                </button>
                <span style={{ fontSize: '15px', fontWeight: 'bold', width: '20px', textAlign: 'center' }}>
                  {cantidadAsientos}
                </span>
                <button
                  onClick={() => setCantidadAsientos((prev) => Math.min(4 - conductorElegido.asientosOcupados, prev + 1))}
                  style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#334155', color: '#FFF', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Opciones de pago */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['efectivo', 'rutpay', 'mercadopago'] as const).map((metodo) => (
                <button
                  key={metodo}
                  onClick={() => setMetodoPago(metodo)}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: metodoPago === metodo ? '700' : '500',
                    background: metodoPago === metodo ? '#2563EB' : '#0F172A',
                    color: metodoPago === metodo ? '#FFF' : '#94A3B8',
                    border: metodoPago === metodo ? '1px solid #3B82F6' : '1px solid rgba(255, 255, 255, 0.1)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                  }}
                >
                  {metodo === 'rutpay' ? <IconoBanco size={13} /> : metodo === 'mercadopago' ? <IconoTarjeta size={13} /> : <IconoEfectivo size={13} />}
                  <span>{metodo === 'rutpay' ? 'RutPay' : metodo === 'mercadopago' ? 'MercadoPago' : 'Efectivo'}</span>
                </button>
              ))}
            </div>

            {/* Botón de Confirmación */}
            <button
              onClick={solicitarReservaAsiento}
              disabled={cargandoReserva || 4 - conductorElegido.asientosOcupados <= 0}
              style={{
                padding: '12px',
                borderRadius: '10px',
                background: 4 - conductorElegido.asientosOcupados <= 0 ? '#475569' : '#2563EB',
                color: '#FFFFFF',
                fontWeight: '800',
                fontSize: '14px',
                border: 'none',
                cursor: 4 - conductorElegido.asientosOcupados <= 0 ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
              }}
            >
              {cargandoReserva
                ? 'Reservando...'
                : 4 - conductorElegido.asientosOcupados <= 0
                ? 'Colectivo Completo (Sin Asientos)'
                : `Reservar ${cantidadAsientos} Asiento${cantidadAsientos > 1 ? 's' : ''}`}
            </button>
          </div>
        ) : (
          /* Caso 3: Estado general de la línea y Despacho Dirigido */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#94A3B8' }}>Recorrido seleccionado</span>
                <h3 style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: '700' }}>
                  {lineaSeleccionada?.nombre || 'Seleccione una línea'}
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
                  {conductoresEnVivo.length === 0
                    ? 'No hay colectivos en ruta actualmente'
                    : `${conductoresEnVivo.length} colectivo(s) en servicio`}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                {conductoresEnVivo.length === 0 ? (
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#94A3B8',
                    background: 'rgba(148, 163, 184, 0.15)',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    border: '1px solid rgba(148, 163, 184, 0.3)',
                  }}>
                    Sin colectivos
                  </span>
                ) : totalAsientosLibres > 0 ? (
                  <div>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: '800',
                      color: '#34D399',
                      background: 'rgba(16, 185, 129, 0.15)',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}>
                      <IconoAsiento size={13} color="#34D399" />
                      {totalAsientosLibres} libre{totalAsientosLibres > 1 ? 's' : ''}
                    </span>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px' }}>En la línea</div>
                  </div>
                ) : (
                  <div>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: '800',
                      color: '#F87171',
                      background: 'rgba(239, 68, 68, 0.15)',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                    }}>
                      Llenos
                    </span>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px' }}>Sin asientos</div>
                  </div>
                )}
              </div>
            </div>

            {/* Panel de Solicitud Dirigida al Primer Móvil en Tránsito */}
            {buscandoMovil ? (
              <div style={{
                background: 'rgba(15, 23, 42, 0.9)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: '#38BDF8',
                      boxShadow: '0 0 10px #38BDF8',
                      animation: 'fimPulse 1s infinite ease-out',
                    }} />
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#38BDF8', textTransform: 'uppercase' }}>
                      Buscando primer móvil en camino...
                    </span>
                  </div>
                  <button
                    onClick={() => { setBuscandoMovil(false); setMovilAsignadoPreview(null); }}
                    style={{ background: 'none', border: 'none', color: '#F87171', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                </div>
                {movilAsignadoPreview ? (
                  <div style={{ fontSize: '12px', color: '#F8FAFC' }}>
                    Ofreciendo solicitud al móvil <b>{movilAsignadoPreview.patente} ({movilAsignadoPreview.nombre})</b> a <b>{movilAsignadoPreview.distanciaMetros}m</b>. Esperando confirmación del chofer...
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#94A3B8' }}>
                    Calculando el colectivo más próximo en aproximación hacia tu punto de recogida...
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Selectores de asientos y método de pago para el próximo colectivo */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
                  {/* Cantidad de asientos */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0F172A', padding: '6px 10px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#94A3B8' }}>Asientos:</span>
                    <button
                      onClick={() => setCantidadAsientos((prev) => Math.max(1, prev - 1))}
                      style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#334155', color: '#FFF', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      -
                    </button>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', minWidth: '16px', textAlign: 'center' }}>
                      {cantidadAsientos}
                    </span>
                    <button
                      onClick={() => setCantidadAsientos((prev) => Math.min(4, prev + 1))}
                      style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#334155', color: '#FFF', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      +
                    </button>
                  </div>

                  {/* Método de pago */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {(['efectivo', 'rutpay', 'mercadopago'] as const).map((metodo) => (
                      <button
                        key={metodo}
                        onClick={() => setMetodoPago(metodo)}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: metodoPago === metodo ? '700' : '500',
                          background: metodoPago === metodo ? '#2563EB' : '#0F172A',
                          color: metodoPago === metodo ? '#FFF' : '#94A3B8',
                          border: metodoPago === metodo ? '1px solid #3B82F6' : '1px solid rgba(255, 255, 255, 0.1)',
                          cursor: 'pointer',
                        }}
                      >
                        {metodo === 'rutpay' ? 'RutPay' : metodo === 'mercadopago' ? 'MercadoPago' : 'Efectivo'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Botón principal de solicitud dirigida */}
                <button
                  onClick={solicitarProximoColectivo}
                  disabled={totalAsientosLibres <= 0 || conductoresEnVivo.length === 0}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    background: totalAsientosLibres <= 0 || conductoresEnVivo.length === 0 ? '#475569' : '#10B981',
                    color: '#FFFFFF',
                    fontWeight: '800',
                    fontSize: '14px',
                    border: 'none',
                    cursor: totalAsientosLibres <= 0 || conductoresEnVivo.length === 0 ? 'not-allowed' : 'pointer',
                    boxShadow: totalAsientosLibres <= 0 ? 'none' : '0 4px 14px rgba(16, 185, 129, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <IconoColectivo size={18} color="#FFFFFF" />
                  <span>
                    {conductoresEnVivo.length === 0
                      ? 'Sin colectivos en ruta'
                      : totalAsientosLibres <= 0
                      ? 'Todos los móviles completos'
                      : `Solicitar Próximo Colectivo (${cantidadAsientos} as.)`}
                  </span>
                </button>
                <div style={{ textAlign: 'center', fontSize: '10px', color: '#64748B' }}>
                  Regla de asignación por turno al primer móvil en aproximación con cupo disponible
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL: PAGAR PASAJE Y SOLICITAR BAJADA AL CONDUCTOR ── */}
      {mostrarModalPago && reservaActiva && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              background: '#1E293B',
              borderRadius: '20px',
              padding: '24px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#38BDF8', letterSpacing: '0.5px' }}>
                  PAGO DE PASAJE
                </span>
                <h3 style={{ margin: '2px 0 0 0', fontSize: '20px', fontWeight: '800' }}>
                  Pagar y Bajarme
                </h3>
              </div>
              <button
                onClick={() => setMostrarModalPago(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94A3B8',
                  cursor: 'pointer',
                }}
              >
                <IconoCruz size={16} color="#94A3B8" />
              </button>
            </div>

            <div style={{ background: '#0F172A', padding: '12px 16px', borderRadius: '12px', fontSize: '13px' }}>
              <div style={{ color: '#94A3B8', marginBottom: '4px' }}>Conductor:</div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#F8FAFC' }}>
                {reservaActiva.conductor.name} ({reservaActiva.conductor.vehiclePlate})
              </div>
              <div style={{ color: '#64748B', fontSize: '12px', marginTop: '2px' }}>
                {reservaActiva.cantidadAsientos} asiento{reservaActiva.cantidadAsientos > 1 ? 's' : ''}
              </div>
            </div>

            {/* Medio de Pago seleccionado en la reserva */}
            <div style={{ background: '#0F172A', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              {reservaActiva.metodoPago === 'rutpay' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FBBF24', fontWeight: '700', fontSize: '14px' }}>
                    <IconoBanco size={18} color="#FBBF24" />
                    <span>RutPay BancoEstado</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
                    Transfiere directamente con RutPay al número de teléfono del chofer:
                  </p>
                  <div
                    style={{
                      background: 'rgba(251, 191, 36, 0.1)',
                      border: '1px dashed #FBBF24',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '16px', fontWeight: '800', color: '#FDE047' }}>
                      {reservaActiva.conductor.telefonoRutPay || reservaActiva.conductor.phone || '+56 9 8765 4321'}
                    </span>
                    <button
                      onClick={() => {
                        const num = reservaActiva.conductor.telefonoRutPay || reservaActiva.conductor.phone || '';
                        if (typeof navigator !== 'undefined' && navigator.clipboard) {
                          navigator.clipboard.writeText(num);
                          setTelefonoCopiado(true);
                          setTimeout(() => setTelefonoCopiado(false), 2000);
                        }
                      }}
                      style={{
                        background: telefonoCopiado ? '#10B981' : '#FBBF24',
                        color: '#0F172A',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '5px 10px',
                        fontSize: '11px',
                        fontWeight: '800',
                        cursor: 'pointer',
                      }}
                    >
                      {telefonoCopiado ? '¡Copiado!' : 'Copiar'}
                    </button>
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748B' }}>
                    Abre tu App BancoEstado, selecciona RutPay y pega este número.
                  </span>
                </div>
              ) : reservaActiva.metodoPago === 'mercadopago' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38BDF8', fontWeight: '700', fontSize: '14px' }}>
                    <IconoTarjeta size={18} color="#38BDF8" />
                    <span>MercadoPago</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#94A3B8' }}>
                    Paga de forma digital a través del link de MercadoPago del conductor:
                  </p>
                  {reservaActiva.conductor.mercadoPagoLink ? (
                    <a
                      href={reservaActiva.conductor.mercadoPagoLink}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        background: '#0284C7',
                        color: '#FFFFFF',
                        textDecoration: 'none',
                        textAlign: 'center',
                        padding: '10px',
                        borderRadius: '10px',
                        fontWeight: '700',
                        fontSize: '13px',
                        display: 'block',
                      }}
                    >
                      Abrir Enlace de MercadoPago
                    </a>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                      Enlace no configurado por el chofer. Puedes pagar en efectivo.
                    </span>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34D399', fontWeight: '700', fontSize: '14px' }}>
                    <IconoEfectivo size={18} color="#34D399" />
                    <span>Pago en Efectivo</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#CBD5E1' }}>
                    Entrega el efectivo directamente al conductor al descender del vehículo.
                  </p>
                </div>
              )}
            </div>

            {/* BOTÓN CONFIRMAR Y ENVIAR AL CHOFER */}
            <button
              onClick={notificarPagoChofer}
              disabled={solicitandoPago || reservaActiva.estado === 'pagando'}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '12px',
                background: reservaActiva.estado === 'pagando'
                  ? '#334155'
                  : 'linear-gradient(180deg, #10B981 0%, #059669 100%)',
                color: '#FFFFFF',
                border: 'none',
                fontWeight: '900',
                fontSize: '15px',
                letterSpacing: '0.3px',
                cursor: reservaActiva.estado === 'pagando' ? 'default' : 'pointer',
                boxShadow: reservaActiva.estado === 'pagando' ? 'none' : '0 6px 20px rgba(16, 185, 129, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <IconoCheck size={20} color="#FFFFFF" />
              <span>
                {solicitandoPago
                  ? 'Avisando al conductor...'
                  : reservaActiva.estado === 'pagando'
                  ? 'Esperando que el conductor acepte...'
                  : 'CONFIRMAR Y NOTIFICAR AL CHOFER'}
              </span>
            </button>

            {reservaActiva.estado === 'pagando' && (
              <div
                style={{
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid #38BDF8',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: '#38BDF8',
                }}
              >
                La voz en el móvil del chofer ha anunciado tu pago. En cuanto acepte, tu pantalla se liberará automáticamente.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
