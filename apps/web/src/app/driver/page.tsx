'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import api, { clearSession, getSession } from '@/lib/api';
import { connectSocket } from '@/lib/socket';
import { Linea, ConductorColectivo, PasajeroEnEspera } from '@/components/map/ColectivoMap';
import { calcularInfoLlegada } from '@/lib/geo';
import {
  IconoColectivo,
  IconoAsiento,
  IconoPasajero,
  IconoGps,
  IconoSentido,
  IconoTarjeta,
  IconoTelefono,
  IconoCheck,
  IconoCruz,
  IconoMas,
  IconoMenos,
  IconoPuntoEstado,
  IconoUbicacion,
  IconoParada,
  IconoSalir,
  IconoGuardar,
  IconoReloj,
  IconoMicrofono,
} from '@/components/icons/Iconos';

// Cargar mapa dinámico sin SSR para Leaflet
const ColectivoMap = dynamic(() => import('@/components/map/ColectivoMap'), { ssr: false });
import AlertaVozReserva, { DatosSolicitudDirigida } from '@/components/driver/AlertaVozReserva';
import { reproducirSonido, hablarTexto, desbloquearAudioYVoz, iniciarEscuchaVoz, detenerVoz, bloquearAbordoTemporal } from '@/lib/voice';

interface SolicitudPagoActiva {
  reservaId: string;
  pasajeroNombre: string;
  cantidadAsientos: number;
  metodoPago: string;
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

  // Configuración de cobros
  const [telefonoRutPay, setTelefonoRutPay] = useState<string>('');
  const [linkMercadoPago, setLinkMercadoPago] = useState<string>('');
  const [guardandoCobro, setGuardandoCobro] = useState<boolean>(false);
  const [mostrarConfigCobro, setMostrarConfigCobro] = useState<boolean>(false);

  // Solicitud dirigida en tránsito (Manos libres TTS y botones gigantes)
  const [solicitudActiva, setSolicitudActiva] = useState<DatosSolicitudDirigida | null>(null);

  // Solicitud de pago y descenso del pasajero
  const [pagoPendiente, setPagoPendiente] = useState<SolicitudPagoActiva | null>(null);
  const [audioDesbloqueado, setAudioDesbloqueado] = useState<boolean>(false);
  const [cargandoAccion, setCargandoAccion] = useState<string | null>(null);

  // Estados de retroalimentación de voz en tiempo real
  const [textoDetectadoPago, setTextoDetectadoPago] = useState<string>('');
  const [textoDetectadoAbordaje, setTextoDetectadoAbordaje] = useState<string>('');

  // Mensajes de alerta y feedback
  const [mensajeExito, setMensajeExito] = useState<string>('');
  const [mensajeError, setMensajeError] = useState<string>('');

  // Referencia a rastreo GPS y deduplicación de eventos
  const watchIdRef = useRef<number | null>(null);
  const ubicacionChoferRef = useRef(ubicacionChofer);
  const ultimaSolicitudNotificadaRef = useRef<{ id: string; timestamp: number } | null>(null);
  const escuchaPagoRef = useRef<{ detener: () => void } | null>(null);
  const escuchaAbordajeRef = useRef<{ detener: () => void } | null>(null);

  useEffect(() => {
    ubicacionChoferRef.current = ubicacionChofer;
  }, [ubicacionChofer]);

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
        setTelefonoRutPay(datos.telefonoRutPay || '');
        setLinkMercadoPago(datos.mercadoPagoLink || '');

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
      setPagoPendiente((prev) => (prev?.reservaId === datos.reservaId ? null : prev));
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
      setSolicitudActiva(datos);
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

    // Evento: Pasajero solicita pagar y descender
    const manejarPasajeroQuierePagar = (datos: SolicitudPagoActiva & { conductorId?: string }) => {
      if (datos.conductorId && choferSesion?.id && datos.conductorId !== choferSesion.id) {
        return;
      }
      setPagoPendiente(datos);
      setTextoDetectadoPago('');
      reproducirSonido('alerta');

      if (escuchaPagoRef.current) {
        try {
          escuchaPagoRef.current.detener();
        } catch {}
        escuchaPagoRef.current = null;
      }

      // Iniciar reconocimiento de voz de inmediato (segundo 0) para no perder la respuesta del conductor
      escuchaPagoRef.current = iniciarEscuchaVoz({
        id: 'escucha-pago-conductor',
        onSi: () => {
          setTextoDetectadoPago('¡SÍ DETECTADO!');
          confirmarPagoPasajero(datos.reservaId);
        },
        onNo: () => {
          setTextoDetectadoPago('¡NO DETECTADO!');
          rechazarPagoPasajero();
        },
        onTextoDetectado: (txt) => {
          setTextoDetectadoPago(txt);
        },
      });

      // Frase clara sin incluir las palabras disparadoras "sí" o "no" para evitar auto-disparo del parlante
      const mensajeVoz = 'Cliente solicita pagar. ¿Liberamos asiento?';

      // Esperar a que concluya el chime de alerta (350ms) antes de emitir la voz
      setTimeout(() => {
        hablarTexto(mensajeVoz);
      }, 350);
    };

    // Evento: Pago confirmado
    const manejarPagoConfirmadoChofer = (datos: { reservaId: string; asientosOcupados: number }) => {
      setReservasPendientes((prev) => prev.filter((r) => r.id !== datos.reservaId));
      setPagoPendiente((prev) => (prev?.reservaId === datos.reservaId ? null : prev));
      setAsientosOcupados(datos.asientosOcupados);
      setChoferSesion((prev: any) =>
        prev ? { ...prev, asientosOcupados: datos.asientosOcupados } : null
      );
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
    socket.on('colectivo:pasajero-quiere-pagar', manejarPasajeroQuierePagar);
    socket.on('colectivo:pago-confirmado-chofer', manejarPagoConfirmadoChofer);
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
      socket.off('colectivo:pasajero-quiere-pagar', manejarPasajeroQuierePagar);
      socket.off('colectivo:pago-confirmado-chofer', manejarPagoConfirmadoChofer);
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
    setAsientosOcupados(nuevoTotal);
    try {
      await api.post('/colectivos/conductor/asientos', { asientosOcupados: nuevoTotal });
    } catch (error) {
      console.error('Error al actualizar asientos:', error);
      setMensajeError('No se pudo actualizar la cantidad de asientos.');
    }
  };

  const alternarAsientoDirecto = async (numeroAsiento: number) => {
    const estaOcupado = numeroAsiento <= asientosOcupados;
    if (estaOcupado) {
      modificarAsientos(-1);
    } else {
      modificarAsientos(1);
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
    const pasajeroNombre = (solicitudActiva?.nombrePasajero || solicitudActiva?.pasajeroNombre || 'el pasajero').split(' ')[0];
    try {
      setSolicitudActiva(null);
      const res = await api.post(`/colectivos/reservas/${reservaId}/responder`, { accion });
      if (accion === 'aceptar') {
        const nombreConfirmado = (res.data?.reserva?.pasajero?.name || pasajeroNombre).split(' ')[0];
        setMensajeExito(`Reserva aceptada: ${nombreConfirmado} confirmado.`);
        reproducirSonido('exito');

        // Locución guiada solicitada: Di "A bordo" cuando [Nombre] suba al auto
        const locucionConfirmada = `Reserva aceptada. Di a bordo cuando ${nombreConfirmado} suba al auto.`;
        setTimeout(() => {
          bloquearAbordoTemporal(4000);
          hablarTexto(locucionConfirmada);
        }, 350);

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
              copia[index] = { ...copia[index], ...reservaConfirmada, estado: 'reservado' };
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
    }
  };

  // Marcar pasajero como abordado
  const confirmarAbordaje = async (reservaId: string) => {
    try {
      setCargandoAccion(reservaId);
      const res = await api.post(`/colectivos/reservas/${reservaId}/abordar`);
      setReservasPendientes((prev) =>
        prev.map((r) => (r.id === reservaId ? { ...r, estado: 'abordado' } : r))
      );
      if (res.data?.chofer?.asientosOcupados !== undefined) {
        setAsientosOcupados(res.data.chofer.asientosOcupados);
      }
      setMensajeExito('Pasajero a bordo. Asiento registrado en rojo.');
      reproducirSonido('exito');
      setTimeout(() => {
        bloquearAbordoTemporal(3000);
        hablarTexto('Pasajero a bordo');
      }, 350);
    } catch (error) {
      console.error('Error al confirmar abordaje:', error);
      setMensajeError('No se pudo registrar el abordaje.');
    } finally {
      setCargandoAccion(null);
    }
  };

  // Escuchar comando de voz "A bordo" cuando hay pasajeros con reserva aceptada esperando subir
  useEffect(() => {
    const hayReservados = reservasPendientes.some((r) => r.estado === 'reservado');
    if (hayReservados && !solicitudActiva && !pagoPendiente) {
      const primerReservado = reservasPendientes.find((r) => r.estado === 'reservado');
      if (primerReservado) {
        escuchaAbordajeRef.current = iniciarEscuchaVoz({
          id: 'escucha-abordaje-conductor',
          onAbordo: () => {
            setTextoDetectadoAbordaje('¡A BORDO DETECTADO!');
            confirmarAbordaje(primerReservado.id);
          },
          onTextoDetectado: (txt) => {
            setTextoDetectadoAbordaje(txt);
          },
        });
      }
    } else {
      setTextoDetectadoAbordaje('');
      if (escuchaAbordajeRef.current) {
        try {
          escuchaAbordajeRef.current.detener();
        } catch {}
        escuchaAbordajeRef.current = null;
      }
    }

    return () => {
      setTextoDetectadoAbordaje('');
      if (escuchaAbordajeRef.current) {
        try {
          escuchaAbordajeRef.current.detener();
        } catch {}
        escuchaAbordajeRef.current = null;
      }
    };
  }, [reservasPendientes, solicitudActiva, pagoPendiente]);

  // Rechazar o cancelar solicitud de pago del pasajero
  const rechazarPagoPasajero = () => {
    detenerVoz();
    if (escuchaPagoRef.current) {
      try {
        escuchaPagoRef.current.detener();
      } catch {}
      escuchaPagoRef.current = null;
    }
    setPagoPendiente(null);
    reproducirSonido('rechazo');
  };

  // Confirmar pago del pasajero y liberar asiento
  const confirmarPagoPasajero = async (reservaId: string) => {
    try {
      if (escuchaPagoRef.current) {
        try {
          escuchaPagoRef.current.detener();
        } catch {}
        escuchaPagoRef.current = null;
      }
      setCargandoAccion(reservaId);
      const res = await api.post(`/colectivos/reservas/${reservaId}/confirmar-pago`);
      setPagoPendiente((prev) => (prev?.reservaId === reservaId ? null : prev));
      setMensajeExito(res.data.mensaje || 'Pago confirmado y asiento liberado.');
      reproducirSonido('exito');
      setTimeout(() => {
        hablarTexto('Pago confirmado. Asiento liberado.');
      }, 350);

      // Actualizar estado local de reservas y chofer
      setReservasPendientes((prev) => prev.filter((r) => r.id !== reservaId));
      if (res.data.asientosOcupados !== undefined) {
        setAsientosOcupados(res.data.asientosOcupados);
        setChoferSesion((prev: any) =>
          prev ? { ...prev, asientosOcupados: res.data.asientosOcupados } : null
        );
      }
    } catch (error) {
      console.error('Error al confirmar pago:', error);
      setMensajeError('No se pudo confirmar el pago.');
      reproducirSonido('rechazo');
    } finally {
      setCargandoAccion(null);
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
      setMensajeExito('Métodos de cobro actualizados correctamente.');
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
    router.push('/login?role=driver');
  };

  // Pasajeros en espera formateados para marcadores en el mapa con cálculo de ETA cuantitativo
  const pasajerosEnEspera: PasajeroEnEspera[] = useMemo(() => {
    return reservasPendientes
      .filter((r) => r.estado === 'reservado')
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
          metodoPago: r.metodoPago,
          minutosLlegada,
          distanciaTexto,
        };
      })
      .filter(Boolean) as PasajeroEnEspera[];
  }, [reservasPendientes, lineaActual, ubicacionChofer]);

  // ─── Desglose de Asientos por Estado (Libre: Verde, Reservado: Naranjo, A Bordo: Rojo) ───
  const conteoAsientos = useMemo(() => {
    // 1. Asientos de pasajeros ya a bordo o pagando
    const abordados = reservasPendientes
      .filter((r) => r.estado === 'abordado' || r.estado === 'pagando')
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

  const obtenerEstadoAsiento = (numeroAsiento: number) => {
    if (numeroAsiento <= conteoAsientos.totalAbordados) {
      return {
        estado: 'abordado' as const,
        color: '#000000',
        bgColor: '#FACC15',
        borderColor: '#FACC15',
        boxShadow: '0 2px 10px rgba(250, 204, 21, 0.4)',
        texto: 'A Bordo',
        subtexto: 'Ocupado',
        textColor: '#000000',
        icono: <IconoPasajero size={22} color="#000000" />,
      };
    }
    if (numeroAsiento <= conteoAsientos.totalAbordados + conteoAsientos.totalReservados) {
      return {
        estado: 'reservado' as const,
        color: '#FACC15',
        bgColor: 'rgba(250, 204, 21, 0.15)',
        borderColor: '#FACC15',
        boxShadow: '0 2px 10px rgba(250, 204, 21, 0.25)',
        texto: 'Reservado',
        subtexto: 'Por subir',
        textColor: '#FACC15',
        icono: <IconoAsiento size={22} color="#FACC15" />,
      };
    }
    return {
      estado: 'libre' as const,
      color: '#A3A3A3',
      bgColor: '#171717',
      borderColor: 'rgba(255, 255, 255, 0.15)',
      boxShadow: 'none',
      texto: 'Disponible',
      subtexto: 'Libre',
      textColor: '#D4D4D4',
      icono: <IconoAsiento size={22} color="#D4D4D4" />,
    };
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A', color: '#FFFFFF', padding: '12px 10px', maxWidth: '800px', margin: '0 auto', width: '100%', boxSizing: 'border-box', overflowX: 'hidden' }}>
      
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
              {choferSesion ? choferSesion.name : 'Conductor'} • {lineaActual ? lineaActual.nombre : 'Línea no asignada'}
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
            onClick={() => setMostrarConfigCobro(!mostrarConfigCobro)}
            style={{
              background: '#171717',
              color: '#FFFFFF',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '11.5px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <IconoTarjeta size={13} color="#FACC15" />
            <span>Pagos</span>
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
        marginBottom: '18px',
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
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '20px',
            padding: '5px 12px',
            fontSize: '12px',
            fontWeight: '700',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FACC15' }} />
            {lineaActual ? `${lineaActual.nombre} • ${sentidoRuta.toUpperCase()}` : 'Línea'}
          </div>

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
        <div style={{ height: '380px', width: '100%' }}>
          <ColectivoMap
            ubicacionUsuario={ubicacionChofer}
            lineaSeleccionada={lineaActual}
            conductoresEnVivo={conductoresEnVivo}
            esModoConductor={true}
            miConductorId={choferSesion?.id}
            miPatente={choferSesion?.vehiculo?.patente || choferSesion?.patente || 'MI AUTO'}
            pasajerosEnEspera={pasajerosEnEspera}
            disparadorCentrado={disparadorCentrado}
            altura="380px"
          />
        </div>
      </section>

      {/* ── SECCIÓN 2: PASAJEROS EN RUTA Y ACCIÓN RÁPIDA DE ABORDO / COBRO (INMEDIATAMENTE DEBAJO DEL MAPA) ── */}
      <section style={{
        background: '#121212',
        borderRadius: '16px',
        padding: '18px',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        marginBottom: '18px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconoPasajero size={20} color="#FACC15" />
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#FFFFFF' }}>
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
              padding: '3px 8px',
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
                  background: 'rgba(250, 204, 21, 0.2)',
                  border: '1.5px solid #FACC15',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <IconoMicrofono size={18} color="#FACC15" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '11px', fontWeight: '800', color: '#FACC15', letterSpacing: '0.5px' }}>
                  CONTROL POR VOZ ACTIVO — DI &quot;A BORDO&quot; AL SUBIR
                </div>
                <div
                  style={{
                    fontSize: '15px',
                    fontWeight: '900',
                    color: textoDetectadoAbordaje.includes('BORDO')
                      ? '#FACC15'
                      : textoDetectadoAbordaje
                      ? '#FFFFFF'
                      : '#A3A3A3',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textShadow: textoDetectadoAbordaje ? '0 0 10px rgba(250, 204, 21, 0.4)' : 'none',
                  }}
                >
                  {textoDetectadoAbordaje ? `Escuchado: "${textoDetectadoAbordaje}"` : 'Esperando tu voz ("A bordo", "Subió")...'}
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
                background: 'rgba(250, 204, 21, 0.15)',
                border: '1px solid #FACC15',
                fontSize: '11px',
                fontWeight: '800',
                color: '#FACC15',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#FACC15',
                  boxShadow: '0 0 8px #FACC15',
                  animation: 'fimPulse 1s infinite ease-out',
                }}
              />
              <span>EN VIVO</span>
            </div>
          </div>
        )}

        {reservasPendientes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 12px', color: '#A3A3A3', background: '#171717', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ marginBottom: '6px' }}>
              <IconoParada size={28} color="#737373" />
            </div>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#D4D4D4' }}>
              Sin pasajeros esperando en tu recorrido en este momento.
            </p>
            <p style={{ margin: '3px 0 0 0', fontSize: '11px', color: '#737373' }}>
              Al estar En Servicio, las solicitudes de pasajeros aparecerán aquí con botón gigante de Abordo.
            </p>
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
                    : reserva.estado === 'abordado'
                    ? '1px solid rgba(255, 255, 255, 0.25)'
                    : '1px solid #FACC15',
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
                      color: reserva.estado === 'reservado' ? '#FACC15' : reserva.estado === 'abordado' ? '#FFFFFF' : '#FACC15',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      marginTop: '2px',
                    }}>
                      <IconoAsiento size={14} color={reserva.estado === 'reservado' ? '#FACC15' : reserva.estado === 'abordado' ? '#FFFFFF' : '#FACC15'} />
                      <span>
                        {reserva.cantidadAsientos} asiento{reserva.cantidadAsientos > 1 ? 's' : ''} {reserva.estado === 'reservado' ? 'reservado (esperando subir)' : reserva.estado === 'abordado' ? 'a bordo (asiento ocupado)' : 'en proceso de pago'}
                      </span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '800',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      background: reserva.estado === 'reservado'
                        ? 'rgba(250, 204, 21, 0.15)'
                        : reserva.estado === 'abordado'
                        ? '#262626'
                        : 'rgba(250, 204, 21, 0.15)',
                      color: reserva.estado === 'reservado'
                        ? '#FACC15'
                        : reserva.estado === 'abordado'
                        ? '#FFFFFF'
                        : '#FACC15',
                      border: '1px solid currentColor',
                    }}>
                      {reserva.estado === 'reservado'
                        ? 'RESERVADO (POR SUBIR)'
                        : reserva.estado === 'abordado'
                        ? 'A BORDO'
                        : reserva.estado === 'pagando'
                        ? 'PAGANDO'
                        : 'PENDIENTE'}
                    </span>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      background: '#262626',
                      color: '#FACC15',
                      border: '1px solid rgba(250, 204, 21, 0.4)',
                      textTransform: 'uppercase',
                    }}>
                      {reserva.metodoPago}
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
                    {reserva.estado === 'pagando' ? (
                      <button
                        onClick={() => confirmarPagoPasajero(reserva.id)}
                        disabled={cargandoAccion === reserva.id}
                        style={{
                          padding: '10px 16px',
                          borderRadius: '10px',
                          background: '#FACC15',
                          color: '#000000',
                          border: 'none',
                          fontWeight: '800',
                          fontSize: '13px',
                          cursor: 'pointer',
                          boxShadow: '0 2px 10px rgba(250, 204, 21, 0.4)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <IconoTarjeta size={15} color="#000000" />
                        <span>{cargandoAccion === reserva.id ? 'Confirmando...' : 'Aceptar Pago'}</span>
                      </button>
                    ) : reserva.estado === 'abordado' ? (
                      <button
                        onClick={() => confirmarPagoPasajero(reserva.id)}
                        disabled={cargandoAccion === reserva.id}
                        style={{
                          padding: '10px 16px',
                          borderRadius: '10px',
                          background: '#FACC15',
                          color: '#000000',
                          border: 'none',
                          fontWeight: '800',
                          fontSize: '13px',
                          cursor: 'pointer',
                          boxShadow: '0 2px 10px rgba(250, 204, 21, 0.4)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <IconoCheck size={15} color="#000000" />
                        <span>{cargandoAccion === reserva.id ? 'Liberando...' : 'Cobrar y Liberar'}</span>
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
                    <button
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
                    </button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── SECCIÓN 3: BOTÓN DE TURNO (EN SERVICIO) ── */}
      <div style={{ marginBottom: '18px' }}>
        <button
          onClick={alternarServicio}
          style={{
            width: '100%',
            padding: '16px 20px',
            borderRadius: '14px',
            border: 'none',
            background: enServicio
              ? '#FACC15'
              : '#262626',
            fontWeight: '900',
            fontSize: '14px',
            cursor: 'pointer',
            color: enServicio ? '#000000' : '#FFFFFF',
            boxShadow: enServicio
              ? '0 6px 22px rgba(250, 204, 21, 0.45)'
              : '0 4px 12px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            letterSpacing: '0.4px',
            transition: 'all 0.2s',
          }}
        >
          <IconoPuntoEstado activo={enServicio} size={14} />
          <span>{enServicio ? 'EN SERVICIO (TRANSMITIENDO GPS A PASAJEROS)' : 'FUERA DE SERVICIO (TOCA PARA INICIAR TURNO)'}</span>
        </button>
      </div>

      {/* ── SECCIÓN 4: CONTROL RÁPIDO DE LOS 4 ASIENTOS (NEGRO / AMARILLO) ── */}
      <section style={{
        background: '#121212',
        borderRadius: '16px',
        padding: '18px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        marginBottom: '18px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#FFFFFF' }}>
              Control de Asientos en Tiempo Real
            </h2>
            <p style={{ margin: 0, fontSize: '11px', color: '#A3A3A3' }}>
              Oscuro: Disponible • Borde Amarillo: Reservado • Amarillo Sólido: A Bordo
            </p>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: '800',
              padding: '4px 8px',
              borderRadius: '8px',
              background: '#262626',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#D4D4D4',
            }}>
              {conteoAsientos.totalLibres} Libres
            </span>
            {conteoAsientos.totalReservados > 0 && (
              <span style={{
                fontSize: '11px',
                fontWeight: '800',
                padding: '4px 8px',
                borderRadius: '8px',
                background: 'rgba(250, 204, 21, 0.15)',
                border: '1px solid #FACC15',
                color: '#FACC15',
              }}>
                {conteoAsientos.totalReservados} Reservados
              </span>
            )}
            {conteoAsientos.totalAbordados > 0 && (
              <span style={{
                fontSize: '11px',
                fontWeight: '800',
                padding: '4px 8px',
                borderRadius: '8px',
                background: '#FACC15',
                border: '1px solid #FACC15',
                color: '#000000',
              }}>
                {conteoAsientos.totalAbordados} A Bordo
              </span>
            )}
          </div>
        </div>

        {/* Visualizador de los 4 Asientos (Táctiles interactivos) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '6px', marginBottom: '14px' }}>
          {[1, 2, 3, 4].map((numeroAsiento) => {
            const estadoInfo = obtenerEstadoAsiento(numeroAsiento);
            return (
              <div
                key={numeroAsiento}
                onClick={() => alternarAsientoDirecto(numeroAsiento)}
                style={{
                  height: '74px',
                  borderRadius: '10px',
                  background: estadoInfo.bgColor,
                  border: `2px solid ${estadoInfo.borderColor}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'transform 0.12s, box-shadow 0.12s',
                  boxShadow: estadoInfo.boxShadow,
                  padding: '4px 2px',
                  minWidth: 0,
                  overflow: 'hidden',
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                title={`Asiento ${numeroAsiento}: ${estadoInfo.texto} (${estadoInfo.subtexto})`}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {estadoInfo.icono}
                </div>
                <span style={{ fontSize: '10.5px', fontWeight: '800', color: estadoInfo.textColor, whiteSpace: 'nowrap' }}>
                  Asiento {numeroAsiento}
                </span>
                <span style={{ fontSize: '8.5px', fontWeight: '700', color: estadoInfo.textColor, textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {estadoInfo.texto}
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
              background: '#171717',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#FFFFFF',
              fontSize: '15px',
              fontWeight: '800',
              cursor: asientosOcupados <= 0 ? 'not-allowed' : 'pointer',
              opacity: asientosOcupados <= 0 ? 0.35 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <span>-</span> Bajó Pasajero
          </button>
          <button
            onClick={() => modificarAsientos(1)}
            disabled={asientosOcupados >= 4}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: '12px',
              background: '#FACC15',
              border: 'none',
              color: '#000000',
              fontSize: '15px',
              fontWeight: '800',
              cursor: asientosOcupados >= 4 ? 'not-allowed' : 'pointer',
              opacity: asientosOcupados >= 4 ? 0.35 : 1,
              boxShadow: '0 4px 14px rgba(250, 204, 21, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
          >
            <span>+</span> Subió Pasajero
          </button>
        </div>
      </section>

      {/* ── SECCIÓN 5: CONTROL DE LÍNEA Y SENTIDO DE RUTA ── */}
      <section style={{
        background: '#121212',
        borderRadius: '16px',
        padding: '18px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        marginBottom: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#A3A3A3', marginBottom: '6px', fontWeight: '600' }}>
              Línea Asignada:
            </label>
            <select
              value={lineaActual?.id || ''}
              onChange={(e) => cambiarLineaColectivo(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '10px',
                background: '#171717',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: '700',
              }}
            >
              {lineasDisponibles.map((linea) => (
                <option key={linea.id} value={linea.id}>
                  {linea.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', color: '#A3A3A3', marginBottom: '6px', fontWeight: '600' }}>
              Sentido de Ruta:
            </label>
            <button
              onClick={alternarSentido}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                background: '#171717',
                color: '#FACC15',
                border: '1px solid #FACC15',
                fontSize: '13px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <IconoSentido size={16} color="#FACC15" />
              <span>Sentido {sentidoRuta === 'ida' ? 'IDA ->' : 'VUELTA ->'}</span>
            </button>
          </div>
        </div>

        {lineaActual && (
          <div style={{ background: '#171717', padding: '10px 14px', borderRadius: '10px', fontSize: '12px', color: '#A3A3A3', display: 'flex', justifyContent: 'space-between' }}>
            <span>Ruta activa: <b style={{ color: '#FFFFFF' }}>{lineaActual.nombre}</b></span>
            <span>Paradas en ruta: <b style={{ color: '#FFFFFF' }}>{lineaActual.paradas?.length || 0} paradas</b></span>
          </div>
        )}
      </section>

      {/* ── SECCIÓN 6: CONFIGURACIÓN DE COBROS (RUTPAY Y MERCADOPAGO) ── */}
      {mostrarConfigCobro && (
        <section style={{
          background: '#121212',
          borderRadius: '16px',
          padding: '18px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          marginBottom: '18px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IconoTarjeta size={16} color="#FACC15" />
              <span>Métodos de Cobro Electrónico</span>
            </h3>
            <button
              onClick={() => setMostrarConfigCobro(false)}
              style={{ background: 'transparent', border: 'none', color: '#A3A3A3', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <IconoCruz size={16} color="#A3A3A3" />
            </button>
          </div>
          <p style={{ fontSize: '12px', color: '#A3A3A3', margin: '0 0 14px 0' }}>
            Permite a los pasajeros transferirte vía RutPay BancoEstado o pagarte con MercadoPago directamente en el colectivo.
          </p>

          <form onSubmit={guardarDatosCobro} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#D4D4D4', marginBottom: '4px', fontWeight: '600' }}>
                Teléfono para RutPay BancoEstado:
              </label>
              <input
                type="text"
                placeholder="+56912345678"
                value={telefonoRutPay}
                onChange={(e) => setTelefonoRutPay(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: '#171717',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#FFFFFF',
                  fontSize: '13px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#D4D4D4', marginBottom: '4px', fontWeight: '600' }}>
                Link o Alias de MercadoPago:
              </label>
              <input
                type="text"
                placeholder="https://mpago.li/... o tu alias"
                value={linkMercadoPago}
                onChange={(e) => setLinkMercadoPago(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: '#171717',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#FFFFFF',
                  fontSize: '13px',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={guardandoCobro}
              style={{
                padding: '12px',
                borderRadius: '10px',
                background: '#FACC15',
                color: '#000000',
                border: 'none',
                fontWeight: '800',
                fontSize: '13px',
                cursor: guardandoCobro ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(250, 204, 21, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              <IconoGuardar size={16} color="#000000" />
              <span>{guardandoCobro ? 'Guardando...' : 'Guardar Datos de Cobro'}</span>
            </button>
          </form>
        </section>
      )}

      {/* ── MODAL MANOS LIBRES: ALERTA DE VOZ Y BOTONES GIGANTES (LEY NO CHAT 21.377) ── */}
      {solicitudActiva && (
        <AlertaVozReserva
          solicitud={solicitudActiva}
          alAceptar={(id) => responderSolicitudDirigida(id, 'aceptar')}
          alRechazar={(id) => responderSolicitudDirigida(id, 'rechazar')}
          alExpirar={() => setSolicitudActiva(null)}
        />
      )}

      {/* ── MODAL: PASAJERO QUIERE PAGAR Y BAJARSE ── */}
      {pagoPendiente && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99998,
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
              maxWidth: '480px',
              background: '#121212',
              border: '2px solid #FACC15',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 12px 40px rgba(250, 204, 21, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(250, 204, 21, 0.15)',
                  border: '2px solid #FACC15',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconoTarjeta size={36} color="#FACC15" />
              </div>
            </div>

            <div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: '800',
                  color: '#FACC15',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                }}
              >
                SOLICITUD DE PAGO Y DESCENSO
              </span>
              <h2
                style={{
                  margin: '6px 0 0 0',
                  fontSize: '24px',
                  fontWeight: '900',
                  color: '#FFFFFF',
                }}
              >
                Pasajero {pagoPendiente.pasajeroNombre}
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#A3A3A3' }}>
                Desea pagar y descender del vehículo
              </p>
            </div>

            <div
              style={{
                background: '#171717',
                borderRadius: '12px',
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div>
                <span style={{ fontSize: '11px', color: '#A3A3A3', display: 'block' }}>Medio de Pago</span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#FFFFFF', textTransform: 'uppercase' }}>
                  {pagoPendiente.metodoPago === 'rutpay'
                    ? 'RutPay BancoEstado'
                    : pagoPendiente.metodoPago === 'mercadopago'
                    ? 'MercadoPago'
                    : 'Efectivo'}
                </span>
              </div>
              <div style={{ width: '1px', height: '30px', background: 'rgba(255, 255, 255, 0.1)' }} />
              <div>
                <span style={{ fontSize: '11px', color: '#A3A3A3', display: 'block' }}>Asientos a Liberar</span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#FACC15' }}>
                  {pagoPendiente.cantidadAsientos} Asiento{pagoPendiente.cantidadAsientos > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* RETROALIMENTACIÓN DE VOZ EN TIEMPO REAL: SÍ / NO */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '12px 16px',
                background: '#171717',
                borderRadius: '14px',
                border: '2px solid #FACC15',
                boxShadow: textoDetectadoPago.includes('SÍ')
                  ? '0 0 25px rgba(250, 204, 21, 0.7)'
                  : textoDetectadoPago.includes('NO')
                  ? '0 0 25px rgba(239, 68, 68, 0.7)'
                  : '0 0 16px rgba(250, 204, 21, 0.2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: textoDetectadoPago.includes('SÍ')
                      ? '#22C55E'
                      : textoDetectadoPago.includes('NO')
                      ? '#EF4444'
                      : '#FACC15',
                    boxShadow: '0 0 10px currentColor',
                    animation: 'fimPulse 1s infinite ease-out',
                  }}
                />
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#FACC15', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                  {textoDetectadoPago ? 'VOZ DETECTADA' : 'MICRÓFONO EN VIVO — DI TU RESPUESTA:'}
                </span>
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: '900',
                  color: textoDetectadoPago.includes('SÍ')
                    ? '#FACC15'
                    : textoDetectadoPago.includes('NO')
                    ? '#EF4444'
                    : textoDetectadoPago
                    ? '#FFFFFF'
                    : '#A3A3A3',
                  textAlign: 'center',
                  textShadow: textoDetectadoPago ? '0 0 12px rgba(250, 204, 21, 0.5)' : 'none',
                }}
              >
                {textoDetectadoPago ? `"${textoDetectadoPago}"` : 'Di "SÍ" para liberar o "NO" para cancelar'}
              </div>
            </div>

            {/* BOTONES GIGANTES: SÍ / NO */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              <button
                onClick={() => confirmarPagoPasajero(pagoPendiente.reservaId)}
                disabled={cargandoAccion === pagoPendiente.reservaId}
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  borderRadius: '14px',
                  background: '#FACC15',
                  border: 'none',
                  color: '#000000',
                  fontSize: '17px',
                  fontWeight: '900',
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(250, 204, 21, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  textTransform: 'uppercase',
                }}
              >
                <IconoCheck size={24} color="#000000" />
                <span>
                  {cargandoAccion === pagoPendiente.reservaId
                    ? 'Liberando Asiento...'
                    : 'ACEPTAR PAGO Y LIBERAR'}
                </span>
              </button>

              <button
                onClick={rechazarPagoPasajero}
                disabled={cargandoAccion === pagoPendiente.reservaId}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  borderRadius: '14px',
                  background: '#1A1A1A',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#FFFFFF',
                  fontSize: '15px',
                  fontWeight: '800',
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <span>CANCELAR / MANTENER ASIENTO</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
