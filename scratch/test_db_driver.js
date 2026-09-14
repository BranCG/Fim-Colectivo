const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:FimChile2026SecurePass@colectivo.fimchile.cl:5432/fim_colectivo?schema=public' } }
});

async function main() {
  const driver = await p.driver.findFirst({
    include: {
      user: true,
      linea: {
        include: {
          trazados: true
        }
      }
    }
  });
  console.log('Driver user:', driver?.user?.email);
  console.log('Driver id:', driver?.id);
  console.log('Driver linea:', driver?.linea?.nombre);
  console.log('Driver linea trazados count:', driver?.linea?.trazados?.length);
  if (driver?.linea?.trazados) {
    console.log('Trazados:', driver.linea.trazados.map(t => ({ id: t.id, sentido: t.sentido, puntosLen: t.puntos?.length })));
  }
}

main().finally(() => p.$disconnect());
