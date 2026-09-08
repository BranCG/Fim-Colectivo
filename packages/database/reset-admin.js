
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function reset() {
  const adminHash = await bcrypt.hash('admin123', 12);
  await prisma.user.update({
    where: { email: 'admin@fim.cl' },
    data: { passwordHash: adminHash }
  });
  console.log('✅ Password for admin@fim.cl has been reset to: admin123');
  await prisma.$disconnect();
}

reset();
