const https = require('https');
const fs = require('fs');

https.get('https://colectivo.fimchile.cl/api/colectivos/lineas', (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const json = JSON.parse(body);
    const ida = json.lineas[0].trazados[0].puntos;

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>MapLibre Route Test</title>
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet" />
  <style>
    body { margin: 0; padding: 0; background: #111; color: white; font-family: sans-serif; }
    #map { width: 100vw; height: 100vh; }
    #status { position: absolute; top: 10px; left: 10px; z-index: 999; background: rgba(0,0,0,0.85); padding: 12px; border-radius: 8px; font-size: 14px; font-weight: bold; border: 1px solid #444; }
  </style>
</head>
<body>
  <div id="status">Inicializando...</div>
  <div id="map"></div>

  <script>
    const ESTILO_MAPLIBRE = {
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
            'raster-saturation': -0.3,
            'raster-contrast': 0.1,
          },
        },
      ],
    };

    const map = new maplibregl.Map({
      container: 'map',
      style: ESTILO_MAPLIBRE,
      center: [-70.618, -33.545],
      zoom: 15,
    });

    const puntosIda = ${JSON.stringify(ida)};

    map.on('load', () => {
      try {
        const coordsGeoJson = puntosIda.map(([lat, lng]) => [lng, lat]);

        map.addSource('fuente-linea-colectivo', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: coordsGeoJson,
            },
          },
        });

        map.addLayer({
          id: 'capa-linea-glow',
          type: 'line',
          source: 'fuente-linea-colectivo',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#000000',
            'line-width': 8.5,
            'line-opacity': 0.85,
          },
        });

        map.addLayer({
          id: 'capa-linea-principal',
          type: 'line',
          source: 'fuente-linea-colectivo',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#FACC15',
            'line-width': 5,
            'line-opacity': 0.95,
          },
        });

        const el = document.createElement('div');
        el.style.width = '20px';
        el.style.height = '20px';
        el.style.backgroundColor = '#FACC15';
        el.style.border = '2px solid black';
        el.style.borderRadius = '50%';
        new maplibregl.Marker({ element: el }).setLngLat([-70.618, -33.545]).addTo(map);

        document.getElementById('status').innerText = 'EXITO: Trazado renderizado con ' + coordsGeoJson.length + ' puntos!';
      } catch (err) {
        document.getElementById('status').innerText = 'ERROR: ' + err.message;
      }
    });
  </script>
</body>
</html>`;

    fs.writeFileSync('scratch/test_map_standalone.html', html);
    console.log('Written scratch/test_map_standalone.html with', ida.length, 'points');
  });
});
