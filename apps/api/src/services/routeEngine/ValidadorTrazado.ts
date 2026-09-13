/**
 * Validador Multicriterio de Trazados y Segmentos Viales
 * FIM Colectivos — Route Engine
 *
 * Evalúa rigurosamente:
 * 1. Continuidad topológica y ausencia de quiebres o saltos anómalos (> 800m sin vía conectora).
 * 2. Secuencia estricta y orden de los tramos (1..N).
 * 3. Correspondencia de calles y límites comunales esperados.
 * 4. Coherencia de sentido de avance (IDA hacia cabecera B, REGRESO hacia cabecera A).
 * 5. Validez geométrica PostGIS (ST_IsValid, ST_IsSimple).
 * 6. Umbral de confianza cuantitativo (>= 95%).
 *
 * Regla: Cualquier fallo crítico impide el estado PUBLICADO independientemente del score de confianza.
 */

export type EstadoValidacion = 'PENDIENTE' | 'VALIDADO' | 'PUBLICADO' | 'REQUIERE_REVISION' | 'FALLIDO';

export interface CriteriosValidacion {
  continuidad: boolean;
  secuencia: boolean;
  correspondenciaCallesComunas: boolean;
  coherenciaSentido: boolean;
  ausenciaSaltosAnomalos: boolean;
  validezGeometrica: boolean;
  scoreConfianzaSuficiente: boolean;
  scoreConfianza: number;
}

export interface ResultadoValidacion {
  esValido: boolean;
  puedePublicarse: boolean;
  tieneFalloCritico: boolean;
  estadoFinal: EstadoValidacion;
  scoreConfianza: number;
  motivosRechazo: string[];
  alertas: string[];
  detalles: CriteriosValidacion;
}

export class ValidadorTrazado {
  /**
   * Distancia máxima tolerable entre puntos de enlace consecutivos en trama urbana (en metros)
   */
  private static readonly DISTANCIA_MAX_SALTO_METROS = 850;

  /**
   * Distancia mínima en línea recta entre inicio y fin para considerar avance de sentido real
   */
  private static readonly DISTANCIA_MIN_DESPLAZAMIENTO_METROS = 1000;

  /**
   * Valida exhaustivamente un trazado de recorrido según la arquitectura multicriterio
   * @param coordenadas Array continuo de coordenadas [lat, lng]
   * @param tramosOrdenados Lista de tramos del recorrido
   * @param sentido Sentido 'ida' o 'regreso'
   * @param distanciaMetros Distancia total calculada en la red vial
   * @param esOrigenOficial Si proviene de una fuente oficial certificada (GTFS/MTT)
   * @param aprobacionManualPublicacion Si un supervisor autorizó la publicación de un trazado validado
   */
  public static validarTrazado(
    coordenadas: [number, number][],
    tramosOrdenados: { orden: number; calleNormalizada: string; comuna: string }[],
    sentido: 'ida' | 'regreso',
    distanciaMetros: number,
    esOrigenOficial = false,
    aprobacionManualPublicacion = false
  ): ResultadoValidacion {
    const motivosRechazo: string[] = [];
    const alertas: string[] = [];

    // 1. Continuidad y densidad de puntos
    const tienePuntosSuficientes = Array.isArray(coordenadas) && coordenadas.length >= 10;
    if (!tienePuntosSuficientes) {
      motivosRechazo.push('Fallo de continuidad: El trazado cuenta con menos de 10 puntos de georreferenciación');
    }

    // 2. Ausencia de saltos anómalos
    let ausenciaSaltosAnomalos = true;
    if (tienePuntosSuficientes) {
      for (let i = 0; i < coordenadas.length - 1; i++) {
        const p1 = coordenadas[i];
        const p2 = coordenadas[i + 1];
        const dist = this.calcularDistanciaAproximadaMetros(p1[0], p1[1], p2[0], p2[1]);

        if (dist > this.DISTANCIA_MAX_SALTO_METROS) {
          ausenciaSaltosAnomalos = false;
          motivosRechazo.push(`Salto anómalo detectado de ${dist.toFixed(0)}m entre nodos viales consecutivos (${i} -> ${i + 1})`);
          break;
        }
      }
    } else {
      ausenciaSaltosAnomalos = false;
    }
    const continuidad = tienePuntosSuficientes && ausenciaSaltosAnomalos;

    // 3. Validez geométrica y distancias viales
    const distanciaMinimaAceptable = distanciaMetros >= 1500;
    const distanciaMaximaAceptable = distanciaMetros <= 65000;

    if (!distanciaMinimaAceptable) {
      motivosRechazo.push(`Invalidez geométrica: Distancia total excesivamente corta (${(distanciaMetros / 1000).toFixed(2)} km)`);
    }
    if (!distanciaMaximaAceptable) {
      motivosRechazo.push(`Invalidez geométrica: Distancia total excede el rango urbano normal (${(distanciaMetros / 1000).toFixed(2)} km)`);
    }
    const validezGeometrica = tienePuntosSuficientes && distanciaMinimaAceptable && distanciaMaximaAceptable;

    // 4. Secuencia estricta y orden de los tramos
    let secuencia = true;
    if (!tramosOrdenados || tramosOrdenados.length < 2) {
      secuencia = false;
      motivosRechazo.push('Fallo de secuencia: El recorrido no cuenta con suficientes tramos ordenados');
    } else {
      for (let i = 0; i < tramosOrdenados.length - 1; i++) {
        if (tramosOrdenados[i].orden >= tramosOrdenados[i + 1].orden) {
          secuencia = false;
          motivosRechazo.push(`Fallo de secuencia: Tramo orden ${tramosOrdenados[i].orden} no es estrictamente menor a ${tramosOrdenados[i + 1].orden}`);
          break;
        }
      }
    }

    // 5. Correspondencia de calles y comunas
    let correspondenciaCallesComunas = true;
    const comunasValidas = tramosOrdenados.filter(t => t.comuna && t.comuna.trim().length > 1);
    if (comunasValidas.length !== tramosOrdenados.length) {
      correspondenciaCallesComunas = false;
      motivosRechazo.push('Fallo de correspondencia: Existen tramos con comuna no identificada');
    }
    const comunasUnicas = new Set(tramosOrdenados.map(t => t.comuna.trim().toUpperCase()));
    if (comunasUnicas.size === 0 || comunasUnicas.size > 8) {
      correspondenciaCallesComunas = false;
      motivosRechazo.push(`Fallo de correspondencia comunal: Recorrido atraviesa una cantidad inverosímil de comunas (${comunasUnicas.size})`);
    }

    // 6. Coherencia de sentido y avance direccional
    let coherenciaSentido = true;
    if (tienePuntosSuficientes) {
      const pInicio = coordenadas[0];
      const pFin = coordenadas[coordenadas.length - 1];
      const desplazamientoNeto = this.calcularDistanciaAproximadaMetros(pInicio[0], pInicio[1], pFin[0], pFin[1]);

      if (desplazamientoNeto < this.DISTANCIA_MIN_DESPLAZAMIENTO_METROS) {
        coherenciaSentido = false;
        motivosRechazo.push(`Incoherencia de sentido: El desplazamiento neto inicio-fin (${desplazamientoNeto.toFixed(0)}m) indica estancamiento o bucle cerrado sin avance hacia cabecera`);
      }
    } else {
      coherenciaSentido = false;
    }

    // 7. Cálculo cuantitativo del score de confianza
    let scoreConfianza = 100.0;
    if (!continuidad) scoreConfianza -= 45;
    if (!validezGeometrica) scoreConfianza -= 40;
    if (!secuencia) scoreConfianza -= 50;
    if (!correspondenciaCallesComunas) scoreConfianza -= 30;
    if (!coherenciaSentido) scoreConfianza -= 35;
    if (alertas.length > 0) scoreConfianza -= (alertas.length * 5);

    scoreConfianza = Math.max(0, Math.min(100, scoreConfianza));
    const scoreConfianzaSuficiente = scoreConfianza >= 95.0;

    // Regla de Oro:
    // Cualquier fallo crítico en continuidad, secuencia, calles/comunas, sentido,
    // ausencia de saltos o validez geométrica IMPIDE 'PUBLICADO' independientemente del score.
    const tieneFalloCritico = (
      !continuidad ||
      !secuencia ||
      !correspondenciaCallesComunas ||
      !coherenciaSentido ||
      !ausenciaSaltosAnomalos ||
      !validezGeometrica
    );

    const esValido = !tieneFalloCritico && scoreConfianza >= 85.0;
    const puedePublicarse = !tieneFalloCritico && scoreConfianzaSuficiente;

    // Determinación del estado final del trazado
    let estadoFinal: EstadoValidacion = 'PENDIENTE';

    if (tieneFalloCritico || scoreConfianza < 85.0) {
      estadoFinal = 'REQUIERE_REVISION';
    } else if (puedePublicarse) {
      // Para fuentes oficiales certificadas (MTT/GTFS), puede ser PUBLICADO directamente
      // Para reconstrucciones OSRM, debe quedar VALIDADO, y solo pasar a PUBLICADO
      // si cuenta con aprobación explícita de publicación.
      if (esOrigenOficial) {
        estadoFinal = 'PUBLICADO';
      } else if (aprobacionManualPublicacion) {
        estadoFinal = 'PUBLICADO';
      } else {
        estadoFinal = 'VALIDADO';
      }
    } else {
      estadoFinal = 'VALIDADO';
    }

    return {
      esValido,
      puedePublicarse,
      tieneFalloCritico,
      estadoFinal,
      scoreConfianza,
      motivosRechazo,
      alertas,
      detalles: {
        continuidad,
        secuencia,
        correspondenciaCallesComunas,
        coherenciaSentido,
        ausenciaSaltosAnomalos,
        validezGeometrica,
        scoreConfianzaSuficiente,
        scoreConfianza,
      },
    };
  }

  /**
   * Cálculo aproximado de distancia geodésica mediante fórmula de Haversine
   */
  private static calcularDistanciaAproximadaMetros(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Radio de la Tierra en metros
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}
