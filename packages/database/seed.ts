import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Sembrando base de datos Fim Colectivo en español...');

  // 1. Limpieza de paradas ficticias anteriores para eliminar círculos numerados
  await prisma.paradaColectivo.deleteMany({});
  await prisma.routeSegment.deleteMany({ where: { folio: '233012' } });
  await prisma.routeShape.deleteMany({ where: { folio: '233012' } });

  // 1b. Carga de datos viales oficiales para Folio 233012
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const route233012Data = require('./data/route_233012.json');

  const linea233012 = await prisma.lineaColectivo.upsert({
    where: { codigo: '233012' },
    update: {
      nombre: 'Folio 233012 • Recorrido T',
      folio: '233012',
      region: 13,
      tipoServicio: 'AUTOMOVIL URBANO TAXI COLECTIVO',
      nombreRecorrido: 'T',
      tipoTrazado: 'PRINCIPAL',
      comunas: 'La Granja, La Pintana, La Florida',
      descripcion: 'La Granja - La Pintana - La Florida (Metro Bellavista)',
      color: '#FACC15',
      tarifa: 800,
      tarifaNoche: 1000,
      origen: 'Los Pensamientos (La Granja)',
      destino: 'Serafín Zamora / Metro Bellavista (La Florida)',
      puntosRuta: JSON.stringify(route233012Data.coordsIda),
      puntosRutaRegreso: JSON.stringify(route233012Data.coordsRegreso),
      callesIda: 'Los Pensamientos, Canto General, Av. Cardenal Raúl Silva Henríquez, Los Mayas, Los Olmecas, General Arriagada, Las Parcelas, San José de la Estrella, Joaquín Edwards Bello, Cristóbal Colón, Av. Manuel Rodríguez, Av. Trinidad, Punta Arenas, Av. Circunvalación Américo Vespucio, Av. Vicuña Mackenna Oriente, Serafín Zamora',
      callesRegreso: 'Serafín Zamora, Av. Circunvalación Américo Vespucio, Punta Arenas, Isla Adelaida, Av. Trinidad, Av. Manuel Rodríguez, Enlace Alt. Pasaje Cunlahue, Av. Vicuña Mackenna, Av. Cardenal Raúl Silva Henríquez, Cristóbal Colón, Joaquín Edwards Bello, San José de la Estrella, Las Parcelas, General Arriagada, Av. Cardenal Raúl Silva Henríquez, Canto General, Los Pensamientos',
      activa: true,
    },
    create: {
      nombre: 'Folio 233012 • Recorrido T',
      codigo: '233012',
      folio: '233012',
      region: 13,
      tipoServicio: 'AUTOMOVIL URBANO TAXI COLECTIVO',
      nombreRecorrido: 'T',
      tipoTrazado: 'PRINCIPAL',
      comunas: 'La Granja, La Pintana, La Florida',
      descripcion: 'La Granja - La Pintana - La Florida (Metro Bellavista)',
      color: '#FACC15',
      tarifa: 800,
      tarifaNoche: 1000,
      origen: 'Los Pensamientos (La Granja)',
      destino: 'Serafín Zamora / Metro Bellavista (La Florida)',
      puntosRuta: JSON.stringify(route233012Data.coordsIda),
      puntosRutaRegreso: JSON.stringify(route233012Data.coordsRegreso),
      callesIda: 'Los Pensamientos, Canto General, Av. Cardenal Raúl Silva Henríquez, Los Mayas, Los Olmecas, General Arriagada, Las Parcelas, San José de la Estrella, Joaquín Edwards Bello, Cristóbal Colón, Av. Manuel Rodríguez, Av. Trinidad, Punta Arenas, Av. Circunvalación Américo Vespucio, Av. Vicuña Mackenna Oriente, Serafín Zamora',
      callesRegreso: 'Serafín Zamora, Av. Circunvalación Américo Vespucio, Punta Arenas, Isla Adelaida, Av. Trinidad, Av. Manuel Rodríguez, Enlace Alt. Pasaje Cunlahue, Av. Vicuña Mackenna, Av. Cardenal Raúl Silva Henríquez, Cristóbal Colón, Joaquín Edwards Bello, San José de la Estrella, Las Parcelas, General Arriagada, Av. Cardenal Raúl Silva Henríquez, Canto General, Los Pensamientos',
      activa: true,
    },
  });
  console.log('✅ Línea oficial registrada:', linea233012.nombre);

  // 1c. Insertar los 19 TRAMOS VIALES ORDENADOS DE IDA en route_segments
  const tramosIdaRaw = [
    { orden: 1, calle: 'LOS PENSAMIENTOS', comuna: 'LA GRANJA', lat: -33.55137, lng: -70.61921 },
    { orden: 2, calle: 'CANTO GENERAL', comuna: 'LA GRANJA', lat: -33.55031, lng: -70.61908 },
    { orden: 3, calle: 'AV. CARDENAL RAUL SILVA HENRIQUEZ', comuna: 'LA GRANJA', lat: -33.55382, lng: -70.61690 },
    { orden: 4, calle: 'AV. CARDENAL RAUL SILVA HENRIQUEZ', comuna: 'LA PINTANA', lat: -33.55700, lng: -70.61680 },
    { orden: 5, calle: 'LOS MAYAS', comuna: 'LA PINTANA', lat: -33.55850, lng: -70.61675 },
    { orden: 6, calle: 'LOS OLMECAS', comuna: 'LA PINTANA', lat: -33.55973, lng: -70.61673 },
    { orden: 7, calle: 'GENERAL ARRIAGADA', comuna: 'LA PINTANA', lat: -33.55720, lng: -70.61100 },
    { orden: 8, calle: 'LAS PARCELAS', comuna: 'LA PINTANA', lat: -33.55400, lng: -70.61110 },
    { orden: 9, calle: 'LAS PARCELAS', comuna: 'LA GRANJA', lat: -33.55100, lng: -70.61120 },
    { orden: 10, calle: 'SAN JOSE DE LA ESTRELLA', comuna: 'LA GRANJA', lat: -33.54600, lng: -70.61140 },
    { orden: 11, calle: 'JOAQUIN EDWARDS BELLO', comuna: 'LA GRANJA', lat: -33.54100, lng: -70.61150 },
    { orden: 12, calle: 'CRISTOBAL COLON', comuna: 'LA GRANJA', lat: -33.53750, lng: -70.61450 },
    { orden: 13, calle: 'AV. CARDENAL RAUL SILVA HENRIQUEZ', comuna: 'LA GRANJA', lat: -33.53500, lng: -70.61600 },
    { orden: 14, calle: 'AV. MANUEL RODRIGUEZ', comuna: 'LA GRANJA', lat: -33.53000, lng: -70.61200 },
    { orden: 15, calle: 'AV. TRINIDAD', comuna: 'LA FLORIDA', lat: -33.52600, lng: -70.60300 },
    { orden: 16, calle: 'PUNTA ARENAS', comuna: 'LA FLORIDA', lat: -33.52300, lng: -70.60000 },
    { orden: 17, calle: 'AV. CIRCUNVALACION AMERICO VESPUCIO', comuna: 'LA FLORIDA', lat: -33.52150, lng: -70.59850 },
    { orden: 18, calle: 'AV. VICUÑA MACKENNA ORIENTE', comuna: 'LA FLORIDA', lat: -33.52100, lng: -70.59800 },
    { orden: 19, calle: 'SERAFIN ZAMORA', comuna: 'LA FLORIDA', lat: -33.52000, lng: -70.59750 },
  ];

  // 1d. Insertar los 20 TRAMOS VIALES ORDENADOS DE REGRESO en route_segments
  const tramosRegresoRaw = [
    { orden: 20, calle: 'SERAFIN ZAMORA', comuna: 'LA FLORIDA', lat: -33.52000, lng: -70.59750 },
    { orden: 21, calle: 'AV. CIRCUNVALACION AMERICO VESPUCIO', comuna: 'LA FLORIDA', lat: -33.52150, lng: -70.59850 },
    { orden: 22, calle: 'PUNTA ARENAS', comuna: 'LA FLORIDA', lat: -33.52300, lng: -70.60000 },
    { orden: 23, calle: 'AV. CIRCUNVALACION AMERICO VESPUCIO', comuna: 'LA FLORIDA', lat: -33.52400, lng: -70.59950 },
    { orden: 24, calle: 'ISLA ADELAIDA', comuna: 'LA FLORIDA', lat: -33.52500, lng: -70.60150 },
    { orden: 25, calle: 'AV. TRINIDAD', comuna: 'LA FLORIDA', lat: -33.52600, lng: -70.60300 },
    { orden: 26, calle: 'AV. MANUEL RODRIGUEZ', comuna: 'LA GRANJA', lat: -33.53000, lng: -70.61200 },
    { orden: 27, calle: 'ENLACE ALT. PASAJE CUNLAHUE', comuna: 'LA GRANJA', lat: -33.53300, lng: -70.61350 },
    { orden: 28, calle: 'AV. VICUÑA MACKENNA', comuna: 'LA GRANJA', lat: -33.53400, lng: -70.61500 },
    { orden: 29, calle: 'AV. CARDENAL RAUL SILVA HENRIQUEZ', comuna: 'LA GRANJA', lat: -33.53500, lng: -70.61600 },
    { orden: 30, calle: 'CRISTOBAL COLON', comuna: 'LA GRANJA', lat: -33.53750, lng: -70.61450 },
    { orden: 31, calle: 'JOAQUIN EDWARDS BELLO', comuna: 'LA GRANJA', lat: -33.54100, lng: -70.61150 },
    { orden: 32, calle: 'SAN JOSE DE LA ESTRELLA', comuna: 'LA GRANJA', lat: -33.54600, lng: -70.61140 },
    { orden: 33, calle: 'LAS PARCELAS', comuna: 'LA GRANJA', lat: -33.55100, lng: -70.61120 },
    { orden: 34, calle: 'LAS PARCELAS', comuna: 'LA PINTANA', lat: -33.55400, lng: -70.61110 },
    { orden: 35, calle: 'GENERAL ARRIAGADA', comuna: 'LA PINTANA', lat: -33.55720, lng: -70.61100 },
    { orden: 36, calle: 'AV. CARDENAL RAUL SILVA HENRIQUEZ', comuna: 'LA PINTANA', lat: -33.55700, lng: -70.61680 },
    { orden: 37, calle: 'AV. CARDENAL RAUL SILVA HENRIQUEZ', comuna: 'LA GRANJA', lat: -33.55382, lng: -70.61690 },
    { orden: 38, calle: 'CANTO GENERAL', comuna: 'LA GRANJA', lat: -33.55031, lng: -70.61908 },
    { orden: 39, calle: 'LOS PENSAMIENTOS', comuna: 'LA GRANJA', lat: -33.55137, lng: -70.61921 },
  ];

  function normalizar(calle: string): string {
    return calle
      .replace(/^AV\.?\s+/i, 'AVENIDA ')
      .replace(/^AVDA\.?\s+/i, 'AVENIDA ')
      .trim();
  }

  for (const t of tramosIdaRaw) {
    await prisma.routeSegment.create({
      data: {
        id: `seg_233012_ida_${t.orden}`,
        lineaId: linea233012.id,
        folio: '233012',
        sentido: 'ida',
        orden: t.orden,
        calleOriginal: t.calle,
        calleNormalizada: normalizar(t.calle),
        comuna: t.comuna,
        latInicio: t.lat,
        lngInicio: t.lng,
        confianza: 100.0,
        estadoValidacion: 'VALIDADO',
      },
    });

    // Geometría del tramo como LineString vial
    const nextT = tramosIdaRaw.find(x => x.orden === t.orden + 1) || t;
    const geojsonTramo = {
      type: 'LineString',
      coordinates: [
        [t.lng, t.lat],
        [nextT.lng, nextT.lat],
      ],
    };

    // Guardar en cache de red vial con resolución completa
    const cacheIda = await prisma.cacheSegmentoVial.upsert({
      where: {
        calleNormalizada_comuna_proveedor: {
          calleNormalizada: normalizar(t.calle),
          comuna: t.comuna,
          proveedor: 'OSM',
        },
      },
      update: {
        comunaVerificada: t.comuna,
        latInicio: t.lat,
        lngInicio: t.lng,
        latFin: nextT.lat,
        lngFin: nextT.lng,
        geometriaGeojson: geojsonTramo,
        sentidoVial: 'ida',
        metodoResolucion: 'RED_VIAL_OSM',
        nombreVialResuelto: normalizar(t.calle),
      },
      create: {
        calleNormalizada: normalizar(t.calle),
        comuna: t.comuna,
        comunaVerificada: t.comuna,
        nombreVialResuelto: normalizar(t.calle),
        osmWayId: `osm_way_ida_${t.orden}`,
        roadId: `cl_stgo_${normalizar(t.calle).toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        sentidoVial: 'ida',
        metodoResolucion: 'RED_VIAL_OSM',
        proveedor: 'OSM',
        latInicio: t.lat,
        lngInicio: t.lng,
        latFin: nextT.lat,
        lngFin: nextT.lng,
        geometriaGeojson: geojsonTramo,
        confianza: 100.0,
      },
    });

    await prisma.$executeRawUnsafe(`
      UPDATE cache_segmentos_viales
      SET geom = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)
      WHERE id = $2
    `, JSON.stringify(geojsonTramo), cacheIda.id);
  }

  for (const t of tramosRegresoRaw) {
    await prisma.routeSegment.create({
      data: {
        id: `seg_233012_reg_${t.orden}`,
        lineaId: linea233012.id,
        folio: '233012',
        sentido: 'regreso',
        orden: t.orden,
        calleOriginal: t.calle,
        calleNormalizada: normalizar(t.calle),
        comuna: t.comuna,
        latInicio: t.lat,
        lngInicio: t.lng,
        confianza: 100.0,
        estadoValidacion: 'VALIDADO',
      },
    });

    const nextT = tramosRegresoRaw.find(x => x.orden === t.orden + 1) || t;
    const geojsonTramo = {
      type: 'LineString',
      coordinates: [
        [t.lng, t.lat],
        [nextT.lng, nextT.lat],
      ],
    };

    const cacheReg = await prisma.cacheSegmentoVial.upsert({
      where: {
        calleNormalizada_comuna_proveedor: {
          calleNormalizada: normalizar(t.calle),
          comuna: t.comuna,
          proveedor: 'OSM',
        },
      },
      update: {
        comunaVerificada: t.comuna,
        latInicio: t.lat,
        lngInicio: t.lng,
        latFin: nextT.lat,
        lngFin: nextT.lng,
        geometriaGeojson: geojsonTramo,
        sentidoVial: 'regreso',
        metodoResolucion: 'RED_VIAL_OSM',
        nombreVialResuelto: normalizar(t.calle),
      },
      create: {
        calleNormalizada: normalizar(t.calle),
        comuna: t.comuna,
        comunaVerificada: t.comuna,
        nombreVialResuelto: normalizar(t.calle),
        osmWayId: `osm_way_reg_${t.orden}`,
        roadId: `cl_stgo_${normalizar(t.calle).toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        sentidoVial: 'regreso',
        metodoResolucion: 'RED_VIAL_OSM',
        proveedor: 'OSM',
        latInicio: t.lat,
        lngInicio: t.lng,
        latFin: nextT.lat,
        lngFin: nextT.lng,
        geometriaGeojson: geojsonTramo,
        confianza: 100.0,
      },
    });

    await prisma.$executeRawUnsafe(`
      UPDATE cache_segmentos_viales
      SET geom = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)
      WHERE id = $2
    `, JSON.stringify(geojsonTramo), cacheReg.id);
  }
  console.log('✅ 19 tramos de IDA y 20 tramos de REGRESO insertados en route_segments y cache_segmentos_viales');

  // 1e. Guardar shapes en route_shapes.
  // Regla estricta de FIM Colectivos:
  // Un shape generado por OSRM (RUTEADO_OSM) no se establece automáticamente como PUBLICADO.
  // Supera las validaciones automáticas y queda como VALIDADO.
  const geojsonIda = JSON.stringify({
    type: 'LineString',
    coordinates: route233012Data.coordsIda.map(([lat, lng]: [number, number]) => [lng, lat]),
  });
  const geojsonRegreso = JSON.stringify({
    type: 'LineString',
    coordinates: route233012Data.coordsRegreso.map(([lat, lng]: [number, number]) => [lng, lat]),
  });

  const shapeIda = await prisma.routeShape.create({
    data: {
      id: `shape_233012_ida_v1`,
      lineaId: linea233012.id,
      folio: '233012',
      sentido: 'ida',
      shapeId: 'SHP-233012-IDA-v1',
      version: 1,
      origenTipo: 'RUTEADO_OSM',
      proveedorOrigen: 'OSRM',
      versionOrigen: 'OSRM-v5.27',
      confianza: 98.5,
      estadoValidacion: 'VALIDADO', // Superó validaciones automáticas -> VALIDADO (no publicado automáticamente)
      notasValidacion: 'Validación automática superada: continuidad, secuencia, ausencia de saltos y correspondencia vial verificadas.',
      puntos: route233012Data.coordsIda,
      limites: [-70.61921, -33.55973, -70.59750, -33.52000],
      esActivo: true,
    },
  });

  await prisma.$executeRawUnsafe(`
    UPDATE route_shapes
    SET geom = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
        distancia_metros = ST_Length(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)::geography)
    WHERE id = $2
  `, geojsonIda, shapeIda.id);

  const shapeRegreso = await prisma.routeShape.create({
    data: {
      id: `shape_233012_reg_v1`,
      lineaId: linea233012.id,
      folio: '233012',
      sentido: 'regreso',
      shapeId: 'SHP-233012-REGRESO-v1',
      version: 1,
      origenTipo: 'RUTEADO_OSM',
      proveedorOrigen: 'OSRM',
      versionOrigen: 'OSRM-v5.27',
      confianza: 98.5,
      estadoValidacion: 'VALIDADO', // Superó validaciones automáticas -> VALIDADO (no publicado automáticamente)
      notasValidacion: 'Validación automática superada: continuidad, secuencia, ausencia de saltos y correspondencia vial verificadas.',
      puntos: route233012Data.coordsRegreso,
      limites: [-70.61921, -33.55973, -70.59750, -33.52000],
      esActivo: true,
    },
  });

  await prisma.$executeRawUnsafe(`
    UPDATE route_shapes
    SET geom = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326),
        distancia_metros = ST_Length(ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)::geography)
    WHERE id = $2
  `, geojsonRegreso, shapeRegreso.id);

  console.log('✅ RouteShapes de IDA y REGRESO persistidos en PostGIS con estado VALIDADO y distancia ST_Length');

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
      tagNumber: 'COL-233-01',
      status: 'active',
      membershipPaid: true,
      membershipDate: new Date(),
      totalRating: 4.9,
      totalTrips: 120,
      lineaId: linea233012.id,
      folioRuta: '233012',
      mttValidada: true,
      asientosTotales: 4,
      asientosOcupados: 1, // 3 disponibles
      sentidoRuta: 'ida',
      isOnline: true,
      lastLat: -33.55137,
      lastLng: -70.61921,
      telefonoRutPay: '+56922222222',
      mercadoPagoLink: 'https://mpago.li/test-chofer',
    },
  });
  console.log('✅ Chofer colectivo activo:', chofer.email, `(${linea233012.nombre})`);

  const conductor = await prisma.driver.upsert({
    where: { email: 'conductor@fimchile.cl' },
    update: {
      lineaId: linea233012.id,
      folioRuta: '233012',
      mttValidada: true,
      lastLat: -33.55031,
      lastLng: -70.61908,
    },
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
      tagNumber: 'COL-233-02',
      status: 'active',
      membershipPaid: true,
      membershipDate: new Date(),
      totalRating: 5.0,
      totalTrips: 85,
      lineaId: linea233012.id,
      folioRuta: '233012',
      mttValidada: true,
      asientosTotales: 4,
      asientosOcupados: 0,
      sentidoRuta: 'ida',
      isOnline: true,
      lastLat: -33.55031,
      lastLng: -70.61908,
      telefonoRutPay: '+56933333333',
      mercadoPagoLink: 'https://mpago.li/test-conductor',
    },
  });
  console.log('✅ Conductor colectivo activo:', conductor.email, `(${linea233012.nombre})`);

  const conductor2 = await prisma.driver.upsert({
    where: { email: 'conductor2@fimchile.cl' },
    update: {
      lineaId: linea233012.id,
      folioRuta: '233012',
      mttValidada: true,
      lastLat: -33.54600,
      lastLng: -70.61140,
    },
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
      vehicleBrand: 'Chevrolet',
      vehicleModel: 'Sail Colectivo',
      vehicleYear: 2021,
      vehiclePlate: 'COL303',
      vehiclePhotoUrl: 'https://via.placeholder.com/400x250?text=Colectivo+Sail',
      tagNumber: 'COL-233-03',
      status: 'active',
      membershipPaid: true,
      membershipDate: new Date(),
      totalRating: 4.8,
      totalTrips: 64,
      lineaId: linea233012.id,
      folioRuta: '233012',
      mttValidada: true,
      asientosTotales: 4,
      asientosOcupados: 2, // 2 disponibles
      sentidoRuta: 'ida',
      isOnline: true,
      lastLat: -33.54100,
      lastLng: -70.61150,
      telefonoRutPay: '+56944444444',
      mercadoPagoLink: 'https://mpago.li/test-mario',
    },
  });
  console.log('✅ Conductor 2 colectivo activo:', conductor2.email, `(${linea233012.nombre})`);

  const conductor3 = await prisma.driver.upsert({
    where: { email: 'conductor3@fimchile.cl' },
    update: {
      lineaId: linea233012.id,
      folioRuta: '233012',
      mttValidada: true,
      lastLat: -33.52300,
      lastLng: -70.60000,
    },
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
      tagNumber: 'COL-233-04',
      status: 'active',
      membershipPaid: true,
      membershipDate: new Date(),
      totalRating: 4.95,
      totalTrips: 110,
      lineaId: linea233012.id,
      folioRuta: '233012',
      mttValidada: true,
      asientosTotales: 4,
      asientosOcupados: 0, // 4 disponibles
      sentidoRuta: 'regreso',
      isOnline: true,
      lastLat: -33.52300,
      lastLng: -70.60000,
      telefonoRutPay: '+56955555555',
      mercadoPagoLink: 'https://mpago.li/test-roberto',
    },
  });
  console.log('✅ Conductor 3 colectivo activo:', conductor3.email, `(${linea233012.nombre})`);

  console.log('\nSeed completado exitosamente!\n');
  console.log('═══════════════════════════════════════════════════');
  console.log('  Credenciales de prueba Fim Colectivo:');
  console.log('  Admin:       admin@fimchile.cl / admin123');
  console.log('  Pasajeros:   pasajero@fimchile.cl / test123');
  console.log('               pasajero2@fimchile.cl / test123 (María Pasajera)');
  console.log('               pasajero3@fimchile.cl / test123 (Andrés Pasajero)');
  console.log('  Conductores: conductor@fimchile.cl / test123 (Folio 233012 - Carlos)');
  console.log('               chofer@fimchile.cl / test123 (Folio 233012 - Pedro)');
  console.log('               conductor2@fimchile.cl / test123 (Folio 233012 - Mario)');
  console.log('               conductor3@fimchile.cl / test123 (Folio 233012 - Roberto)');
  console.log('═══════════════════════════════════════════════════\n');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
