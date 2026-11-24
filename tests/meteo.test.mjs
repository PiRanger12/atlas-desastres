// Pruebas del cliente de Open-Meteo (js/meteo.js)
import {test,describe} from 'node:test';
import assert from 'node:assert/strict';
import {cargarScript,fetchFalso,almacen,plano} from './helpers.mjs';

const VARS=['temperature_2m_max','temperature_2m_min','precipitation_sum','wind_speed_10m_max','wind_gusts_10m_max'];

// Respuesta falsa con el mismo formato que /v1/archive
function respuesta(url){
  const q=new URL(url).searchParams,dias=[];
  for(let d=new Date(q.get('start_date')+'T00:00:00Z');d<=new Date(q.get('end_date')+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+1))
    dias.push(d.toISOString().slice(0,10));
  const serie=base=>dias.map((_,i)=>base+i);
  return {status:200,body:{latitude:30,longitude:-90,elevation:21,daily:{time:dias,
    temperature_2m_max:serie(30),temperature_2m_min:serie(20),precipitation_sum:serie(0),
    wind_speed_10m_max:serie(10),wind_gusts_10m_max:serie(40)}}};
}
const katrina={fecha:'2005-08-29',lat:29.95,lon:-90.07};

describe('METEO.disponible',()=>{
  const {METEO}=cargarScript('js/meteo.js');
  test('acepta eventos con fecha desde 1940',()=>{
    assert.equal(METEO.disponible(katrina),true);
    assert.equal(METEO.disponible({fecha:'1940-01-01'}),true);
  });
  test('rechaza eventos sin fecha o anteriores a 1940',()=>{
    assert.equal(METEO.disponible({fecha:'1939-12-31'}),false);
    assert.equal(METEO.disponible({}),false);
    assert.equal(METEO.disponible({fecha:''}),false);
  });
});

describe('METEO.ventana',()=>{
  const {METEO}=cargarScript('js/meteo.js');
  test('evento de un día: 7 días antes y 3 después, cruzando de mes',()=>{
    assert.deepEqual(plano(METEO.ventana(katrina)),['2005-08-22','2005-09-01']);
  });
  test('respeta los años bisiestos',()=>{
    assert.deepEqual(plano(METEO.ventana({fecha:'1960-02-29'})),['1960-02-22','1960-03-03']);
  });
  test('evento con fecha_fin: 3 días de margen a cada lado, cruzando de año',()=>{
    assert.deepEqual(plano(METEO.ventana({fecha:'2019-12-20',fecha_fin:'2020-01-10'})),['2019-12-17','2020-01-13']);
  });
});

describe('METEO.diario',()=>{
  test('arma la URL de /v1/archive con los parámetros correctos',async()=>{
    const fetch=fetchFalso(respuesta);
    const {METEO}=cargarScript('js/meteo.js',{fetch});
    await METEO.diario(katrina);
    assert.equal(fetch.llamadas.length,1);
    const u=new URL(fetch.llamadas[0]);
    assert.equal(u.origin+u.pathname,'https://archive-api.open-meteo.com/v1/archive');
    assert.equal(u.searchParams.get('latitude'),'29.95');
    assert.equal(u.searchParams.get('longitude'),'-90.07');
    assert.equal(u.searchParams.get('start_date'),'2005-08-22');
    assert.equal(u.searchParams.get('end_date'),'2005-09-01');
    assert.deepEqual(u.searchParams.get('daily').split(','),VARS);
    assert.equal(u.searchParams.get('models'),'era5');
    assert.equal(u.searchParams.get('timezone'),'auto');
  });

  test('convierte las series diarias en una lista de días',async()=>{
    const {METEO}=cargarScript('js/meteo.js',{fetch:fetchFalso(respuesta)});
    const r=plano(await METEO.diario(katrina));
    assert.equal(r.lat,30);assert.equal(r.lon,-90);assert.equal(r.elev,21);
    assert.equal(r.dias.length,11);
    assert.deepEqual(r.dias[0],{fecha:'2005-08-22',tmax:30,tmin:20,lluvia:0,viento:10,rafaga:40});
    assert.deepEqual(r.dias[7],{fecha:'2005-08-29',tmax:37,tmin:27,lluvia:7,viento:17,rafaga:47});
  });

  test('conserva los valores nulos de la API',async()=>{
    const fetch=fetchFalso(url=>{const r=respuesta(url);r.body.daily.precipitation_sum[0]=null;return r});
    const {METEO}=cargarScript('js/meteo.js',{fetch});
    const r=await METEO.diario(katrina);
    assert.equal(r.dias[0].lluvia,null);
  });

  test('dos llamadas simultáneas comparten una sola petición',async()=>{
    const fetch=fetchFalso(respuesta);
    const {METEO}=cargarScript('js/meteo.js',{fetch});
    await Promise.all([METEO.diario(katrina),METEO.diario(katrina)]);
    assert.equal(fetch.llamadas.length,1);
  });

  test('usa sessionStorage como caché entre recargas de la página',async()=>{
    const ss=almacen(),fetch=fetchFalso(respuesta);
    await cargarScript('js/meteo.js',{fetch,sessionStorage:ss}).METEO.diario(katrina);
    const r=await cargarScript('js/meteo.js',{fetch,sessionStorage:ss}).METEO.diario(katrina);
    assert.equal(fetch.llamadas.length,1);
    assert.equal(r.dias.length,11);
  });

  test('funciona aunque sessionStorage no esté disponible',async()=>{
    const roto={getItem(){throw new Error('bloqueado')},setItem(){throw new Error('bloqueado')}};
    const {METEO}=cargarScript('js/meteo.js',{fetch:fetchFalso(respuesta),sessionStorage:roto});
    const r=await METEO.diario(katrina);
    assert.equal(r.dias.length,11);
  });

  test('un error HTTP rechaza la promesa, no se guarda y se puede reintentar',async()=>{
    let n=0;
    const fetch=fetchFalso(url=>++n===1?{status:429,body:{}}:respuesta(url));
    const ss=almacen();
    const {METEO}=cargarScript('js/meteo.js',{fetch,sessionStorage:ss});
    await assert.rejects(METEO.diario(katrina),/429/);
    assert.equal(ss.size,0);
    const r=await METEO.diario(katrina);
    assert.equal(r.dias.length,11);
    assert.equal(fetch.llamadas.length,2);
  });
});
