/**
 * Servicio de Caché de Segmentos y Red Vial
 * FIM Colectivos — Route Engine
 *
 * Almacena en Supabase la resolución de calles y tramos de red vial
 * para permitir el procesamiento eficiente de más de 40.000 recorridos
 * sin repetir consultas externas costosas.
 */

import prisma from '../../utils/prisma';
import { NormalizadorVial } from './Normalizador';

export interface SegmentoVialResuelto {
  id?: string;
  calleNormalizada: string;
  comuna: string;
  comunaVerificada?: string | null;
  nombreVialResuelto: string;
  osmWayId?: string | null;
  roadId?: string | null;
  sentidoVial?: string | null; // Sentido vial: "ida" | "regreso" | "ambos" | "oneway"
  metodoResolucion: string;
  proveedor: string;
  latInicio: number;
  lngInicio: number;
  latFin: number;
  lngFin: number;
  geometriaGeojson?: any; // GeoJSON LineString del segmento vial completo
  confianza: number;
  datosCrudos?: any;
}

export class ServicioCacheVial {
  /**
   * Busca un segmento vial en el caché persistente de Supabase
   */
  public static async consultarCache(
    calleNormalizada: string,
    comuna: string,
    proveedor = 'OSM'
  ): Promise<SegmentoVialResuelto | null> {
    try {
      const registro = await prisma.cacheSegmentoVial.findUnique({
        where: {
          calleNormalizada_comuna_proveedor: {
            calleNormalizada,
            comuna,
            proveedor,
          },
        },
      });

      if (!registro || registro.latInicio == null || registro.lngInicio == null) {
        return null;
      }

      return {
        id: registro.id,
        calleNormalizada: registro.calleNormalizada,
        comuna: registro.comuna,
        comunaVerificada: registro.comunaVerificada || registro.comuna,
        nombreVialResuelto: registro.nombreVialResuelto || registro.calleNormalizada,
        osmWayId: registro.osmWayId,
        roadId: registro.roadId,
        sentidoVial: registro.sentidoVial,
        metodoResolucion: registro.metodoResolucion,
        proveedor: registro.proveedor,
        latInicio: registro.latInicio,
        lngInicio: registro.lngInicio,
        latFin: registro.latFin || registro.latInicio,
        lngFin: registro.lngFin || registro.lngInicio,
        geometriaGeojson: registro.geometriaGeojson,
        confianza: registro.confianza,
        datosCrudos: registro.datosCrudos,
      };
    } catch (error) {
      console.warn(`[ServicioCacheVial] Error consultando caché para ${calleNormalizada} (${comuna}):`, error);
      return null;
    }
  }

  /**
   * Guarda o actualiza la resolución completa de un segmento vial en el caché de Supabase
   */
  public static async guardarEnCache(segmento: SegmentoVialResuelto): Promise<void> {
    try {
      // Si no se proporcionó geometría GeoJSON explícita pero hay inicio y fin, generarla como LineString
      let geometriaGeojson = segmento.geometriaGeojson;
      if (!geometriaGeojson && segmento.latInicio && segmento.lngInicio) {
        const pFinLat = segmento.latFin || segmento.latInicio;
        const pFinLng = segmento.lngFin || segmento.lngInicio;
        geometriaGeojson = {
          type: 'LineString',
          coordinates: [
            [segmento.lngInicio, segmento.latInicio],
            [pFinLng, pFinLat],
          ],
        };
      }

      await prisma.cacheSegmentoVial.upsert({
        where: {
          calleNormalizada_comuna_proveedor: {
            calleNormalizada: segmento.calleNormalizada,
            comuna: segmento.comuna,
            proveedor: segmento.proveedor || 'OSM',
          },
        },
        update: {
          comunaVerificada: segmento.comunaVerificada || segmento.comuna,
          nombreVialResuelto: segmento.nombreVialResuelto,
          osmWayId: segmento.osmWayId || null,
          roadId: segmento.roadId || null,
          sentidoVial: segmento.sentidoVial || null,
          metodoResolucion: segmento.metodoResolucion,
          latInicio: segmento.latInicio,
          lngInicio: segmento.lngInicio,
          latFin: segmento.latFin,
          lngFin: segmento.lngFin,
          geometriaGeojson: geometriaGeojson as any,
          confianza: segmento.confianza,
          datosCrudos: segmento.datosCrudos || undefined,
          fechaActualizacion: new Date(),
        },
        create: {
          calleNormalizada: segmento.calleNormalizada,
          comuna: segmento.comuna,
          comunaVerificada: segmento.comunaVerificada || segmento.comuna,
          nombreVialResuelto: segmento.nombreVialResuelto,
          osmWayId: segmento.osmWayId || null,
          roadId: segmento.roadId || null,
          sentidoVial: segmento.sentidoVial || null,
          metodoResolucion: segmento.metodoResolucion,
          proveedor: segmento.proveedor || 'OSM',
          latInicio: segmento.latInicio,
          lngInicio: segmento.lngInicio,
          latFin: segmento.latFin,
          lngFin: segmento.lngFin,
          geometriaGeojson: geometriaGeojson as any,
          confianza: segmento.confianza,
          datosCrudos: segmento.datosCrudos || undefined,
        },
      });

      // Actualizar la columna PostGIS geom con la geometría del segmento vial
      if (geometriaGeojson) {
        const geojsonStr = JSON.stringify(geometriaGeojson);
        await prisma.$executeRawUnsafe(`
          UPDATE cache_segmentos_viales
          SET geom = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)
          WHERE calle_normalizada = $2 AND comuna = $3 AND proveedor = $4
        `, geojsonStr, segmento.calleNormalizada, segmento.comuna, segmento.proveedor || 'OSM');
      } else if (segmento.latInicio && segmento.lngInicio) {
        await prisma.$executeRawUnsafe(`
          UPDATE cache_segmentos_viales
          SET geom = ST_SetSRID(ST_MakePoint($1, $2), 4326)
          WHERE calle_normalizada = $3 AND comuna = $4 AND proveedor = $5
        `, segmento.lngInicio, segmento.latInicio, segmento.calleNormalizada, segmento.comuna, segmento.proveedor || 'OSM');
      }
    } catch (error) {
      console.warn(`[ServicioCacheVial] Error guardando en caché para ${segmento.calleNormalizada}:`, error);
    }
  }
}
