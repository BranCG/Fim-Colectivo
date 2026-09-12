/**
 * Puntos de Referencia Urbanos para FIM Colectivo
 * Exclusivamente: Estaciones de Metro, Estaciones/Intermodales de Microbús y Malls
 * Sin emojis, diseño limpio para alta legibilidad en ruta.
 */

export type TipoReferencia = 'metro' | 'microbus' | 'mall';

export interface PuntoReferencia {
  id: string;
  nombre: string;
  tipo: TipoReferencia;
  subtitulo: string;
  latitud: number;
  longitud: number;
}

export const PUNTOS_REFERENCIA: PuntoReferencia[] = [
  // ─── 1. ESTACIONES DE METRO ───
  // Línea 1
  { id: 'metro-san-pablo', nombre: 'Metro San Pablo', tipo: 'metro', subtitulo: 'Línea 1 y Línea 5', latitud: -33.4475, longitud: -70.7247 },
  { id: 'metro-pajaritos', nombre: 'Metro Pajaritos', tipo: 'metro', subtitulo: 'Línea 1 • Conexión Aeropuerto', latitud: -33.4544, longitud: -70.7161 },
  { id: 'metro-las-rejas', nombre: 'Metro Las Rejas', tipo: 'metro', subtitulo: 'Línea 1', latitud: -33.4546, longitud: -70.7061 },
  { id: 'metro-ecuador', nombre: 'Metro Ecuador', tipo: 'metro', subtitulo: 'Línea 1', latitud: -33.4528, longitud: -70.6975 },
  { id: 'metro-san-alberto-hurtado', nombre: 'Metro San Alberto Hurtado', tipo: 'metro', subtitulo: 'Línea 1', latitud: -33.4519, longitud: -70.6908 },
  { id: 'metro-usach', nombre: 'Metro U. de Santiago', tipo: 'metro', subtitulo: 'Línea 1 • Terminal Sur', latitud: -33.4522, longitud: -70.6844 },
  { id: 'metro-estacion-central', nombre: 'Metro Estación Central', tipo: 'metro', subtitulo: 'Línea 1 • Tren Nos/Rancagua', latitud: -33.4517, longitud: -70.6789 },
  { id: 'metro-ula', nombre: 'Metro Unión Latinoamericana', tipo: 'metro', subtitulo: 'Línea 1', latitud: -33.4503, longitud: -70.6728 },
  { id: 'metro-republica', nombre: 'Metro República', tipo: 'metro', subtitulo: 'Línea 1', latitud: -33.4489, longitud: -70.6672 },
  { id: 'metro-los-heroes', nombre: 'Metro Los Héroes', tipo: 'metro', subtitulo: 'Línea 1 y Línea 2', latitud: -33.4461, longitud: -70.6597 },
  { id: 'metro-la-moneda', nombre: 'Metro La Moneda', tipo: 'metro', subtitulo: 'Línea 1', latitud: -33.4442, longitud: -70.6547 },
  { id: 'metro-u-de-chile', nombre: 'Metro U. de Chile', tipo: 'metro', subtitulo: 'Línea 1 y Línea 3', latitud: -33.4439, longitud: -70.6508 },
  { id: 'metro-santa-lucia', nombre: 'Metro Santa Lucía', tipo: 'metro', subtitulo: 'Línea 1', latitud: -33.4419, longitud: -70.6450 },
  { id: 'metro-u-catolica', nombre: 'Metro Universidad Católica', tipo: 'metro', subtitulo: 'Línea 1', latitud: -33.4397, longitud: -70.6397 },
  { id: 'metro-baquedano', nombre: 'Metro Baquedano', tipo: 'metro', subtitulo: 'Línea 1 y Línea 5', latitud: -33.4372, longitud: -70.6342 },
  { id: 'metro-salvador', nombre: 'Metro Salvador', tipo: 'metro', subtitulo: 'Línea 1', latitud: -33.4339, longitud: -70.6272 },
  { id: 'metro-manuel-montt', nombre: 'Metro Manuel Montt', tipo: 'metro', subtitulo: 'Línea 1', latitud: -33.4319, longitud: -70.6200 },
  { id: 'metro-pedro-de-valdivia', nombre: 'Metro Pedro de Valdivia', tipo: 'metro', subtitulo: 'Línea 1', latitud: -33.4258, longitud: -70.6133 },
  { id: 'metro-los-leones', nombre: 'Metro Los Leones', tipo: 'metro', subtitulo: 'Línea 1 y Línea 6', latitud: -33.4217, longitud: -70.6067 },
  { id: 'metro-tobalaba', nombre: 'Metro Tobalaba', tipo: 'metro', subtitulo: 'Línea 1 y Línea 4', latitud: -33.4181, longitud: -70.6011 },
  { id: 'metro-el-golf', nombre: 'Metro El Golf', tipo: 'metro', subtitulo: 'Línea 1', latitud: -33.4150, longitud: -70.5936 },
  { id: 'metro-alcantara', nombre: 'Metro Alcántara', tipo: 'metro', subtitulo: 'Línea 1', latitud: -33.4136, longitud: -70.5886 },
  { id: 'metro-escuela-militar', nombre: 'Metro Escuela Militar', tipo: 'metro', subtitulo: 'Línea 1 • Intermodal', latitud: -33.4108, longitud: -70.5833 },
  { id: 'metro-manquehue', nombre: 'Metro Manquehue', tipo: 'metro', subtitulo: 'Línea 1', latitud: -33.4078, longitud: -70.5683 },
  { id: 'metro-magallanes', nombre: 'Metro Hernando de Magallanes', tipo: 'metro', subtitulo: 'Línea 1', latitud: -33.4056, longitud: -70.5561 },
  { id: 'metro-los-dominicos', nombre: 'Metro Los Dominicos', tipo: 'metro', subtitulo: 'Línea 1 Terminal', latitud: -33.4039, longitud: -70.5439 },

  // Línea 2
  { id: 'metro-vespucio-norte', nombre: 'Metro Vespucio Norte', tipo: 'metro', subtitulo: 'Línea 2 Terminal', latitud: -33.3939, longitud: -70.6444 },
  { id: 'metro-cal-y-canto', nombre: 'Metro Puente Cal y Canto', tipo: 'metro', subtitulo: 'Línea 2 y Línea 3', latitud: -33.4333, longitud: -70.6522 },
  { id: 'metro-santa-ana', nombre: 'Metro Santa Ana', tipo: 'metro', subtitulo: 'Línea 2 y Línea 5', latitud: -33.4386, longitud: -70.6586 },
  { id: 'metro-toesca', nombre: 'Metro Toesca', tipo: 'metro', subtitulo: 'Línea 2', latitud: -33.4519, longitud: -70.6583 },
  { id: 'metro-parque-ohiggins', nombre: 'Metro Parque O Higgins', tipo: 'metro', subtitulo: 'Línea 2', latitud: -33.4600, longitud: -70.6575 },
  { id: 'metro-rondizzoni', nombre: 'Metro Rondizzoni', tipo: 'metro', subtitulo: 'Línea 2', latitud: -33.4689, longitud: -70.6569 },
  { id: 'metro-franklin', nombre: 'Metro Franklin', tipo: 'metro', subtitulo: 'Línea 2 y Línea 6', latitud: -33.4756, longitud: -70.6500 },
  { id: 'metro-el-llano', nombre: 'Metro El Llano', tipo: 'metro', subtitulo: 'Línea 2', latitud: -33.4839, longitud: -70.6500 },
  { id: 'metro-san-miguel', nombre: 'Metro San Miguel', tipo: 'metro', subtitulo: 'Línea 2', latitud: -33.4917, longitud: -70.6500 },
  { id: 'metro-lo-vial', nombre: 'Metro Lo Vial', tipo: 'metro', subtitulo: 'Línea 2', latitud: -33.4986, longitud: -70.6500 },
  { id: 'metro-departamental', nombre: 'Metro Departamental', tipo: 'metro', subtitulo: 'Línea 2', latitud: -33.5069, longitud: -70.6500 },
  { id: 'metro-ciudad-del-nino', nombre: 'Metro Ciudad del Niño', tipo: 'metro', subtitulo: 'Línea 2', latitud: -33.5139, longitud: -70.6500 },
  { id: 'metro-lo-ovalle', nombre: 'Metro Lo Ovalle', tipo: 'metro', subtitulo: 'Línea 2 • Intermodal', latitud: -33.5222, longitud: -70.6569 },
  { id: 'metro-la-cisterna', nombre: 'Metro La Cisterna', tipo: 'metro', subtitulo: 'Línea 2 y 4A • Intermodal', latitud: -33.5361, longitud: -70.6639 },

  // Línea 3
  { id: 'metro-plaza-de-armas', nombre: 'Metro Plaza de Armas', tipo: 'metro', subtitulo: 'Línea 3 y Línea 5', latitud: -33.4378, longitud: -70.6506 },
  { id: 'metro-plaza-egana', nombre: 'Metro Plaza Egaña', tipo: 'metro', subtitulo: 'Línea 3 y Línea 4', latitud: -33.4531, longitud: -70.5708 },
  { id: 'metro-nunoa', nombre: 'Metro Ñuñoa', tipo: 'metro', subtitulo: 'Línea 3 y Línea 6', latitud: -33.4544, longitud: -70.6067 },
  { id: 'metro-irarrazaval', nombre: 'Metro Irarrázaval', tipo: 'metro', subtitulo: 'Línea 3 y Línea 5', latitud: -33.4542, longitud: -70.6278 },

  // Línea 4 & 4A
  { id: 'metro-macul', nombre: 'Metro Macul', tipo: 'metro', subtitulo: 'Línea 4', latitud: -33.5019, longitud: -70.5956 },
  { id: 'metro-vicuna-mackenna', nombre: 'Metro Vicuña Mackenna', tipo: 'metro', subtitulo: 'Línea 4 y Línea 4A', latitud: -33.5186, longitud: -70.5989 },
  { id: 'metro-vicente-valdes', nombre: 'Metro Vicente Valdés', tipo: 'metro', subtitulo: 'Línea 4 y Línea 5', latitud: -33.5236, longitud: -70.5981 },
  { id: 'metro-puente-alto', nombre: 'Metro Plaza de Puente Alto', tipo: 'metro', subtitulo: 'Línea 4 Terminal', latitud: -33.6117, longitud: -70.5756 },

  // Línea 5
  { id: 'metro-bellavista-florida', nombre: 'Metro Bellavista de La Florida', tipo: 'metro', subtitulo: 'Línea 5 • Intermodal', latitud: -33.5217, longitud: -70.5989 },
  { id: 'metro-plaza-maipu', nombre: 'Metro Plaza de Maipú', tipo: 'metro', subtitulo: 'Línea 5 Terminal', latitud: -33.5103, longitud: -70.7578 },
  { id: 'metro-del-sol', nombre: 'Metro Del Sol', tipo: 'metro', subtitulo: 'Línea 5 • Intermodal', latitud: -33.5147, longitud: -70.7483 },

  // Línea 6
  { id: 'metro-cerrillos', nombre: 'Metro Cerrillos', tipo: 'metro', subtitulo: 'Línea 6 Terminal', latitud: -33.4981, longitud: -70.7094 },
  { id: 'metro-estadio-nacional', nombre: 'Metro Estadio Nacional', tipo: 'metro', subtitulo: 'Línea 6', latitud: -33.4636, longitud: -70.6067 },

  // ─── 2. ESTACIONES E INTERMODALES DE MICROBÚS ───
  { id: 'bus-intermodal-la-cisterna', nombre: 'Intermodal La Cisterna', tipo: 'microbus', subtitulo: 'Terminal de Microbuses y Buses', latitud: -33.5364, longitud: -70.6644 },
  { id: 'bus-intermodal-bellavista', nombre: 'Intermodal Bellavista de La Florida', tipo: 'microbus', subtitulo: 'Terminal de Microbuses', latitud: -33.5220, longitud: -70.5985 },
  { id: 'bus-intermodal-franklin', nombre: 'Intermodal Franklin', tipo: 'microbus', subtitulo: 'Estación de Microbús RED', latitud: -33.4758, longitud: -70.6492 },
  { id: 'bus-terminal-san-borja', nombre: 'Terminal San Borja', tipo: 'microbus', subtitulo: 'Terminal Buses y Microbuses Estación Central', latitud: -33.4533, longitud: -70.6803 },
  { id: 'bus-terminal-alameda', nombre: 'Terminal Alameda / Sur', tipo: 'microbus', subtitulo: 'Estación de Buses y Conexión RED', latitud: -33.4531, longitud: -70.6872 },
  { id: 'bus-intermodal-pajaritos', nombre: 'Intermodal Pajaritos', tipo: 'microbus', subtitulo: 'Terminal de Buses y Microbuses', latitud: -33.4542, longitud: -70.7164 },
  { id: 'bus-intermodal-del-sol', nombre: 'Intermodal Del Sol (Maipú)', tipo: 'microbus', subtitulo: 'Terminal de Microbuses Maipú', latitud: -33.5147, longitud: -70.7483 },
  { id: 'bus-intermodal-vespucio-norte', nombre: 'Intermodal Vespucio Norte', tipo: 'microbus', subtitulo: 'Terminal de Microbuses Norte', latitud: -33.3936, longitud: -70.6447 },
  { id: 'bus-intermodal-los-dominicos', nombre: 'Intermodal Los Dominicos', tipo: 'microbus', subtitulo: 'Estación de Microbús Las Condes', latitud: -33.4042, longitud: -70.5436 },
  { id: 'bus-parada-baquedano', nombre: 'Parada 1 / Metro Baquedano', tipo: 'microbus', subtitulo: 'Eje Alameda - Providencia', latitud: -33.4370, longitud: -70.6335 },
  { id: 'bus-parada-tobalaba', nombre: 'Parada 1 / Metro Tobalaba', tipo: 'microbus', subtitulo: 'Eje Providencia - Apoquindo', latitud: -33.4185, longitud: -70.6005 },
  { id: 'bus-parada-los-leones', nombre: 'Parada 2 / Metro Los Leones', tipo: 'microbus', subtitulo: 'Conexión Providencia', latitud: -33.4220, longitud: -70.6060 },
  { id: 'bus-paradero-14-vicuna', nombre: 'Paradero 14 Vicuña Mackenna', tipo: 'microbus', subtitulo: 'Punto neurálgico La Florida', latitud: -33.5210, longitud: -70.5975 },
  { id: 'bus-paradero-25-gran-avenida', nombre: 'Paradero 25 Gran Avenida', tipo: 'microbus', subtitulo: 'Eje Gran Avenida - La Cisterna', latitud: -33.5350, longitud: -70.6630 },
  { id: 'bus-parada-escuela-militar', nombre: 'Intermodal Escuela Militar', tipo: 'microbus', subtitulo: 'Conexión Oriente RED', latitud: -33.4112, longitud: -70.5828 },

  // ─── 3. MALLS Y CENTROS COMERCIALES ───
  { id: 'mall-costanera-center', nombre: 'Mall Costanera Center', tipo: 'mall', subtitulo: 'Centro Comercial Providencia', latitud: -33.4175, longitud: -70.6064 },
  { id: 'mall-parque-arauco', nombre: 'Mall Parque Arauco', tipo: 'mall', subtitulo: 'Centro Comercial Las Condes', latitud: -33.4022, longitud: -70.5781 },
  { id: 'mall-alto-las-condes', nombre: 'Mall Alto Las Condes', tipo: 'mall', subtitulo: 'Centro Comercial Las Condes', latitud: -33.3917, longitud: -70.5458 },
  { id: 'mall-plaza-vespucio', nombre: 'Mall Plaza Vespucio', tipo: 'mall', subtitulo: 'Centro Comercial La Florida', latitud: -33.5189, longitud: -70.5986 },
  { id: 'mall-plaza-oeste', nombre: 'Mall Plaza Oeste', tipo: 'mall', subtitulo: 'Centro Comercial Cerrillos', latitud: -33.5167, longitud: -70.7167 },
  { id: 'mall-plaza-egana', nombre: 'Mall Plaza Egaña', tipo: 'mall', subtitulo: 'Centro Comercial La Reina / Ñuñoa', latitud: -33.4528, longitud: -70.5714 },
  { id: 'mall-plaza-norte', nombre: 'Mall Plaza Norte', tipo: 'mall', subtitulo: 'Centro Comercial Huechuraba', latitud: -33.3667, longitud: -70.6778 },
  { id: 'mall-plaza-los-dominicos', nombre: 'Mall Plaza Los Dominicos', tipo: 'mall', subtitulo: 'Centro Comercial Las Condes', latitud: -33.4131, longitud: -70.5414 },
  { id: 'mall-plaza-alameda', nombre: 'Mall Plaza Alameda', tipo: 'mall', subtitulo: 'Centro Comercial Estación Central', latitud: -33.4514, longitud: -70.6833 },
  { id: 'mall-del-centro-santiago', nombre: 'Mall del Centro Santiago', tipo: 'mall', subtitulo: 'Centro Comercial Santiago Centro', latitud: -33.4372, longitud: -70.6483 },
  { id: 'mall-arauco-maipu', nombre: 'Mall Arauco Maipú', tipo: 'mall', subtitulo: 'Centro Comercial Maipú', latitud: -33.4819, longitud: -70.7514 },
  { id: 'mall-portal-nunoa', nombre: 'Portal Ñuñoa', tipo: 'mall', subtitulo: 'Centro Comercial Ñuñoa', latitud: -33.4639, longitud: -70.5972 },
  { id: 'mall-portal-la-dehesa', nombre: 'Portal La Dehesa', tipo: 'mall', subtitulo: 'Centro Comercial Lo Barnechea', latitud: -33.3597, longitud: -70.5186 },
  { id: 'mall-vivo-panoramico', nombre: 'Mall Vivo Panorámico', tipo: 'mall', subtitulo: 'Centro Comercial Providencia', latitud: -33.4244, longitud: -70.6111 },
  { id: 'mall-vivo-imperio', nombre: 'Mall Vivo Imperio', tipo: 'mall', subtitulo: 'Centro Comercial Santiago Centro', latitud: -33.4406, longitud: -70.6486 },
];

/**
 * Obtiene todos los puntos de referencia urbanos
 */
export function obtenerPuntosReferencia(): PuntoReferencia[] {
  return PUNTOS_REFERENCIA;
}
