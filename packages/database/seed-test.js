
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function main() {
  console.log('Cleaning database...');
  await prisma.payout.deleteMany({});
  await prisma.rating.deleteMany({});
  await prisma.trip.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.driver.deleteMany({});
  await prisma.user.deleteMany({});

  const passwordHash = await bcrypt.hash('123456', 12);

  console.log('Creating passengers...');
  const p1 = await prisma.user.create({
    data: {
      email: 'pasajero1@fim.cl',
      phone: '+56911111111',
      name: 'Juan Pasajero',
      passwordHash,
      role: 'passenger',
      isVerified: true,
      rut: '11.111.111-1'
    }
  });

  const p2 = await prisma.user.create({
    data: {
      email: 'pasajero2@fim.cl',
      phone: '+56922222222',
      name: 'Maria Pasajera',
      passwordHash,
      role: 'passenger',
      isVerified: true,
      rut: '22.222.222-2'
    }
  });

  console.log('Creating drivers...');
  const d1 = await prisma.driver.create({
    data: {
      email: 'conductor1@fim.cl',
      phone: '+56933333333',
      name: 'Pedro Conductor',
      passwordHash,
      rut: '33.333.333-3',
      birthDate: new Date('1990-01-01'),
      address: 'Alameda 123, Santiago',
      idFrontUrl: 'https://placehold.co/600x400?text=ID+Front',
      idBackUrl: 'https://placehold.co/600x400?text=ID+Back',
      selfieUrl: 'https://placehold.co/600x400?text=Selfie',
      licenseNumber: 'LIC-111',
      licenseUrl: 'https://placehold.co/600x400?text=License',
      vehicleBrand: 'Toyota',
      vehicleModel: 'Corolla',
      vehicleYear: 2020,
      vehiclePlate: 'ABCD-12',
      vehiclePhotoUrl: 'https://placehold.co/600x400?text=Car',
      tagNumber: 'TAG-111',
      status: 'active',
      membershipPaid: true,
      membershipPlan: 'PREPAID',
      membershipGoal: 100000
    }
  });

  const d2 = await prisma.driver.create({
    data: {
      email: 'conductor2@fim.cl',
      phone: '+56944444444',
      name: 'Luis Conductor',
      passwordHash,
      rut: '44.444.444-4',
      birthDate: new Date('1995-05-05'),
      address: 'Providencia 456, Santiago',
      idFrontUrl: 'https://placehold.co/600x400?text=ID+Front',
      idBackUrl: 'https://placehold.co/600x400?text=ID+Back',
      selfieUrl: 'https://placehold.co/600x400?text=Selfie',
      licenseNumber: 'LIC-222',
      licenseUrl: 'https://placehold.co/600x400?text=License',
      vehicleBrand: 'Hyundai',
      vehicleModel: 'Accent',
      vehicleYear: 2018,
      vehiclePlate: 'EFGH-34',
      vehiclePhotoUrl: 'https://placehold.co/600x400?text=Car',
      tagNumber: 'TAG-222',
      status: 'active',
      membershipPaid: false,
      membershipPlan: 'PROGRESSIVE',
      membershipGoal: 120000
    }
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
