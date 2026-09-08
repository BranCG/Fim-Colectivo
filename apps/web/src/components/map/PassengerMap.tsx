'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  origin: { lat: number; lng: number; address: string } | null;
  dest: { lat: number; lng: number; address: string } | null;
  driverPos: { lat: number; lng: number } | null;
  centerTrigger?: number;
}

export default function PassengerMap({ origin, dest, driverPos, centerTrigger = 0 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routeRef = useRef<any>(null);

  // Inicializar el mapa una sola vez
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    import('leaflet').then((mod) => {
      // Double check due to async nature and React StrictMode
      if (mapRef.current || !containerRef.current) return;

      const L = (mod as any).default || (mod as any);
      console.log('Fim: Leaflet loaded');

      const map = L.map(containerRef.current, {
        center: origin ? [origin.lat, origin.lng] : [-33.4489, -70.6693],
        zoom: 18,
        zoomControl: false,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // ← CRÍTICO: fuerza que Leaflet recalcule el tamaño del contenedor
      setTimeout(() => map.invalidateSize(true), 200);

      mapRef.current = map;
      setMapLoaded(true); // Dispara el segundo useEffect
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Efecto para centrar el mapa cuando se clickea "Mi ubicación actual"
  useEffect(() => {
    if (mapLoaded && mapRef.current && centerTrigger > 0 && origin) {
      mapRef.current.setView([origin.lat, origin.lng], 18, { animate: true, duration: 1 });
    }
  }, [centerTrigger, origin, mapLoaded]);

  // Actualizar marcadores cuando cambian las posiciones o cuando el mapa termina de cargar
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;

    import('leaflet').then((mod) => {
      const L = mod.default;
      const map = mapRef.current;
      if (!map) return;

      // Limpiar marcadores anteriores
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (routeRef.current) { routeRef.current.remove(); routeRef.current = null; }

      // ── Marcador Origen (punto verde pulsante) ──────────────────
      if (origin) {
        const originIcon = L.divIcon({
          className: 'transparent-icon',
          html: `
            <div style="position:relative;width:24px;height:24px">
              <div style="position:absolute;inset:0;background:#00E5A0;border-radius:50%;opacity:0.4;animation:ping 1.5s ease-out infinite"></div>
              <div style="position:absolute;inset:4px;background:#00E5A0;border-radius:50%;border:2px solid white;box-shadow:0 0 10px #00E5A0"></div>
            </div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        const originMarker = L.marker([origin.lat, origin.lng], { icon: originIcon }).addTo(map);
        originMarker.bindTooltip('Tu ubicación', { permanent: false, direction: 'top', className: 'fim-tooltip' });
        markersRef.current.push(originMarker);
      }

      if (dest) {
        // ── Marcador Destino ──────────────────────────────────────
        const destIcon = L.divIcon({
          className: 'transparent-icon',
          html: `
            <div style="display:flex;flex-direction:column;align-items:center">
              <div style="background:#FF4560;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(255,69,96,0.6)"></div>
              <div style="width:2px;height:10px;background:#FF4560;margin-top:1px"></div>
              <div style="width:8px;height:4px;background:#FF456080;border-radius:0 0 50% 50%"></div>
            </div>`,
          iconSize: [20, 30],
          iconAnchor: [10, 30],
        });
        const destMarker = L.marker([dest.lat, dest.lng], { icon: destIcon }).addTo(map);
        destMarker.bindTooltip(dest.address, { permanent: false, direction: 'top', className: 'fim-tooltip' });
        markersRef.current.push(destMarker);
  
        // ── Línea de ruta (Real por calles con OSRM) ───────────────────────
        if (origin) {
          const fetchRoute = async () => {
            try {
              const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`);
              const data = await res.json();
              
              if (!mapRef.current) return;
              if (routeRef.current) { routeRef.current.remove(); }
  
              if (data.routes && data.routes[0]) {
                const routeLine = L.geoJSON(data.routes[0].geometry, {
                  style: { color: '#00E5A0', weight: 5, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }
                }).addTo(map);
                routeRef.current = routeLine;
              } else {
                throw new Error('Sin ruta');
              }
            } catch (error) {
              if (!mapRef.current) return;
              const routeLine = L.polyline(
                [[origin.lat, origin.lng], [dest.lat, dest.lng]],
                { color: '#00E5A0', weight: 4, opacity: 0.85, dashArray: '10 6', lineCap: 'round' }
              ).addTo(map);
              routeRef.current = routeLine;
            }
          };
          fetchRoute();
  
          // Ajustar vista para ver toda la ruta
          const bounds = L.latLngBounds(
            [[origin.lat, origin.lng], [dest.lat, dest.lng]]
          );
          map.fitBounds(bounds, { padding: [80, 80], maxZoom: 15 });
        }
      } else if (origin) {
        map.setView([origin.lat, origin.lng], 18);
      }

      // ── Marcador Conductor (auto en movimiento) ───────────────
      if (driverPos) {
        const driverIcon = L.divIcon({
          className: 'transparent-icon',
          html: `
            <div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center">
              <div style="position:absolute;inset:-6px;background:rgba(0,229,160,0.18);border-radius:50%;animation:ping 2s ease-out infinite"></div>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 8px rgba(0,229,160,0.6));position:relative;z-index:2;display:block">
                <defs>
                  <linearGradient id="ledGlowLeft" x1="8.5" y1="4.5" x2="3" y2="-1" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stop-color="#00E5A0" stop-opacity="0.8" />
                    <stop offset="100%" stop-color="#00E5A0" stop-opacity="0" />
                  </linearGradient>
                  <linearGradient id="ledGlowRight" x1="15.5" y1="4.5" x2="21" y2="-1" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stop-color="#00E5A0" stop-opacity="0.8" />
                    <stop offset="100%" stop-color="#00E5A0" stop-opacity="0" />
                  </linearGradient>
                </defs>
                <style>
                  @keyframes ledPulse {
                    0% { opacity: 0.15; }
                    50% { opacity: 1; }
                    100% { opacity: 0.15; }
                  }
                </style>

                {/* Pulsing Light Beams to the sides */}
                <polygon points="8.5,4.5 2,-2 8,-3" fill="url(#ledGlowLeft)" style="animation: ledPulse 1.2s infinite ease-in-out; mix-blend-mode: screen;" />
                <polygon points="15.5,4.5 16,-3 22,-2" fill="url(#ledGlowRight)" style="animation: ledPulse 1.2s infinite ease-in-out; mix-blend-mode: screen;" />

                {/* Spoiler */}
                <rect x="5" y="19" width="14" height="2" rx="1" fill="#00E5A0" />
                {/* Car Body */}
                <path d="M9 3C7.5 3 6.5 4.5 6.5 6V18C6.5 19.5 7.5 20.5 9 20.5H15C16.5 20.5 17.5 19.5 17.5 18V6C17.5 4.5 16.5 3 15 3H9Z" fill="#131320" stroke="#00E5A0" stroke-width="2" />
                {/* Windshield */}
                <path d="M8 8C8 6.5 9.5 6 12 6C14.5 6 16 6.5 16 8H8Z" fill="#00E5A0" fill-opacity="0.8" />
                {/* Side Mirrors */}
                <rect x="4.5" y="7" width="2" height="3" rx="1" fill="#00E5A0" />
                <rect x="17.5" y="7" width="2" height="3" rx="1" fill="#00E5A0" />
                {/* Headlights (Bulbs pulsing in sync) */}
                <circle cx="8.5" cy="4.5" r="1.2" fill="#FFFFFF" style="animation: ledPulse 1.2s infinite ease-in-out; filter: drop-shadow(0 0 3px #FFFFFF);" />
                <circle cx="15.5" cy="4.5" r="1.2" fill="#FFFFFF" style="animation: ledPulse 1.2s infinite ease-in-out; filter: drop-shadow(0 0 3px #FFFFFF);" />
              </svg>
            </div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        const driverMarker = L.marker([driverPos.lat, driverPos.lng], { icon: driverIcon }).addTo(map);
        driverMarker.bindTooltip('Tu conductor', { permanent: false, direction: 'top', className: 'fim-tooltip' });
        markersRef.current.push(driverMarker);
      }

      // Invalidar tamaño después de actualizar marcadores
      map.invalidateSize(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, dest, driverPos, mapLoaded]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        ref={containerRef}
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
}
