// Pruebas del cliente de la API Hazel de NOAA/NCEI (js/noaa.js)
import {test,describe} from 'node:test';
import assert from 'node:assert/strict';
import {cargarScript,fetchFalso,almacen,plano} from './helpers.mjs';

const BASE='https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1/tsunamis';

// 3 páginas de mareogramas; uno sin coordenadas para comprobar el filtro
function paginas(url){
  const u=new URL(url),p=+u.searchParams.get('page');
  const items=[{id:p*10+1,latitude:p,longitude:p},{id:p*10+2,latitude:p,longitude:p}];
  if(p===2)items.push({id:99,latitude:null,longitude:5});
  return {status:200,body:{totalPages:3,page:p,items}};
}

describe('NOAA.marigrams',()=>{
  test('descarga todas las páginas de 200 en 200',async()=>{
    const fetch=fetchFalso(paginas);
    const {NOAA}=cargarScript('js/noaa.js',{fetch});
    await NOAA.marigrams();
    const pags=fetch.llamadas.map(u=>new URL(u)).map(u=>{
      assert.equal(u.origin+u.pathname,BASE+'/marigrams');
      assert.equal(u.searchParams.get('itemsPerPage'),'200');
      return +u.searchParams.get('page')});
    assert.deepEqual(pags.sort(),[1,2,3]);
  });

  test('junta las páginas y descarta los mareogramas sin coordenadas',async()=>{
    const {NOAA}=cargarScript('js/noaa.js',{fetch:fetchFalso(paginas)});
    const ids=plano(await NOAA.marigrams()).map(m=>m.id);
    assert.deepEqual(ids,[11,12,21,22,31,32]);
  });

  test('una sola página no hace peticiones extra',async()=>{
    const fetch=fetchFalso(()=>({status:200,body:{totalPages:1,items:[{id:1,latitude:0,longitude:0}]}}));
    const {NOAA}=cargarScript('js/noaa.js',{fetch});
    assert.equal((await NOAA.marigrams()).length,1);
    assert.equal(fetch.llamadas.length,1);
  });

  test('las llamadas repetidas no vuelven a descargar',async()=>{
    const fetch=fetchFalso(paginas);
    const {NOAA}=cargarScript('js/noaa.js',{fetch});
    await NOAA.marigrams();await NOAA.marigrams();
    assert.equal(fetch.llamadas.length,3);
  });

  test('usa sessionStorage como caché entre recargas de la página',async()=>{
    const ss=almacen(),fetch=fetchFalso(paginas);
    await cargarScript('js/noaa.js',{fetch,sessionStorage:ss}).NOAA.marigrams();
    const r=await cargarScript('js/noaa.js',{fetch,sessionStorage:ss}).NOAA.marigrams();
    assert.equal(fetch.llamadas.length,3);
    assert.equal(r.length,6);
  });

  test('si falla una página, rechaza y permite reintentar',async()=>{
    let falla=true;
    const fetch=fetchFalso(url=>falla&&url.includes('page=2')?{status:500,body:{}}:paginas(url));
    const {NOAA}=cargarScript('js/noaa.js',{fetch});
    await assert.rejects(NOAA.marigrams(),/NOAA 500/);
    falla=false;
    assert.equal((await NOAA.marigrams()).length,6);
  });
});

describe('NOAA.event',()=>{
  test('pide el evento por id y guarda el resultado',async()=>{
    const fetch=fetchFalso(url=>({status:200,body:{id:+url.split('/').pop(),maxWaterHeight:38.9}}));
    const {NOAA}=cargarScript('js/noaa.js',{fetch});
    const a=await NOAA.event(5413),b=await NOAA.event(5413);
    assert.equal(a.maxWaterHeight,38.9);
    assert.equal(a,b);
    assert.deepEqual(fetch.llamadas,[BASE+'/events/5413']);
  });

  test('un error no se queda en caché',async()=>{
    let n=0;
    const fetch=fetchFalso(()=>++n===1?{status:404,body:{}}:{status:200,body:{id:1}});
    const {NOAA}=cargarScript('js/noaa.js',{fetch});
    await assert.rejects(NOAA.event(1),/NOAA 404/);
    assert.equal((await NOAA.event(1)).id,1);
  });
});

test('NOAA.eventPage arma el enlace a la ficha del evento',()=>{
  const {NOAA}=cargarScript('js/noaa.js');
  assert.equal(NOAA.eventPage(5413),'https://www.ngdc.noaa.gov/hazel/view/hazards/tsunami/event-more-info/5413');
});
