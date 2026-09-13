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
  IconoBuscar,
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
    mttValidada?: boolean;
    folioRuta?: string | null;
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
  const [sentidoSeleccionado, setSentidoSeleccionado] = useState<'ida' | 'regreso'>('ida');
  const [conductoresEnVivo, setConductoresEnVivo] = useState<ConductorColectivo[]>([]);
  const [conductorElegido, setConductorElegido] = useState<ConductorColectivo | null>(null);

  // Estados de reserva
  const [cantidadAsientos, setCantidadAsientos] = useState<number>(1);
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'rutpay' | 'mercadopago'>('efectivo');
  const [reservaActiva, setReservaActiva] = useState<ReservaActiva | null>(null);
  const [cargandoReserva, setCargandoReserva] = useState(false);
  const estaAbordado = reservaActiva?.estado === 'abordado' || reservaActiva?.estado === 'pagando';

  // Estados de pago y bajada
  const [mostrarModalPago, setMostrarModalPago] = useState<boolean>(false);
  const [solicitandoPago, setSolicitandoPago] = useState<boolean>(false);
  const [telefonoCopiado, setTelefonoCopiado] = useState<boolean>(false);

  // Inspector de Tramos Viales y Trazados GIS (PostGIS)
  const [tramosViales, setTramosViales] = useState<any[]>([]);
  const [mostrarInspectorTramos, setMostrarInspectorTramos] = useState<boolean>(false);
  const [tramoSeleccionado, setTramoSeleccionado] = useState<any | null>(null);
  const [cargandoTramos, setCargandoTramos] = useState<boolean>(false);

  // Buscador intuitivo de trayecto (por folio, nombre o comuna)
  const [terminoBusqueda, setTerminoBusqueda] = useState<string>('');
  const [mostrarBuscador, setMostrarBuscador] = useState<boolean>(false);

  const lineasFiltradas = useMemo(() => {
    if (!terminoBusqueda.trim()) return listaLineas;
    const q = terminoBusqueda.toLowerCase().trim();
    return listaLineas.filter((l) => {
      const folio = (l.folio || '').toLowerCase();
      const nombre = (l.nombre || '').toLowerCase();
      const recorrido = (l.nombreRecorrido || '').toLowerCase();
      const comunas = (l.comunas || '').toLowerCase();
      return folio.includes(q) || nombre.includes(q) || recorrido.includes(q) || comunas.includes(q);
    });
  }, [listaLineas, terminoBusqueda]);

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
      router.replace('/login/?role=passenger');
      return;
    }
    setUsuarioSesion(sesion.user);
  }, [router]);

  // 2. Obtener geolocalización en tiempo real del pasajero y auto-centrar el mapa
  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;

    let primerExito = true;

    const alObtenerUbicacion = (posicion: GeolocationPosition) => {
      const lat = posicion.coords.latitude;
      const lng = posicion.coords.longitude;

      setUbicacionPasajero({ latitud: lat, longitud: lng });

      if (primerExito) {
        primerExito = false;
        setDisparadorCentrado((prev) => prev + 1);
      }
    };

    const alFallarUbicacion = (error: GeolocationPositionError) => {
      console.warn('GPS inicial no disponible, aguardando señal precisa:', error.message);
      if (primerExito) {
        setUbicacionPasajero((prev) => prev || { latitud: -33.4489, longitud: -70.6693 });
      }
    };

    // Intentar obtener rápidamente la posición actual
    navigator.geolocation.getCurrentPosition(alObtenerUbicacion, alFallarUbicacion, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 3000,
    });

    // Suscribir rastreo continuo para actualizar ubicación mientras la app se usa
    const watchId = navigator.geolocation.watchPosition(alObtenerUbicacion, alFallarUbicacion, {
      enableHighAccuracy: true,
      maximumAge: 2000,
    });

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
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

      // Si tiene una reserva en curso, asociar su línea automáticamente
      if (respuestaReservas.data?.reservas && respuestaReservas.data.reservas.length > 0) {
        const resv = respuestaReservas.data.reservas[0];
        setReservaActiva(resv);
        const lRes = lineasObtenidas.find(
          (l) => l.nombre === resv.linea?.nombre || l.id === (resv as any).lineaId
        );
        if (lRes) setLineaSeleccionada(lRes);
      }
    } catch (error) {
      console.error('Error al cargar líneas:', error);
      setMensajeError('No se pudieron obtener las líneas de colectivo disponibles.');
    }
  }, [lineaSeleccionada]);

  useEffect(() => {
    cargarLineasYReservas();
  }, [cargarLineasYReservas]);

  // Cargar tramos viales del recorrido al cambiar línea o sentido seleccionado
  useEffect(() => {
    if (!lineaSeleccionada?.id) return;
    setCargandoTramos(true);
    api.get(`/colectivos/lineas/${lineaSeleccionada.id}/tramos?sentido=${sentidoSeleccionado}`)
      .then((res) => {
        if (res.data?.tramos) {
          setTramosViales(res.data.tramos);
        }
      })
      .catch((err) => {
        console.warn('Error al obtener tramos viales:', err);
      })
      .finally(() => setCargandoTramos(false));
  }, [lineaSeleccionada?.id, sentidoSeleccionado]);

  const trazadoGisActivo = useMemo(() => {
    const sNorm = (sentidoSeleccionado || 'ida').toLowerCase().trim();
    return (
      lineaSeleccionada?.trazados?.find(
        (t) => t.sentido?.toLowerCase().trim() === sNorm && t.esActivo !== false
      ) ||
      lineaSeleccionada?.trazados?.find((t) => t.sentido?.toLowerCase().trim() === sNorm)
    );
  }, [lineaSeleccionada, sentidoSeleccionado]);

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
          mttValidada: c.mttValidada,
          folioRuta: c.folioRuta,
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
          mttValidada: datos.mttValidada !== undefined ? datos.mttValidada : (indice >= 0 ? prev[indice].mttValidada : true),
          folioRuta: datos.folioRuta || (indice >= 0 ? prev[indice].folioRuta : null),
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
    setMostrarBuscador(false);
    setTerminoBusqueda('');
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
        sentido: sentidoSeleccionado,
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
    router.replace('/login/?role=passenger');
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

      {/* ── Modo A Bordo: Barra superior mínima para dar máximo espacio al mapa ── */}
      {estaAbordado && (
        <div style={{
          padding: '10px 16px',
          background: '#0D0D0D',
          borderBottom: '1px solid rgba(250, 204, 21, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 5,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ADE80' }} />
            <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#FFFFFF' }}>
              En viaje: {lineaSeleccionada?.nombreRecorrido || lineaSeleccionada?.nombre || 'Colectivo'}
            </span>
            <span style={{ fontSize: '11px', color: '#FACC15', fontWeight: '700' }}>
              ({reservaActiva?.conductor?.vehiclePlate || (reservaActiva as any)?.conductorVehiclePlate || 'COL202'})
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '600' }}>
            {sentidoSeleccionado === 'regreso' ? 'Hacia La Granja' : 'Hacia Metro Bellavista'}
          </span>
        </div>
      )}

      {/* ── Buscador de Trayecto Inteligente (Aparece cuando no hay seleccionado o al tocar Buscar) ── */}
      {!estaAbordado && (!lineaSeleccionada || mostrarBuscador) && (
        <div style={{
          padding: '12px 14px',
          background: '#121212',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          zIndex: 6,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: '#1C1C1C',
            borderRadius: '12px',
            border: '1.5px solid #FACC15',
            padding: '8px 12px',
            gap: '10px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
          }}>
            <IconoBuscar size={18} color="#FACC15" />
            <input
              type="text"
              placeholder="Buscar trayecto por N° (ej: 233012, T) o destino..."
              value={terminoBusqueda}
              onChange={(e) => setTerminoBusqueda(e.target.value)}
              autoFocus={mostrarBuscador}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '13.5px',
                fontWeight: '600',
                outline: 'none',
              }}
            />
            {terminoBusqueda && (
              <button
                onClick={() => setTerminoBusqueda('')}
                style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 0 }}
              >
                <IconoCruz size={14} color="#888" />
              </button>
            )}
            {lineaSeleccionada && (
              <button
                onClick={() => setMostrarBuscador(false)}
                style={{
                  background: '#2A2A2A',
                  color: '#D4D4D4',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                Cerrar
              </button>
            )}
          </div>

          {/* Lista de Recorridos Disponibles */}
          <div style={{
            maxHeight: '220px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}>
            <div style={{ fontSize: '11px', color: '#A3A3A3', fontWeight: '700', letterSpacing: '0.4px', textTransform: 'uppercase', paddingLeft: '2px' }}>
              {terminoBusqueda ? `Resultados encontrados (${lineasFiltradas.length})` : 'Recorridos oficiales disponibles'}
            </div>

            {lineasFiltradas.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#737373', fontSize: '12px' }}>
                No se encontraron recorridos para "{terminoBusqueda}". Intenta con otro número de folio o comuna.
              </div>
            ) : (
              lineasFiltradas.map((linea) => (
                <div
                  key={linea.id}
                  onClick={() => seleccionarLinea(linea)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: '#181818',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      background: 'rgba(250, 204, 21, 0.15)',
                      border: '1px solid rgba(250, 204, 21, 0.4)',
                      color: '#FACC15',
                      fontSize: '11px',
                      fontWeight: '900',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      whiteSpace: 'nowrap',
                    }}>
                      FOLIO {linea.folio || '233012'}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '800', color: '#FFFFFF' }}>
                        {linea.nombreRecorrido || linea.nombre}
                      </div>
                      <div style={{ fontSize: '11px', color: '#9CA3AF' }}>
                        {linea.comunas || 'La Granja · La Pintana · La Florida'}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: '#FACC15' }}>
                      ${linea.tarifa?.toLocaleString('es-CL') || '800'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#4ADE80', fontWeight: '600' }}>
                      Seleccionar ➔
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Ficha Intuitiva y Compacta del Trayecto Seleccionado (Y ahí recién aparecer) ── */}
      {!estaAbordado && lineaSeleccionada && !mostrarBuscador && (
        <div style={{
          padding: '10px 14px',
          background: '#0D0D0D',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 5,
        }}>
          {/* Cabecera limpia del Trayecto con botón Buscar otro */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                background: '#FACC15',
                color: '#000000',
                fontSize: '11px',
                fontWeight: '900',
                padding: '2px 8px',
                borderRadius: '6px',
                letterSpacing: '0.4px',
              }}>
                FOLIO {lineaSeleccionada.folio || '233012'}
              </span>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#FFFFFF' }}>
                {lineaSeleccionada.nombreRecorrido || lineaSeleccionada.nombre}
              </span>
            </div>

            <button
              onClick={() => setMostrarBuscador(true)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                color: '#FACC15',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <IconoBuscar size={12} color="#FACC15" />
              <span>Cambiar trayecto</span>
            </button>
          </div>

          {/* Subtítulo de comunas */}
          <div style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: '500' }}>
            📍 {lineaSeleccionada.comunas || 'La Granja · La Pintana · La Florida'}
          </div>

          {/* Selector Limpio de Sentido: IDA vs REGRESO */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              onClick={() => setSentidoSeleccionado('ida')}
              style={{
                padding: '8px 10px',
                borderRadius: '8px',
                border: sentidoSeleccionado === 'ida' ? '1.5px solid #FACC15' : '1px solid rgba(255, 255, 255, 0.1)',
                background: sentidoSeleccionado === 'ida' ? 'rgba(250, 204, 21, 0.15)' : '#171717',
                color: sentidoSeleccionado === 'ida' ? '#FACC15' : '#888888',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '800', fontSize: '11px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: sentidoSeleccionado === 'ida' ? '#FACC15' : '#555555' }} />
                <span>IDA • A BELLAVISTA</span>
              </div>
              <span style={{ fontSize: '9.5px', color: sentidoSeleccionado === 'ida' ? '#E5E5E5' : '#666666', paddingLeft: '11px' }}>
                Los Pensamientos ➔ Serafín Zamora
              </span>
            </button>

            <button
              onClick={() => setSentidoSeleccionado('regreso')}
              style={{
                padding: '8px 10px',
                borderRadius: '8px',
                border: sentidoSeleccionado === 'regreso' ? '1.5px solid #10B981' : '1px solid rgba(255, 255, 255, 0.1)',
                background: sentidoSeleccionado === 'regreso' ? 'rgba(16, 185, 129, 0.15)' : '#171717',
                color: sentidoSeleccionado === 'regreso' ? '#10B981' : '#888888',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '800', fontSize: '11px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: sentidoSeleccionado === 'regreso' ? '#10B981' : '#555555' }} />
                <span>REGRESO • A LA GRANJA</span>
              </div>
              <span style={{ fontSize: '9.5px', color: sentidoSeleccionado === 'regreso' ? '#E5E5E5' : '#666666', paddingLeft: '11px' }}>
                Serafín Zamora ➔ Los Pensamientos
              </span>
            </button>
          </div>

          {/* Barra inferior compacta: Distancia y Botón de Calles */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '2px' }}>
            <span style={{ fontSize: '11px', color: '#737373' }}>
              Distancia ruta: <b style={{ color: '#E5E5E5' }}>{trazadoGisActivo?.distanciaMetros ? `${(trazadoGisActivo.distanciaMetros / 1000).toFixed(1)} km` : (sentidoSeleccionado === 'regreso' ? '27.3 km' : '23.6 km')}</b>
            </span>
            <button
              onClick={() => setMostrarInspectorTramos(!mostrarInspectorTramos)}
              style={{
                background: 'none',
                border: 'none',
                color: '#38BDF8',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                padding: '2px 4px',
                textDecoration: 'underline',
              }}
            >
              {mostrarInspectorTramos ? 'Ocultar calles' : `Ver calles (${tramosViales.length || (sentidoSeleccionado === 'regreso' ? 20 : 19)})`}
            </button>
          </div>

          {/* Panel Desplegable de Calles */}
          {mostrarInspectorTramos && (
            <div style={{
              marginTop: '4px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              paddingTop: '6px',
              maxHeight: '150px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}>
              <div style={{ fontSize: '10px', color: '#A3A3A3', marginBottom: '2px' }}>
                Secuencia vial del recorrido ({sentidoSeleccionado.toUpperCase()}):
              </div>
              {cargandoTramos ? (
                <div style={{ fontSize: '11px', color: '#737373', padding: '4px 0' }}>Cargando calles...</div>
              ) : (
                tramosViales.map((tramo) => {
                  const esSeleccionado = tramoSeleccionado?.orden === tramo.orden;
                  return (
                    <div
                      key={tramo.id || tramo.orden}
                      onClick={() => setTramoSeleccionado(esSeleccionado ? null : tramo)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: esSeleccionado ? 'rgba(56, 189, 248, 0.2)' : '#171717',
                        border: esSeleccionado ? '1px solid #38BDF8' : '1px solid rgba(255, 255, 255, 0.05)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        fontSize: '11px',
                        color: esSeleccionado ? '#38BDF8' : '#D4D4D4',
                      }}
                    >
                      <span style={{ fontWeight: '700' }}>
                        {tramo.orden}. {tramo.calleOriginal}
                      </span>
                      <span style={{ fontSize: '9.5px', color: esSeleccionado ? '#38BDF8' : '#737373' }}>
                        {tramo.comuna}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

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
          estaAbordado={reservaActiva?.estado === 'abordado' || reservaActiva?.estado === 'pagando'}
          sentidoSeleccionado={sentidoSeleccionado}
          tramoSeleccionado={tramoSeleccionado}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'rgba(74, 222, 128, 0.15)',
                    border: '1px solid #4ADE80',
                    color: '#4ADE80',
                    borderRadius: '10px',
                    padding: '2px 8px',
                    fontSize: '10.5px',
                    fontWeight: '800',
                  }}>
                    <IconoCheck size={11} color="#4ADE80" />
                    Patente Verificada MTT ({reservaActiva.conductor.vehiclePlate})
                  </span>
                </div>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '11px',
                    color: conductorElegido.asientosOcupados >= 4 ? '#A3A3A3' : '#FACC15',
                    fontWeight: '700',
                  }}>
                    {4 - conductorElegido.asientosOcupados} de 4 asientos disponibles
                  </span>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'rgba(74, 222, 128, 0.15)',
                    border: '1px solid #4ADE80',
                    color: '#4ADE80',
                    borderRadius: '10px',
                    padding: '2px 7px',
                    fontSize: '10px',
                    fontWeight: '800',
                  }}>
                    <IconoCheck size={10} color="#4ADE80" />
                    Patente Verificada MTT
                  </span>
                </div>
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
