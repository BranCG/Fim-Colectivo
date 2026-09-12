'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { calcularInfoLlegada } from '@/lib/geo';
import { obtenerPuntosReferencia, PuntoReferencia } from '@/lib/puntosReferencia';

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
  minutosLlegada?: number;
  distanciaTexto?: string;
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
  miPatente?: string;
  pasajerosEnEspera?: PasajeroEnEspera[];
  altura?: string;
}

// Estilo Vectorial Nativo Dark de OpenFreeMap: 100% abierto, sin API key, sin marcas de agua y sin saturación comercial
const URL_ESTILO_DARK = 'https://tiles.openfreemap.org/styles/dark';

// Fallback por si la conexión al CDN vectorial se viera interrumpida
const ESTILO_FALLBACK: any = {
  version: 8,
  sources: {
    'osm-tiles': {
      type: 'raster',
      tiles: [
        'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'osm-tiles-layer',
      type: 'raster',
      source: 'osm-tiles',
      minzoom: 0,
      maxzoom: 19,
      paint: {
        'raster-brightness-max': 0.4,
        'raster-brightness-min': 0.05,
        'raster-contrast': 0.25,
        'raster-saturation': -0.9,
      },
    },
  ],
};

// ─── Generador de Pin SVG de Colectivo Chileno Ultra-Visible ───
interface OpcionesColectivoSvg {
  patente: string;
  textoBadge: string;
  colorBadge: string;
  colorAuto: string;
  colorLetrero: string;
  esDestacado: boolean;
  idUnico: string;
  iconoBadge?: 'auto' | 'reloj' | 'ninguno';
}

function generarSvgColectivoHtml({
  patente,
  textoBadge,
  colorBadge,
  colorAuto,
  colorLetrero,
  esDestacado,
  idUnico,
  iconoBadge = 'ninguno',
}: OpcionesColectivoSvg): string {
  const zIndex = esDestacado ? '90' : '40';

  let svgIconoHtml = '';
  if (iconoBadge === 'auto') {
    svgIconoHtml = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; flex-shrink:0;"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 3c-.1.2-.1.5-.1.8v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>`;
  } else if (iconoBadge === 'reloj') {
    svgIconoHtml = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; flex-shrink:0;"><circle cx="12" cy="12" r="9"/><polyline points="12 6 12 12 16 14"/></svg>`;
  }

  return `
    <div class="fim-colectivo-pin" style="display: flex; flex-direction: column; align-items: center; cursor: pointer; user-select: none; z-index: ${zIndex}; pointer-events: auto;">
      <!-- Badge superior con tiempo o texto de identificación -->
      <div style="
        background: ${colorBadge};
        color: #000000;
        font-size: 9px;
        font-weight: 800;
        padding: 1.5px 6px;
        border-radius: 8px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.5);
        white-space: nowrap;
        margin-bottom: 2px;
        letter-spacing: 0.2px;
        border: ${esDestacado ? '1.5px solid #FFFFFF' : '1px solid rgba(0,0,0,0.3)'};
        display: flex;
        align-items: center;
        gap: 4px;
      ">
        ${svgIconoHtml}
        <span>${textoBadge}</span>
      </div>

      <!-- Automóvil SVG tipo colectivo chileno compacto de tamaño fijo -->
      <div style="position: relative; width: 24px; height: 30px; display: flex; align-items: center; justify-content: center;">
        <svg width="22" height="28" viewBox="0 0 44 56" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 5px rgba(0,0,0,0.7)); position: relative; z-index: 2;">
          <defs>
            <linearGradient id="bodyGrad_${idUnico}" x1="6" y1="8" x2="38" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#1E293B" />
              <stop offset="25%" stop-color="#0F172A" />
              <stop offset="65%" stop-color="#090D16" />
              <stop offset="100%" stop-color="#020617" />
            </linearGradient>

            <linearGradient id="glassGrad_${idUnico}" x1="14" y1="16" x2="30" y2="24" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.9" />
              <stop offset="100%" stop-color="#A3A3A3" stop-opacity="0.5" />
            </linearGradient>
          </defs>

          <!-- Sombra del automóvil en el asfalto -->
          <ellipse cx="22" cy="30" rx="16" ry="21" fill="#000000" fill-opacity="0.45" />

          <!-- Neumáticos laterales -->
          <rect x="4" y="12" width="3.5" height="9" rx="1.5" fill="#0F172A" stroke="#475569" stroke-width="0.8" />
          <rect x="36.5" y="12" width="3.5" height="9" rx="1.5" fill="#0F172A" stroke="#475569" stroke-width="0.8" />
          <rect x="4" y="34" width="3.5" height="9" rx="1.5" fill="#0F172A" stroke="#475569" stroke-width="0.8" />
          <rect x="36.5" y="34" width="3.5" height="9" rx="1.5" fill="#0F172A" stroke="#475569" stroke-width="0.8" />

          <!-- Espejos retrovisores -->
          <path d="M5 19 C3.5 19 3 21 4.5 22.5 L7 22 Z" fill="#1E293B" stroke="${colorLetrero}" stroke-width="1.2" />
          <path d="M39 19 C40.5 19 41 21 39.5 22.5 L37 22 Z" fill="#1E293B" stroke="${colorLetrero}" stroke-width="1.2" />

          <!-- Carrocería sedán moderna con borde amarillo colectivo -->
          <path d="M12 10 C12 6.5 16 5 22 5 C28 5 32 6.5 32 10 L34 20 L35 43 C35 48 31 51 22 51 C13 51 9 48 9 43 L10 20 Z"
                fill="url(#bodyGrad_${idUnico})" stroke="${colorLetrero}" stroke-width="2.5" stroke-linejoin="round" />

          <!-- Parabrisas con curvatura -->
          <path d="M13.5 17.5 C13.5 15.5 16.5 14.5 22 14.5 C27.5 14.5 30.5 15.5 30.5 17.5 L29 23 C29 24.5 26.5 25 22 25 C17.5 25 15 24.5 15 23 Z"
                fill="url(#glassGrad_${idUnico})" stroke="rgba(255,255,255,0.4)" stroke-width="0.8" />

          <!-- Techo del Colectivo -->
          <rect x="14" y="25" width="16" height="12" rx="2" fill="#0A0F1D" stroke="rgba(255,255,255,0.15)" stroke-width="0.8" />

          <!-- Letrero de Colectivo en el Techo (Amarillo chileno) -->
          <rect x="14" y="27.5" width="16" height="7" rx="2" fill="${colorLetrero}" />
          <rect x="15.5" y="29" width="13" height="4" rx="1" fill="#000000" />
          <text x="22" y="32.2" font-size="2.8" font-family="system-ui, -apple-system, sans-serif" font-weight="900" fill="${colorLetrero}" text-anchor="middle" letter-spacing="0.2">COLECTIVO</text>

          <!-- Luneta Trasera -->
          <path d="M15 39 C15 38 17.5 37.5 22 37.5 C26.5 37.5 29 38 29 39 L28 42 C28 42.5 26 43 22 43 C18 43 16 42.5 16 42 Z"
                fill="url(#glassGrad_${idUnico})" stroke="rgba(255,255,255,0.25)" stroke-width="0.8" />

          <!-- Focos Delanteros LED -->
          <ellipse cx="13.5" cy="9.5" rx="2.2" ry="1.5" fill="#FFFFFF" />
          <ellipse cx="30.5" cy="9.5" rx="2.2" ry="1.5" fill="#FFFFFF" />

          <!-- Luces Traseras / Freno -->
          <rect x="11.5" y="48.5" width="4.5" height="2" rx="1" fill="#EF4444" />
          <rect x="28" y="48.5" width="4.5" height="2" rx="1" fill="#EF4444" />
        </svg>
      </div>

      <!-- Placa Patente micro-formato -->
      <div style="
        margin-top: -2px;
        background: #FFFFFF;
        color: #000000;
        border: 1px solid #000000;
        border-radius: 3px;
        padding: 0.5px 4px;
        font-size: 7.5px;
        font-weight: 900;
        font-family: 'Courier New', Courier, monospace;
        letter-spacing: 0.4px;
        box-shadow: 0 1px 4px rgba(0,0,0,0.5);
        z-index: 3;
        white-space: nowrap;
      ">
        ${patente}
      </div>
    </div>
  `;
}

// ─── Generador de Pin SVG para Puntos de Referencia Clave (Metro, Microbús, Malls) ───
function generarSvgReferenciaHtml(punto: PuntoReferencia): string {
  let iconoHtml = '';
  let colorAcento = '#FFFFFF';

  if (punto.tipo === 'metro') {
    colorAcento = '#FACC15'; // Amarillo colectivo
    iconoHtml = `
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FACC15" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; flex-shrink:0;">
        <rect x="4" y="3" width="16" height="14" rx="2"/>
        <path d="M4 11h16"/>
        <path d="M12 3v8"/>
        <path d="m8 19-2 3"/>
        <path d="m16 19 2 3"/>
        <circle cx="9" cy="14" r="1" fill="#FACC15"/>
        <circle cx="15" cy="14" r="1" fill="#FACC15"/>
      </svg>
    `;
  } else if (punto.tipo === 'microbus') {
    colorAcento = '#FFFFFF'; // Blanco
    iconoHtml = `
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; flex-shrink:0;">
        <path d="M8 6v6"/>
        <path d="M15 6v6"/>
        <path d="M2 12h19.6"/>
        <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.2 6 18.2 6H5.8C4.8 6 3.9 6.8 3.6 7.8L2.2 12.8c-.1.4-.2.8-.2 1.2 0 .4.1.8.2 1.2.3 1.1.8 2.8.8 2.8h3"/>
        <circle cx="7" cy="18" r="2"/>
        <circle cx="17" cy="18" r="2"/>
      </svg>
    `;
  } else if (punto.tipo === 'mall') {
    colorAcento = '#FACC15'; // Amarillo colectivo
    iconoHtml = `
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FACC15" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; flex-shrink:0;">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
        <path d="M3 6h18"/>
        <path d="M16 10a4 4 0 0 1-8 0"/>
      </svg>
    `;
  }

  return `
    <div class="fim-referencia-pin" style="display: flex; flex-direction: column; align-items: center; cursor: pointer; user-select: none; z-index: 28; pointer-events: auto;">
      <div style="
        background: rgba(10, 10, 10, 0.94);
        color: #FFFFFF;
        border: 1.2px solid ${colorAcento};
        border-radius: 6px;
        padding: 1.5px 5px;
        font-size: 8px;
        font-weight: 800;
        letter-spacing: 0.2px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.85);
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 3.5px;
        backdrop-filter: blur(4px);
      ">
        ${iconoHtml}
        <span>${punto.nombre}</span>
      </div>
      <div style="
        width: 0;
        height: 0;
        border-left: 3px solid transparent;
        border-right: 3px solid transparent;
        border-top: 3.5px solid ${colorAcento};
        margin-top: -0.5px;
      "></div>
    </div>
  `;
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
  miPatente,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const marcadoresReferenciaRef = useRef<any[]>([]);

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
        style: URL_ESTILO_DARK,
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

      mapa.on('error', (err: any) => {
        // En caso de que el CDN vectorial no responda, activar fallback
        if (err && err.error && (err.error.status === 404 || err.error.status === 500)) {
          try {
            mapa.setStyle(ESTILO_FALLBACK);
          } catch {}
        }
      });

      const marcarListo = () => {
        if (cancelado) return;
        mapaRef.current = mapa;
        setMapaCargado(true);
        setTimeout(() => mapa.resize(), 100);
      };

      if (mapa.loaded()) {
        marcarListo();
      } else {
        mapa.on('load', marcarListo);
      }
    });

    return () => {
      cancelado = true;
      marcadoresReferenciaRef.current.forEach((m) => m.remove());
      marcadoresReferenciaRef.current = [];
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

          const colorRuta = '#FACC15';

          if (mapa.getSource(idFuenteRuta)) {
            mapa.getSource(idFuenteRuta).setData(geojsonData);
          } else {
            mapa.addSource(idFuenteRuta, {
              type: 'geojson',
              data: geojsonData,
            });

            // Capa exterior negra de contraste
            mapa.addLayer({
              id: idCapaRutaGlow,
              type: 'line',
              source: idFuenteRuta,
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
              },
              paint: {
                'line-color': '#000000',
                'line-width': 9,
                'line-opacity': 0.8,
              },
            });

            // Capa principal en amarillo colectivo
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
        // Modo Conductor: "TU COLECTIVO" con automóvil SVG detallado
        const el = document.createElement('div');
        el.className = 'fim-marker-container';
        el.style.cssText = 'display: flex; flex-direction: column; align-items: center; z-index: 100; cursor: pointer;';
        el.innerHTML = generarSvgColectivoHtml({
          patente: miPatente || 'MI AUTO',
          textoBadge: 'TU COLECTIVO',
          colorBadge: '#FACC15',
          colorAuto: '#000000',
          colorLetrero: '#FACC15',
          esDestacado: true,
          idUnico: 'chofer_propio',
          iconoBadge: 'auto',
        });

        const marcador = new Marker({ element: el, anchor: 'bottom' })
          .setLngLat([ubicacionUsuario.longitud, ubicacionUsuario.latitud])
          .setPopup(
            new Popup({ offset: 22, closeButton: false, className: 'fim-map-popup' }).setHTML(
              '<b>Tu Colectivo en tiempo real</b><br/><span style="color: #FACC15; font-size: 10.5px;">GPS activo y en servicio</span>'
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
          <div style="position: absolute; inset: 0; background: #FACC15; border-radius: 50%; opacity: 0.45; animation: fimPulse 1.8s ease-out infinite;"></div>
          <div style="position: absolute; inset: 4px; background: #000000; border-radius: 50%; border: 2.5px solid #FFFFFF; box-shadow: 0 0 14px rgba(250,204,21,0.95);"></div>
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
      lineaSeleccionada.paradas.forEach((parada) => {
        const el = document.createElement('div');
        el.className = 'fim-marker-container';
        el.style.cssText = `
          background: #000000;
          border: 2.5px solid #FACC15;
          border-radius: 50%;
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 3px 8px rgba(0,0,0,0.7);
          font-size: 11px;
          font-weight: 900;
          color: #FFFFFF;
          cursor: pointer;
        `;
        el.innerText = String(parada.orden);

        const marcador = new Marker({ element: el, anchor: 'center' })
          .setLngLat([parada.longitud, parada.latitud])
          .setPopup(
            new Popup({ offset: 14, closeButton: false, className: 'fim-map-popup' }).setHTML(
              `<b>Parada ${parada.orden}: ${parada.nombre}</b><br/><span style="font-size: 10px; color: #A3A3A3;">Sentido: ${parada.sentido.toUpperCase()}</span>`
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

        // Calcular tiempo y distancia de aproximación
        const eta = ubicacionUsuario
          ? calcularInfoLlegada(chofer.latitud, chofer.longitud, ubicacionUsuario.latitud, ubicacionUsuario.longitud)
          : null;

        let colorAsientos = '#FACC15'; // Amarillo colectivo
        let textoAsientos = `${asientosDisponibles} libres`;
        if (estaLleno) {
          colorAsientos = '#171717'; // Lleno en negro/gris
          textoAsientos = 'Lleno';
        } else if (asientosDisponibles === 1) {
          colorAsientos = '#FACC15';
          textoAsientos = '1 libre';
        }

        const textoPill = eta ? `${eta.textoTiempo} • ${textoAsientos}` : textoAsientos;
        const textoBadge = esSeleccionado
          ? (eta ? `TU COLECTIVO • ${eta.textoTiempo}` : 'TU COLECTIVO')
          : textoPill;

        const colorBadge = esSeleccionado ? '#FACC15' : colorAsientos;
        const colorAuto = '#000000';
        const colorLetrero = '#FACC15';

        const el = document.createElement('div');
        el.className = 'fim-marker-container';
        el.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          z-index: ${esSeleccionado ? 90 : 40};
        `;
        el.innerHTML = generarSvgColectivoHtml({
          patente: chofer.patente,
          textoBadge,
          colorBadge,
          colorAuto,
          colorLetrero,
          esDestacado: esSeleccionado,
          idUnico: `flota_${chofer.conductorId.replace(/[^a-zA-Z0-9]/g, '_')}`,
          iconoBadge: esSeleccionado ? 'auto' : (eta ? 'reloj' : 'ninguno'),
        });

        el.addEventListener('click', () => {
          if (alSeleccionarConductor) {
            alSeleccionarConductor(chofer);
          }
        });

        const infoEtaHtml = eta
          ? `<div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.1); color: #FACC15; font-weight: 800;">Llega en ${eta.textoTiempo} (${eta.textoDistancia})</div>`
          : '';

        const tituloPopup = esSeleccionado
          ? `<b>Tu Colectivo Asignado</b> (${chofer.patente})`
          : `<b>${chofer.nombre}</b> (${chofer.patente})`;

        const marcador = new Marker({ element: el, anchor: 'bottom' })
          .setLngLat([chofer.longitud, chofer.latitud])
          .setPopup(
            new Popup({ offset: 22, closeButton: false, className: 'fim-map-popup' }).setHTML(
              `${tituloPopup}<br/>Sentido: ${chofer.sentidoRuta.toUpperCase()}<br/>Disponibles: ${asientosDisponibles}/4${infoEtaHtml}`
            )
          )
          .addTo(mapa);

        marcadoresRef.current.push(marcador);
      });

    // F. Marcadores: Pasajeros en Espera con Reserva (Modo Conductor)
    if (esModoConductor && pasajerosEnEspera && pasajerosEnEspera.length > 0) {
      pasajerosEnEspera.forEach((p) => {
        if (!p.latitud || !p.longitud) return;

        // Calcular tiempo de llegada del chofer a este pasajero
        const eta = ubicacionUsuario
          ? calcularInfoLlegada(ubicacionUsuario.latitud, ubicacionUsuario.longitud, p.latitud, p.longitud)
          : null;

        const textoTiempoPasajero = eta ? eta.textoTiempo : (p.minutosLlegada ? `~${p.minutosLlegada} min` : '');

        const el = document.createElement('div');
        el.className = 'fim-marker-container';
        el.style.cssText = 'display: flex; flex-direction: column; align-items: center; cursor: pointer; z-index: 90;';
        el.innerHTML = `
          <div style="background: #000000; color: #FACC15; border: 1.5px solid #FACC15; font-size: 10px; font-weight: 900; padding: 2.5px 8px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.8); margin-bottom: 2px; white-space: nowrap; display: flex; align-items: center; gap: 4px;">
            ${textoTiempoPasajero ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FACC15" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 6 12 12 16 14"/></svg> ${textoTiempoPasajero} • ` : ''}${p.nombre.split(' ')[0]} (${p.asientos} as.)
          </div>
          <div style="background: #FACC15; border: 2px solid #000000; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(250,204,21,0.5);">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
        `;

        const infoLlegadaChoferHtml = eta
          ? `<div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.1); color: #FACC15; font-weight: 800;">Llegas a recogerlo en: ${eta.textoTiempo} (${eta.textoDistancia})</div>`
          : '';

        const marcador = new Marker({ element: el, anchor: 'bottom' })
          .setLngLat([p.longitud, p.latitud])
          .setPopup(
            new Popup({ offset: 18, closeButton: false, className: 'fim-map-popup' }).setHTML(
              `<b>Reserva de Pasajero</b><br/>Pasajero: ${p.nombre}<br/>Asientos: ${p.asientos}<br/>Pago: ${p.metodoPago?.toUpperCase() || 'EFECTIVO'}${p.paradaNombre ? '<br/>En: ' + p.paradaNombre : ''}${infoLlegadaChoferHtml}`
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

  // 4. Renderizar marcadores de puntos de referencia clave (Metro, Microbús y Malls)
  useEffect(() => {
    if (!mapaCargado || !mapaRef.current || !maplibreModuleRef.current) return;

    const mapa = mapaRef.current;
    const { Marker, Popup } = maplibreModuleRef.current;

    marcadoresReferenciaRef.current.forEach((m) => m.remove());
    marcadoresReferenciaRef.current = [];

    const puntos = obtenerPuntosReferencia();

    puntos.forEach((punto) => {
      const el = document.createElement('div');
      el.className = 'fim-marker-container fim-marker-referencia';
      el.innerHTML = generarSvgReferenciaHtml(punto);

      let distanciaTexto = '';
      if (ubicacionUsuario) {
        const info = calcularInfoLlegada(
          ubicacionUsuario.latitud,
          ubicacionUsuario.longitud,
          punto.latitud,
          punto.longitud
        );
        if (info) {
          distanciaTexto = `<div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.1); color: #FACC15; font-size: 10px; font-weight: 800;">A ${info.textoDistancia} de tu ubicación</div>`;
        }
      }

      const tipoLabel =
        punto.tipo === 'metro'
          ? 'ESTACIÓN DE METRO'
          : punto.tipo === 'microbus'
          ? 'ESTACIÓN / INTERMODAL DE MICROBÚS'
          : 'MALL / CENTRO COMERCIAL';

      const colorAcento = punto.tipo === 'microbus' ? '#FFFFFF' : '#FACC15';

      const marcador = new Marker({ element: el, anchor: 'bottom' })
        .setLngLat([punto.longitud, punto.latitud])
        .setPopup(
          new Popup({ offset: 16, closeButton: false, className: 'fim-map-popup' }).setHTML(
            `<div style="padding: 2px;">
              <div style="font-size: 8.5px; font-weight: 800; color: ${colorAcento}; letter-spacing: 0.5px;">${tipoLabel}</div>
              <div style="font-size: 12px; font-weight: 900; color: #FFFFFF; margin-top: 2px;">${punto.nombre}</div>
              <div style="font-size: 10px; color: #A3A3A3; margin-top: 2px;">${punto.subtitulo}</div>
              ${distanciaTexto}
            </div>`
          )
        )
        .addTo(mapa);

      marcadoresReferenciaRef.current.push(marcador);
    });

    return () => {
      marcadoresReferenciaRef.current.forEach((m) => m.remove());
      marcadoresReferenciaRef.current = [];
    };
  }, [mapaCargado, ubicacionUsuario]);

  // ETA destacado para mostrar en el HUD flotante superior del mapa
  const etaDestacado = useMemo(() => {
    if (!ubicacionUsuario) return null;

    if (esModoConductor) {
      if (pasajerosEnEspera.length === 0) return null;
      const primerPasajero = pasajerosEnEspera[0];
      if (!primerPasajero.latitud || !primerPasajero.longitud) return null;
      const eta = calcularInfoLlegada(
        ubicacionUsuario.latitud,
        ubicacionUsuario.longitud,
        primerPasajero.latitud,
        primerPasajero.longitud
      );
      if (!eta) return null;
      return {
        tipo: 'conductor',
        titulo: `Llegas a buscar a ${primerPasajero.nombre.split(' ')[0]}`,
        textoTiempo: eta.textoTiempo,
        textoDistancia: eta.textoDistancia,
        color: '#FACC15',
      };
    } else {
      // Modo pasajero: si hay conductor seleccionado o asignado
      if (!conductorSeleccionadoId) return null;
      const chofer = conductoresEnVivo.find((c) => c.conductorId === conductorSeleccionadoId);
      if (!chofer) return null;
      const eta = calcularInfoLlegada(
        chofer.latitud,
        chofer.longitud,
        ubicacionUsuario.latitud,
        ubicacionUsuario.longitud
      );
      if (!eta) return null;
      return {
        tipo: 'pasajero',
        titulo: `Colectivo ${chofer.patente}`,
        textoTiempo: eta.textoTiempo,
        textoDistancia: eta.textoDistancia,
        color: '#FACC15',
      };
    }
  }, [ubicacionUsuario, esModoConductor, pasajerosEnEspera, conductorSeleccionadoId, conductoresEnVivo]);

  return (
    <div
      style={{
        position: altura === '100%' ? 'absolute' : 'relative',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: altura,
        minHeight: altura === '100%' ? '100%' : '320px',
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      {/* HUD flotante superior con tiempo estimado (ETA) completamente responsive */}
      {etaDestacado && (
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            background: 'rgba(0, 0, 0, 0.95)',
            backdropFilter: 'blur(10px)',
            border: `1.5px solid ${etaDestacado.color}`,
            borderRadius: '24px',
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.75)',
            pointerEvents: 'none',
            maxWidth: 'calc(100% - 24px)',
            boxSizing: 'border-box',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={etaDestacado.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="9" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {etaDestacado.titulo}:{' '}
            <span style={{ color: '#FACC15', fontWeight: '900' }}>
              {etaDestacado.tipo === 'conductor' ? 'en ' : 'llega en '}{etaDestacado.textoTiempo}
            </span>{' '}
            <span style={{ color: '#A3A3A3', fontWeight: '600', fontSize: '11px' }}>
              ({etaDestacado.textoDistancia})
            </span>
          </span>
        </div>
      )}

      <div ref={contenedorRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />
      <style jsx global>{`
        .maplibregl-canvas {
          outline: none;
        }
        .fim-map-popup .maplibregl-popup-content {
          background: #0A0A0A !important;
          color: #FFFFFF !important;
          border: 1px solid rgba(250, 204, 21, 0.4) !important;
          border-radius: 10px !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7) !important;
          padding: 8px 12px !important;
          backdrop-filter: blur(8px);
        }
        .fim-map-popup .maplibregl-popup-tip {
          border-top-color: #0A0A0A !important;
        }
        .fim-referencia-pin:hover {
          transform: scale(1.12);
          transition: transform 0.15s ease-out;
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
