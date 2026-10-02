// Ejecutar con Next dev en localhost:3010 y NEXT_PUBLIC_API_URL=http://127.0.0.1:4011.
// Usa respuestas de API controladas; nunca conecta con el servidor de producción.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve(__dirname, '../test-results');
fs.mkdirSync(output, { recursive: true });

async function scenario(browser, method) {
  let reserva = null;
  let occupied = 0;
  let failStop = true;
  let detailChecks = 0;
  let failDetail = false;
  const posts = [];
  const errors = [];
  const linea = { id:'l', nombre:'Línea de prueba', codigo:'233', color:'#FACC15', paradas:[] };
  const driver = { id:'d', name:'Carlos', phone:'900000000', vehiclePlate:'AA0001', vehicleBrand:'Test', vehicleModel:'Auto', asientosTotales:4,
    lastLat:-33.45, lastLng:-70.66, isOnline:true, status:'active', lineaId:'l', sentidoRuta:'ida' };
  const active = () => reserva && !['completado','cancelado'].includes(reserva.estado) ? [reserva] : [];
  const contexts = [];
  async function pageFor(role) {
    const context = await browser.newContext({ viewport:{width:412,height:915}, geolocation:{latitude:-33.45,longitude:-70.66}, permissions:['geolocation'] });
    contexts.push(context);
    await context.addInitScript(({role,driver}) => {
      const user = role === 'driver' ? {...driver, role} : {id:'p', name:'Ana', role};
      localStorage.setItem('fim_colectivo_token','test-only');
      localStorage.setItem('fim_colectivo_user',JSON.stringify(user));
      window.__spoken = [];
      window.Audio = class {
        src=''; onended=null; onerror=null; timer=null;
        play() { try { window.__spoken.push(new URL(this.src).searchParams.get('texto')); } catch {}
          this.timer=setTimeout(()=>this.onended?.(),30); return Promise.resolve(); }
        pause() { clearTimeout(this.timer); }
        load() {}
      };
      window.SpeechRecognition = class {
        active=false;
        start() { this.active=true; window.__recognizer=this; setTimeout(()=>this.onstart?.(),0); }
        abort() { this.active=false; }
        stop() { this.abort(); }
      };
      window.__say = text => {
        const rec=window.__recognizer;
        if (!rec?.active) throw Error('No active speech listener');
        const result=Object.assign([{transcript:text}],{isFinal:true});
        rec.onresult?.({resultIndex:0,results:[result]});
      };
    },{role,driver});
    await context.route('**/socket.io/**',route=>route.abort());
    await context.route('**/*.tile.openstreetmap.org/**',route=>route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')}));
    await context.route('**/api/**',async route=>{
      const req=route.request(), url=new URL(req.url()), endpoint=url.pathname;
      let body={}, status=200;
      if (req.method()==='OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'}});
      if (req.method()==='GET') {
        if (endpoint.endsWith('/lineas')) body={lineas:[linea]};
        else if (endpoint.endsWith('/lineas/l')) body={linea:{...linea,conductores:[{...driver,asientosOcupados:occupied}]}};
        // Reproduce la omisión del viaje en la lista después de aceptar el método.
        else if (endpoint.endsWith('/mis-reservas')) body={reservas:reserva?.estado==='pagado' ? [] : active()};
        else if (endpoint.endsWith('/reservas/r/estado')) {
          detailChecks++;
          if(failDetail) { status=503; body={error:'Estado temporalmente no disponible'}; }
          else body={reserva};
        }
        else if (endpoint.endsWith('/conductor/estado')) body={chofer:{...driver,asientosOcupados:occupied,linea,reservasAsiento:active()}};
        else body={};
      } else {
        posts.push(endpoint);
        const data=req.postDataJSON() || {};
        if (endpoint.endsWith('/reservar')) {
          assert.equal(data.conductorId,'d'); assert.equal(data.latitudSubida,-33.45);
          reserva={id:'r',pasajeroId:'p',conductorId:'d',lineaId:'l',linea,conductor:driver,pasajero:{id:'p',name:'Ana',phone:'900000001'},cantidadAsientos:1,estado:'pendiente_chofer',metodoPago:'none',latitudSubida:-33.45,longitudSubida:-70.66};
        } else if(endpoint.endsWith('/responder')) { assert.equal(data.accion,'aceptar'); reserva.estado='reservado'; occupied=1; }
        else if(endpoint.endsWith('/abordar')) { reserva.estado='abordado'; }
        else if(endpoint.endsWith('/solicitar-pago')) { assert.equal(data.metodoPago,method); reserva.metodoPago=data.metodoPago; reserva.estado='pagando'; }
        else if(endpoint.endsWith('/confirmar-pago')) { reserva.estado='pagado'; }
        else if(endpoint.endsWith('/solicitar-parada')) {
          if(failStop) { failStop=false; status=500; body={error:'Fallo de red simulado. Reintenta.'}; }
          else { reserva.estado='parada_solicitada'; occupied=0; }
        } else if(endpoint.endsWith('/liberar-asiento')) { reserva.estado='completado'; }
        if(status===200) body={ok:true,reserva,chofer:{...driver,asientosOcupados:occupied},asientosOcupados:occupied};
      }
      await route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});
    });
    const page=await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://localhost:3010/'+role+'/',{waitUntil:'domcontentloaded',timeout:120000});
    return page;
  }
  const passenger=await pageFor('passenger');
  const conductor=await pageFor('driver');
  async function say(text) {
    await conductor.waitForFunction(()=>window.__recognizer?.active,{},{timeout:15000});
    await conductor.waitForTimeout(1700);
    await conductor.evaluate(t=>window.__say(t),text);
  }
  try {
    await passenger.getByText('AA0001',{exact:true}).first().click({timeout:60000});
    await passenger.getByRole('button',{name:/reservar.*asiento/i}).click();
    await conductor.getByRole('button',{name:/SÍ.*TOMAR/}).waitFor({timeout:20000});
    // Android termina una sesión después de un silencio: el gestor debe reabrirla.
    await conductor.waitForFunction(()=>window.__recognizer?.active);
    await conductor.evaluate(()=>{
      window.__previousRecognizer=window.__recognizer;
      window.__recognizer.active=false;
      window.__recognizer.onerror?.({error:'no-speech'});
      window.__recognizer.onend?.();
    });
    await conductor.waitForFunction(()=>window.__recognizer?.active && window.__recognizer!==window.__previousRecognizer);
    await say('Sí');
    await passenger.getByText('Asiento Reservado',{exact:true}).waitFor({timeout:20000});
    assert.equal(occupied,1);
    await say('A bordo');
    await passenger.locator('#btn-pagar-efectivo').waitFor({timeout:15000});
    assert.equal(await passenger.locator('#btn-pagar-rutpay').count(),1);
    await passenger.screenshot({path:path.join(output,'metodos-'+method+'.png')});
    await passenger.locator(method==='rutpay'?'#btn-pagar-rutpay':'#btn-pagar-efectivo').click();
    await passenger.reload();
    await passenger.getByText(/Esperando al conductor/).waitFor({timeout:15000});
    await conductor.getByRole('dialog',{name:'Método indicado por el pasajero'}).waitFor({timeout:15000});
    await conductor.screenshot({path:path.join(output,'aviso-'+method+'.png')});
    await say('Sí');
    await passenger.locator('#btn-solicitar-parada').waitFor({timeout:15000});
    assert.ok(detailChecks > 0);
    assert.equal(occupied,1);
    await passenger.reload();
    await passenger.locator('#btn-solicitar-parada').waitFor({timeout:15000});
    failDetail = true;
    const before = detailChecks;
    await passenger.waitForTimeout(6500);
    assert.ok(detailChecks > before);
    assert.equal(await passenger.locator('#btn-solicitar-parada').isVisible(),true);
    assert.equal(occupied,1);
    failDetail = false;
    assert.equal(await passenger.getByText('Carlos (AA0001)',{exact:true}).count(),0);
    assert.equal(await passenger.locator('#btn-pagar-efectivo').count(),0);
    await passenger.screenshot({path:path.join(output,'viaje-'+method+'.png')});
    await passenger.locator('#btn-solicitar-parada').click();
    await passenger.getByRole('alert').filter({hasText:'Fallo de red simulado'}).waitFor();
    assert.equal(occupied,1);
    assert.equal(await passenger.locator('#btn-solicitar-parada').isEnabled(),true);
    await passenger.locator('#btn-solicitar-parada').click();
    await passenger.getByRole('button',{name:'PARADA SOLICITADA',exact:true}).waitFor();
    assert.equal(occupied,0);
    await conductor.getByRole('button',{name:'PASAJERO DESCENDIÓ',exact:true}).waitFor({timeout:15000});
    assert.ok((await conductor.evaluate(()=>window.__spoken)).includes('Deja a Ana en la siguiente parada.'));
    await passenger.reload();
    await passenger.getByRole('button',{name:'PARADA SOLICITADA',exact:true}).waitFor();
    await conductor.getByRole('button',{name:'PASAJERO DESCENDIÓ',exact:true}).click();
    assert.equal(occupied,0);
    await passenger.locator('#btn-solicitar-parada').waitFor({state:'detached',timeout:15000});
    assert.equal(posts.filter(x=>x.endsWith('/confirmar-pago')).length,1);
    assert.deepEqual(errors,[]);
    console.log('PASS flujo UI, voz simulada, reconexión y reintento: '+method);
  } catch(error) {
    await passenger.screenshot({path:path.join(output,'failure-passenger.png')});
    await conductor.screenshot({path:path.join(output,'failure-driver.png')});
    console.error('Estado:',reserva?.estado,'POST:',posts,'Errores:',errors);
    throw error;
  } finally { for(const context of contexts) await context.close(); }
}

(async()=>{
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || 'msedge',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try { for(const method of ['efectivo','rutpay']) await scenario(browser,method); }
  finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
