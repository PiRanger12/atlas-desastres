// Cliente mínimo de la API NCEI/NOAA Hazel (Global Historical Hazard Database)
// Docs: https://www.ngdc.noaa.gov/hazel/view/swagger#/Tsunami%20Marigrams
window.NOAA=(()=>{
const BASE='https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1/tsunamis';
const PAGE=200; // máximo permitido por la API
const CACHE='noaa-marigrams-v1';

const getJSON=url=>fetch(url).then(r=>{if(!r.ok)throw new Error(`NOAA ${r.status}: ${url}`);return r.json()});
const cacheGet=k=>{try{return JSON.parse(sessionStorage.getItem(k))}catch{return null}};
const cacheSet=(k,v)=>{try{sessionStorage.setItem(k,JSON.stringify(v))}catch{}};

// Descarga todos los mareogramas: pide la página 1 para conocer totalPages y luego el resto en paralelo.
let allP=null;
function marigrams(){
  if(allP)return allP;
  const hit=cacheGet(CACHE);if(hit)return allP=Promise.resolve(hit);
  allP=(async()=>{
    const url=p=>`${BASE}/marigrams?itemsPerPage=${PAGE}&page=${p}`;
    const first=await getJSON(url(1));
    const rest=await Promise.all(Array.from({length:first.totalPages-1},(_,i)=>getJSON(url(i+2))));
    const items=[first,...rest].flatMap(r=>r.items).filter(m=>m.latitude!=null&&m.longitude!=null);
    cacheSet(CACHE,items);return items;
  })().catch(e=>{allP=null;throw e});
  return allP;
}

// Detalle de un evento de tsunami (causa, magnitud, altura máxima, comentarios).
const evCache=new Map();
function event(id){
  if(!evCache.has(id))evCache.set(id,getJSON(`${BASE}/events/${id}`).catch(e=>{evCache.delete(id);throw e}));
  return evCache.get(id);
}
const eventPage=id=>`https://www.ngdc.noaa.gov/hazel/view/hazards/tsunami/event-more-info/${id}`;

return {marigrams,event,eventPage};
})();
