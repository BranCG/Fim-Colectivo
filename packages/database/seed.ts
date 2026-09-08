import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Sembrando base de datos Fim Colectivo en español...');

  // 1. Líneas de Colectivos iniciales
  const linea10 = await prisma.lineaColectivo.upsert({
    where: { codigo: '10' },
    update: {},
    create: {
      nombre: 'Línea 10',
      codigo: '10',
      descripcion: 'Terminal Norte - Hospital - Centro - Costanera',
      color: '#2563EB', // Azul
      tarifa: 800,
      tarifaNoche: 1000,
      origen: 'Terminal Norte',
      destino: 'Costanera / Playa',
      puntosRuta: JSON.stringify([
        [-33.4372, -70.6506],
        [-33.4400, -70.6480],
        [-33.4440, -70.6450],
        [-33.4500, -70.6400],
      ]),
      activa: true,
      paradas: {
        create: [
          { nombre: 'Terminal Norte', latitud: -33.4372, longitud: -70.6506, orden: 1, sentido: 'ida' },
          { nombre: 'Hospital Regional', latitud: -33.4400, longitud: -70.6480, orden: 2, sentido: 'ida' },
          { nombre: 'Plaza de Armas / Centro', latitud: -33.4440, longitud: -70.6450, orden: 3, sentido: 'ida' },
          { nombre: 'Costanera / Playa', latitud: -33.4500, longitud: -70.6400, orden: 4, sentido: 'ida' },
        ],
      },
    },
  });
  console.log('✅ Línea creada:', linea10.nombre);

  const linea21 = await prisma.lineaColectivo.upsert({
    where: { codigo: '21' },
    update: {},
    create: {
      nombre: 'Línea 21',
      codigo: '21',
      descripcion: 'Sector Alto - Universidades - Mall - Centro',
      color: '#10B981', // Verde
      tarifa: 850,
      tarifaNoche: 1100,
      origen: 'Sector Alto',
      destino: 'Centro',
      puntosRuta: JSON.stringify([
        [-33.4200, -70.6100],
        [-33.4280, -70.6200],
        [-33.4350, -70.6350],
        [-33.4440, -70.6450],
      ]),
      activa: true,
      paradas: {
        create: [
          { nombre: 'Sector Alto', latitud: -33.4200, longitud: -70.6100, orden: 1, sentido: 'ida' },
          { nombre: 'Campus Universitario', latitud: -33.4280, longitud: -70.6200, orden: 2, sentido: 'ida' },
          { nombre: 'Mall Plaza', latitud: -33.4350, longitud: -70.6350, orden: 3, sentido: 'ida' },
          { nombre: 'Centro', latitud: -33.4440, longitud: -70.6450, orden: 4, sentido: 'ida' },
        ],
      },
    },
  });
  console.log('✅ Línea creada:', linea21.nombre);

  // 2. Administrador
  const hashClaveAdmin = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@fimchile.cl' },
    update: {},
    create: {
      email: 'admin@fimchile.cl',
      phone: '+56900000000',
      name: 'Administrador Fim Colectivo',
      passwordHash: hashClaveAdmin,
      role: 'admin',
      isVerified: true,
    },
  });
  console.log('✅ Admin creado:', admin.email);

  // 3. Pasajero de prueba
  const hashClavePasajero = await bcrypt.hash('test123', 12);
  const pasajero = await prisma.user.upsert({
    where: { email: 'pasajero@fimchile.cl' },
    update: {},
    create: {
      email: 'pasajero@fimchile.cl',
      phone: '+56911111111',
      name: 'Juan Pasajero',
      passwordHash: hashClavePasajero,
      role: 'passenger',
      rut: '12.345.678-9',
      birthDate: new Date('1990-05-15'),
      address: 'Av. Providencia 1000, Santiago',
      isVerified: true,
    },
  });
  console.log('✅ Pasajero de prueba:', pasajero.email);

  // 4. Chofer Colectivo de prueba (Línea 10, 4 asientos, RutPay y MercadoPago)
  const hashClaveChofer = await bcrypt.hash('test123', 12);
  const chofer = await prisma.driver.upsert({
    where: { email: 'chofer@fimchile.cl' },
    update: {},
    create: {
      email: 'chofer@fimchile.cl',
      phone: '+56922222222',
      name: 'Pedro Chofer Colectivo',
      passwordHash: hashClaveChofer,
      rut: '15.678.901-2',
      birthDate: new Date('1985-08-20'),
      address: 'Av. Las Condes 5000, Santiago',
      idFrontUrl: 'https://via.placeholder.com/400x250?text=Cedula+Frente',
      idBackUrl: 'https://via.placeholder.com/400x250?text=Cedula+Dorso',
      licenseNumber: 'A1234567',
      licenseUrl: 'https://via.placeholder.com/400x250?text=Licencia',
      vehicleBrand: 'Nissan',
      vehicleModel: 'V16 / Versa Colectivo',
      vehicleYear: 2022,
      vehiclePlate: 'COL101',
      vehiclePhotoUrl: 'https://via.placeholder.com/400x250?text=Colectivo+Linea+10',
      tagNumber: 'COL-10-01',
      status: 'active',
      membershipPaid: true,
      membershipDate: new Date(),
      totalRating: 4.9,
      totalTrips: 120,
      lineaId: linea10.id,
      asientosTotales: 4,
      asientosOcupados: 1, // 3 disponibles
      sentidoRuta: 'ida',
      isOnline: true,
      lastLat: -33.4385,
      lastLng: -70.6495,
      telefonoRutPay: '+56922222222',
      mercadoPagoLink: 'https://mpago.li/test-chofer',
    },
  });
  console.log('✅ Chofer colectivo activo:', chofer.email, `(${linea10.nombre})`);

  console.log('\n🎉 Seed completado exitosamente!\n');
  console.log('═══════════════════════════════════════════════════');
  console.log('  Credenciales de prueba Fim Colectivo:');
  console.log('  Admin:      admin@fimchile.cl / admin123');
  console.log('  Pasajero:   pasajero@fimchile.cl / test123');
  console.log('  Chofer:     chofer@fimchile.cl / test123');
  console.log('═══════════════════════════════════════════════════\n');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
