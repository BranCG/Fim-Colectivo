'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import api, { clearSession, getSession } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import { Linea, ConductorColectivo } from '@/components/map/ColectivoMap';
import { calcularInfoLlegada } from '@/lib/geo';
import { usePantallaEncendida } from '@/lib/usePantallaEncendida';
import { useFcmToken } from '@/lib/useFcmToken';
import {
  IconoColectivo,
  IconoCheck,
  IconoCruz,
  IconoAlerta,
  IconoGps,
  IconoPuntoEstado,
  IconoAsiento,
  IconoReloj,
  IconoCampana,
  IconoEfectivo,
  IconoBanco,
} from '@/components/icons/Iconos';
import { reproducirSonido, hablarTexto } from '@/lib/voice';

// Cargar mapa de colectivos de forma dinámica para evitar problemas con SSR en Next.js
const ColectivoMap = dynamic(() => import('@/components/map/ColectivoMap'), { ssr: false });

interface ReservaActiva {
  id: string;
  conductorId?: string;
  latitudSubida?: number;
  longitudSubida?: number;
  linea: { nombre: string };
  conductor: {
    id: string;
    name: string;
    phone: string;
    vehiclePlate: string;
    vehicleBrand: string;
    vehicleModel: string;
    lastLat?: number;
    lastLng?: number;
  };
  cantidadAsientos: number;
  metodoPago?: 'efectivo' | 'rutpay';
  estado: string; // "reservado", "abordado", "completado"
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
  const [reservaActiva, setReservaActiva] = useState<ReservaActiva | null>(null);
  const [cargandoReserva, setCargandoReserva] = useState(false);

  const reservaActivaRef = useRef<ReservaActiva | null>(null);
  reservaActivaRef.current = reservaActiva;
  const accionEnCurso = useRef(false);
  const [enviandoParada, setEnviandoParada] = useState(false);
  const soloMapa = Boolean(reservaActiva && ['pagado', 'parada_solicitada'].includes(reservaActiva.estado));
  useEffect(() => {
    if (reservaActiva && usuarioSesion?.id) {
      sessionStorage.setItem('fim_reserva_' + usuarioSesion.id, reservaActiva.id);
    }
  }, [reservaActiva, usuarioSesion?.id]);

  // Avisos y abordaje
  const [mostrarModalAbordaje, setMostrarModalAbordaje] = useState<boolean>(false);
  const [enviandoAviso, setEnviandoAviso] = useState<boolean>(false);
  const [telefonoCopiado, setTelefonoCopiado] = useState<boolean>(false);
  const [paradaSolicitada, setParadaSolicitada] = useState<boolean>(false);

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

  // Mantener pantalla encendida siempre (pasajero activo)
  usePantallaEncendida(true);

  // Inicializar y registrar token FCM para notificaciones push en segundo plano
  useFcmToken();

  // 1. Validar autenticación
  useEffect(() => {
    const sesion = getSession();
    if (!sesion) {
      router.push('/login?role=passenger');
      return;
    }
    setUsuarioSesion(sesion.user);
  }, [router]);

  const leerUbicacionRecogida = useCallback(async () => {
    if (!navigator.geolocation) throw new Error('Este dispositivo no permite obtener tu ubicación.');
    const posicion = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }));
    const ubicacion = { latitud: posicion.coords.latitude, longitud: posicion.coords.longitude };
    setUbicacionPasajero(ubicacion);
    return ubicacion;
  }, []);
  useEffect(() => {
    leerUbicacionRecogida().catch(() => setMensajeError('Activa el GPS y el permiso de ubicación para reservar en tu punto de recogida.'));
  }, [leerUbicacionRecogida]);

  // 3. Cargar líneas de colectivo y reservas activas
  const cargarLineasYReservas = useCallback(async () => {
    try {
      const [respuestaLineas, respuestaReservas] = await Promise.all([
        api.get('/colectivos/lineas'),
        api.get('/colectivos/reservas/mis-reservas'),
      ]);

      const lineasObtenidas: Linea[] = respuestaLineas.data.lineas || [];
      setListaLineas(lineasObtenidas);

      if (lineasObtenidas.length > 0 && !lineaSeleccionada) {
        setLineaSeleccionada(lineasObtenidas[0]);
      }

      // Si tiene una reserva en curso
      if (respuestaReservas.data?.reservas && respuestaReservas.data.reservas.length > 0) {
        setReservaActiva(respuestaReservas.data.reservas[0]);
      } else {
        const clave = 'fim_reserva_' + getSession()?.user?.id;
        const id = sessionStorage.getItem(clave);
        if (id) {
          const { data } = await api.get('/colectivos/reservas/' + encodeURIComponent(id) + '/estado');
          if (data.reserva && ['pendiente_chofer', 'reservado', 'abordado', 'pagando', 'pagado', 'parada_solicitada'].includes(data.reserva.estado)) {
            setReservaActiva(data.reserva);
          } else if (data.reserva) {
            sessionStorage.removeItem(clave);
          }
        }
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
      if (!reservaActivaRef.current || datos?.reservaId !== reservaActivaRef.current.id || !['reservado', 'abordado'].includes(reservaActivaRef.current.estado)) return;
      if (datos?.pasajeroId && usuarioSesion?.id && datos.pasajeroId !== usuarioSesion.id) {
        return;
      }
      setReservaActiva((prev) => (prev ? { ...prev, estado: 'abordado' } : null));
      // Mostrar popup de instrucciones al subir y anunciar por voz
      setMostrarModalAbordaje(true);
      reproducirSonido('exito');
      hablarTexto('Indica si pagarás en efectivo o con RutPay.');
    };

    // Evento: Reserva cancelada o rechazada por el chofer
    const manejarReservaCancelada = (datos?: any) => {
      if (datos?.reservaId !== reservaActivaRef.current?.id) return;
      if (!['pendiente_chofer', 'reservado'].includes(reservaActivaRef.current?.estado || '')) return;
      if (datos?.pasajeroId && usuarioSesion?.id && datos.pasajeroId !== usuarioSesion.id) {
        return;
      }
      reproducirSonido('rechazo');
      hablarTexto('El conductor no pudo tomar tu viaje. Puedes pedir otro automóvil.');
      setReservaActiva(null);
      setConductorElegido(null);
      setBuscandoMovil(false);
      setMovilAsignadoPreview(null);
      setMensajeAlerta('');
      setMensajeError(
        datos?.mensaje ||
        'El conductor no pudo aceptar la reserva. Puedes solicitar otro automóvil disponible en el mapa.'
      );
    };

    // Evento: Conductor liberó asiento / finalizó el viaje al llegar a la parada
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const manejarViajeFinalizado = (datos: any) => {
      if (datos?.reservaId !== reservaActivaRef.current?.id) return;
      setReservaActiva(null);
      setConductorElegido(null);
      setBuscandoMovil(false);
      setMovilAsignadoPreview(null);
      setMostrarModalAbordaje(false);
      setParadaSolicitada(false);
      reproducirSonido('exito');
      hablarTexto('Has llegado a tu destino. Gracias por viajar.');
      setMensajeAlerta('¡Viaje completado con éxito! Gracias por viajar con Fim Colectivo.');
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

    const manejarReservaActualizada = (datos: { reserva: ReservaActiva & { pasajeroId: string } }) => {
      if (datos.reserva?.pasajeroId !== usuarioSesion?.id) return;
      if (reservaActivaRef.current && datos.reserva.id !== reservaActivaRef.current.id) return;
      if (!['completado', 'cancelado', 'rechazado'].includes(datos.reserva.estado)) {
        setReservaActiva(datos.reserva);
        if (['pagado', 'parada_solicitada'].includes(datos.reserva.estado)) {
          setMensajeAlerta(''); setMensajeError(''); setMostrarModalAbordaje(false);
        }
      }
    };
    // Compatibilidad con servidores que solo emiten el aviso específico.
    const manejarMetodoAceptado = (datos: { reservaId?: string; pasajeroId?: string }) => {
      if (datos?.reservaId !== reservaActivaRef.current?.id) return;
      if (datos.pasajeroId && datos.pasajeroId !== usuarioSesion?.id) return;
      setReservaActiva(prev => prev && ['abordado', 'pagando'].includes(prev.estado)
        ? { ...prev, estado: 'pagado' } : prev);
      setBuscandoMovil(false);
      setMostrarModalAbordaje(false);
      setMensajeAlerta('');
    };
    socket.on('colectivo:pago-confirmado', manejarMetodoAceptado);
    socket.on('colectivo:reserva-actualizada', manejarReservaActualizada);
    socket.on('colectivo:actualizacion-ubicacion', manejarActualizacionUbicacion);
    socket.on('colectivo:location-update', manejarActualizacionUbicacion);
    socket.on('colectivo:conductor-offline', manejarConductorOffline);
    socket.on('colectivo:conductor-online', manejarConductorOnline);
    socket.on('colectivo:cambio-asientos', manejarCambioAsientos);
    socket.on('colectivo:reserva-abordada', manejarReservaAbordada);
    socket.on('colectivo:reserva-cancelada', manejarReservaCancelada);
    socket.on('colectivo:viaje-finalizado', manejarViajeFinalizado);

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
      const actual = reservaActivaRef.current;
      if (actual && (datos?.reservaId !== actual.id || actual.estado !== 'pendiente_chofer')) return;
      if (datos?.pasajeroId && usuarioSesion?.id && datos.pasajeroId !== usuarioSesion.id) {
        return;
      }
      reproducirSonido('rechazo');
      hablarTexto('Los colectivos no pudieron tomar tu solicitud. Puedes pedir otro automóvil.');
      setReservaActiva(null);
      setConductorElegido(null);
      setBuscandoMovil(false);
      setMovilAsignadoPreview(null);
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
      socket.off('colectivo:reserva-actualizada', manejarReservaActualizada);
      socket.off('colectivo:pago-confirmado', manejarMetodoAceptado);
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
      socket.off('colectivo:viaje-finalizado', manejarViajeFinalizado);
      socket.off('colectivo:asignando-a-chofer', manejarAsignandoAChofer);
      socket.off('colectivo:reserva-aceptada', manejarReservaAceptada);
      socket.off('colectivo:sin-conductores-disponibles', manejarSinConductores);
    };
  }, [lineaSeleccionada?.id, usuarioSesion?.id]);

  // 5. Polling inteligente de respaldo para que la pantalla del pasajero siempre sincronice
  useEffect(() => {
    const requiereSondeo = buscandoMovil || Boolean(reservaActiva);
    if (!requiereSondeo) return;
    let vigente = true;
    let consultando = false;
    const intervalo = setInterval(async () => {
      if (consultando || accionEnCurso.current) return;
      consultando = true;
      try {
        const res = await api.get('/colectivos/reservas/mis-reservas');
        if (!vigente || accionEnCurso.current) return;
        const reservas: ReservaActiva[] = res.data?.reservas || [];
        // Una lista vacía no acredita un descenso: consultar la reserva concreta.
        let actual = reservaActiva
          ? reservas.find(r => r.id === reservaActiva.id)
          : reservas[0];
        if (!actual && reservaActiva) {
          const detalle = await api.get('/colectivos/reservas/' + reservaActiva.id + '/estado');
          if (!vigente || accionEnCurso.current) return;
          actual = detalle.data?.reserva;
        }
        if (!actual) return;
        if (['completado', 'cancelado', 'rechazado', 'sin_conductores'].includes(actual.estado)) {
          setReservaActiva(null);
          setConductorElegido(null);
          setBuscandoMovil(false);
          setMovilAsignadoPreview(null);
          setMostrarModalAbordaje(false);
          setParadaSolicitada(false);
          if (actual.estado === 'completado') {
            setMensajeAlerta('Viaje completado. Gracias por viajar con Fim Colectivo.');
          } else {
            setMensajeError('La reserva finalizó. Puedes solicitar otro colectivo.');
          }
          return;
        }
        setReservaActiva(actual);
        if (actual.estado !== 'pendiente_chofer') {
          setBuscandoMovil(false);
          setMovilAsignadoPreview(null);
        }
        if (['pagado', 'parada_solicitada'].includes(actual.estado)) {
          setMensajeAlerta('');
          setMostrarModalAbordaje(false);
        }
      } catch (e) {
        console.warn('[Pasajero] Error en sondeo de respaldo:', e);
      } finally { consultando = false; }
    }, 2500);

    return () => { vigente = false; clearInterval(intervalo); };
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
      const ubicacion = await leerUbicacionRecogida();
      const res = await api.post('/colectivos/reservar', {
        conductorId: conductorElegido.conductorId,
        lineaId: lineaSeleccionada.id,
        cantidadAsientos,
        latitudSubida: ubicacion.latitud,
        longitudSubida: ubicacion.longitud,
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
      setMensajeAlerta('Reserva cancelada correctamente.');
    } catch (error) {
      console.error('Error al cancelar reserva:', error);
      setMensajeError('No se pudo cancelar la reserva.');
    }
  };

  const avisarMetodo = async (metodoPago: 'efectivo' | 'rutpay') => {
    if (!reservaActiva || accionEnCurso.current) return;
    accionEnCurso.current = true; setEnviandoAviso(true); setMensajeError('');
    try {
      const res = await api.post('/colectivos/reservas/' + reservaActiva.id + '/solicitar-pago', { metodoPago });
      setReservaActiva(res.data.reserva);
    } catch (error: any) {
      setMensajeError(error.response?.data?.error || 'No se pudo enviar el aviso. Intenta nuevamente.');
    } finally { accionEnCurso.current = false; setEnviandoAviso(false); }
  };

  const solicitarParada = async () => {
    if (!reservaActiva || accionEnCurso.current || reservaActiva.estado !== 'pagado') return;
    accionEnCurso.current = true; setEnviandoParada(true); setMensajeError('');
    try {
      const res = await api.post('/colectivos/reservas/' + reservaActiva.id + '/solicitar-parada');
      setReservaActiva(res.data.reserva);
      setParadaSolicitada(true);
      reproducirSonido('exito');
    } catch (error: any) {
      setMensajeError(error.response?.data?.error || 'No se pudo solicitar la parada. Vuelve a intentarlo.');
    } finally { accionEnCurso.current = false; setEnviandoParada(false); }
  };

  // Solicitar asignación dirigida al primer móvil en tránsito (Regla Federación)
  const solicitarProximoColectivo = async () => {
    if (!lineaSeleccionada || reservaActiva || buscandoMovil) return;
    setConductorElegido(null);
    setBuscandoMovil(true);
    setMensajeError('');
    setMovilAsignadoPreview(null);
    try {
      const ubicacion = await leerUbicacionRecogida();
      const res = await api.post('/colectivos/solicitar-dirigido', {
        lineaId: lineaSeleccionada.id,
        latitudSubida: ubicacion.latitud,
        longitudSubida: ubicacion.longitud,
        cantidadAsientos,
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

  if (soloMapa && reservaActiva) {
    const conductorId = reservaActiva.conductor.id;
    const detenido = reservaActiva.estado === 'parada_solicitada';
    return <main style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0A0A0A' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <ColectivoMap ubicacionUsuario={ubicacionPasajero} lineaSeleccionada={lineaSeleccionada}
          conductoresEnVivo={conductoresEnVivo.filter(c => c.conductorId === conductorId)}
          conductorSeleccionadoId={conductorId} estaAbordado />
      </div>
      {mensajeError && <p role="alert" style={{ color: '#FACC15', padding: 12 }}>{mensajeError}</p>}
      <button id="btn-solicitar-parada" onClick={solicitarParada} disabled={enviandoParada || detenido}
        style={{ margin: 16, marginBottom: 'max(16px, env(safe-area-inset-bottom))', padding: 22, border: 0, borderRadius: 16, background: '#FACC15', color: '#000', fontWeight: 900, fontSize: 22 }}>
        <IconoCampana size={24} /> {enviandoParada ? 'ENVIANDO…' : detenido ? 'PARADA SOLICITADA' : 'SOLICITAR PARADA'}
      </button>
    </main>;
  }

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
          estaAbordado={false}
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

            <div style={{ display: 'flex', gap: 8 }}>
              {/* Cancelar solo antes de abordar. */}
              {reservaActiva.estado !== 'abordado' && reservaActiva.estado !== 'pagando' && reservaActiva.estado !== 'pagado' && (
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
                {/* Selector de asientos para el próximo colectivo */}
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

      {/* ── MODAL: INSTRUCCIONES AL ABORDAR (aparece inmediatamente al subir) ── */}
      {reservaActiva && ['abordado', 'pagando'].includes(reservaActiva.estado) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0, 0, 0, 0.92)',
            backdropFilter: 'blur(10px)',
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
              background: '#0D0D0D',
              borderRadius: '24px',
              padding: '28px 24px',
              border: '2px solid #FACC15',
              boxShadow: '0 20px 60px rgba(250, 204, 21, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              textAlign: 'center',
            }}
          >
            {/* Icono */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  background: 'rgba(250, 204, 21, 0.15)',
                  border: '2px solid #FACC15',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 30px rgba(250, 204, 21, 0.3)',
                  animation: 'fimPulse 1.5s infinite ease-out',
                }}
              >
                <IconoColectivo size={38} color="#FACC15" />
              </div>
            </div>

            {/* Mensaje principal */}
            <div>
              <span style={{
                fontSize: '11px',
                fontWeight: '800',
                color: '#FACC15',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
              }}>
                ESTAS A BORDO
              </span>
              <h2 style={{ margin: '8px 0 0 0', fontSize: '20px', fontWeight: '900', color: '#FFFFFF', lineHeight: '1.3' }}>
                Indica cómo pagarás al conductor
              </h2>
              <p style={{ margin: '10px 0 0 0', fontSize: '13px', color: '#A3A3A3', lineHeight: '1.5' }}>
                Estos botones avisan al conductor. El pago se realiza directamente con él.
              </p>
            </div>

            {/* Conductor asignado */}
            <div style={{
              background: '#171717',
              padding: '14px 16px',
              borderRadius: '12px',
              fontSize: '13px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
            }}>
              <div>
                <div style={{ color: '#A3A3A3', fontSize: '11px', marginBottom: '3px' }}>Conductor Asignado</div>
                <div style={{ fontWeight: '800', color: '#FFFFFF', fontSize: '15px' }}>
                  {reservaActiva.conductor.name} ({reservaActiva.conductor.vehiclePlate})
                </div>
              </div>
            </div>

            {reservaActiva.estado === 'abordado' ? <>
              <button id="btn-pagar-efectivo" onClick={() => avisarMetodo('efectivo')} disabled={enviandoAviso}
                style={{ padding: 18, borderRadius: 14, background: '#FACC15', border: 0, color: '#000', fontSize: 18, fontWeight: 900 }}>
                <IconoEfectivo size={24} /> Pagar en efectivo
              </button>
              <button id="btn-pagar-rutpay" onClick={() => avisarMetodo('rutpay')} disabled={enviandoAviso}
                style={{ padding: 18, borderRadius: 14, background: '#171717', border: '2px solid #FACC15', color: '#FACC15', fontSize: 18, fontWeight: 900 }}>
                <IconoBanco size={24} /> Pagar con RutPay
              </button>
            </> : <p role="status" style={{ color: '#FACC15' }}>Avisaste que pagarás {reservaActiva.metodoPago === 'rutpay' ? 'con RutPay' : 'en efectivo'}. Esperando al conductor…</p>}
            {mensajeError && <p role="alert" style={{ color: '#FACC15' }}>{mensajeError}</p>}

            {enviandoAviso && (
              <p style={{ margin: 0, fontSize: '12px', color: '#FACC15', fontWeight: '700' }}>
                Avisando al conductor...
              </p>
            )}
          </div>
        </div>
      )}


    </div>
  );
}
