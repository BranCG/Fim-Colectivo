'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import api, { clearSession, getSession } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import { Linea, ConductorColectivo } from '@/components/map/ColectivoMap';
import { calcularInfoLlegada } from '@/lib/geo';
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
  IconoReloj,
} from '@/components/icons/Iconos';
import { reproducirSonido, hablarTexto } from '@/lib/voice';

// Cargar mapa de colectivos de forma dinámica para evitar problemas con SSR en Next.js
const ColectivoMap = dynamic(() => import('@/components/map/ColectivoMap'), { ssr: false });

interface ReservaActiva {
  id: string;
  conductorId?: string;
  latitudSubida?: number;
  longitudSubida?: number;
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
    lastLat?: number;
    lastLng?: number;
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

  // Cálculo cuantitativo de tiempo estimado de llegada del colectivo reservado/asignado
  const infoLlegadaReserva = useMemo(() => {
    if (!reservaActiva || reservaActiva.estado !== 'reservado') {
      return null;
    }
    const conductorIdTarget = reservaActiva.conductor?.id || (reservaActiva as any).conductorId;
    const choferEnVivo = conductoresEnVivo.find((c) => c.conductorId === conductorIdTarget);
    const latChofer = choferEnVivo?.latitud ?? (reservaActiva.conductor as any)?.lastLat;
    const lngChofer = choferEnVivo?.longitud ?? (reservaActiva.conductor as any)?.lastLng;
    const latPasajero = ubicacionPasajero?.latitud ?? reservaActiva.latitudSubida;
    const lngPasajero = ubicacionPasajero?.longitud ?? reservaActiva.longitudSubida;

    return calcularInfoLlegada(latChofer, lngChofer, latPasajero, lngPasajero);
  }, [reservaActiva, conductoresEnVivo, ubicacionPasajero]);

  // Cálculo cuantitativo de tiempo de llegada del colectivo pre-seleccionado antes de reservar
  const infoLlegadaPreseleccionado = useMemo(() => {
    if (!conductorElegido || !ubicacionPasajero) return null;
    return calcularInfoLlegada(
      conductorElegido.latitud,
      conductorElegido.longitud,
      ubicacionPasajero.latitud,
      ubicacionPasajero.longitud
    );
  }, [conductorElegido, ubicacionPasajero]);

  // 1. Validar autenticación
  useEffect(() => {
    const sesion = getSession();
    if (!sesion) {
      router.push('/login?role=passenger');
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

  const conductorElegidoRef = useRef<ConductorColectivo | null>(null);
  useEffect(() => {
    conductorElegidoRef.current = conductorElegido;
  }, [conductorElegido]);

  // 4. Conexión WebSocket en tiempo real
  useEffect(() => {
    const socket = connectSocket();

    // Re-suscribir salas automáticamente al conectar y ante cualquier reconexión de red
    const suscribirSalasPasajero = () => {
      if (usuarioSesion?.id) {
        socket.emit('pasajero:unirse', { pasajeroId: usuarioSesion.id });
      }
      if (lineaSeleccionada?.id) {
        socket.emit('colectivo:unirse-linea', { lineaId: lineaSeleccionada.id });
      }
    };

    suscribirSalasPasajero();
    socket.on('connect', suscribirSalasPasajero);

    if (lineaSeleccionada?.id) {
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
        // Si el chofer no está en servicio activo en la lista, no agregarlo
        return prev;
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
      if (conductorElegidoRef.current?.conductorId === datos.conductorId) {
        setConductorElegido((prev) =>
          prev ? { ...prev, asientosOcupados: datos.asientosOcupados } : null
        );
      }
    };

    // Evento: Pasajero abordó el colectivo
    const manejarReservaAbordada = (datos?: any) => {
      if (datos?.pasajeroId && usuarioSesion?.id && datos.pasajeroId !== usuarioSesion.id) {
        return;
      }
      setMensajeAlerta('¡Has abordado el colectivo! El chofer confirmó tu asiento.');
      setReservaActiva((prev) => (prev ? { ...prev, estado: 'abordado' } : null));
    };

    // Evento: Reserva cancelada o rechazada por el chofer
    const manejarReservaCancelada = (datos?: any) => {
      if (datos?.pasajeroId && usuarioSesion?.id && datos.pasajeroId !== usuarioSesion.id) {
        return;
      }
      reproducirSonido('rechazo');
      hablarTexto('El conductor no pudo tomar tu viaje. Puedes pedir otro automóvil.');
      setReservaActiva(null);
      setConductorElegido(null);
      setBuscandoMovil(false);
      setMovilAsignadoPreview(null);
      setMostrarModalPago(false);
      setMensajeAlerta('');
      setMensajeError(
        datos?.mensaje ||
        'El conductor no pudo aceptar la reserva. Puedes solicitar otro automóvil disponible en el mapa.'
      );
    };

    // Evento: Conductor confirmó el pago y liberó el asiento
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const manejarPagoConfirmado = (datos: any) => {
      if (datos?.pasajeroId && usuarioSesion?.id && datos.pasajeroId !== usuarioSesion.id) {
        return;
      }
      setMensajeAlerta(datos.mensaje || '¡Pago confirmado por el conductor! Asiento liberado. Gracias por viajar.');
      setReservaActiva(null);
      setConductorElegido(null);
      setMostrarModalPago(false);
    };

    // Evento: Conductor pasa a fuera de servicio o se desconecta
    const manejarConductorOffline = (datos: { conductorId: string }) => {
      setConductoresEnVivo((prev) => prev.filter((c) => c.conductorId !== datos.conductorId));
      if (conductorElegidoRef.current?.conductorId === datos.conductorId) {
        setConductorElegido(null);
        setMensajeAlerta('El colectivo seleccionado se ha puesto fuera de servicio.');
      }
    };

    // Evento: Conductor entra en servicio
    const manejarConductorOnline = (datos: any) => {
      setConductoresEnVivo((prev) => {
        const existe = prev.some((c) => c.conductorId === datos.conductorId);
        const nuevo: ConductorColectivo = {
          conductorId: datos.conductorId,
          nombre: datos.nombre,
          patente: datos.patente,
          latitud: datos.latitud,
          longitud: datos.longitud,
          asientosOcupados: datos.asientosOcupados || 0,
          asientosTotales: datos.asientosTotales || 4,
          sentidoRuta: datos.sentidoRuta || 'ida',
        };
        if (existe) {
          return prev.map((c) => (c.conductorId === datos.conductorId ? { ...c, ...nuevo } : c));
        }
        return [...prev, nuevo];
      });
    };

    socket.on('colectivo:actualizacion-ubicacion', manejarActualizacionUbicacion);
    socket.on('colectivo:location-update', manejarActualizacionUbicacion);
    socket.on('colectivo:conductor-offline', manejarConductorOffline);
    socket.on('colectivo:conductor-online', manejarConductorOnline);
    socket.on('colectivo:cambio-asientos', manejarCambioAsientos);
    socket.on('colectivo:reserva-abordada', manejarReservaAbordada);
    socket.on('colectivo:reserva-cancelada', manejarReservaCancelada);
    socket.on('colectivo:pago-confirmado', manejarPagoConfirmado);

    // Eventos de asignación dirigida al primer móvil en camino
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const manejarAsignandoAChofer = (datos: any) => {
      if (datos?.pasajeroId && usuarioSesion?.id && datos.pasajeroId !== usuarioSesion.id) {
        return;
      }
      setMovilAsignadoPreview(datos.conductor);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const manejarReservaAceptada = (datos: any) => {
      const pasajeroDestinoId = datos.reserva?.pasajeroId || datos.pasajeroId;
      if (usuarioSesion?.id && pasajeroDestinoId && pasajeroDestinoId !== usuarioSesion.id) {
        return;
      }
      reproducirSonido('exito');
      hablarTexto('Móvil confirmado. Tu colectivo viene en camino.');
      setReservaActiva(datos.reserva);
      setBuscandoMovil(false);
      setMovilAsignadoPreview(null);
      setMensajeError('');
      setMensajeAlerta('¡Móvil confirmado! El chofer aceptó tu solicitud y viene en camino.');
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const manejarSinConductores = (datos: any) => {
      if (datos?.pasajeroId && usuarioSesion?.id && datos.pasajeroId !== usuarioSesion.id) {
        return;
      }
      reproducirSonido('rechazo');
      hablarTexto('Los colectivos no pudieron tomar tu solicitud. Puedes pedir otro automóvil.');
      setReservaActiva(null);
      setConductorElegido(null);
      setBuscandoMovil(false);
      setMovilAsignadoPreview(null);
      setMostrarModalPago(false);
      setMensajeAlerta('');
      setMensajeError(
        datos?.mensaje ||
        'Los colectivos no pudieron tomar tu solicitud. Puedes solicitar otro automóvil disponible en el mapa.'
      );
    };

    socket.on('colectivo:asignando-a-chofer', manejarAsignandoAChofer);
    socket.on('colectivo:reserva-aceptada', manejarReservaAceptada);
    socket.on('colectivo:sin-conductores-disponibles', manejarSinConductores);

    return () => {
      socket.off('connect', suscribirSalasPasajero);
      if (lineaSeleccionada?.id) {
        socket.emit('colectivo:salir-linea', { lineaId: lineaSeleccionada.id });
      }
      socket.off('colectivo:actualizacion-ubicacion', manejarActualizacionUbicacion);
      socket.off('colectivo:location-update', manejarActualizacionUbicacion);
      socket.off('colectivo:conductor-offline', manejarConductorOffline);
      socket.off('colectivo:conductor-online', manejarConductorOnline);
      socket.off('colectivo:cambio-asientos', manejarCambioAsientos);
      socket.off('colectivo:reserva-abordada', manejarReservaAbordada);
      socket.off('colectivo:reserva-cancelada', manejarReservaCancelada);
      socket.off('colectivo:pago-confirmado', manejarPagoConfirmado);
      socket.off('colectivo:asignando-a-chofer', manejarAsignandoAChofer);
      socket.off('colectivo:reserva-aceptada', manejarReservaAceptada);
      socket.off('colectivo:sin-conductores-disponibles', manejarSinConductores);
    };
  }, [lineaSeleccionada?.id, usuarioSesion?.id]);

  // 5. Polling inteligente de respaldo para que la pantalla del pasajero siempre sincronice
  useEffect(() => {
    const requiereSondeo = buscandoMovil || Boolean(reservaActiva);
    if (!requiereSondeo) return;

    const intervalo = setInterval(async () => {
      try {
        const res = await api.get('/colectivos/reservas/mis-reservas');
        const reservas = res.data?.reservas || [];
        if (reservas.length > 0) {
          const actual = reservas[0];
          setReservaActiva(actual);
          if (actual.estado === 'reservado' && buscandoMovil) {
            setBuscandoMovil(false);
            setMovilAsignadoPreview(null);
            setMensajeAlerta('¡Móvil confirmado! El chofer aceptó tu solicitud y viene en camino.');
          } else if (actual.estado === 'abordado') {
            setBuscandoMovil(false);
          }
        } else {
          // Si el chofer canceló o rechazó y ya no hay reservas activas en la BD:
          if (reservaActiva) {
            reproducirSonido('rechazo');
            hablarTexto('El viaje no fue aceptado. Puedes pedir otro automóvil.');
            setReservaActiva(null);
            setConductorElegido(null);
            setMostrarModalPago(false);
            setBuscandoMovil(false);
            setMovilAsignadoPreview(null);
            setMensajeAlerta('');
            setMensajeError('El conductor no pudo aceptar tu reserva. Puedes pedir otro automóvil disponible en el mapa.');
          }
        }
      } catch (e) {
        console.warn('[Pasajero] Error en sondeo de respaldo:', e);
      }
    }, 2500);

    return () => clearInterval(intervalo);
  }, [buscandoMovil, reservaActiva]);

  // Manejar cambio de línea
  const seleccionarLinea = (linea: Linea) => {
    setLineaSeleccionada(linea);
    setConductorElegido(null);
    setConductoresEnVivo([]);
  };

  // Enviar solicitud de reserva de asiento
  const solicitarReservaAsiento = async () => {
    if (!conductorElegido || !lineaSeleccionada || reservaActiva) return;

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
      setConductorElegido(null);
      setMensajeAlerta('Solicitud enviada al conductor. Esperando confirmación...');
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
    if (!lineaSeleccionada || reservaActiva || buscandoMovil) return;
    setConductorElegido(null);
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
    router.push('/login?role=passenger');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0A0A0A', color: '#FFFFFF', width: '100%', overflowX: 'hidden' }}>
      {/* ── Barra Superior / Encabezado ── */}
      <header style={{
        padding: '10px 14px',
        background: 'rgba(10, 10, 10, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IconoColectivo size={22} color="#FACC15" />
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>
              Fim <span style={{ color: '#FACC15' }}>Colectivo</span>
            </h1>
            <p style={{ fontSize: '11px', margin: 0, color: '#A3A3A3' }}>
              {usuarioSesion ? `Hola, ${usuarioSesion.name}` : 'Transporte Colectivo en Vivo'}
            </p>
          </div>
        </div>

        <button
          onClick={cerrarSesionUsuario}
          style={{
            background: '#171717',
            color: '#D4D4D4',
            border: '1px solid rgba(255, 255, 255, 0.15)',
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
        background: '#121212',
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
                border: esActiva ? '2px solid #FACC15' : '1px solid rgba(255, 255, 255, 0.15)',
                background: esActiva ? 'rgba(250, 204, 21, 0.15)' : '#171717',
                color: esActiva ? '#FACC15' : '#D4D4D4',
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
                background: esActiva ? '#FACC15' : '#737373',
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
          background: 'rgba(250, 204, 21, 0.15)',
          borderBottom: '1px solid #FACC15',
          padding: '8px 16px',
          color: '#FACC15',
          fontSize: '12px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconoCheck size={16} color="#FACC15" />
            <span>{mensajeAlerta}</span>
          </div>
          <button onClick={() => setMensajeAlerta('')} style={{ background: 'none', border: 'none', color: '#FACC15', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><IconoCruz size={14} color="#FACC15" /></button>
        </div>
      )}
      {mensajeError && (
        <div style={{
          background: '#171717',
          borderBottom: '2px solid #FACC15',
          padding: '10px 16px',
          color: '#FFFFFF',
          fontSize: '12px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconoAlerta size={18} color="#FACC15" />
            <span>{mensajeError}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => {
                setMensajeError('');
                setConductorElegido(null);
                solicitarProximoColectivo();
              }}
              style={{
                background: '#FACC15',
                color: '#000000',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer',
                letterSpacing: '0.2px',
              }}
            >
              Pedir otro colectivo
            </button>
            <button onClick={() => setMensajeError('')} style={{ background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <IconoCruz size={14} color="#FFFFFF" />
            </button>
          </div>
        </div>
      )}

      {/* ── Mapa Interactivo Principal ── */}
      <div style={{ flex: 1, position: 'relative' }}>
        <ColectivoMap
          ubicacionUsuario={ubicacionPasajero}
          lineaSeleccionada={lineaSeleccionada}
          conductoresEnVivo={conductoresEnVivo}
          conductorSeleccionadoId={reservaActiva ? (reservaActiva.conductor?.id || (reservaActiva as any).conductorId) : conductorElegido?.conductorId}
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
            background: '#171717',
            color: '#FACC15',
            border: '1px solid #FACC15',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.6)',
            cursor: 'pointer',
          }}
          title="Centrar en mi posición"
        >
          <IconoGps size={20} color="#FACC15" />
        </button>
      </div>

      {/* ── Panel Inferior: Colectivo Seleccionado o Reserva Activa ── */}
      <div style={{
        padding: '14px 12px',
        background: '#121212',
        borderTop: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.5)',
        zIndex: 10,
        maxHeight: '48vh',
        overflowY: 'auto',
        boxSizing: 'border-box',
      }}>
        {/* Caso 1: Reserva Activa */}
        {reservaActiva ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{
                  fontSize: '10px',
                  fontWeight: '700',
                  color: reservaActiva.estado === 'abordado' ? '#FFFFFF' : '#FACC15',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  <IconoPuntoEstado activo={reservaActiva.estado === 'abordado' || reservaActiva.estado === 'reservado'} size={8} />
                  <span>
                    {reservaActiva.estado === 'abordado'
                      ? 'A Bordo'
                      : reservaActiva.estado === 'pendiente_chofer'
                      ? 'Solicitud Enviada'
                      : 'Asiento Reservado'}
                  </span>
                </span>
                <h3 style={{ margin: '2px 0 0 0', fontSize: '16px', fontWeight: '800', color: '#FFFFFF' }}>
                  {reservaActiva.conductor.name} ({reservaActiva.conductor.vehiclePlate})
                </h3>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  fontSize: '13px',
                  fontWeight: '800',
                  color: '#000000',
                  background: '#FACC15',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  border: '1px solid #FACC15',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}>
                  <IconoAsiento size={14} color="#000000" />
                  {reservaActiva.cantidadAsientos} asiento{reservaActiva.cantidadAsientos > 1 ? 's' : ''}
                </span>
                <div style={{ fontSize: '11px', color: '#A3A3A3', marginTop: '3px' }}>
                  {reservaActiva.estado === 'abordado'
                    ? 'En viaje'
                    : reservaActiva.estado === 'pendiente_chofer'
                    ? 'Esperando respuesta del chofer'
                    : 'Móvil en camino'}
                </div>
              </div>
            </div>

            {/* Si está en pendiente_chofer: tarjeta especial de espera sin estimación prematura */}
            {reservaActiva.estado === 'pendiente_chofer' && (
              <div
                style={{
                  background: 'rgba(250, 204, 21, 0.08)',
                  border: '1.5px dashed #FACC15',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'rgba(250, 204, 21, 0.15)',
                    border: '1.5px solid #FACC15',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    animation: 'fimPulse 1.2s infinite ease-out',
                  }}
                >
                  <IconoReloj size={20} color="#FACC15" />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: '#FACC15' }}>
                    Esperando confirmación del conductor...
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#D4D4D4', marginTop: '2px' }}>
                    El chofer recibió la alerta en su vehículo. Debe responder <b>Sí</b> o <b>No</b> para confirmar tu viaje.
                  </div>
                </div>
              </div>
            )}

            {/* Tiempo estimado de llegada del colectivo reservado (cuantitativo en minutos) - ÚNICAMENTE cuando fue confirmado */}
            {reservaActiva.estado === 'reservado' && infoLlegadaReserva && (
              <div
                style={{
                  background: 'rgba(250, 204, 21, 0.12)',
                  border: '1.5px solid #FACC15',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: '#FACC15',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <IconoReloj size={20} color="#000000" />
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#A3A3A3', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      Tiempo estimado de llegada
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: '900', color: '#FACC15' }}>
                      {infoLlegadaReserva.resumen}
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    background: '#FACC15',
                    color: '#000000',
                    fontSize: '11px',
                    fontWeight: '900',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    letterSpacing: '0.3px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  EN RUTA
                </span>
              </div>
            )}

            {/* Opciones de Pago directo BancoEstado RutPay / MercadoPago */}
            <div style={{
              background: '#171717',
              padding: '10px',
              borderRadius: '8px',
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}>
              <div style={{ color: '#A3A3A3' }}>Método de pago: <b style={{ color: '#FFFFFF' }}>{reservaActiva.metodoPago.toUpperCase()}</b></div>
              {reservaActiva.conductor.telefonoRutPay && (
                <div style={{ color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <IconoBanco size={14} color="#FACC15" />
                  <span><b>RutPay BancoEstado:</b> <code style={{ color: '#FACC15' }}>{reservaActiva.conductor.telefonoRutPay}</code></span>
                </div>
              )}
              {reservaActiva.conductor.mercadoPagoLink && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <IconoTarjeta size={14} color="#FACC15" />
                  <a href={reservaActiva.conductor.mercadoPagoLink} target="_blank" rel="noreferrer" style={{ color: '#FACC15', textDecoration: 'underline' }}>
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
                    ? '#262626'
                    : '#FACC15',
                  color: reservaActiva.estado === 'pagando' ? '#A3A3A3' : '#000000',
                  border: reservaActiva.estado === 'pagando' ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
                  fontWeight: '800',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: reservaActiva.estado === 'pagando' ? 'none' : '0 4px 14px rgba(250, 204, 21, 0.35)',
                }}
              >
                <IconoTarjeta size={16} color={reservaActiva.estado === 'pagando' ? '#A3A3A3' : '#000000'} />
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
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    background: 'transparent',
                    color: '#A3A3A3',
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
                <span style={{ fontSize: '11px', color: '#A3A3A3' }}>Colectivo seleccionado</span>
                <h3 style={{ margin: '2px 0 0 0', fontSize: '16px', fontWeight: '800', color: '#FFFFFF' }}>
                  {conductorElegido.nombre} — {conductorElegido.patente}
                </h3>
                <span style={{
                  fontSize: '11px',
                  color: conductorElegido.asientosOcupados >= 4 ? '#A3A3A3' : '#FACC15',
                  fontWeight: '700',
                }}>
                  {4 - conductorElegido.asientosOcupados} de 4 asientos disponibles
                </span>
              </div>
              <button
                onClick={() => setConductorElegido(null)}
                style={{ background: 'none', border: 'none', color: '#A3A3A3', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <IconoCruz size={16} color="#A3A3A3" />
              </button>
            </div>

            {/* Tiempo estimado de llegada si decide reservar este colectivo */}
            {infoLlegadaPreseleccionado && (
              <div
                style={{
                  background: 'rgba(250, 204, 21, 0.12)',
                  border: '1px solid #FACC15',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#FACC15',
                  fontSize: '12px',
                  fontWeight: '700',
                  flexWrap: 'wrap',
                }}
              >
                <IconoReloj size={16} color="#FACC15" />
                <span>
                  Llegaría en <b>{infoLlegadaPreseleccionado.textoTiempo}</b> ({infoLlegadaPreseleccionado.textoDistancia} de tu posición)
                </span>
              </div>
            )}

            {/* Selector de Asientos */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#171717', padding: '8px 12px', borderRadius: '8px' }}>
              <span style={{ fontSize: '13px', color: '#D4D4D4' }}>Asientos a reservar:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setCantidadAsientos((prev) => Math.max(1, prev - 1))}
                  style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#262626', color: '#FFF', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  -
                </button>
                <span style={{ fontSize: '15px', fontWeight: 'bold', width: '20px', textAlign: 'center', color: '#FACC15' }}>
                  {cantidadAsientos}
                </span>
                <button
                  onClick={() => setCantidadAsientos((prev) => Math.min(4 - conductorElegido.asientosOcupados, prev + 1))}
                  style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#262626', color: '#FFF', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Opciones de pago */}
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['efectivo', 'rutpay', 'mercadopago'] as const).map((metodo) => {
                const seleccionado = metodoPago === metodo;
                return (
                  <button
                    key={metodo}
                    onClick={() => setMetodoPago(metodo)}
                    style={{
                      flex: 1,
                      padding: '8px 4px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: seleccionado ? '800' : '500',
                      background: seleccionado ? '#FACC15' : '#171717',
                      color: seleccionado ? '#000000' : '#A3A3A3',
                      border: seleccionado ? '1px solid #FACC15' : '1px solid rgba(255, 255, 255, 0.1)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                    }}
                  >
                    {metodo === 'rutpay' ? <IconoBanco size={13} color={seleccionado ? '#000000' : '#A3A3A3'} /> : metodo === 'mercadopago' ? <IconoTarjeta size={13} color={seleccionado ? '#000000' : '#A3A3A3'} /> : <IconoEfectivo size={13} color={seleccionado ? '#000000' : '#A3A3A3'} />}
                    <span>{metodo === 'rutpay' ? 'RutPay' : metodo === 'mercadopago' ? 'MercadoPago' : 'Efectivo'}</span>
                  </button>
                );
              })}
            </div>

            {/* Botón de Confirmación */}
            <button
              onClick={solicitarReservaAsiento}
              disabled={cargandoReserva || 4 - conductorElegido.asientosOcupados <= 0}
              style={{
                padding: '12px',
                borderRadius: '10px',
                background: 4 - conductorElegido.asientosOcupados <= 0 ? '#262626' : '#FACC15',
                color: 4 - conductorElegido.asientosOcupados <= 0 ? '#737373' : '#000000',
                fontWeight: '800',
                fontSize: '14px',
                border: 'none',
                cursor: 4 - conductorElegido.asientosOcupados <= 0 ? 'not-allowed' : 'pointer',
                boxShadow: 4 - conductorElegido.asientosOcupados <= 0 ? 'none' : '0 4px 14px rgba(250, 204, 21, 0.35)',
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
                <span style={{ fontSize: '11px', color: '#A3A3A3' }}>Recorrido seleccionado</span>
                <h3 style={{ margin: '2px 0 0 0', fontSize: '15px', fontWeight: '700', color: '#FFFFFF' }}>
                  {lineaSeleccionada?.nombre || 'Seleccione una línea'}
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: '#737373' }}>
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
                    color: '#A3A3A3',
                    background: '#262626',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                  }}>
                    Sin colectivos
                  </span>
                ) : totalAsientosLibres > 0 ? (
                  <div>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: '800',
                      color: '#000000',
                      background: '#FACC15',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      border: '1px solid #FACC15',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}>
                      <IconoAsiento size={13} color="#000000" />
                      {totalAsientosLibres} libre{totalAsientosLibres > 1 ? 's' : ''}
                    </span>
                    <div style={{ fontSize: '11px', color: '#A3A3A3', marginTop: '3px' }}>En la línea</div>
                  </div>
                ) : (
                  <div>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: '800',
                      color: '#A3A3A3',
                      background: '#262626',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                    }}>
                      Llenos
                    </span>
                    <div style={{ fontSize: '11px', color: '#A3A3A3', marginTop: '3px' }}>Sin asientos</div>
                  </div>
                )}
              </div>
            </div>

            {/* Panel de Solicitud Dirigida al Primer Móvil en Tránsito */}
            {buscandoMovil ? (
              <div style={{
                background: '#171717',
                border: '1px solid #FACC15',
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
                      background: '#FACC15',
                      boxShadow: '0 0 10px #FACC15',
                      animation: 'fimPulse 1s infinite ease-out',
                    }} />
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#FACC15', textTransform: 'uppercase' }}>
                      Buscando primer móvil en camino...
                    </span>
                  </div>
                  <button
                    onClick={() => { setBuscandoMovil(false); setMovilAsignadoPreview(null); }}
                    style={{ background: 'none', border: 'none', color: '#A3A3A3', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                </div>
                {movilAsignadoPreview ? (
                  <div style={{ fontSize: '12px', color: '#FFFFFF' }}>
                    Ofreciendo solicitud al móvil <b>{movilAsignadoPreview.patente} ({movilAsignadoPreview.nombre})</b> a <b>{movilAsignadoPreview.distanciaMetros}m</b>. Esperando confirmación del chofer...
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#A3A3A3' }}>
                    Calculando el colectivo más próximo en aproximación hacia tu punto de recogida...
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Selectores de asientos y método de pago para el próximo colectivo */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
                  {/* Cantidad de asientos */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#171717', padding: '6px 10px', borderRadius: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#A3A3A3' }}>Asientos:</span>
                    <button
                      onClick={() => setCantidadAsientos((prev) => Math.max(1, prev - 1))}
                      style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#262626', color: '#FFF', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      -
                    </button>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', minWidth: '16px', textAlign: 'center', color: '#FACC15' }}>
                      {cantidadAsientos}
                    </span>
                    <button
                      onClick={() => setCantidadAsientos((prev) => Math.min(4, prev + 1))}
                      style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#262626', color: '#FFF', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      +
                    </button>
                  </div>

                  {/* Método de pago */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {(['efectivo', 'rutpay', 'mercadopago'] as const).map((metodo) => {
                      const sel = metodoPago === metodo;
                      return (
                        <button
                          key={metodo}
                          onClick={() => setMetodoPago(metodo)}
                          style={{
                            padding: '6px 8px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: sel ? '800' : '500',
                            background: sel ? '#FACC15' : '#171717',
                            color: sel ? '#000000' : '#A3A3A3',
                            border: sel ? '1px solid #FACC15' : '1px solid rgba(255, 255, 255, 0.1)',
                            cursor: 'pointer',
                          }}
                        >
                          {metodo === 'rutpay' ? 'RutPay' : metodo === 'mercadopago' ? 'MercadoPago' : 'Efectivo'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Botón principal de solicitud dirigida */}
                <button
                  onClick={solicitarProximoColectivo}
                  disabled={buscandoMovil || totalAsientosLibres <= 0 || conductoresEnVivo.length === 0}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '10px',
                    background: buscandoMovil || totalAsientosLibres <= 0 || conductoresEnVivo.length === 0 ? '#262626' : '#FACC15',
                    color: buscandoMovil || totalAsientosLibres <= 0 || conductoresEnVivo.length === 0 ? '#737373' : '#000000',
                    fontWeight: '800',
                    fontSize: '14px',
                    border: 'none',
                    cursor: buscandoMovil || totalAsientosLibres <= 0 || conductoresEnVivo.length === 0 ? 'not-allowed' : 'pointer',
                    boxShadow: totalAsientosLibres <= 0 ? 'none' : '0 4px 14px rgba(250, 204, 21, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  <IconoColectivo size={18} color={totalAsientosLibres <= 0 ? '#737373' : '#000000'} />
                  <span>
                    {conductoresEnVivo.length === 0
                      ? 'Sin colectivos en ruta'
                      : totalAsientosLibres <= 0
                      ? 'Todos los móviles completos'
                      : `Solicitar Próximo Colectivo (${cantidadAsientos} as.)`}
                  </span>
                </button>
                <div style={{ textAlign: 'center', fontSize: '10px', color: '#737373' }}>
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
            background: 'rgba(0, 0, 0, 0.85)',
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
              background: '#121212',
              borderRadius: '20px',
              padding: '24px',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#FACC15', letterSpacing: '0.5px' }}>
                  PAGO DE PASAJE
                </span>
                <h3 style={{ margin: '2px 0 0 0', fontSize: '20px', fontWeight: '800', color: '#FFFFFF' }}>
                  Pagar y Bajarme
                </h3>
              </div>
              <button
                onClick={() => setMostrarModalPago(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#A3A3A3',
                  cursor: 'pointer',
                }}
              >
                <IconoCruz size={16} color="#A3A3A3" />
              </button>
            </div>

            <div style={{ background: '#171717', padding: '12px 16px', borderRadius: '12px', fontSize: '13px' }}>
              <div style={{ color: '#A3A3A3', marginBottom: '4px' }}>Conductor:</div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#FFFFFF' }}>
                {reservaActiva.conductor.name} ({reservaActiva.conductor.vehiclePlate})
              </div>
              <div style={{ color: '#737373', fontSize: '12px', marginTop: '2px' }}>
                {reservaActiva.cantidadAsientos} asiento{reservaActiva.cantidadAsientos > 1 ? 's' : ''}
              </div>
            </div>

            {/* Medio de Pago seleccionado en la reserva */}
            <div style={{ background: '#171717', padding: '16px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              {reservaActiva.metodoPago === 'rutpay' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FACC15', fontWeight: '700', fontSize: '14px' }}>
                    <IconoBanco size={18} color="#FACC15" />
                    <span>RutPay BancoEstado</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#A3A3A3' }}>
                    Transfiere directamente con RutPay al número de teléfono del chofer:
                  </p>
                  <div
                    style={{
                      background: 'rgba(250, 204, 21, 0.1)',
                      border: '1px dashed #FACC15',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: '16px', fontWeight: '800', color: '#FFFFFF' }}>
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
                        background: '#FACC15',
                        color: '#000000',
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
                  <span style={{ fontSize: '11px', color: '#737373' }}>
                    Abre tu App BancoEstado, selecciona RutPay y pega este número.
                  </span>
                </div>
              ) : reservaActiva.metodoPago === 'mercadopago' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FACC15', fontWeight: '700', fontSize: '14px' }}>
                    <IconoTarjeta size={18} color="#FACC15" />
                    <span>MercadoPago</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '12px', color: '#A3A3A3' }}>
                    Paga de forma digital a través del link de MercadoPago del conductor:
                  </p>
                  {reservaActiva.conductor.mercadoPagoLink ? (
                    <a
                      href={reservaActiva.conductor.mercadoPagoLink}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        background: '#FACC15',
                        color: '#000000',
                        textDecoration: 'none',
                        textAlign: 'center',
                        padding: '10px',
                        borderRadius: '10px',
                        fontWeight: '800',
                        fontSize: '13px',
                        display: 'block',
                      }}
                    >
                      Abrir Enlace de MercadoPago
                    </a>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#A3A3A3' }}>
                      Enlace no configurado por el chofer. Puedes pagar en efectivo.
                    </span>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FACC15', fontWeight: '700', fontSize: '14px' }}>
                    <IconoEfectivo size={18} color="#FACC15" />
                    <span>Pago en Efectivo</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '13px', color: '#D4D4D4' }}>
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
                  ? '#262626'
                  : '#FACC15',
                color: reservaActiva.estado === 'pagando' ? '#A3A3A3' : '#000000',
                border: 'none',
                fontWeight: '900',
                fontSize: '15px',
                letterSpacing: '0.3px',
                cursor: reservaActiva.estado === 'pagando' ? 'default' : 'pointer',
                boxShadow: reservaActiva.estado === 'pagando' ? 'none' : '0 6px 20px rgba(250, 204, 21, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <IconoCheck size={20} color={reservaActiva.estado === 'pagando' ? '#A3A3A3' : '#000000'} />
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
                  background: 'rgba(250, 204, 21, 0.1)',
                  border: '1px solid #FACC15',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: '#FACC15',
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
