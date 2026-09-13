const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== VERIFICACIÓN DE DATOS POST-SEED EN SUPABASE ===');

  const countParadas = await prisma.paradaColectivo.count();
  console.log(`- Paradas en paradas_colectivo: ${countParadas} (debe ser 0)`);

  const countTramos = await prisma.routeSegment.count();
  console.log(`- Tramos en route_segments: ${countTramos} (deben ser 39)`);

  const shapes = await prisma.routeShape.findMany();
  console.log(`- Shapes en route_shapes: ${shapes.length}`);
  for (const s of shapes) {
    console.log(`  * Shape ${s.shapeId}: sentido=${s.sentido}, origen=${s.origenTipo}, estado=${s.estadoValidacion}, distancia=${(s.distanciaMetros/1000).toFixed(2)} km, puntos=${s.puntos ? s.puntos.length : 0}`);
  }

  const cacheCount = await prisma.cacheSegmentoVial.count();
  console.log(`- Segmentos en cache_segmentos_viales: ${cacheCount}`);
  const sampleCache = await prisma.cacheSegmentoVial.findFirst({
    where: { calleNormalizada: 'LOS PENSAMIENTOS' }
  });
  console.log('  * Muestra cache:', {
    calle: sampleCache.calleNormalizada,
    comuna: sampleCache.comuna,
    comunaVerificada: sampleCache.comunaVerificada,
    osmWayId: sampleCache.osmWayId,
    roadId: sampleCache.roadId,
    metodo: sampleCache.metodoResolucion,
    sentido: sampleCache.sentidoVial,
    tieneGeometriaGeojson: !!sampleCache.geometriaGeojson
  });

  // Verificar geometría PostGIS en route_shapes y cache_segmentos_viales
  const postgisCheck = await prisma.$queryRawUnsafe(`
    SELECT id, shape_id, ST_GeometryType(geom) as geom_type, ST_SRID(geom) as srid, ST_Length(geom::geography) as dist_geo
    FROM route_shapes;
  `);
  console.log('  * Verificación PostGIS nativa route_shapes:');
  console.table(postgisCheck);
}

main().catch(console.error).finally(() => prisma.$disconnect());
