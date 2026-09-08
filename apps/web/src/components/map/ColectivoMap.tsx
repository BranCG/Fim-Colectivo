'use client';

import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';

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

// Estilo Vectorial MapLibre de Carto Voyager (Altísima legibilidad de calles, avenidas y rotulación)
const ESTILO_MAPLIBRE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maplibreModuleRef = useRef<any>(null);
  const [mapaCargado, setMapaCargado] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const marcadoresRef = useRef<any[]>([]);

  // 1. Inicializar MapLibre GL
  useEffect(() => {
    if (mapaRef.current || !contenedorRef.current) return;

    let cancelado = false;

    import('maplibre-gl').then((mod) => {
      if (cancelado || mapaRef.current || !contenedorRef.current) return;

      maplibreModuleRef.current = mod;
      const { Map, NavigationControl } = mod;

      const centroInicial: [number, number] = ubicacionUsuario
        ? [ubicacionUsuario.longitud, ubicacionUsuario.latitud]
        : [-70.6506, -33.4372]; // Santiago Centro

      const mapa = new Map({
        container: contenedorRef.current,
        style: ESTILO_MAPLIBRE,
        center: centroInicial,
        zoom: 14.8,
        pitch: 0,
        bearing: 0,
        attributionControl: false,
      });

      // Controles de navegación y brújula
      mapa.addControl(
        new NavigationControl({
          showCompass: true,
          showZoom: true,
          visualizePitch: true,
        }),
        'bottom-right'
      );

      mapa.on('load', () => {
        if (cancelado) return;
        mapaRef.current = mapa;
        setMapaCargado(true);
        setTimeout(() => mapa.resize(), 150);
      });
    });

    return () => {
      cancelado = true;
      if (mapaRef.current) {
        mapaRef.current.remove();
        mapaRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Centrar mapa con animación suave cuando se dispare `disparadorCentrado`
  useEffect(() => {
    if (mapaCargado && mapaRef.current && disparadorCentrado > 0 && ubicacionUsuario) {
      mapaRef.current.flyTo({
        center: [ubicacionUsuario.longitud, ubicacionUsuario.latitud],
        zoom: 16,
        essential: true,
        duration: 1000,
      });
    }
  }, [disparadorCentrado, ubicacionUsuario, mapaCargado]);

  // 3. Renderizar capa de ruta y marcadores dinámicos
  useEffect(() => {
    if (!mapaCargado || !mapaRef.current || !maplibreModuleRef.current) return;

    const mapa = mapaRef.current;
    const { Marker, Popup } = maplibreModuleRef.current;

    // A. Limpiar marcadores anteriores
    marcadoresRef.current.forEach((m) => m.remove());
    marcadoresRef.current = [];

    // B. Trazado de ruta GeoJSON nativo de la línea
    const idFuenteRuta = 'fuente-linea-colectivo';
    const idCapaRutaGlow = 'capa-linea-glow';
    const idCapaRutaLinea = 'capa-linea-principal';

    if (lineaSeleccionada && lineaSeleccionada.puntosRuta) {
      try {
        const puntosRaw = JSON.parse(lineaSeleccionada.puntosRuta);
        if (Array.isArray(puntosRaw) && puntosRaw.length > 1) {
          // Convertir de [lat, lng] a estándar GeoJSON [lng, lat]
          const coordenadasGeoJson = puntosRaw.map(([lat, lng]: [number, number]) => [lng, lat]);
          const geojsonData = {
            type: 'Feature' as const,
            properties: {},
            geometry: {
              type: 'LineString' as const,
              coordinates: coordenadasGeoJson,
            },
          };

          const colorRuta = lineaSeleccionada.color || '#2563EB';

          if (mapa.getSource(idFuenteRuta)) {
            mapa.getSource(idFuenteRuta).setData(geojsonData);
          } else {
            mapa.addSource(idFuenteRuta, {
              type: 'geojson',
              data: geojsonData,
            });

            // Capa exterior de resalte (glow)
            mapa.addLayer({
              id: idCapaRutaGlow,
              type: 'line',
              source: idFuenteRuta,
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
              },
              paint: {
                'line-color': '#0F172A',
                'line-width': 8,
                'line-opacity': 0.35,
              },
            });

            // Capa principal con el color de la línea
            mapa.addLayer({
              id: idCapaRutaLinea,
              type: 'line',
              source: idFuenteRuta,
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
              },
              paint: {
                'line-color': colorRuta,
                'line-width': 5,
                'line-opacity': 0.95,
              },
            });
          }
        }
      } catch (e) {
        console.error('Error al procesar puntos de la ruta:', e);
      }
    } else {
      // Si no hay línea, remover capas si existen
      if (mapa.getLayer(idCapaRutaLinea)) mapa.removeLayer(idCapaRutaLinea);
      if (mapa.getLayer(idCapaRutaGlow)) mapa.removeLayer(idCapaRutaGlow);
      if (mapa.getSource(idFuenteRuta)) mapa.removeSource(idFuenteRuta);
    }

    // C. Marcador: Ubicación del usuario o Mi Colectivo
    if (ubicacionUsuario) {
      if (esModoConductor) {
        // Modo Conductor: "TU COLECTIVO"
        const el = document.createElement('div');
        el.className = 'fim-marker-container';
        el.style.cssText = 'display: flex; flex-direction: column; align-items: center; z-index: 100; cursor: pointer;';
        el.innerHTML = `
          <div style="background: #F59E0B; color: #0F172A; font-size: 10px; font-weight: 900; padding: 2px 8px; border-radius: 12px; box-shadow: 0 0 14px rgba(245,158,11,0.9); white-space: nowrap; margin-bottom: 2px; letter-spacing: 0.3px;">
            TU COLECTIVO
          </div>
          <div style="position: relative; background: #0F172A; border: 2.5px solid #F59E0B; border-radius: 10px; padding: 4px 8px; display: flex; align-items: center; gap: 5px; box-shadow: 0 4px 16px rgba(245,158,11,0.6); animation: fimPulse 2s infinite;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 3c-.1.2-.1.5-.1.8v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
            <span style="color: #FBBF24; font-size: 11px; font-weight: bold; font-family: monospace;">MI AUTO</span>
          </div>
        `;

        const marcador = new Marker({ element: el, anchor: 'bottom' })
          .setLngLat([ubicacionUsuario.longitud, ubicacionUsuario.latitud])
          .setPopup(
            new Popup({ offset: 20, closeButton: false, className: 'fim-map-popup' }).setHTML(
              '<b>Tu posición GPS en tiempo real</b>'
            )
          )
          .addTo(mapa);

        marcadoresRef.current.push(marcador);
      } else {
        // Modo Pasajero: "Tu Ubicación"
        const el = document.createElement('div');
        el.className = 'fim-marker-container';
        el.style.cssText = 'position: relative; width: 28px; height: 28px; cursor: pointer;';
        el.innerHTML = `
          <div style="position: absolute; inset: 0; background: #3B82F6; border-radius: 50%; opacity: 0.4; animation: fimPulse 1.8s ease-out infinite;"></div>
          <div style="position: absolute; inset: 4px; background: #2563EB; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 0 14px rgba(37,99,235,0.9);"></div>
        `;

        const marcador = new Marker({ element: el, anchor: 'center' })
          .setLngLat([ubicacionUsuario.longitud, ubicacionUsuario.latitud])
          .setPopup(
            new Popup({ offset: 15, closeButton: false, className: 'fim-map-popup' }).setHTML(
              '<b>Tu ubicación actual</b>'
            )
          )
          .addTo(mapa);

        marcadoresRef.current.push(marcador);
      }
    }

    // D. Marcador: Paradas de la línea
    if (lineaSeleccionada?.paradas && lineaSeleccionada.paradas.length > 0) {
      const colorLinea = lineaSeleccionada.color || '#2563EB';

      lineaSeleccionada.paradas.forEach((parada) => {
        const el = document.createElement('div');
        el.className = 'fim-marker-container';
        el.style.cssText = `
          background: #FFFFFF;
          border: 2.5px solid ${colorLinea};
          border-radius: 50%;
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 3px 8px rgba(0,0,0,0.35);
          font-size: 11px;
          font-weight: 800;
          color: ${colorLinea};
          cursor: pointer;
        `;
        el.innerText = String(parada.orden);

        const marcador = new Marker({ element: el, anchor: 'center' })
          .setLngLat([parada.longitud, parada.latitud])
          .setPopup(
            new Popup({ offset: 14, closeButton: false, className: 'fim-map-popup' }).setHTML(
              `<b>Parada ${parada.orden}: ${parada.nombre}</b><br/><span style="font-size: 10px; color: #94A3B8;">Sentido: ${parada.sentido.toUpperCase()}</span>`
            )
          )
          .addTo(mapa);

        marcadoresRef.current.push(marcador);
      });
    }

    // E. Marcadores: Colectivos en Vivo de la flota
    conductoresEnVivo
      .filter((chofer) => !esModoConductor || chofer.conductorId !== miConductorId)
      .forEach((chofer) => {
        const asientosDisponibles = chofer.asientosTotales - chofer.asientosOcupados;
        const estaLleno = asientosDisponibles <= 0;
        const esSeleccionado = conductorSeleccionadoId === chofer.conductorId;

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

        const el = document.createElement('div');
        el.className = 'fim-marker-container';
        el.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          transform: ${esSeleccionado ? 'scale(1.15)' : 'scale(1)'};
          transition: transform 0.2s;
        `;
        el.innerHTML = `
          <div style="background: ${colorAsientos}; color: white; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.35); white-space: nowrap; margin-bottom: 2px; letter-spacing: 0.2px;">
            ${textoAsientos}
          </div>
          <div style="position: relative; background: #0F172A; border: 2.5px solid ${colorBorde}; border-radius: 10px; padding: 4px 6px; display: flex; align-items: center; gap: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.45);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F1F5F9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 3c-.1.2-.1.5-.1.8v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
            <span style="color: #F1F5F9; font-size: 10px; font-weight: bold; font-family: monospace;">${chofer.patente}</span>
          </div>
        `;

        el.addEventListener('click', () => {
          if (alSeleccionarConductor) {
            alSeleccionarConductor(chofer);
          }
        });

        const marcador = new Marker({ element: el, anchor: 'bottom' })
          .setLngLat([chofer.longitud, chofer.latitud])
          .setPopup(
            new Popup({ offset: 18, closeButton: false, className: 'fim-map-popup' }).setHTML(
              `<b>${chofer.nombre}</b><br/>Sentido: ${chofer.sentidoRuta.toUpperCase()}<br/>Disponibles: ${asientosDisponibles}/4`
            )
          )
          .addTo(mapa);

        marcadoresRef.current.push(marcador);
      });

    // F. Marcadores: Pasajeros en Espera con Reserva (Modo Conductor)
    if (esModoConductor && pasajerosEnEspera && pasajerosEnEspera.length > 0) {
      pasajerosEnEspera.forEach((p) => {
        if (!p.latitud || !p.longitud) return;

        const el = document.createElement('div');
        el.className = 'fim-marker-container';
        el.style.cssText = 'display: flex; flex-direction: column; align-items: center; cursor: pointer;';
        el.innerHTML = `
          <div style="background: #7C3AED; color: white; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 12px; box-shadow: 0 2px 8px rgba(124,58,237,0.6); margin-bottom: 2px; white-space: nowrap;">
            ${p.nombre.split(' ')[0]} (${p.asientos} as.)
          </div>
          <div style="background: #6D28D9; border: 2px solid #DDD6FE; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 10px rgba(109,40,217,0.6);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
        `;

        const marcador = new Marker({ element: el, anchor: 'bottom' })
          .setLngLat([p.longitud, p.latitud])
          .setPopup(
            new Popup({ offset: 18, closeButton: false, className: 'fim-map-popup' }).setHTML(
              `<b>Reserva de Pasajero</b><br/>Pasajero: ${p.nombre}<br/>Asientos: ${p.asientos}<br/>Pago: ${p.metodoPago?.toUpperCase() || 'EFECTIVO'}${p.paradaNombre ? '<br/>En: ' + p.paradaNombre : ''}`
            )
          )
          .addTo(mapa);

        marcadoresRef.current.push(marcador);
      });
    }
  }, [
    mapaCargado,
    ubicacionUsuario,
    lineaSeleccionada,
    conductoresEnVivo,
    conductorSeleccionadoId,
    alSeleccionarConductor,
    esModoConductor,
    miConductorId,
    pasajerosEnEspera,
  ]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: altura,
        minHeight: '320px',
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      <div ref={contenedorRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />
      <style jsx global>{`
        .maplibregl-canvas {
          outline: none;
        }
        .fim-map-popup .maplibregl-popup-content {
          background: rgba(15, 23, 42, 0.95) !important;
          color: #f8fafc !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          border-radius: 10px !important;
          font-size: 11px !important;
          font-weight: 500 !important;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45) !important;
          padding: 8px 12px !important;
          backdrop-filter: blur(8px);
        }
        .fim-map-popup .maplibregl-popup-tip {
          border-top-color: rgba(15, 23, 42, 0.95) !important;
        }
        @keyframes fimPulse {
          0% {
            transform: scale(0.95);
            opacity: 0.8;
          }
          70% {
            transform: scale(1.4);
            opacity: 0;
          }
          100% {
            transform: scale(0.95);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
