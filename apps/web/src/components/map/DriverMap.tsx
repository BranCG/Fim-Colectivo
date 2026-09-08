'use client';

import { useEffect, useRef } from 'react';

interface Props {
  driverPos: { lat: number; lng: number };
  passengerPos: { lat: number; lng: number } | null;
  destPos: { lat: number; lng: number } | null;
}

export default function DriverMap({ driverPos, passengerPos, destPos }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
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
      console.log('Fim: Driver Leaflet loaded');

      const map = L.map(containerRef.current, {
        center: [driverPos.lat, driverPos.lng],
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

      // CRÍTICO: fuerza recalculo de tamaño
      setTimeout(() => map.invalidateSize(true), 200);

      mapRef.current = map;
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Actualizar marcadores cuando cambian posiciones
  useEffect(() => {
    if (!mapRef.current) return;

    import('leaflet').then((mod) => {
      const L = mod.default;
      const map = mapRef.current;
      if (!map) return;

      // Limpiar
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      if (routeRef.current) { routeRef.current.remove(); routeRef.current = null; }

      // ── Marcador Conductor ─────────────────────────────────────
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
      driverMarker.bindTooltip('Tu posición', { permanent: false, direction: 'top', className: 'fim-tooltip' });
      markersRef.current.push(driverMarker);

      // ── Marcador Pasajero ──────────────────────────────────────
      if (passengerPos) {
        const passengerIcon = L.divIcon({
          className: 'transparent-icon',
          html: `
            <div style="position:relative">
              <div style="position:absolute;inset:-4px;background:rgba(255,184,0,0.15);border-radius:50%;animation:ping 2s ease-out infinite"></div>
              <div style="width:40px;height:40px;background:#1A1A28;border-radius:50%;
                          border:3px solid #FFB800;display:flex;align-items:center;
                          justify-content:center;font-size:18px;
                          box-shadow:0 4px 16px rgba(255,184,0,0.4)">
                🧑
              </div>
            </div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });
        const pm = L.marker([passengerPos.lat, passengerPos.lng], { icon: passengerIcon }).addTo(map);
        pm.bindTooltip('Pasajero', { permanent: false, direction: 'top', className: 'fim-tooltip' });
        markersRef.current.push(pm);

        // Ruta: conductor → pasajero (Real con OSRM, verde)
        const fetchPassengerRoute = async () => {
          try {
            const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${driverPos.lng},${driverPos.lat};${passengerPos.lng},${passengerPos.lat}?overview=full&geometries=geojson`);
            const data = await res.json();
            
            if (!mapRef.current) return;
            if (routeRef.current) { routeRef.current.remove(); }

            if (data.routes && data.routes[0]) {
              const route = L.geoJSON(data.routes[0].geometry, {
                style: { color: '#00E5A0', weight: 5, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }
              }).addTo(map);
              routeRef.current = route;
            } else {
              throw new Error('Sin ruta');
            }
          } catch (e) {
            if (!mapRef.current) return;
            const route = L.polyline(
              [[driverPos.lat, driverPos.lng], [passengerPos.lat, passengerPos.lng]],
              { color: '#00E5A0', weight: 4, opacity: 0.85, dashArray: '10 6', lineCap: 'round' }
            ).addTo(map);
            routeRef.current = route;
          }
        };
        fetchPassengerRoute();

        map.fitBounds(
          L.latLngBounds([[driverPos.lat, driverPos.lng], [passengerPos.lat, passengerPos.lng]]),
          { padding: [100, 100], maxZoom: 15 }
        );
      } else if (destPos) {
        // Ruta: conductor → destino (rojo)
        const destIcon = L.divIcon({
          className: 'transparent-icon',
          html: `
            <div style="display:flex;flex-direction:column;align-items:center">
              <div style="background:#FF4560;width:16px;height:16px;border-radius:50%;
                          border:3px solid white;box-shadow:0 2px 10px rgba(255,69,96,0.7)"></div>
              <div style="width:2px;height:12px;background:#FF4560"></div>
              <div style="width:10px;height:5px;background:rgba(255,69,96,0.5);border-radius:0 0 50% 50%"></div>
            </div>`,
          iconSize: [20, 33],
          iconAnchor: [10, 33],
        });
        const dm = L.marker([destPos.lat, destPos.lng], { icon: destIcon }).addTo(map);
        dm.bindTooltip('🏁 Destino', { permanent: false, direction: 'top', className: 'fim-tooltip' });
        markersRef.current.push(dm);

        // Ruta: conductor → destino (Real con OSRM, rojo)
        const fetchDestRoute = async () => {
          try {
            const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${driverPos.lng},${driverPos.lat};${destPos.lng},${destPos.lat}?overview=full&geometries=geojson`);
            const data = await res.json();
            
            if (!mapRef.current) return;
            if (routeRef.current) { routeRef.current.remove(); }

            if (data.routes && data.routes[0]) {
              const route = L.geoJSON(data.routes[0].geometry, {
                style: { color: '#FF4560', weight: 5, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }
              }).addTo(map);
              routeRef.current = route;
            } else {
              throw new Error('Sin ruta');
            }
          } catch (e) {
            if (!mapRef.current) return;
            const route = L.polyline(
              [[driverPos.lat, driverPos.lng], [destPos.lat, destPos.lng]],
              { color: '#FF4560', weight: 4, opacity: 0.85, dashArray: '10 6', lineCap: 'round' }
            ).addTo(map);
            routeRef.current = route;
          }
        };
        fetchDestRoute();

        map.fitBounds(
          L.latLngBounds([[driverPos.lat, driverPos.lng], [destPos.lat, destPos.lng]]),
          { padding: [100, 100], maxZoom: 15 }
        );
      } else {
        map.setView([driverPos.lat, driverPos.lng], 18);
        setTimeout(() => { if (mapRef.current) mapRef.current.panBy([0, 150]); }, 100);
      }

      map.invalidateSize(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverPos, passengerPos, destPos]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        ref={containerRef}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
      />
    </div>
  );
}
