const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'cache_segmentos_viales' 
    ORDER BY ordinal_position;
  `);
  console.log('Columnas actuales de cache_segmentos_viales:');
  console.table(cols);
}

main().catch(console.error).finally(() => prisma.$disconnect());
