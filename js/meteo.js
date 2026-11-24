// Cliente mínimo de la API de clima histórico de Open-Meteo (reanálisis ERA5, de 1940 a la fecha)
// Docs: https://open-meteo.com/en/docs/historical-weather-api · Datos: CC BY 4.0
window.METEO=(()=>{
const BASE='https://archive-api.open-meteo.com/v1/archive';
const VARS=['temperature_2m_max','temperature_2m_min','precipitation_sum','wind_speed_10m_max','wind_gusts_10m_max'];
const DESDE=1940;          // primer año con datos ERA5
const ANTES=7,DESPUES=3;   // días alrededor de un evento de un solo día
const MARGEN=3;            // días extra a cada lado de un evento con fecha_fin
const CACHE='meteo-v1:';

const getJSON=url=>fetch(url).then(r=>{if(!r.ok)throw new Error(`Open-Meteo ${r.status}`);return r.json()});
const cacheGet=k=>{try{return JSON.parse(sessionStorage.getItem(k))}catch{return null}};
const cacheSet=(k,v)=>{try{sessionStorage.setItem(k,JSON.stringify(v))}catch{}};
const mover=(iso,n)=>{const d=new Date(iso+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};

// ¿Tiene el evento una fecha exacta dentro del periodo que cubre ERA5?
const disponible=ev=>!!ev.fecha&&+ev.fecha.slice(0,4)>=DESDE;
// Ventana de días a consultar: [inicio, fin]
const ventana=ev=>ev.fecha_fin?[mover(ev.fecha,-MARGEN),mover(ev.fecha_fin,MARGEN)]:[mover(ev.fecha,-ANTES),mover(ev.fecha,DESPUES)];

// Datos diarios del lugar y la ventana del evento: {lat, lon, elev, dias:[{fecha,tmax,tmin,lluvia,viento,rafaga}]}
const pend=new Map();
function diario(ev){
  const [ini,fin]=ventana(ev),key=CACHE+[ev.lat,ev.lon,ini,fin].join('|');
  if(pend.has(key))return pend.get(key);
  const hit=cacheGet(key);if(hit)return Promise.resolve(hit);
  const url=`${BASE}?latitude=${ev.lat}&longitude=${ev.lon}&start_date=${ini}&end_date=${fin}`
    +`&daily=${VARS.join(',')}&models=era5&timezone=auto`;
  const p=getJSON(url).then(r=>{
    const d=r.daily;
    const out={lat:r.latitude,lon:r.longitude,elev:r.elevation,dias:d.time.map((f,i)=>({fecha:f,
      tmax:d.temperature_2m_max[i],tmin:d.temperature_2m_min[i],lluvia:d.precipitation_sum[i],
      viento:d.wind_speed_10m_max[i],rafaga:d.wind_gusts_10m_max[i]}))};
    cacheSet(key,out);pend.delete(key);return out;
  }).catch(e=>{pend.delete(key);throw e});
  pend.set(key,p);return p;
}

const pagina='https://open-meteo.com/en/docs/historical-weather-api';
return {disponible,ventana,diario,pagina,DESDE};
})();
