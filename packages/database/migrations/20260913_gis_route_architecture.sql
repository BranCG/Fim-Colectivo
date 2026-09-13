-- ==============================================================================
-- MIGRACIÓN CONTROLADA: ARQUITECTURA GIS DE RECORRIDOS PARA FIM COLECTIVOS
-- Base de Datos: Supabase PostgreSQL con PostGIS
-- Fecha: 2026-09-13
-- ==============================================================================

-- 1. Asegurar extensión PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Tabla: cache_segmentos_viales (Caché persistente de resolución en red vial)
CREATE TABLE IF NOT EXISTS cache_segmentos_viales (
    id TEXT PRIMARY KEY,
    calle_normalizada TEXT NOT NULL,
    comuna TEXT NOT NULL,
    comuna_verificada TEXT,
    nombre_vial_resuelto TEXT,
    osm_way_id TEXT,
    road_id TEXT,
    sentido_vial TEXT,
    metodo_resolucion TEXT NOT NULL DEFAULT 'OVERPASS_OSM',
    proveedor TEXT NOT NULL DEFAULT 'OSM',
    version_proveedor TEXT NOT NULL DEFAULT '1.0',
    lat_inicio DOUBLE PRECISION,
    lng_inicio DOUBLE PRECISION,
    lat_fin DOUBLE PRECISION,
    lng_fin DOUBLE PRECISION,
    geometria_geojson JSONB,
    confianza DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    geom geometry(Geometry, 4326),
    datos_crudos JSONB,
    fecha_creacion TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índices de cache_segmentos_viales
CREATE UNIQUE INDEX IF NOT EXISTS idx_cache_segmentos_clave ON cache_segmentos_viales (calle_normalizada, comuna, proveedor);
CREATE INDEX IF NOT EXISTS idx_cache_segmentos_geom ON cache_segmentos_viales USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_cache_segmentos_osm_way ON cache_segmentos_viales (osm_way_id);
CREATE INDEX IF NOT EXISTS idx_cache_segmentos_road_id ON cache_segmentos_viales (road_id);

-- 3. Tabla: route_segments (Tramos viales ordenados del recorrido)
CREATE TABLE IF NOT EXISTS route_segments (
    id TEXT PRIMARY KEY,
    linea_id TEXT NOT NULL REFERENCES lineas_colectivo(id) ON DELETE CASCADE,
    folio TEXT NOT NULL,
    sentido TEXT NOT NULL,
    orden INTEGER NOT NULL,
    calle_original TEXT NOT NULL,
    calle_normalizada TEXT NOT NULL,
    comuna TEXT NOT NULL,
    lat_inicio DOUBLE PRECISION,
    lng_inicio DOUBLE PRECISION,
    lat_fin DOUBLE PRECISION,
    lng_fin DOUBLE PRECISION,
    geom geometry(Geometry, 4326),
    geojson JSONB,
    confianza DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    estado_validacion TEXT NOT NULL DEFAULT 'PENDIENTE',
    notas_validacion TEXT,
    metadatos JSONB,
    fecha_creacion TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índices de route_segments
CREATE INDEX IF NOT EXISTS idx_route_segments_secuencia ON route_segments (linea_id, sentido, orden);
CREATE INDEX IF NOT EXISTS idx_route_segments_folio ON route_segments (folio, sentido, orden);
CREATE INDEX IF NOT EXISTS idx_route_segments_estado ON route_segments (estado_validacion);
CREATE INDEX IF NOT EXISTS idx_route_segments_geom ON route_segments USING GIST (geom);

-- 4. Tabla: route_shapes (Trazados viales continuos reales en PostGIS)
CREATE TABLE IF NOT EXISTS route_shapes (
    id TEXT PRIMARY KEY,
    linea_id TEXT NOT NULL REFERENCES lineas_colectivo(id) ON DELETE CASCADE,
    folio TEXT NOT NULL,
    sentido TEXT NOT NULL,
    shape_id TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    origen_tipo TEXT NOT NULL DEFAULT 'RUTEADO_OSM',
    proveedor_origen TEXT,
    version_origen TEXT,
    distancia_metros DOUBLE PRECISION,
    confianza DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    estado_validacion TEXT NOT NULL DEFAULT 'PENDIENTE',
    notas_validacion TEXT,
    geom geometry(LineString, 4326),
    puntos JSONB,
    limites JSONB,
    es_activo BOOLEAN NOT NULL DEFAULT TRUE,
    metadatos JSONB,
    fecha_creacion TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índices de route_shapes
CREATE INDEX IF NOT EXISTS idx_route_shapes_geom ON route_shapes USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_route_shapes_activo ON route_shapes (linea_id, sentido, es_activo);
CREATE INDEX IF NOT EXISTS idx_route_shapes_folio ON route_shapes (folio, sentido, es_activo);
CREATE INDEX IF NOT EXISTS idx_route_shapes_shape_id ON route_shapes (shape_id);
CREATE INDEX IF NOT EXISTS idx_route_shapes_estado ON route_shapes (estado_validacion);
