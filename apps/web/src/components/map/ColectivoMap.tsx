'use client';

import { useEffect, useRef, useState } from 'react';

export interface Parada {
  id: string;
  nombre: string;
  latitud: number;
  longitud: number;
  orden: number;
  sentido: string;
}

export interface Linea {
  id: string;
  nombre: string;
  codigo: string;
  descripcion?: string | null;
  color: string;
  tarifa: number;
  puntosRuta?: string | null;
  paradas?: Parada[];
}

export interface ConductorColectivo {
  conductorId: string;
  nombre: string;
  patente: string;
  latitud: number;
  longitud: number;
  asientosOcupados: number;
  asientosTotales: number;
  sentidoRuta: string;
  telefonoRutPay?: string | null;
  mercadoPagoLink?: string | null;
}

export interface PasajeroEnEspera {
  id: string;
  nombre: string;
  latitud: number;
  longitud: number;
  asientos: number;
  paradaNombre?: string;
  metodoPago?: string;
}

interface Props {
  ubicacionUsuario: { latitud: number; longitud: number; direccion?: string } | null;
  lineaSeleccionada: Linea | null;
  conductoresEnVivo: ConductorColectivo[];
  conductorSeleccionadoId?: string | null;
  alSeleccionarConductor?: (conductor: ConductorColectivo) => void;
  disparadorCentrado?: number;
  esModoConductor?: boolean;
  miConductorId?: string;
  pasajerosEnEspera?: PasajeroEnEspera[];
  altura?: string;
}

export default function ColectivoMap({
  ubicacionUsuario,
  lineaSeleccionada,
  conductoresEnVivo,
  conductorSeleccionadoId,
  alSeleccionarConductor,
  disparadorCentrado = 0,
  esModoConductor = false,
  miConductorId,
  pasajerosEnEspera = [],
  altura = '100%',
}: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapaRef = useRef<any>(null);
  const [mapaCargado, setMapaCargado] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const marcadoresRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const capaRutaRef = useRef<any>(null);

  // Inicializar mapa de Leaflet
  useEffect(() => {
    if (mapaRef.current || !contenedorRef.current) return;

    import('leaflet').then((modulo) => {
      if (mapaRef.current || !contenedorRef.current) return;

      const L = (modulo as any).default || modulo;

      const centroInicial = ubicacionUsuario
        ? [ubicacionUsuario.latitud, ubicacionUsuario.longitud]
        : [-33.4489, -70.6693];

      const mapa = L.map(contenedorRef.current, {
        center: centroInicial,
        zoom: 15,
        zoomControl: false,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
      }).addTo(mapa);

      L.control.zoom({ position: 'bottomright' }).addTo(mapa);

      setTimeout(() => mapa.invalidateSize(true), 200);

      mapaRef.current = mapa;
      setMapaCargado(true);
    });

    return () => {
      if (mapaRef.current) {
        mapaRef.current.remove();
        mapaRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Centrar mapa al disparar evento
  useEffect(() => {
    if (mapaCargado && mapaRef.current && disparadorCentrado > 0 && ubicacionUsuario) {
      mapaRef.current.setView([ubicacionUsuario.latitud, ubicacionUsuario.longitud], 16, {
        animate: true,
        duration: 1,
      });
    }
  }, [disparadorCentrado, ubicacionUsuario, mapaCargado]);

  // Actualizar marcadores, trazado de línea y colectivos en vivo
  useEffect(() => {
    if (!mapaCargado || !mapaRef.current) return;

    import('leaflet').then((modulo) => {
      const L = (modulo as any).default || modulo;
      const mapa = mapaRef.current;
      if (!mapa) return;

      // Limpiar marcadores y trazado previo
      marcadoresRef.current.forEach((marcador) => marcador.remove());
      marcadoresRef.current = [];

      if (capaRutaRef.current) {
        capaRutaRef.current.remove();
        capaRutaRef.current = null;
      }      // 1. Ubicación del usuario o del propio conductor
      if (ubicacionUsuario) {
        if (esModoConductor) {
          const iconoMiColectivo = L.divIcon({
            className: 'transparent-icon',
            html: `
              <div style="display:flex;flex-direction:column;align-items:center;">
                <div style="background:#F59E0B;color:#0F172A;font-size:10px;font-weight:900;padding:2px 8px;border-radius:12px;box-shadow:0 0 14px rgba(245,158,11,0.9);white-space:nowrap;margin-bottom:2px;letter-spacing:0.3px;">
                  TU COLECTIVO
                </div>
                <div style="position:relative;background:#0F172A;border:2.5px solid #F59E0B;border-radius:10px;padding:4px 8px;display:flex;align-items:center;gap:5px;box-shadow:0 4px 16px rgba(245,158,11,0.6);animation:pulse 2s infinite;">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 3c-.1.2-.1.5-.1.8v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
                  <span style="color:#FBBF24;font-size:11px;font-weight:bold;font-family:monospace;">MI AUTO</span>
                </div>
              </div>`,
            iconSize: [96, 56],
            iconAnchor: [48, 50],
          });

          const marcadorMiAuto = L.marker([ubicacionUsuario.latitud, ubicacionUsuario.longitud], {
            icon: iconoMiColectivo,
            zIndexOffset: 1000,
          }).addTo(mapa);
          marcadorMiAuto.bindTooltip('<b>Tu posición GPS en tiempo real</b>', { direction: 'top', className: 'fim-tooltip' });
          marcadoresRef.current.push(marcadorMiAuto);
        } else {
          const iconoUsuario = L.divIcon({
            className: 'transparent-icon',
            html: `
              <div style="position:relative;width:26px;height:26px;">
                <div style="position:absolute;inset:0;background:#3B82F6;border-radius:50%;opacity:0.35;animation:pulse 1.8s ease-out infinite;"></div>
                <div style="position:absolute;inset:4px;background:#2563EB;border-radius:50%;border:2px solid white;box-shadow:0 0 12px rgba(37,99,235,0.8);"></div>
              </div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          });

          const marcadorUsuario = L.marker([ubicacionUsuario.latitud, ubicacionUsuario.longitud], {
            icon: iconoUsuario,
          }).addTo(mapa);
          marcadorUsuario.bindTooltip('Tu ubicación', { direction: 'top', className: 'fim-tooltip' });
          marcadoresRef.current.push(marcadorUsuario);
        }
      }

      // 2. Dibujar trazado y paradas de la Línea seleccionada
      if (lineaSeleccionada) {
        const colorLinea = lineaSeleccionada.color || '#2563EB';

        // Trazado de ruta
        if (lineaSeleccionada.puntosRuta) {
          try {
            const coordenadas = JSON.parse(lineaSeleccionada.puntosRuta);
            if (Array.isArray(coordenadas) && coordenadas.length > 1) {
              const trazado = L.polyline(coordenadas, {
                color: colorLinea,
                weight: 5,
                opacity: 0.85,
                lineCap: 'round',
                lineJoin: 'round',
              }).addTo(mapa);
              capaRutaRef.current = trazado;
            }
          } catch (e) {
            console.error('Error al dibujar ruta de colectivo:', e);
          }
        }

        // Paradas de la línea
        if (lineaSeleccionada.paradas && lineaSeleccionada.paradas.length > 0) {
          lineaSeleccionada.paradas.forEach((parada) => {
            const iconoParada = L.divIcon({
              className: 'transparent-icon',
              html: `
                <div style="background:white;border:2.5px solid ${colorLinea};border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.25);font-size:10px;font-weight:bold;color:${colorLinea};">
                  ${parada.orden}
                </div>`,
              iconSize: [18, 18],
              iconAnchor: [9, 9],
            });

            const marcadorParada = L.marker([parada.latitud, parada.longitud], {
              icon: iconoParada,
            }).addTo(mapa);
            marcadorParada.bindTooltip(`Parada: ${parada.nombre} (${parada.sentido.toUpperCase()})`, {
              direction: 'top',
              className: 'fim-tooltip',
            });
            marcadoresRef.current.push(marcadorParada);
          });
        }
      }

      // 3. Marcadores de Colectivos en Vivo (otros choferes de la flota)
      conductoresEnVivo
        .filter((chofer) => !esModoConductor || chofer.conductorId !== miConductorId)
        .forEach((chofer) => {
          const asientosDisponibles = chofer.asientosTotales - chofer.asientosOcupados;
          const estaLleno = asientosDisponibles <= 0;
          const esSeleccionado = conductorSeleccionadoId === chofer.conductorId;

          // Color del badge de asientos
          let colorAsientos = '#10B981'; // Verde
          let textoAsientos = `${asientosDisponibles} libres`;
          if (estaLleno) {
            colorAsientos = '#EF4444'; // Rojo
            textoAsientos = 'Lleno';
          } else if (asientosDisponibles === 1) {
            colorAsientos = '#F59E0B'; // Ámbar
            textoAsientos = '1 libre';
          }

          const colorBorde = esSeleccionado ? '#F59E0B' : '#1E293B';

          const iconoColectivo = L.divIcon({
            className: 'transparent-icon',
            html: `
              <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
                <!-- Badge Asientos Disponibles -->
                <div style="background:${colorAsientos};color:white;font-size:10px;font-weight:700;padding:2px 7px;border-radius:12px;box-shadow:0 2px 5px rgba(0,0,0,0.3);white-space:nowrap;margin-bottom:2px;letter-spacing:0.2px;">
                  ${textoAsientos}
                </div>
                <!-- Vehículo Colectivo -->
                <div style="position:relative;background:#1E293B;border:2.5px solid ${colorBorde};border-radius:10px;padding:4px 6px;display:flex;align-items:center;gap:4px;box-shadow:0 4px 10px rgba(0,0,0,0.4);transform:${esSeleccionado ? 'scale(1.15)' : 'scale(1)'};transition:transform 0.2s;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F1F5F9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 3c-.1.2-.1.5-.1.8v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
                  <span style="color:#F1F5F9;font-size:10px;font-weight:bold;font-family:monospace;">${chofer.patente}</span>
                </div>
              </div>`,
            iconSize: [60, 52],
            iconAnchor: [30, 48],
          });

          const marcadorChofer = L.marker([chofer.latitud, chofer.longitud], {
            icon: iconoColectivo,
          }).addTo(mapa);

          marcadorChofer.bindTooltip(
            `<b>${chofer.nombre}</b><br/>Sentido: ${chofer.sentidoRuta.toUpperCase()}<br/>Disponibles: ${asientosDisponibles}/4`,
            { direction: 'top', className: 'fim-tooltip' }
          );

          marcadorChofer.on('click', () => {
            if (alSeleccionarConductor) {
              alSeleccionarConductor(chofer);
            }
          });

          marcadoresRef.current.push(marcadorChofer);
        });

      // 4. Marcadores de Pasajeros con Reserva (Modo Conductor)
      if (esModoConductor && pasajerosEnEspera && pasajerosEnEspera.length > 0) {
        pasajerosEnEspera.forEach((p) => {
          if (!p.latitud || !p.longitud) return;

          const iconoPasajero = L.divIcon({
            className: 'transparent-icon',
            html: `
              <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
                <div style="background:#7C3AED;color:white;font-size:10px;font-weight:700;padding:2px 7px;border-radius:12px;box-shadow:0 2px 8px rgba(124,58,237,0.6);margin-bottom:2px;white-space:nowrap;">
                  ${p.nombre.split(' ')[0]} (${p.asientos} as.)
                </div>
                <div style="background:#6D28D9;border:2px solid #DDD6FE;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(109,40,217,0.6);">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
              </div>`,
            iconSize: [70, 48],
            iconAnchor: [35, 44],
          });

          const marcadorPasajero = L.marker([p.latitud, p.longitud], {
            icon: iconoPasajero,
            zIndexOffset: 500,
          }).addTo(mapa);

          marcadorPasajero.bindTooltip(
            `<b>Reserva de Pasajero</b><br/>Pasajero: ${p.nombre}<br/>Asientos: ${p.asientos}<br/>Pago: ${p.metodoPago?.toUpperCase() || 'EFECTIVO'}${p.paradaNombre ? '<br/>En: ' + p.paradaNombre : ''}`,
            { direction: 'top', className: 'fim-tooltip' }
          );

          marcadoresRef.current.push(marcadorPasajero);
        });
      }
    });
  }, [mapaCargado, ubicacionUsuario, lineaSeleccionada, conductoresEnVivo, conductorSeleccionadoId, alSeleccionarConductor, esModoConductor, miConductorId, pasajerosEnEspera]);

  return (
    <div style={{ position: 'relative', width: '100%', height: altura, minHeight: '320px', borderRadius: '16px', overflow: 'hidden' }}>
      <div ref={contenedorRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />
      <style jsx global>{`
        .fim-tooltip {
          background: rgba(15, 23, 42, 0.92) !important;
          color: #f8fafc !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          border-radius: 8px !important;
          font-size: 11px !important;
          font-weight: 500 !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
          padding: 4px 8px !important;
        }
        .fim-tooltip::before {
          border-top-color: rgba(15, 23, 42, 0.92) !important;
        }
        .transparent-icon {
          background: transparent !important;
          border: none !important;
        }
        @keyframes pulse {
          0% {
            transform: scale(0.9);
            opacity: 0.6;
          }
          70% {
            transform: scale(1.7);
            opacity: 0;
          }
          100% {
            transform: scale(0.9);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
