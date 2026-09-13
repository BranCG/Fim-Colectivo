/**
 * Capa de Abstracción de Proveedores de Ruteo y Red Vial
 * FIM Colectivos — Route Engine
 *
 * Mantiene desacoplada la fuente de datos de la red vial (OpenStreetMap, etc.)
 * del motor de cálculo de rutas (OSRM, GraphHopper, Valhalla u Oficial).
 */

export interface PuntoCoordenada {
  lat: number;
  lng: number;
}

export interface ResultadoRuteo {
  coordenadas: [number, number][]; // Array [lat, lng]
  distanciaMetros: number;
  duracionSegundos?: number;
  proveedor: string;
  versionProveedor?: string;
  esOficial: boolean;
}

/**
 * Interfaz de abstracción para motores de ruteo
 */
export interface IProveedorRuteo {
  nombre: string;
  tipoOrigen: 'OFICIAL' | 'RUTEADO_OSM' | 'MAP_MATCHED' | 'MANUAL';
  calcularGeometriaVial(puntosEnlace: PuntoCoordenada[]): Promise<ResultadoRuteo>;
}

/**
 * Proveedor de Trazados Oficiales (GTFS Shapes / Ministerio de Transportes)
 * Máxima prioridad en la arquitectura FIM
 */
export class ProveedorTrazadoOficial implements IProveedorRuteo {
  public readonly nombre = 'OFICIAL_MTT_GTFS';
  public readonly tipoOrigen = 'OFICIAL' as const;

  private trazadoOficial: [number, number][];
  private distanciaOficial?: number;

  constructor(trazadoOficial: [number, number][], distanciaOficial?: number) {
    this.trazadoOficial = trazadoOficial;
    this.distanciaOficial = distanciaOficial;
  }

  public async calcularGeometriaVial(): Promise<ResultadoRuteo> {
    return {
      coordenadas: this.trazadoOficial,
      distanciaMetros: this.distanciaOficial || 0,
      proveedor: this.nombre,
      versionProveedor: 'GTFS-OFICIAL-2026',
      esOficial: true,
    };
  }
}

/**
 * Proveedor de Ruteo OSRM sobre la Red Vial de OpenStreetMap
 * Utilizado para reconstrucción vial a partir de tramos consecutivos
 */
export class ProveedorRuteoOSRM implements IProveedorRuteo {
  public readonly nombre = 'OSRM';
  public readonly tipoOrigen = 'RUTEADO_OSM' as const;
  private urlBase: string;

  constructor(urlBase = 'https://router.project-osrm.org') {
    this.urlBase = urlBase;
  }

  public async calcularGeometriaVial(puntosEnlace: PuntoCoordenada[]): Promise<ResultadoRuteo> {
    if (!puntosEnlace || puntosEnlace.length < 2) {
      throw new Error('Se requieren al menos 2 puntos de enlace vial para calcular un trazado');
    }

    // Formato OSRM: lng,lat;lng,lat;...
    const coordsStr = puntosEnlace.map(p => `${p.lng},${p.lat}`).join(';');
    const url = `${this.urlBase}/route/v1/driving/${coordsStr}?overview=full&geometries=geojson&steps=false`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const respuesta = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!respuesta.ok) {
        throw new Error(`Error HTTP ${respuesta.status} en servidor OSRM`);
      }

      const datos: any = await respuesta.json();

      if (datos.code !== 'Ok' || !datos.routes || datos.routes.length === 0) {
        throw new Error(`OSRM no pudo generar una ruta vial continua: ${datos.code || 'Sin rutas'}`);
      }

      const rutaPrincipal = datos.routes[0];
      // OSRM entrega GeoJSON en [lng, lat]. Convertimos a estándar interno [lat, lng]
      const coordsLatLng: [number, number][] = rutaPrincipal.geometry.coordinates.map(
        ([lng, lat]: [number, number]) => [lat, lng]
      );

      return {
        coordenadas: coordsLatLng,
        distanciaMetros: rutaPrincipal.distance || 0,
        duracionSegundos: rutaPrincipal.duration,
        proveedor: this.nombre,
        versionProveedor: 'OSRM-v5.27',
        esOficial: false,
      };
    } catch (error: any) {
      clearTimeout(timeout);
      throw new Error(`Fallo en cálculo de ruteo OSRM: ${error.message}`);
    }
  }
}
