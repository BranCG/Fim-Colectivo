/**
 * Generador y Persistidor de Trazados Viales PostGIS
 * FIM Colectivos — Route Engine
 *
 * Ensambla los tramos viales ordenados, calcula la geometría continua
 * en la red vial, invoca la validación multicriterio y persiste el
 * RouteShape en Supabase PostgreSQL con PostGIS geometry(LineString, 4326).
 */

import prisma from '../../utils/prisma';
import { IProveedorRuteo, PuntoCoordenada, ResultadoRuteo } from './ProveedorRuteo';
import { ValidadorTrazado, ResultadoValidacion } from './ValidadorTrazado';
import { ServicioCacheVial } from './ServicioCacheVial';

export interface TramoDefinicion {
  orden: number;
  calleOriginal: string;
  calleNormalizada: string;
  comuna: string;
  puntoAproximado?: PuntoCoordenada;
}

export interface ResultadoProcesamientoTrazado {
  folio: string;
  sentido: 'ida' | 'regreso';
  shapeId: string;
  distanciaMetros: number;
  cantidadPuntos: number;
  cantidadTramos: number;
  origenTipo: string;
  validacion: ResultadoValidacion;
  puntos: [number, number][];
}

export class GeneradorTrazado {
  private proveedorRuteo: IProveedorRuteo;

  constructor(proveedorRuteo: IProveedorRuteo) {
    this.proveedorRuteo = proveedorRuteo;
  }

  /**
   * Genera, valida y persiste un trazado continuo para un sentido de recorrido
   */
  public async procesarTrazado(
    lineaId: string,
    folio: string,
    sentido: 'ida' | 'regreso',
    tramos: TramoDefinicion[],
    puntosEnlaceVial: PuntoCoordenada[],
    version = 1,
    permitirPublicacion = false
  ): Promise<ResultadoProcesamientoTrazado> {
    if (!tramos || tramos.length === 0) {
      throw new Error(`El recorrido ${folio} (${sentido}) no contiene tramos para procesar`);
    }

    console.log(`[GeneradorTrazado] Procesando ${folio} (${sentido.toUpperCase()}) con ${tramos.length} tramos y ${puntosEnlaceVial.length} puntos de enlace...`);

    // 1. Calcular la geometría vial continua mediante el motor de ruteo
    const resultadoRuteo: ResultadoRuteo = await this.proveedorRuteo.calcularGeometriaVial(puntosEnlaceVial);

    // 2. Ejecutar validación multicriterio
    const validacion = ValidadorTrazado.validarTrazado(
      resultadoRuteo.coordenadas,
      tramos,
      sentido,
      resultadoRuteo.distanciaMetros,
      this.proveedorRuteo.tipoOrigen === 'OFICIAL',
      permitirPublicacion
    );

    // Ajuste de estado:
    // Los shapes OSRM no se establecen automáticamente como PUBLICADO.
    // Quedan como VALIDADO tras superar las validaciones automáticas.
    // Solo pueden ser PUBLICADO si cumplen todos los criterios Y se solicitó explícitamente publicación.
    const estadoPersistencia = validacion.estadoFinal;

    const shapeId = `SHP-${folio}-${sentido.toUpperCase()}-v${version}`;

    // 3. Calcular límites espaciales (Bounding Box)
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    for (const [lat, lng] of resultadoRuteo.coordenadas) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
    const limites = [minLng, minLat, maxLng, maxLat];

    // 4. Construir GeoJSON para inserción PostGIS nativa
    // GeoJSON estándar usa coordenadas [lng, lat]
    const coordenadasGeoJson = resultadoRuteo.coordenadas.map(([lat, lng]) => [lng, lat]);
    const geojsonString = JSON.stringify({
      type: 'LineString',
      coordinates: coordenadasGeoJson,
    });

    // 5. Persistir en la tabla `route_shapes` con PostGIS en Supabase
    // Primero desactivamos cualquier versión previa activa para este folio y sentido
    if (estadoPersistencia === 'PUBLICADO') {
      await prisma.routeShape.updateMany({
        where: { lineaId, sentido },
        data: { esActivo: false },
      });
    }

    // Inserción o actualización del RouteShape
    const shapeGuardado = await prisma.routeShape.upsert({
      where: { id: `shape_${lineaId}_${sentido}_v${version}` },
      update: {
        shapeId,
        version,
        origenTipo: this.proveedorRuteo.tipoOrigen,
        proveedorOrigen: resultadoRuteo.proveedor,
        versionOrigen: resultadoRuteo.versionProveedor,
        distanciaMetros: resultadoRuteo.distanciaMetros,
        confianza: validacion.scoreConfianza,
        estadoValidacion: estadoPersistencia,
        notasValidacion: validacion.motivosRechazo.concat(validacion.alertas).join(' | ') || null,
        puntos: resultadoRuteo.coordenadas as any, // Derivado para lectura instantánea del frontend
        limites: limites as any,
        esActivo: estadoPersistencia === 'PUBLICADO' || estadoPersistencia === 'VALIDADO',
        fechaActualizacion: new Date(),
      },
      create: {
        id: `shape_${lineaId}_${sentido}_v${version}`,
        lineaId,
        folio,
        sentido,
        shapeId,
        version,
        origenTipo: this.proveedorRuteo.tipoOrigen,
        proveedorOrigen: resultadoRuteo.proveedor,
        versionOrigen: resultadoRuteo.versionProveedor,
        distanciaMetros: resultadoRuteo.distanciaMetros,
        confianza: validacion.scoreConfianza,
        estadoValidacion: estadoPersistencia,
        notasValidacion: validacion.motivosRechazo.concat(validacion.alertas).join(' | ') || null,
        puntos: resultadoRuteo.coordenadas as any,
        limites: limites as any,
        esActivo: estadoPersistencia === 'PUBLICADO' || estadoPersistencia === 'VALIDADO',
      },
    });

    // Inyectar geometría PostGIS nativa mediante SQL directo y calcular distancia geodésica exacta
    try {
      await prisma.$executeRawUnsafe(`
        UPDATE route_shapes
        SET geom = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
            distancia_metros = ST_Length(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)::geography)
        WHERE id = $2
      `, geojsonString, shapeGuardado.id);
    } catch (errPostgis) {
      console.warn(`[GeneradorTrazado] Advertencia al actualizar geometría PostGIS:`, errPostgis);
    }

    // 6. Persistir los tramos individuales ordenados en `route_segments`
    for (const tramo of tramos) {
      const segmentId = `seg_${lineaId}_${sentido}_${tramo.orden}`;
      await prisma.routeSegment.upsert({
        where: { id: segmentId },
        update: {
          folio,
          sentido,
          orden: tramo.orden,
          calleOriginal: tramo.calleOriginal,
          calleNormalizada: tramo.calleNormalizada,
          comuna: tramo.comuna,
          latInicio: tramo.puntoAproximado?.lat,
          lngInicio: tramo.puntoAproximado?.lng,
          confianza: validacion.scoreConfianza,
          estadoValidacion: estadoPersistencia,
          fechaActualizacion: new Date(),
        },
        create: {
          id: segmentId,
          lineaId,
          folio,
          sentido,
          orden: tramo.orden,
          calleOriginal: tramo.calleOriginal,
          calleNormalizada: tramo.calleNormalizada,
          comuna: tramo.comuna,
          latInicio: tramo.puntoAproximado?.lat,
          lngInicio: tramo.puntoAproximado?.lng,
          confianza: validacion.scoreConfianza,
          estadoValidacion: estadoPersistencia,
        },
      });
    }

    console.log(`[GeneradorTrazado] ✅ Trazado ${shapeId} completado. Distancia: ${(resultadoRuteo.distanciaMetros / 1000).toFixed(2)} km. Estado: ${estadoPersistencia}. Confianza: ${validacion.scoreConfianza}%`);

    return {
      folio,
      sentido,
      shapeId,
      distanciaMetros: resultadoRuteo.distanciaMetros,
      cantidadPuntos: resultadoRuteo.coordenadas.length,
      cantidadTramos: tramos.length,
      origenTipo: this.proveedorRuteo.tipoOrigen,
      validacion,
      puntos: resultadoRuteo.coordenadas,
    };
  }
}
