
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  const drivers = await prisma.driver.findMany();
  console.log('--- USERS ---');
  console.log(JSON.stringify(users, null, 2));
  console.log('--- DRIVERS ---');
  console.log(JSON.stringify(drivers, null, 2));
}

main().finally(() => prisma.$disconnect());
