const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runMigrationExtension() {
  console.log('--- Aplicando ampliación de cache_segmentos_viales en Supabase PostgreSQL ---');
  
  // Agregar comuna_verificada si no existe
  await prisma.$executeRawUnsafe(`
    ALTER TABLE cache_segmentos_viales
    ADD COLUMN IF NOT EXISTS comuna_verificada TEXT,
    ADD COLUMN IF NOT EXISTS geometria_geojson JSONB;
  `);

  // Crear índice en road_id si no existe
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_cache_segmentos_road_id ON cache_segmentos_viales (road_id);
  `);

  console.log('✅ Columnas comuna_verificada y geometria_geojson agregadas con éxito a cache_segmentos_viales');
}

runMigrationExtension()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
