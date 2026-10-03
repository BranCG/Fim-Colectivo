const test = require('node:test');
const assert = require('node:assert/strict');
const { transitionReservation, validatePickup, updateOccupiedSeats } = require('../dist/utils/reservationFlow');
const { withoutPaymentData } = require('../dist/utils/withoutPaymentData');

// Doble transaccional: representa conflictos de serialización P2034 de Prisma.
// No sustituye la prueba de despliegue contra PostgreSQL.
function database(seats = 4) {
  let revision = 0;
  let state = { driver: { id: 'd', lineaId: 'l', status: 'active', isOnline: true, asientosTotales: seats, asientosOcupados: 0 }, reservations: {} };
  const add = (id, passenger = id) => state.reservations[id] = {
    id, pasajeroId: passenger, conductorId: 'd', lineaId: 'l', cantidadAsientos: 1, estado: 'pendiente_chofer', metodoPago: 'none',
    pasajero: { id: passenger, name: passenger }, conductor: { id: 'd' }, linea: { id: 'l', tarifa: 800 },
  };
  const client = { async $transaction(fn, options) {
    assert.equal(options.isolationLevel, 'Serializable');
    const version = revision;
    const draft = structuredClone(state);
    let writes = false;
    const tx = {
      reservaAsiento: {
        findUnique: async ({ where }) => structuredClone(draft.reservations[where.id] || null),
        aggregate: async ({ where }) => ({ _sum: { cantidadAsientos: Object.values(draft.reservations)
          .filter(r => r.conductorId === where.conductorId && where.estado.in.includes(r.estado))
          .reduce((sum, r) => sum + r.cantidadAsientos, 0) } }),
        update: async ({ where, data }) => { writes = true; return Object.assign(draft.reservations[where.id], data); },
      },
      driver: {
        findUniqueOrThrow: async () => structuredClone(draft.driver),
        update: async ({ data }) => { writes = true; return Object.assign(draft.driver, data); },
      },
    };
    const result = await fn(tx);
    if (version !== revision) throw Object.assign(new Error('serialization conflict'), { code: 'P2034' });
    if (writes) { state = draft; revision++; }
    return result;
  } };
  const run = (id, action, method) => transitionReservation(client, {
    id, action, method, role: ['notify-method', 'request-stop'].includes(action) ? 'passenger' : 'driver',
    actorId: ['notify-method', 'request-stop'].includes(action) ? state.reservations[id].pasajeroId : 'd',
  });
  return { add, run, client, state: () => state };
}

for (const method of ['efectivo', 'rutpay']) test('recorrido completo con ' + method, async () => {
  const db = database(); db.add('Ana');
  await db.run('Ana', 'accept');
  assert.equal(db.state().driver.asientosOcupados, 1);
  await db.run('Ana', 'board');
  assert.equal(db.state().driver.asientosOcupados, 1);
  const aviso = await db.run('Ana', 'notify-method', method);
  assert.equal(aviso.reserva.metodoPago, method);
  assert.equal(aviso.reserva.estado, 'pagando');
  await db.run('Ana', 'acknowledge-method');
  assert.equal(db.state().driver.asientosOcupados, 1);
  await db.run('Ana', 'request-stop');
  assert.equal(db.state().driver.asientosOcupados, 0);
  assert.equal(db.state().reservations.Ana.estado, 'parada_solicitada');
  // Otro pasajero puede reservar antes de que el conductor cierre el descenso.
  db.add('Luis'); await db.run('Luis', 'accept');
  await db.run('Ana', 'complete');
  assert.equal(db.state().driver.asientosOcupados, 1);
});

test('dos aceptaciones simultáneas del último asiento no sobreocupan', async () => {
  const db = database(1); db.add('a'); db.add('b');
  const results = await Promise.allSettled([db.run('a', 'accept'), db.run('b', 'accept')]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(db.state().driver.asientosOcupados, 1);
  assert.equal(Object.values(db.state().reservations).filter(r => r.estado === 'reservado').length, 1);
});

test('reintentos simultáneos no duplican cupos ni cambios', async () => {
  const db = database(); db.add('a');
  for (const [action, method] of [['accept'], ['board'], ['notify-method', 'rutpay'], ['acknowledge-method'], ['request-stop'], ['complete']]) {
    const results = await Promise.all([db.run('a', action, method), db.run('a', action, method)]);
    assert.equal(results.filter(r => r.changed).length, 1, action);
  }
  assert.equal(db.state().driver.asientosOcupados, 0);
});

test('solicitar parada antes de aceptar el método no libera cupo', async () => {
  const db = database(); db.add('a'); await db.run('a','accept'); await db.run('a','board');
  await assert.rejects(db.run('a','request-stop'), e => e.status === 409);
  assert.equal(db.state().driver.asientosOcupados, 1);
});

test('reintento tardío de aceptación no devuelve una reserva a la fase anterior', async () => {
  const db = database(); db.add('a'); await db.run('a','accept'); await db.run('a','board');
  const result = await db.run('a','accept');
  assert.equal(result.reserva.estado, 'abordado'); assert.equal(result.changed, false);
});

test('nadie puede alterar la reserva de otro conductor o pasajero', async () => {
  const db = database(); db.add('a');
  await assert.rejects(transitionReservation(db.client, { id:'a', action:'accept', actorId:'otro', role:'driver' }), e=>e.status===403);
  await db.run('a','accept'); await db.run('a','board');
  await assert.rejects(transitionReservation(db.client, { id:'a', action:'notify-method', method:'rutpay', actorId:'otro', role:'passenger' }), e=>e.status===403);
});

test('cancelación repetida no resta el asiento de otro pasajero', async () => {
  const db = database(); db.add('a'); db.add('b');
  await db.run('a','accept'); await db.run('b','accept');
  await db.run('a','cancel'); await db.run('a','cancel');
  assert.equal(db.state().driver.asientosOcupados, 1);
  await assert.rejects(db.run('a','board'), e=>e.status===409);
});

test('solo efectivo y RutPay son opciones de aviso', async () => {
  const db = database(); db.add('a'); await db.run('a','accept'); await db.run('a','board');
  for (const method of ['mercadopago', undefined, '', 10]) await assert.rejects(db.run('a','notify-method',method), e=>e.status===400);
});

test('la API conserva el método comunicado y oculta importes y datos bancarios', () => {
  const date = new Date();
  assert.deepEqual(withoutPaymentData({ metodoPago:'rutpay', tarifa:800, createdAt:date, conductor:{ telefonoRutPay:'123', walletBalance:200, name:'Ana' } }), {
    metodoPago:'rutpay', createdAt:date, conductor:{ name:'Ana' },
  });
});

test('no reservar con ubicación ausente o cupos inválidos', () => {
  for (const args of [[undefined,-70,1],[-33,NaN,1],[-33,-70,0],[-33,-70,1.5],[91,-70,1]]) {
    assert.throws(()=>validatePickup(...args),e=>e.status===400);
  }
  assert.doesNotThrow(()=>validatePickup(-33.4,-70.6,1));
});

test('el contador manual no libera una reserva ni sobreocupa el vehículo', async () => {
  const db = database(); db.add('a'); await db.run('a', 'accept');
  for (const value of [0, 5]) await assert.rejects(updateOccupiedSeats(db.client, 'd', value), e => e.status === 409);
  await assert.rejects(updateOccupiedSeats(db.client, 'd', 1.5), e => e.status === 400);
  await updateOccupiedSeats(db.client, 'd', 2);
  await db.run('a', 'board'); await db.run('a', 'notify-method', 'efectivo');
  await db.run('a', 'acknowledge-method'); await db.run('a', 'request-stop');
  assert.equal(db.state().driver.asientosOcupados, 1);
  await updateOccupiedSeats(db.client, 'd', 0);
  assert.equal(db.state().driver.asientosOcupados, 0);
});
