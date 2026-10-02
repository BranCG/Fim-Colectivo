'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import api, { clearSession, getSession } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import { Linea, ConductorColectivo, PasajeroEnEspera } from '@/components/map/ColectivoMap';
import { calcularInfoLlegada } from '@/lib/geo';
import { usePantallaEncendida } from '@/lib/usePantallaEncendida';
import { useFcmToken } from '@/lib/useFcmToken';
import {
  IconoColectivo,
  IconoAsiento,
  IconoPasajero,
  IconoGps,
  IconoTelefono,
  IconoCheck,
  IconoCruz,
  IconoMas,
  IconoMenos,
  IconoPuntoEstado,
  IconoUbicacion,
  IconoSalir,
  IconoReloj,
  IconoMicrofono,
  IconoParlante,
  IconoCampana,
} from '@/components/icons/Iconos';

// Cargar mapa dinámico sin SSR para Leaflet
const ColectivoMap = dynamic(() => import('@/components/map/ColectivoMap'), { ssr: false });
import AlertaMetodoPago from '@/components/driver/AlertaMetodoPago';
import AlertaVozReserva, { DatosSolicitudDirigida } from '@/components/driver/AlertaVozReserva';
import { reproducirSonido, hablarTexto, desbloquearAudioYVoz, iniciarEscuchaVoz, detenerVoz, bloquearAbordoTemporal } from '@/lib/voice';

interface AvisoPasajero {
  metodoPago: 'efectivo' | 'rutpay';
  reservaId: string;
  pasajeroNombre: string;
  cantidadAsientos: number;
}

interface ReservaPasajero {
  conductorId?: string;
  metodoPago?: 'efectivo' | 'rutpay';
  id: string;
  pasajero: {
    id: string;
    name: string;
    phone: string;
  };
  cantidadAsientos: number;
  direccionSubida?: string;
  latitudSubida?: number | null;
  longitudSubida?: number | null;
  estado: string;
}

export default function PaginaConductorColectivo() {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [choferSesion, setChoferSesion] = useState<any>(null);

  // Estados del colectivo
  const [lineasDisponibles, setLineasDisponibles] = useState<Linea[]>([]);
  const [lineaActual, setLineaActual] = useState<Linea | null>(null);
  const [enServicio, setEnServicio] = useState<boolean>(false);
  const [asientosOcupados, setAsientosOcupados] = useState<number>(0);
  const [sentidoRuta, setSentidoRuta] = useState<'ida' | 'vuelta'>('ida');

  // Ubicación y mapa en tiempo real
  const [ubicacionChofer, setUbicacionChofer] = useState<{
    latitud: number;
    longitud: number;
  } | null>(null);
  const [disparadorCentrado, setDisparadorCentrado] = useState(0);
  const [conductoresEnVivo, setConductoresEnVivo] = useState<ConductorColectivo[]>([]);

  // Reservas de pasajeros
  const [reservasPendientes, setReservasPendientes] = useState<ReservaPasajero[]>([]);
  const estadoReservasRef = useRef({ reservas: reservasPendientes, asientos: asientosOcupados });
  estadoReservasRef.current = { reservas: reservasPendientes, asientos: asientosOcupados };

  // Solicitud dirigida en tránsito (Manos libres TTS y botones gigantes)
  const [solicitudActiva, setSolicitudActiva] = useState<DatosSolicitudDirigida | null>(null);

  // Aviso de un pasajero a bordo
  const [avisoPendiente, setAvisoPendiente] = useState<AvisoPasajero | null>(null);
  const [paradaSolicitada, setParadaSolicitada] = useState<{
    pasajeroNombre: string;
    reservaId?: string;
    hora: string;
  } | null>(null);
  const [audioDesbloqueado, setAudioDesbloqueado] = useState<boolean>(false);
  const [cargandoAccion, setCargandoAccion] = useState<string | null>(null);

  // Estados de retroalimentación de voz en tiempo real
  const [textoDetectadoAbordaje, setTextoDetectadoAbordaje] = useState<string>('');
  const [anunciandoAbordajeVoz, setAnunciandoAbordajeVoz] = useState<boolean>(false);

  // Mensajes de alerta y feedback
  const [mensajeExito, setMensajeExito] = useState<string>('');
  const [mensajeError, setMensajeError] = useState<string>('');

  const [pasajeroAbordajeId, setPasajeroAbordajeId] = useState<string | null>(null);
  const [elegirAbordaje, setElegirAbordaje] = useState(false);
  const abordajesEnCurso = useRef(new Set<string>());
  const respuestasEnCurso = useRef(new Set<string>());
  const paradasAnunciadas = useRef(new Set<string>());
  const reservasRef = useRef(reservasPendientes);
  reservasRef.current = reservasPendientes;

  // Referencia a rastreo GPS y deduplicación de eventos
  const watchIdRef = useRef<number | null>(null);
  const ubicacionChoferRef = useRef(ubicacionChofer);
  const ultimaSolicitudNotificadaRef = useRef<{ id: string; timestamp: number } | null>(null);
  const escuchaAbordajeRef = useRef<{ detener: () => void } | null>(null);

  useEffect(() => {
    ubicacionChoferRef.current = ubicacionChofer;
  }, [ubicacionChofer]);

  // Mantener pantalla encendida siempre (conductor activo)
  usePantallaEncendida(true);

  // Inicializar y registrar token FCM para notificaciones push en segundo plano
  useFcmToken();

  // 1. Validar autenticación de chofer
  useEffect(() => {
    const sesion = getSession();
    if (!sesion) {
      router.push('/login?role=driver');
      return;
    }
    setChoferSesion(sesion.user);
  }, [router]);

  // 2. Obtener ubicación GPS inicial del dispositivo
  useEffect(() => {
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUbicacionChofer({
            latitud: pos.coords.latitude,
            longitud: pos.coords.longitude,
          });
        },
        (err) => {
          console.warn('GPS inicial no disponible, usando última posición guardada:', err.message);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }, []);

  // 3. Cargar datos del chofer y líneas disponibles
  const cargarDatosChofer = useCallback(async () => {
    try {
      const [resEstado, resLineas] = await Promise.all([
        api.get('/colectivos/conductor/estado').catch(() => null),
        api.get('/colectivos/lineas'),
      ]);

      const lineas: Linea[] = resLineas.data.lineas || [];
      setLineasDisponibles(lineas);

      if (resEstado?.data?.chofer) {
        const datos = resEstado.data.chofer;
        setEnServicio(datos.isOnline || false);
        setAsientosOcupados(datos.asientosOcupados || 0);
        setSentidoRuta(datos.sentidoRuta || 'ida');

        if (datos.lastLat && datos.lastLng) {
          setUbicacionChofer((prev) => prev || {
            latitud: datos.lastLat,
            longitud: datos.lastLng,
          });
        }

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

  useEffect(() => {
    if (!choferSesion?.id) return;
    let alive = true;
    let syncing = false;
    const sync = async () => {
      if (syncing) return;
      syncing = true;
      const previo = estadoReservasRef.current;
      try {
        const { data } = await api.get('/colectivos/conductor/estado');
        if (!alive) return;
        // No sustituir una acción o evento más reciente por una consulta que salió antes.
        if (previo.reservas !== estadoReservasRef.current.reservas || previo.asientos !== estadoReservasRef.current.asientos) return;
        setReservasPendientes(data.chofer.reservasAsiento || []);
        setAsientosOcupados(data.chofer.asientosOcupados);
      } catch (error) { console.warn('No se pudieron sincronizar las reservas.', error); }
      finally { syncing = false; }
    };
    const socket = connectSocket();
    socket.on('connect', sync);
    const timer = setInterval(sync, 3000);
    return () => { alive = false; clearInterval(timer); socket.off('connect', sync); };
  }, [choferSesion?.id]);

  useEffect(() => {
    const pendiente = reservasPendientes.find(r => r.estado === 'pagando');
    setAvisoPendiente(prev => {
      if (!pendiente || !['efectivo', 'rutpay'].includes(pendiente.metodoPago || '')) return null;
      if (prev?.reservaId === pendiente.id && prev.metodoPago === pendiente.metodoPago) return prev;
      return { reservaId: pendiente.id, pasajeroNombre: pendiente.pasajero.name, cantidadAsientos: pendiente.cantidadAsientos, metodoPago: pendiente.metodoPago! };
    });
    const parada = reservasPendientes.find(r => r.estado === 'parada_solicitada');
    setParadaSolicitada(prev => !parada ? null : prev?.reservaId === parada.id ? prev : {
      reservaId: parada.id, pasajeroNombre: parada.pasajero.name, hora: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
    });
    if (!solicitudActiva && !pendiente && !parada) {
      const siguiente = reservasPendientes.find(r => r.estado === 'pendiente_chofer');
      if (siguiente && !respuestasEnCurso.current.has(siguiente.id)) setSolicitudActiva({ reservaId: siguiente.id, nombrePasajero: siguiente.pasajero.name, cantidadAsientos: siguiente.cantidadAsientos, distanciaMetros: 0 });
    }
  }, [reservasPendientes, solicitudActiva]);

  useEffect(() => {
    if (!paradaSolicitada?.reservaId || solicitudActiva || avisoPendiente || paradasAnunciadas.current.has(paradaSolicitada.reservaId)) return;
    paradasAnunciadas.current.add(paradaSolicitada.reservaId);
    reproducirSonido('alerta');
    hablarTexto('Deja a ' + paradaSolicitada.pasajeroNombre.split(' ')[0] + ' en la siguiente parada.');
  }, [paradaSolicitada?.reservaId, solicitudActiva, avisoPendiente]);

  // 4. WebSockets y transmisión de ubicación en tiempo real
  useEffect(() => {
    if (!choferSesion?.id) return;

    const socket = connectSocket();

    // Función idempotente para unirse a salas del chofer y línea
    const suscribirSalas = () => {
      if (choferSesion?.id) {
        socket.emit('conductor:unirse', { conductorId: choferSesion.id });
        if (enServicio) {
          socket.emit('driver:online', {
            driverId: choferSesion.id,
            lat: ubicacionChoferRef.current?.latitud || -33.4489,
            lng: ubicacionChoferRef.current?.longitud || -70.6693,
          });
        } else {
          socket.emit('driver:offline', {
            driverId: choferSesion.id,
          });
        }
      }
      if (lineaActual?.id) {
        socket.emit('colectivo:unirse-linea', { lineaId: lineaActual.id });
      }
    };

    suscribirSalas();
    socket.on('connect', suscribirSalas);

    // Evento al recibir una nueva reserva de asiento (actualiza lista visual y estado de asientos)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const manejarNuevaReserva = (datos: { reserva: any; asientosOcupados?: number; conductorId?: string }) => {
      if (datos.conductorId && choferSesion?.id && datos.conductorId !== choferSesion.id) {
        return;
      }
      setReservasPendientes((prev) => {
        const existe = prev.some((r) => r.id === datos.reserva?.id);
        if (existe) return prev;
        return [datos.reserva, ...prev];
      });
      if (datos.asientosOcupados !== undefined) {
        setAsientosOcupados(datos.asientosOcupados);
        setChoferSesion((prev: any) =>
          prev ? { ...prev, asientosOcupados: datos.asientosOcupados } : null
        );
      }
      setMensajeExito(`Nueva reserva: Pasajero ${datos.reserva?.pasajero?.name || 'en ruta'}`);
    };

    // Evento si el pasajero cancela
    const manejarReservaCancelada = (datos: { reservaId: string }) => {
      setReservasPendientes((prev) => prev.filter((r) => r.id !== datos.reservaId));
      setSolicitudActiva((prev) => (prev?.reservaId === datos.reservaId ? null : prev));
      setAvisoPendiente((prev) => (prev?.reservaId === datos.reservaId ? null : prev));
      setMensajeExito('Una reserva fue cancelada por el pasajero.');
    };

    // Evento de solicitud dirigida al móvil en tránsito (Dispara lectura TTS y modal gigante con deduplicación)
    const manejarSolicitudAsignada = (datos: DatosSolicitudDirigida & { conductorId?: string }) => {
      if (datos.conductorId && choferSesion?.id && datos.conductorId !== choferSesion.id) {
        return;
      }
      if (
        ultimaSolicitudNotificadaRef.current &&
        ultimaSolicitudNotificadaRef.current.id === datos.reservaId &&
        Date.now() - ultimaSolicitudNotificadaRef.current.timestamp < 15000
      ) {
        console.log('[Driver] Ignorando evento duplicado de solicitud:', datos.reservaId);
        return;
      }
      ultimaSolicitudNotificadaRef.current = { id: datos.reservaId, timestamp: Date.now() };
      setSolicitudActiva(prev => prev || datos);
    };

    // Evento si la solicitud expiró o fue pasada a otro móvil
    const manejarSolicitudExpirada = (datos: { reservaId: string }) => {
      setSolicitudActiva((prev) => (prev?.reservaId === datos.reservaId ? null : prev));
    };

    // Evento si el pasajero canceló mientras sonaba la alerta
    const manejarSolicitudCancelada = (datos: { reservaId: string }) => {
      setSolicitudActiva((prev) => (prev?.reservaId === datos.reservaId ? null : prev));
    };

    // Evento: Cambio en asientos ocupados de la línea o propio móvil
    const manejarCambioAsientos = (datos: { conductorId: string; asientosOcupados: number; asientosTotales: number }) => {
      if (datos.conductorId === choferSesion.id) {
        setAsientosOcupados(datos.asientosOcupados);
        setChoferSesion((prev: any) =>
          prev ? { ...prev, asientosOcupados: datos.asientosOcupados } : null
        );
      }
    };

    const manejarReservaActualizada = (datos: { reserva: ReservaPasajero; asientosOcupados: number }) => {
      const reserva = datos.reserva;
      if (!reserva || reserva.conductorId !== choferSesion.id) return;
      setAsientosOcupados(datos.asientosOcupados);
      setReservasPendientes(prev => {
        const restantes = prev.filter(r => r.id !== reserva.id);
        return ['completado', 'cancelado', 'rechazado'].includes(reserva.estado) ? restantes : [...restantes, reserva];
      });
      if (reserva.estado !== 'pendiente_chofer') setSolicitudActiva(prev => prev?.reservaId === reserva.id ? null : prev);
    };

    // Evento: Reserva confirmada al chofer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const manejarReservaConfirmadaChofer = (datos: { reserva: any; asientosOcupados?: number }) => {
      setSolicitudActiva((prev) => (prev?.reservaId === datos.reserva?.id ? null : prev));
      if (datos.asientosOcupados !== undefined) {
        setAsientosOcupados(datos.asientosOcupados);
        setChoferSesion((prev: any) =>
          prev ? { ...prev, asientosOcupados: datos.asientosOcupados } : null
        );
      }
      if (datos.reserva) {
        setReservasPendientes((prev) => {
          const index = prev.findIndex((r) => r.id === datos.reserva.id);
          if (index >= 0) {
            const copia = [...prev];
            copia[index] = { ...copia[index], ...datos.reserva, estado: 'reservado' };
            return copia;
          }
          return [datos.reserva, ...prev];
        });
      }
    };

    // Evento de ubicación de otros colectivos de la misma línea
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const manejarUbicacionFlota = (payload: any) => {
      if (payload.lineaId === lineaActual?.id && payload.conductorId !== choferSesion.id) {
        setConductoresEnVivo((prev) => {
          const index = prev.findIndex((c) => c.conductorId === payload.conductorId);
          const nuevoChofer: ConductorColectivo = {
            conductorId: payload.conductorId,
            nombre: payload.nombre,
            patente: payload.patente,
            latitud: payload.latitud,
            longitud: payload.longitud,
            asientosOcupados: payload.asientosOcupados,
            asientosTotales: payload.asientosTotales,
            sentidoRuta: payload.sentidoRuta,
          };
          if (index >= 0) {
            const copia = [...prev];
            copia[index] = nuevoChofer;
            return copia;
          }
          return [...prev, nuevoChofer];
        });
      }
    };

    // Evento si otro colectivo de la línea se desconecta o pasa a fuera de servicio
    const manejarConductorOffline = (datos: { conductorId: string }) => {
      setConductoresEnVivo((prev) => prev.filter((c) => c.conductorId !== datos.conductorId));
    };

    socket.on('colectivo:nueva-reserva', manejarNuevaReserva);
    socket.on('colectivo:reserva-cancelada', manejarReservaCancelada);
    socket.on('colectivo:actualizacion-ubicacion', manejarUbicacionFlota);
    socket.on('colectivo:conductor-offline', manejarConductorOffline);
    socket.on('colectivo:solicitud-asignada', manejarSolicitudAsignada);
    socket.on('colectivo:solicitud-expirada', manejarSolicitudExpirada);
    socket.on('colectivo:solicitud-cancelada', manejarSolicitudCancelada);
    socket.on('colectivo:cambio-asientos', manejarCambioAsientos);
    socket.on('colectivo:reserva-actualizada', manejarReservaActualizada);
    socket.on('colectivo:reserva-confirmada-chofer', manejarReservaConfirmadaChofer);


    // Si está en servicio, transmitir ubicación GPS continua
    if (enServicio && typeof window !== 'undefined' && 'geolocation' in navigator) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (posicion) => {
          const nuevaLat = posicion.coords.latitude;
          const nuevaLng = posicion.coords.longitude;

          setUbicacionChofer({ latitud: nuevaLat, longitud: nuevaLng });

          socket.emit('driver:location', {
            driverId: choferSesion.id,
            lat: nuevaLat,
            lng: nuevaLng,
          });
        },
        (err) => console.warn('Error en GPS del chofer:', err),
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
      );
    } else if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    return () => {
      socket.off('colectivo:nueva-reserva', manejarNuevaReserva);
      socket.off('colectivo:reserva-cancelada', manejarReservaCancelada);
      socket.off('colectivo:actualizacion-ubicacion', manejarUbicacionFlota);
      socket.off('colectivo:location-update', manejarUbicacionFlota);
      socket.off('colectivo:conductor-offline', manejarConductorOffline);
      socket.off('colectivo:solicitud-asignada', manejarSolicitudAsignada);
      socket.off('colectivo:solicitud-expirada', manejarSolicitudExpirada);
      socket.off('colectivo:solicitud-cancelada', manejarSolicitudCancelada);
      socket.off('colectivo:cambio-asientos', manejarCambioAsientos);
      socket.off('colectivo:reserva-actualizada', manejarReservaActualizada);
      socket.off('colectivo:reserva-confirmada-chofer', manejarReservaConfirmadaChofer);

      socket.off('connect', suscribirSalas);
      if (lineaActual?.id) {
        socket.emit('colectivo:salir-linea', { lineaId: lineaActual.id });
      }
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enServicio, choferSesion?.id, lineaActual?.id]);

  // Sincronización de respaldo periódica (cada 7s) en servicio
  useEffect(() => {
    if (!enServicio) return;
    const intervalo = setInterval(() => {
      cargarDatosChofer();
    }, 7000);
    return () => clearInterval(intervalo);
  }, [enServicio, cargarDatosChofer]);

  // Alternar estado En Servicio / Fuera de Servicio
  const alternarServicio = async () => {
    const nuevoEstado = !enServicio;
    setEnServicio(nuevoEstado);

    try {
      // Persistir inmediatamente en base de datos para que el polling de 7s y el backend no se desincronicen
      await api.post('/colectivos/conductor/servicio', { enServicio: nuevoEstado });
    } catch (error) {
      console.error('Error al actualizar estado de servicio en backend:', error);
    }

    const socket = connectSocket();

    if (nuevoEstado) {
      // Desbloquear audio al iniciar turno
      desbloquearAudioYVoz('Servicio iniciado. Audio y voz conectados.', () => {
        setAudioDesbloqueado(true);
      });

      if (typeof window !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition((pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUbicacionChofer({ latitud: lat, longitud: lng });
          socket.emit('driver:online', {
            driverId: choferSesion?.id,
            lat,
            lng,
          });
        });
      }
    } else {
      // Si pasa a Fuera de Servicio: emitir driver:offline y detener rastreo GPS inmediatamente
      if (choferSesion?.id) {
        socket.emit('driver:offline', { driverId: choferSesion.id });
      }
      if (watchIdRef.current !== null && typeof window !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }

    setMensajeExito(nuevoEstado ? 'Turno iniciado: En servicio transmitiendo GPS' : 'Turno finalizado: Fuera de servicio');
  };

  // Asignar línea de colectivo
  const cambiarLineaColectivo = async (nuevaLineaId: string) => {
    try {
      await api.post('/colectivos/conductor/linea', { lineaId: nuevaLineaId });
      const lineaEncontrada = lineasDisponibles.find((l) => l.id === nuevaLineaId) || null;
      setLineaActual(lineaEncontrada);
      setConductoresEnVivo([]);
      setMensajeExito(`Línea cambiada a ${lineaEncontrada?.nombre}`);
    } catch (error) {
      console.error('Error al cambiar línea:', error);
      setMensajeError('No se pudo cambiar la línea.');
    }
  };

  // Modificar asientos ocupados (+ / - o clic directo)
  const modificarAsientos = async (delta: number) => {
    const nuevoTotal = Math.max(0, Math.min(4, asientosOcupados + delta));
    if (nuevoTotal === asientosOcupados) return;
    try {
      const res = await api.post('/colectivos/conductor/asientos', { asientosOcupados: nuevoTotal });
      setAsientosOcupados(res.data.chofer.asientosOcupados);
    } catch (error: any) {
      console.error('Error al actualizar asientos:', error);
      setMensajeError(error.response?.data?.error || 'No se pudo actualizar la cantidad de asientos.');
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

  // Responder a la solicitud dirigida de asiento (Aceptar / Rechazar)
  const responderSolicitudDirigida = async (reservaId: string, accion: 'aceptar' | 'rechazar') => {
    if (respuestasEnCurso.current.has(reservaId)) return;
    respuestasEnCurso.current.add(reservaId);
    const pasajeroNombre = (solicitudActiva?.nombrePasajero || solicitudActiva?.pasajeroNombre || 'el pasajero').split(' ')[0];
    try {
      setSolicitudActiva(null);
      const res = await api.post(`/colectivos/reservas/${reservaId}/responder`, { accion });
      if (accion === 'aceptar') {
        const nombreConfirmado = (res.data?.reserva?.pasajero?.name || pasajeroNombre).split(' ')[0];
        setMensajeExito(`Reserva aceptada: ${nombreConfirmado} confirmado.`);
        reproducirSonido('exito');

        // Locución guiada sin auto-disparo de trigger
        const locucionConfirmada =
          nombreConfirmado && nombreConfirmado !== 'el pasajero'
            ? `Reserva aceptada. Indica cuando suba ${nombreConfirmado}.`
            : 'Reserva aceptada. Indica cuando suba el pasajero.';

        setAnunciandoAbordajeVoz(true);
        setTimeout(() => {
          bloquearAbordoTemporal(1200);
          hablarTexto(locucionConfirmada, () => {
            setAnunciandoAbordajeVoz(false);
          });
        }, 500);

        // Actualizar conteo de asientos inmediatamente en pantalla
        if (res.data?.asientosOcupados !== undefined) {
          setAsientosOcupados(res.data.asientosOcupados);
          setChoferSesion((prev: any) =>
            prev ? { ...prev, asientosOcupados: res.data.asientosOcupados } : null
          );
        } else {
          setAsientosOcupados((prev) => Math.min(4, prev + 1));
          setChoferSesion((prev: any) =>
            prev ? { ...prev, asientosOcupados: Math.min(4, (prev.asientosOcupados || 0) + 1) } : null
          );
        }

        // Actualizar la reserva en el listado local a estado 'reservado' y limpiar duplicados
        const reservaConfirmada = res.data?.reserva;
        if (reservaConfirmada) {
          setReservasPendientes((prev) => {
            const filtradas = prev.filter(
              (r) => r.id === reservaId || r.pasajero?.id !== reservaConfirmada.pasajero?.id
            );
            const index = filtradas.findIndex((r) => r.id === reservaId);
            if (index >= 0) {
              const copia = [...filtradas];
              copia[index] = { ...copia[index], ...reservaConfirmada };
              return copia;
            }
            return [reservaConfirmada, ...filtradas];
          });
        }
      } else {
        setMensajeExito('Solicitud rechazada. Reasignada al siguiente colectivo.');
        reproducirSonido('rechazo');
        setReservasPendientes((prev) => prev.filter((r) => r.id !== reservaId));
      }
    } catch (error) {
      console.error('Error al responder solicitud dirigida:', error);
      setSolicitudActiva(null);
      setMensajeError('No se pudo procesar la respuesta a la reserva.');
    } finally {
      respuestasEnCurso.current.delete(reservaId);
    }
  };

  // Marcar pasajero como abordado
  const confirmarAbordaje = async (reservaId: string) => {
    if (abordajesEnCurso.current.has(reservaId)) return;
    abordajesEnCurso.current.add(reservaId);
    try {
      setCargandoAccion(reservaId);
      const res = await api.post(`/colectivos/reservas/${reservaId}/abordar`);
      setReservasPendientes((prev) =>
        prev.map((r) => (r.id === reservaId ? { ...r, ...res.data.reserva } : r))
      );
      if (res.data?.chofer?.asientosOcupados !== undefined) {
        setAsientosOcupados(res.data.chofer.asientosOcupados);
      }
      setPasajeroAbordajeId(null); setElegirAbordaje(false);
      setMensajeExito('Pasajero a bordo. Asiento registrado en rojo.');
      reproducirSonido('exito');
      setTimeout(() => {
        bloquearAbordoTemporal(1000);
        hablarTexto('Pasajero a bordo');
      }, 450);
    } catch (error) {
      console.error('Error al confirmar abordaje:', error);
      setMensajeError('No se pudo registrar el abordaje.');
    } finally {
      abordajesEnCurso.current.delete(reservaId);
      setCargandoAccion(null);
    }
  };

  // Con varias recogidas, el conductor selecciona el pasajero antes de decir A bordo.
  useEffect(() => {
    if (!reservasPendientes.some(r => r.estado === 'reservado') || solicitudActiva || avisoPendiente || paradaSolicitada) return;
    const escucha = iniciarEscuchaVoz({
      id: 'escucha-abordaje-conductor',
      onAbordo: () => {
        const candidatos = reservasRef.current.filter(r => r.estado === 'reservado');
        const elegido = candidatos.find(r => r.id === pasajeroAbordajeId) || (candidatos.length === 1 ? candidatos[0] : null);
        if (!elegido) {
          setElegirAbordaje(true);
          hablarTexto('Selecciona al pasajero que acaba de subir.');
          return;
        }
        setTextoDetectadoAbordaje('A BORDO DETECTADO');
        void confirmarAbordaje(elegido.id);
      },
      onTextoDetectado: setTextoDetectadoAbordaje,
      onError: () => setMensajeError('Micrófono no disponible. Usa el botón Subir a bordo.'),
    });
    return () => escucha.detener();
  }, [reservasPendientes, solicitudActiva, avisoPendiente, paradaSolicitada, pasajeroAbordajeId]);

  const aceptarMetodo = async (reservaId: string) => {
    const { data } = await api.post('/colectivos/reservas/' + reservaId + '/confirmar-pago');
    setReservasPendientes(prev => prev.map(r => r.id === reservaId ? data.reserva : r));
    setAvisoPendiente(null);
  };

  // Liberar asiento cuando el pasajero desciende.
  const liberarAsientoParada = async (reservaId?: string) => {
    try {
      if (reservaId) {
        setCargandoAccion(reservaId);
        const res = await api.post(`/colectivos/reservas/${reservaId}/liberar-asiento`);
        setAsientosOcupados(res.data.asientosOcupados);
        setChoferSesion((prev: any) => prev ? { ...prev, asientosOcupados: res.data.asientosOcupados } : null);
        setReservasPendientes((prev) => prev.filter((r) => r.id !== reservaId));
      } else {
        setAsientosOcupados((prev) => Math.max(0, prev - 1));
      }
      setParadaSolicitada(null);
      setMensajeExito('Asiento liberado.');
      reproducirSonido('exito');
    } catch (error) {
      console.error('Error al liberar asiento:', error);
      setMensajeError('No se pudo liberar el asiento.');
    } finally {
      setCargandoAccion(null);
    }
  };

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

  // Cerrar sesión
  const cerrarSesionChofer = () => {
    clearSession();
    router.push('/login?role=driver');
  };

  // Pasajeros en espera formateados para marcadores en el mapa con cálculo de ETA cuantitativo
  const pasajerosEnEspera: PasajeroEnEspera[] = useMemo(() => {
    return reservasPendientes
      .filter((r) => ['reservado', 'abordado', 'pagando'].includes(r.estado))
      .map((r) => {
        let lat = r.latitudSubida;
        let lng = r.longitudSubida;
        if ((!lat || !lng) && lineaActual?.paradas) {
          const parada = lineaActual.paradas.find(
            (p) => p.nombre.toLowerCase() === r.direccionSubida?.toLowerCase()
          );
          if (parada) {
            lat = parada.latitud;
            lng = parada.longitud;
          }
        }
        if (!lat || !lng) return null;

        let minutosLlegada: number | undefined;
        let distanciaTexto: string | undefined;

        if (ubicacionChofer?.latitud && ubicacionChofer?.longitud) {
          const info = calcularInfoLlegada(
            ubicacionChofer.latitud,
            ubicacionChofer.longitud,
            lat,
            lng
          );
          if (info) {
            minutosLlegada = info.minutos;
            distanciaTexto = info.textoDistancia;
          }
        }

        return {
          id: r.id,
          nombre: r.pasajero.name,
          latitud: lat,
          longitud: lng,
          asientos: r.cantidadAsientos,
          paradaNombre: r.direccionSubida,
          minutosLlegada,
          distanciaTexto,
        };
      })
      .filter(Boolean) as PasajeroEnEspera[];
  }, [reservasPendientes, lineaActual, ubicacionChofer]);

  // ─── Desglose de Asientos por Estado (Libre: Verde, Reservado: Naranjo, A Bordo: Rojo) ───
  const conteoAsientos = useMemo(() => {
    // 1. Asientos de pasajeros a bordo (incluye estados históricos).
    const abordados = reservasPendientes
      .filter((r) => r.estado === 'abordado' || r.estado === 'pagando' || r.estado === 'pagado')
      .reduce((sum, r) => sum + (r.cantidadAsientos || 1), 0);

    // 2. Asientos con reserva aceptada esperando subir al colectivo
    const reservados = reservasPendientes
      .filter((r) => r.estado === 'reservado')
      .reduce((sum, r) => sum + (r.cantidadAsientos || 1), 0);

    // 3. Asientos ocupados manualmente fuera de reservas de app
    const manuales = Math.max(0, asientosOcupados - (abordados + reservados));
    const totalAbordados = Math.min(4, abordados + manuales);
    const totalReservados = Math.min(Math.max(0, 4 - totalAbordados), reservados);
    const totalLibres = Math.max(0, 4 - (totalAbordados + totalReservados));

    return {
      totalAbordados,
      totalReservados,
      totalLibres,
    };
  }, [reservasPendientes, asientosOcupados]);

  const asientosLibres = conteoAsientos.totalLibres;

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A', color: '#FFFFFF', padding: '8px 10px', maxWidth: '800px', margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
      
      {/* ── Encabezado Principal ── */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '12px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        marginBottom: '14px',
        flexWrap: 'wrap',
        gap: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '180px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: '#FACC15',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(250, 204, 21, 0.3)',
            flexShrink: 0,
          }}>
            <IconoColectivo size={22} color="#000000" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '17px', fontWeight: '800', letterSpacing: '-0.3px' }}>
              Fim <span style={{ color: '#FACC15' }}>Colectivo Chofer</span>
            </h1>
            <p style={{ margin: 0, fontSize: '11px', color: '#A3A3A3' }}>
              {choferSesion ? choferSesion.name : 'Conductor'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              desbloquearAudioYVoz('Audio y voz activados para el servicio de colectivos', () => {
                setAudioDesbloqueado(true);
                setMensajeExito('Altavoz y síntesis de voz verificados correctamente.');
              });
            }}
            style={{
              background: audioDesbloqueado ? 'rgba(250, 204, 21, 0.15)' : '#171717',
              color: audioDesbloqueado ? '#FACC15' : '#D4D4D4',
              border: audioDesbloqueado ? '1px solid #FACC15' : '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '11.5px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
            title="Toca para probar y asegurar que tu dispositivo reproduce la voz del pasajero"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
            <span>{audioDesbloqueado ? 'Audio Activo' : 'Probar Audio'}</span>
          </button>
          <button
            onClick={cerrarSesionChofer}
            style={{
              background: '#171717',
              color: '#D4D4D4',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '11.5px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Salir
          </button>
        </div>
      </header>

      {/* ── Alertas ── */}
      {mensajeExito && (
        <div style={{ background: 'rgba(250, 204, 21, 0.15)', border: '1px solid #FACC15', padding: '10px 14px', borderRadius: '10px', color: '#FACC15', marginBottom: '14px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconoCheck size={16} color="#FACC15" />
            <span>{mensajeExito}</span>
          </div>
          <button onClick={() => setMensajeExito('')} style={{ background: 'transparent', border: 'none', color: '#FACC15', cursor: 'pointer' }}><IconoCruz size={14} color="#FACC15" /></button>
        </div>
      )}
      {mensajeError && (
        <div style={{ background: '#171717', border: '1px solid rgba(255, 255, 255, 0.3)', padding: '10px 14px', borderRadius: '10px', color: '#FFFFFF', marginBottom: '14px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconoCruz size={16} color="#FFFFFF" />
            <span>{mensajeError}</span>
          </div>
          <button onClick={() => setMensajeError('')} style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer' }}><IconoCruz size={14} color="#FFFFFF" /></button>
        </div>
      )}

      {/* ── SECCIÓN 1: MAPA EN VIVO DEL CONDUCTOR ── */}
      <section style={{
        position: 'relative',
        borderRadius: '16px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        marginBottom: '10px',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
        background: '#121212',
      }}>
        {/* Badges superiores sobre el mapa */}
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          zIndex: 10,
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}>

          <div style={{
            background: enServicio ? '#FACC15' : '#262626',
            backdropFilter: 'blur(8px)',
            borderRadius: '20px',
            padding: '5px 10px',
            fontSize: '11px',
            fontWeight: '800',
            color: enServicio ? '#000000' : '#A3A3A3',
            boxShadow: enServicio ? '0 0 10px rgba(250, 204, 21, 0.5)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <IconoPuntoEstado activo={enServicio} size={8} />
            <span>{enServicio ? 'EN SERVICIO' : 'FUERA DE SERVICIO'}</span>
          </div>

          <div style={{
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            borderRadius: '20px',
            padding: '5px 10px',
            fontSize: '11px',
            fontWeight: '700',
            color: asientosLibres === 0 ? '#A3A3A3' : '#FACC15',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <IconoAsiento size={13} color={asientosLibres === 0 ? '#A3A3A3' : '#FACC15'} />
            <span>{asientosLibres === 0 ? 'Lleno' : `${asientosLibres} libre${asientosLibres > 1 ? 's' : ''}`}</span>
          </div>
        </div>

        {/* Botón flotante para centrar mapa en el colectivo */}
        <button
          onClick={() => setDisparadorCentrado((prev) => prev + 1)}
          style={{
            position: 'absolute',
            bottom: '16px',
            right: '16px',
            zIndex: 10,
            background: '#FACC15',
            color: '#000000',
            border: 'none',
            borderRadius: '50px',
            padding: '10px 16px',
            fontSize: '13px',
            fontWeight: '800',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(250, 204, 21, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'transform 0.15s',
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.94)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <IconoGps size={16} color="#000000" />
          <span>Centrar mi auto</span>
        </button>

        {/* Componente Leaflet del Mapa */}
        <div style={{ height: '300px', width: '100%' }}>
          <ColectivoMap
            ubicacionUsuario={ubicacionChofer}
            lineaSeleccionada={lineaActual}
            conductoresEnVivo={conductoresEnVivo}
            esModoConductor={true}
            miConductorId={choferSesion?.id}
            miPatente={choferSesion?.vehiculo?.patente || choferSesion?.patente || ''}
            pasajerosEnEspera={pasajerosEnEspera}
            disparadorCentrado={disparadorCentrado}
            altura="300px"
          />
        </div>
      </section>

      {/* ── PASAJEROS EN RUTA Y AVISOS ── */}
      <section style={{
        background: '#121212',
        borderRadius: '16px',
        padding: '12px 14px',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        marginBottom: '10px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: reservasPendientes.length === 0 ? '8px' : '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconoPasajero size={18} color="#FACC15" />
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#FFFFFF' }}>
              Pasajeros en Ruta (Acción Rápida de Abordaje)
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {reservasPendientes.some((r) => r.estado === 'reservado') && (
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                color: '#FACC15',
                background: 'rgba(250, 204, 21, 0.15)',
                border: '1px solid rgba(250, 204, 21, 0.35)',
                padding: '3px 8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}>
                <IconoMicrofono size={13} color="#FACC15" />
                <span>Di &quot;A bordo&quot; o pulsa el botón</span>
              </span>
            )}
            <span style={{
              fontSize: '11px',
              fontWeight: '800',
              padding: '2px 8px',
              borderRadius: '10px',
              background: reservasPendientes.length > 0 ? '#FACC15' : '#262626',
              color: reservasPendientes.length > 0 ? '#000000' : '#A3A3A3',
            }}>
              {reservasPendientes.length} en ruta
            </span>
          </div>
        </div>

        {reservasPendientes.some((r) => r.estado === 'reservado') && (
          <div
            style={{
              background: '#0D0D0D',
              border: '2px solid #FACC15',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              boxShadow: textoDetectadoAbordaje.includes('BORDO')
                ? '0 0 25px rgba(250, 204, 21, 0.7)'
                : '0 4px 18px rgba(250, 204, 21, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: anunciandoAbordajeVoz ? 'rgba(59, 130, 246, 0.2)' : 'rgba(250, 204, 21, 0.2)',
                  border: anunciandoAbordajeVoz ? '1.5px solid #3B82F6' : '1.5px solid #FACC15',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {anunciandoAbordajeVoz ? (
                  <IconoParlante size={18} color="#93C5FD" />
                ) : (
                  <IconoMicrofono size={18} color="#FACC15" />
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: anunciandoAbordajeVoz ? '#93C5FD' : '#FACC15', letterSpacing: '0.5px' }}>
                  {anunciandoAbordajeVoz ? 'ANUNCIANDO INSTRUCCIONES DE ABORDAJE...' : 'CONTROL POR VOZ ACTIVO — DI "A BORDO" AL SUBIR'}
                </div>
                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: '900',
                    color: anunciandoAbordajeVoz
                      ? '#E5E5E5'
                      : textoDetectadoAbordaje.includes('BORDO')
                      ? '#FACC15'
                      : textoDetectadoAbordaje
                      ? '#FFFFFF'
                      : '#A3A3A3',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textShadow: (textoDetectadoAbordaje && !anunciandoAbordajeVoz) ? '0 0 10px rgba(250, 204, 21, 0.4)' : 'none',
                  }}
                >
                  {anunciandoAbordajeVoz
                    ? '"Reserva aceptada. Di a bordo cuando suba el pasajero"'
                    : textoDetectadoAbordaje
                    ? `Escuchado: "${textoDetectadoAbordaje}"`
                    : 'Esperando tu voz ("A bordo", "Subió")...'}
                </div>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '16px',
                background: anunciandoAbordajeVoz ? 'rgba(59, 130, 246, 0.15)' : 'rgba(250, 204, 21, 0.15)',
                border: anunciandoAbordajeVoz ? '1px solid #3B82F6' : '1px solid #FACC15',
                fontSize: '11px',
                fontWeight: '800',
                color: anunciandoAbordajeVoz ? '#93C5FD' : '#FACC15',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: anunciandoAbordajeVoz ? '#3B82F6' : '#FACC15',
                  boxShadow: anunciandoAbordajeVoz ? '0 0 8px #3B82F6' : '0 0 8px #FACC15',
                  animation: 'fimPulse 1s infinite ease-out',
                }}
              />
              <span>{anunciandoAbordajeVoz ? 'ANUNCIANDO' : 'EN VIVO'}</span>
            </div>
          </div>
        )}

        {reservasPendientes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '10px 12px', color: '#737373', background: '#171717', borderRadius: '10px', fontSize: '11.5px', fontWeight: '600' }}>
            Sin pasajeros esperando en ruta en este momento.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {reservasPendientes.map((reserva) => {
              // Calcular tiempo estimado de llegada para el conductor a buscar al pasajero
              const infoLlegada = (() => {
                if (reserva.estado !== 'reservado') return null;
                let lat = reserva.latitudSubida;
                let lng = reserva.longitudSubida;
                if ((!lat || !lng) && lineaActual?.paradas) {
                  const parada = lineaActual.paradas.find(
                    (p) => p.nombre.toLowerCase() === reserva.direccionSubida?.toLowerCase()
                  );
                  if (parada) {
                    lat = parada.latitud;
                    lng = parada.longitud;
                  }
                }
                if (!lat || !lng || !ubicacionChofer?.latitud || !ubicacionChofer?.longitud) return null;
                return calcularInfoLlegada(ubicacionChofer.latitud, ubicacionChofer.longitud, lat, lng);
              })();

              return (
                <div
                  key={reserva.id}
                style={{
                  background: '#171717',
                  padding: '14px',
                  borderRadius: '12px',
                  border: reserva.estado === 'reservado'
                    ? '2px solid #FACC15'
                    : '1px solid rgba(255, 255, 255, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  boxShadow: reserva.estado === 'reservado' ? '0 4px 14px rgba(250, 204, 21, 0.25)' : '0 4px 12px rgba(0, 0, 0, 0.3)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#FFFFFF' }}>
                      {reserva.pasajero.name}
                    </h4>
                    <span style={{
                      fontSize: '12px',
                      color: reserva.estado === 'reservado' ? '#FACC15' : '#FFFFFF',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      marginTop: '2px',
                    }}>
                      <IconoAsiento size={14} color={reserva.estado === 'reservado' ? '#FACC15' : '#FFFFFF'} />
                      <span>
                        {reserva.cantidadAsientos} asiento{reserva.cantidadAsientos > 1 ? 's' : ''} {reserva.estado === 'reservado' ? 'reservado (esperando subir)' : 'a bordo (asiento ocupado)'}
                      </span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '800',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      background: reserva.estado === 'reservado' ? 'rgba(250, 204, 21, 0.15)' : '#262626',
                      color: reserva.estado === 'reservado' ? '#FACC15' : '#FFFFFF',
                      border: '1px solid currentColor',
                    }}>
                      {reserva.estado === 'reservado' ? 'RESERVADO (POR SUBIR)' : 'A BORDO'}
                    </span>
                  </div>
                </div>

                {/* Badge cuantitativo de tiempo estimado de llegada para el conductor */}
                {infoLlegada && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                      background: 'rgba(250, 204, 21, 0.12)',
                      border: '1.5px solid #FACC15',
                      borderRadius: '10px',
                      padding: '8px 12px',
                      boxShadow: '0 2px 10px rgba(250, 204, 21, 0.2)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: '#FACC15',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <IconoReloj size={18} color="#000000" />
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: '#FACC15' }}>
                          Llegas a buscarlo en ~{infoLlegada.minutos} min
                        </div>
                        <div style={{ fontSize: '11px', color: '#D4D4D4' }}>
                          Distancia: {infoLlegada.textoDistancia}
                        </div>
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: '800',
                        color: '#000000',
                        background: '#FACC15',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.3px',
                      }}
                    >
                      En camino
                    </span>
                  </div>
                )}

                {reserva.direccionSubida && (
                  <div style={{ fontSize: '12px', color: '#D4D4D4', display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.05)', padding: '6px 10px', borderRadius: '8px' }}>
                    <IconoUbicacion size={14} color="#FACC15" />
                    <span>Punto de recogida: <b>{reserva.direccionSubida}</b></span>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginTop: '2px' }}>
                  <a
                    href={`tel:${reserva.pasajero.phone}`}
                    style={{
                      fontSize: '12px',
                      color: '#FACC15',
                      textDecoration: 'none',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <IconoTelefono size={13} color="#FACC15" />
                    <span>Llamar ({reserva.pasajero.phone})</span>
                  </a>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {['abordado', 'pagando', 'pagado', 'parada_solicitada'].includes(reserva.estado) ? (
                      <button onClick={() => liberarAsientoParada(reserva.id)} disabled={cargandoAccion === reserva.id}
                        style={{ padding: '10px 16px', borderRadius: '10px', background: '#16A34A', color: '#FFF', border: 'none', fontWeight: 800 }}>
                        {cargandoAccion === reserva.id ? 'Liberando...' : 'Liberar asiento'}
                      </button>
                    ) : reserva.estado === 'pendiente_chofer' ? (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => responderSolicitudDirigida(reserva.id, 'aceptar')}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '8px',
                            background: '#FACC15',
                            color: '#000000',
                            border: 'none',
                            fontWeight: '800',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <IconoCheck size={13} color="#000000" />
                          <span>Aceptar</span>
                        </button>
                        <button
                          onClick={() => responderSolicitudDirigida(reserva.id, 'rechazar')}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '8px',
                            background: '#262626',
                            color: '#A3A3A3',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            fontWeight: '700',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          Paso
                        </button>
                      </div>
                    ) : (
                      /* BOTÓN DESTACADO "SUBIR A BORDO" */
                      <button
                        onClick={() => confirmarAbordaje(reserva.id)}
                        disabled={cargandoAccion === reserva.id}
                        style={{
                          padding: '11px 18px',
                          borderRadius: '10px',
                          background: '#FACC15',
                          color: '#000000',
                          border: 'none',
                          fontWeight: '900',
                          fontSize: '13px',
                          cursor: 'pointer',
                          boxShadow: '0 4px 14px rgba(250, 204, 21, 0.45)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <IconoCheck size={16} color="#000000" />
                        <span>{cargandoAccion === reserva.id ? 'Marcando...' : 'SUBIR A BORDO'}</span>
                      </button>
                    )}
                    {['pendiente_chofer', 'reservado'].includes(reserva.estado) && <button
                      onClick={() => cancelarReservaPasajero(reserva.id)}
                      style={{
                        padding: '9px 12px',
                        borderRadius: '8px',
                        background: 'transparent',
                        color: '#A3A3A3',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        fontWeight: '700',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <IconoCruz size={12} color="#A3A3A3" />
                      <span>Cancelar</span>
                    </button>}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── SECCIÓN 3: BOTÓN DE TURNO (PONER EN LÍNEA / DESCONECTARME) ── */}
      <div style={{ marginBottom: '10px' }}>
        <button
          onClick={alternarServicio}
          style={{
            width: '100%',
            padding: '14px 18px',
            borderRadius: '12px',
            border: enServicio ? 'none' : '1.5px solid rgba(250, 204, 21, 0.4)',
            background: enServicio ? '#FACC15' : '#1A1A1A',
            fontWeight: '900',
            fontSize: '15px',
            cursor: 'pointer',
            color: enServicio ? '#000000' : '#FACC15',
            boxShadow: enServicio
              ? '0 4px 18px rgba(250, 204, 21, 0.4)'
              : '0 2px 8px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            letterSpacing: '0.6px',
            transition: 'all 0.2s',
            textTransform: 'uppercase',
          }}
        >
          <IconoPuntoEstado activo={enServicio} size={12} />
          <span>{enServicio ? 'DESCONECTARME' : 'PONER EN LÍNEA'}</span>
        </button>
      </div>

      {/* ── SECCIÓN 4: CONTROL RÁPIDO DE ASIENTOS (BARRA SIMPLE: ASIENTOS : + O -) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#121212',
          border: '1.5px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '14px',
          padding: '10px 16px',
          marginBottom: '10px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <IconoAsiento size={20} color="#FACC15" />
          <span style={{ fontSize: '13px', fontWeight: '900', color: '#FACC15', letterSpacing: '0.5px' }}>
            ASIENTOS:
          </span>
          <span style={{ fontSize: '17px', fontWeight: '900', color: '#FFFFFF', letterSpacing: '0.5px' }}>
            {asientosOcupados}/4
          </span>
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#A3A3A3' }}>
            ({4 - asientosOcupados} {4 - asientosOcupados === 1 ? 'libre' : 'libres'})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => modificarAsientos(-1)}
            disabled={asientosOcupados <= 0}
            title="Restar pasajero"
            aria-label="Disminuir asientos"
            style={{
              width: '46px',
              height: '44px',
              borderRadius: '10px',
              background: '#262626',
              color: '#FFFFFF',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              fontSize: '24px',
              fontWeight: '900',
              cursor: asientosOcupados <= 0 ? 'not-allowed' : 'pointer',
              opacity: asientosOcupados <= 0 ? 0.3 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.1s, background 0.15s',
              userSelect: 'none',
            }}
            onMouseDown={(e) => {
              if (asientosOcupados > 0) e.currentTarget.style.transform = 'scale(0.92)';
            }}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            −
          </button>

          <button
            onClick={() => modificarAsientos(1)}
            disabled={asientosOcupados >= 4}
            title="Sumar pasajero"
            aria-label="Aumentar asientos"
            style={{
              width: '46px',
              height: '44px',
              borderRadius: '10px',
              background: '#FACC15',
              color: '#000000',
              border: 'none',
              fontSize: '24px',
              fontWeight: '900',
              cursor: asientosOcupados >= 4 ? 'not-allowed' : 'pointer',
              opacity: asientosOcupados >= 4 ? 0.3 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: asientosOcupados >= 4 ? 'none' : '0 2px 10px rgba(250, 204, 21, 0.4)',
              transition: 'transform 0.1s, background 0.15s',
              userSelect: 'none',
            }}
            onMouseDown={(e) => {
              if (asientosOcupados < 4) e.currentTarget.style.transform = 'scale(0.92)';
            }}
            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            +
          </button>
        </div>
      </div>

      {/* ── MODAL MANOS LIBRES: ALERTA DE VOZ Y BOTONES GIGANTES (LEY NO CHAT 21.377) ── */}
      {solicitudActiva && (
        <AlertaVozReserva
          key={solicitudActiva.reservaId}
          solicitud={solicitudActiva}
          alAceptar={(id) => responderSolicitudDirigida(id, 'aceptar')}
          alRechazar={(id) => responderSolicitudDirigida(id, 'rechazar')}
          alExpirar={(id) => responderSolicitudDirigida(id, 'rechazar')}
        />
      )}

      {/* ── MODAL: PASAJERO SOLICITA PARADA ── */}
      {paradaSolicitada && !solicitudActiva && !avisoPendiente && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(0, 0, 0, 0.88)',
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
              background: '#0D0D0D',
              border: '2px solid #FACC15',
              borderRadius: '24px',
              padding: '28px 24px',
              boxShadow: '0 20px 60px rgba(250, 204, 21, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              textAlign: 'center',
            }}
          >
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
                }}
              >
                <IconoCampana size={38} color="#FACC15" />
              </div>
            </div>

            <div>
              <span style={{ fontSize: '11px', fontWeight: '800', color: '#FACC15', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                SOLICITUD DE PARADA ({paradaSolicitada.hora})
              </span>
              <h2 style={{ margin: '8px 0 0 0', fontSize: '22px', fontWeight: '900', color: '#FFFFFF', lineHeight: '1.3' }}>
                {paradaSolicitada.pasajeroNombre.toLowerCase() !== 'pasajero'
                  ? `Favor dejar a ${paradaSolicitada.pasajeroNombre} en la siguiente parada`
                  : 'Favor dejar al pasajero en la siguiente parada'}
              </h2>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#A3A3A3' }}>
                El pasajero ha solicitado descender del colectivo en la próxima parada.
              </p>
            </div>

            <button
              onClick={() => liberarAsientoParada(paradaSolicitada.reservaId)}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '14px',
                background: '#FACC15',
                border: 'none',
                color: '#000000',
                fontSize: '16px',
                fontWeight: '900',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: '0 6px 20px rgba(250, 204, 21, 0.4)',
              }}
            >
              <IconoCheck size={20} color="#000000" />
              <span>PASAJERO DESCENDIÓ</span>
            </button>
          </div>
        </div>
      )}

      {avisoPendiente && !solicitudActiva && (
        <AlertaMetodoPago key={avisoPendiente.reservaId + ':' + avisoPendiente.metodoPago}
          nombre={avisoPendiente.pasajeroNombre} metodo={avisoPendiente.metodoPago}
          onAceptar={() => aceptarMetodo(avisoPendiente.reservaId)} />
      )}
      {elegirAbordaje && (
        <div role="dialog" aria-label="Seleccionar pasajero que sube" style={{ position: 'fixed', inset: 0, zIndex: 99997, background: '#121212', padding: 24 }}>
          <h2>¿Qué pasajero acaba de subir?</h2>
          {reservasPendientes.filter(r => r.estado === 'reservado').map(r => <button key={r.id}
            onClick={() => { setPasajeroAbordajeId(r.id); setElegirAbordaje(false); hablarTexto(r.pasajero.name + '. Di A bordo para confirmar.'); }}
            style={{ width: '100%', padding: 24, marginBottom: 12, background: '#FACC15', border: 0, borderRadius: 12, color: '#000', fontWeight: 800 }}>
            {r.pasajero.name}
          </button>)}
          <button onClick={() => setElegirAbordaje(false)}>Volver</button>
        </div>
      )}
    </div>
  );
}
