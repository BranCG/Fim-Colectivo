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

  // 3. Pasajeros de prueba
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

  const pasajero2 = await prisma.user.upsert({
    where: { email: 'pasajero2@fimchile.cl' },
    update: {},
    create: {
      email: 'pasajero2@fimchile.cl',
      phone: '+56966666666',
      name: 'María Pasajera',
      passwordHash: hashClavePasajero,
      role: 'passenger',
      rut: '17.890.123-4',
      birthDate: new Date('1994-08-22'),
      address: 'Av. Matta 500, Santiago',
      isVerified: true,
    },
  });
  console.log('✅ Pasajero 2 de prueba:', pasajero2.email);

  const pasajero3 = await prisma.user.upsert({
    where: { email: 'pasajero3@fimchile.cl' },
    update: {},
    create: {
      email: 'pasajero3@fimchile.cl',
      phone: '+56977777777',
      name: 'Andrés Pasajero',
      passwordHash: hashClavePasajero,
      role: 'passenger',
      rut: '18.901.234-5',
      birthDate: new Date('1992-11-10'),
      address: 'Av. Vicuña Mackenna 1500, Santiago',
      isVerified: true,
    },
  });
  console.log('✅ Pasajero 3 de prueba:', pasajero3.email);

  // 4. Choferes Colectivo de prueba (4 asientos, RutPay y MercadoPago)
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

  const conductor = await prisma.driver.upsert({
    where: { email: 'conductor@fimchile.cl' },
    update: {},
    create: {
      email: 'conductor@fimchile.cl',
      phone: '+56933333333',
      name: 'Carlos Conductor Colectivo',
      passwordHash: hashClaveChofer,
      rut: '16.789.012-3',
      birthDate: new Date('1988-03-12'),
      address: 'Av. Libertador Bernardo O Higgins 1234, Santiago',
      idFrontUrl: 'https://via.placeholder.com/400x250?text=Cedula+Frente',
      idBackUrl: 'https://via.placeholder.com/400x250?text=Cedula+Dorso',
      licenseNumber: 'B9876543',
      licenseUrl: 'https://via.placeholder.com/400x250?text=Licencia',
      vehicleBrand: 'Toyota',
      vehicleModel: 'Yaris Colectivo',
      vehicleYear: 2023,
      vehiclePlate: 'COL202',
      vehiclePhotoUrl: 'https://via.placeholder.com/400x250?text=Colectivo+Toyota',
      tagNumber: 'COL-10-02',
      status: 'active',
      membershipPaid: true,
      membershipDate: new Date(),
      totalRating: 5.0,
      totalTrips: 85,
      lineaId: linea10.id,
      asientosTotales: 4,
      asientosOcupados: 0,
      sentidoRuta: 'ida',
      isOnline: true,
      lastLat: -33.4380,
      lastLng: -70.6490,
      telefonoRutPay: '+56933333333',
      mercadoPagoLink: 'https://mpago.li/test-conductor',
    },
  });
  console.log('✅ Conductor colectivo activo:', conductor.email, `(${linea10.nombre})`);

  const conductor2 = await prisma.driver.upsert({
    where: { email: 'conductor2@fimchile.cl' },
    update: {},
    create: {
      email: 'conductor2@fimchile.cl',
      phone: '+56944444444',
      name: 'Mario Chofer Colectivo',
      passwordHash: hashClaveChofer,
      rut: '17.123.456-7',
      birthDate: new Date('1987-04-18'),
      address: 'Av. Recoleta 800, Santiago',
      idFrontUrl: 'https://via.placeholder.com/400x250?text=Cedula+Frente',
      idBackUrl: 'https://via.placeholder.com/400x250?text=Cedula+Dorso',
      licenseNumber: 'C1122334',
      licenseUrl: 'https://via.placeholder.com/400x250?text=Licencia',
      vehicleBrand: 'Hyundai',
      vehicleModel: 'Accent Colectivo',
      vehicleYear: 2021,
      vehiclePlate: 'COL103',
      vehiclePhotoUrl: 'https://via.placeholder.com/400x250?text=Colectivo+Hyundai',
      tagNumber: 'COL-10-03',
      status: 'active',
      membershipPaid: true,
      membershipDate: new Date(),
      totalRating: 4.8,
      totalTrips: 64,
      lineaId: linea10.id,
      asientosTotales: 4,
      asientosOcupados: 2, // 2 disponibles
      sentidoRuta: 'ida',
      isOnline: true,
      lastLat: -33.4410,
      lastLng: -70.6470,
      telefonoRutPay: '+56944444444',
      mercadoPagoLink: 'https://mpago.li/test-mario',
    },
  });
  console.log('✅ Conductor 2 colectivo activo:', conductor2.email, `(${linea10.nombre})`);

  const conductor3 = await prisma.driver.upsert({
    where: { email: 'conductor3@fimchile.cl' },
    update: {},
    create: {
      email: 'conductor3@fimchile.cl',
      phone: '+56955555555',
      name: 'Roberto Chofer Colectivo',
      passwordHash: hashClaveChofer,
      rut: '18.234.567-8',
      birthDate: new Date('1983-09-25'),
      address: 'Av. Vitacura 3000, Santiago',
      idFrontUrl: 'https://via.placeholder.com/400x250?text=Cedula+Frente',
      idBackUrl: 'https://via.placeholder.com/400x250?text=Cedula+Dorso',
      licenseNumber: 'D4455667',
      licenseUrl: 'https://via.placeholder.com/400x250?text=Licencia',
      vehicleBrand: 'Chevrolet',
      vehicleModel: 'Sail Colectivo',
      vehicleYear: 2022,
      vehiclePlate: 'COL201',
      vehiclePhotoUrl: 'https://via.placeholder.com/400x250?text=Colectivo+Chevrolet',
      tagNumber: 'COL-21-01',
      status: 'active',
      membershipPaid: true,
      membershipDate: new Date(),
      totalRating: 4.95,
      totalTrips: 110,
      lineaId: linea21.id,
      asientosTotales: 4,
      asientosOcupados: 0, // 4 disponibles
      sentidoRuta: 'ida',
      isOnline: true,
      lastLat: -33.4250,
      lastLng: -70.6150,
      telefonoRutPay: '+56955555555',
      mercadoPagoLink: 'https://mpago.li/test-roberto',
    },
  });
  console.log('✅ Conductor 3 colectivo activo:', conductor3.email, `(${linea21.nombre})`);

  console.log('\nSeed completado exitosamente!\n');
  console.log('═══════════════════════════════════════════════════');
  console.log('  Credenciales de prueba Fim Colectivo:');
  console.log('  Admin:       admin@fimchile.cl / admin123');
  console.log('  Pasajeros:   pasajero@fimchile.cl / test123');
  console.log('               pasajero2@fimchile.cl / test123 (María Pasajera)');
  console.log('               pasajero3@fimchile.cl / test123 (Andrés Pasajero)');
  console.log('  Conductores: conductor@fimchile.cl / test123 (Línea 10)');
  console.log('               chofer@fimchile.cl / test123 (Línea 10)');
  console.log('               conductor2@fimchile.cl / test123 (Línea 10 - Mario)');
  console.log('               conductor3@fimchile.cl / test123 (Línea 21 - Roberto)');
  console.log('═══════════════════════════════════════════════════\n');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
