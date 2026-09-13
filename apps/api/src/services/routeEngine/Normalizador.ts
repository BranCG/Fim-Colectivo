/**
 * Normalizador de nombres de calles y vías urbanas de Chile
 * FIM Colectivos — Route Engine
 *
 * Estandariza nombres con errores de codificación (encoding),
 * tildes erróneas, abreviaturas históricas y variaciones comunes,
 * preservando siempre el valor original para auditoría.
 */

export interface ResultadoNormalizacion {
  calleOriginal: string;
  calleNormalizada: string;
  comuna: string;
}

export class NormalizadorVial {
  /**
   * Normaliza el nombre de una calle chilena
   * @param calleRaw Texto crudo proveniente del Excel o fuente
   * @param comuna Nombre de la comuna
   */
  public static normalizarCalle(calleRaw: string, comuna: string): ResultadoNormalizacion {
    if (!calleRaw || typeof calleRaw !== 'string') {
      return {
        calleOriginal: '',
        calleNormalizada: '',
        comuna: (comuna || '').trim().toUpperCase(),
      };
    }

    const calleOriginal = calleRaw.trim();
    let texto = calleOriginal.toUpperCase();

    // 1. Corrección de errores comunes de encoding en registros de transportes (UTF-8 / Latin1)
    texto = texto
      .replace(/VICU\?A/g, 'VICUÑA')
      .replace(/VICU\uFFFDA/g, 'VICUÑA')
      .replace(/PE\?A/g, 'PEÑA')
      .replace(/CA\?ETE/g, 'CAÑETE')
      .replace(/QUILLOTA\?/g, 'QUILLOTA')
      .replace(/CONCEPCI\?N/g, 'CONCEPCIÓN')
      .replace(/RA\?L/g, 'RAÚL')
      .replace(/CARDENAL RAUL/g, 'CARDENAL RAÚL')
      .replace(/SERAFIN/g, 'SERAFÍN')
      .replace(/COLON/g, 'COLÓN')
      .replace(/RODRIGUEZ/g, 'RODRÍGUEZ')
      .replace(/JOSE/g, 'JOSÉ')
      .replace(/CIRCUNVALACION/g, 'CIRCUNVALACIÓN')
      .replace(/AMERICO/g, 'AMÉRICO')
      .replace(/JOAQUIN/g, 'JOAQUÍN');

    // 2. Estandarización de prefijos viales oficiales
    texto = texto
      .replace(/^AVDA\.?\s+/i, 'AVENIDA ')
      .replace(/^AV\.?\s+/i, 'AVENIDA ')
      .replace(/^PJE\.?\s+/i, 'PASAJE ')
      .replace(/^PSJE\.?\s+/i, 'PASAJE ')
      .replace(/^CL\.?\s+/i, 'CALLE ')
      .replace(/^C\.\s+/i, 'CALLE ')
      .replace(/^CNO\.?\s+/i, 'CAMINO ')
      .replace(/^DIAG\.?\s+/i, 'DIAGONAL ');

    // 3. Limpieza de espacios múltiples y signos de puntuación innecesarios
    texto = texto
      .replace(/\s{2,}/g, ' ')
      .replace(/^\s+|\s+$/g, '');

    return {
      calleOriginal,
      calleNormalizada: texto,
      comuna: (comuna || '').trim().toUpperCase(),
    };
  }

  /**
   * Genera una clave única determinística para caché de resolución vial
   */
  public static generarClaveCache(calleNormalizada: string, comuna: string, proveedor = 'OSM'): string {
    const calleSlug = calleNormalizada.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const comunaSlug = comuna.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `${calleSlug}__${comunaSlug}__${proveedor.toLowerCase()}`;
  }
}
