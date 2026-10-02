const test = require('node:test');
const assert = require('node:assert/strict');
const { recordDriverLocation, expireDriverLocations } = require('../dist/utils/driverTracking');

function fixture(now) {
  const state = { id:'d', lineaId:'l', status:'active', isOnline:true, lastSeen:new Date(now), lastLat:0, lastLng:0 };
  let beforeExpiry;
  const matches = where => (!where.id || where.id===state.id) && state.isOnline===where.isOnline &&
    (!where.status || where.status===state.status) &&
    (!where.OR || !state.lastSeen || state.lastSeen < where.OR[0].lastSeen.lt);
  const db = { driver: {
    async updateMany({where,data}) { if(!matches(where)) return {count:0}; Object.assign(state,data); return {count:1}; },
    async findUniqueOrThrow() { return {...state}; },
    async findMany({where}) { const result=matches(where) ? [{id:'d',lineaId:'l'}] : []; beforeExpiry?.(); return result; },
  } };
  return { db, state, race(fn) { beforeExpiry=fn; } };
}

test('el GPS nativo mantiene el turno sin depender del socket y vence al dejar de llegar', async () => {
  const now=Date.now(), f=fixture(now);
  // El WebView deja de enviar mensajes, pero el servicio nativo sigue activo.
  await recordDriverLocation(f.db,'d',-33.4,-70.6,now+80000,new Date(now+80000));
  assert.deepEqual(await expireDriverLocations(f.db,new Date(now+100000)),[]);
  assert.equal(f.state.isOnline,true);
  assert.deepEqual(await expireDriverLocations(f.db,new Date(now+171000)),[{id:'d',lineaId:'l'}]);
  assert.equal(f.state.isOnline,false);
  assert.deepEqual(await expireDriverLocations(f.db,new Date(now+172000)),[]);
});

test('un GPS retrasado no vuelve a conectar a quien terminó el turno', async () => {
  const now=Date.now(), f=fixture(now); f.state.isOnline=false;
  await assert.rejects(recordDriverLocation(f.db,'d',-33,-70,now,new Date(now)),e=>e.status===409);
  assert.equal(f.state.isOnline,false);
});

test('una ubicación que llega durante el vencimiento conserva el turno', async () => {
  const now=Date.now(), f=fixture(now-120000);
  f.race(()=>{f.state.lastSeen=new Date(now);});
  assert.deepEqual(await expireDriverLocations(f.db,new Date(now)),[]);
  assert.equal(f.state.isOnline,true);
});

test('rechaza ubicaciones antiguas o inválidas, admite coordenadas cero', async () => {
  const now=Date.now(), f=fixture(now);
  for (const [lat,lng,at] of [[NaN,0,now],[91,0,now],[0,181,now],[0,0,now-61000],[0,0,now+31000]]) {
    await assert.rejects(recordDriverLocation(f.db,'d',lat,lng,at,new Date(now)),e=>e.status===400);
  }
  await recordDriverLocation(f.db,'d',0,0,now,new Date(now));
  assert.equal(f.state.lastLat,0);
});
