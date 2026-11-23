// Atlas de desastres históricos — lógica del mapa (D3 + TopoJSON)
(async()=>{
const [TOPO,RAW]=await Promise.all([
  fetch('data/paises.topo.json').then(r=>r.json()),
  fetch('data/desastres.json').then(r=>r.json())
]);
const D=RAW.map((r,i)=>({id:i,r:r.region,y:r.anio,t:r.tipo,n:r.nombre,p:r.lugar,lat:r.lat,lon:r.lon,m:r.muertes,d:r.muertes_texto,x:r.descripcion}));
const REG={norte:"Norteamérica",meso:"México, Centroamérica y Caribe",sudamerica:"Sudamérica",europa:"Europa",africa:"África",medio:"Medio Oriente",rusia:"Rusia, Cáucaso y Asia Central",sur:"Asia del Sur",oriental:"Asia Oriental",sudeste:"Sudeste Asiático",oceania:"Oceanía"};
const TYPES={sismo:["Terremoto","#c0392b"],tsunami:["Tsunami","#1f6fb2"],volcan:["Volcán","#e07b00"],ciclon:["Ciclón / huracán","#7b4fb5"],inundacion:["Inundación","#1a9a8b"],sequia:["Sequía / hambruna","#9a7b2f"],calor:["Calor / incendio","#d6457a"],otro:["Otros","#5b6570"]};

const svg=d3.select('#map'),fig=document.getElementById('fig'),tip=document.getElementById('tip');
const countries=topojson.feature(TOPO,TOPO.objects.countries).features;
// Dos proyecciones: globo 3D (ortográfica, se gira arrastrando) y mapa plano (Natural Earth)
const sphere={type:'Sphere'},grat=d3.geoGraticule10();
const P3=d3.geoOrthographic().clipAngle(90).precision(.4),P2=d3.geoNaturalEarth1();
const ROT0=[40,-15];
let mode='3d',proj=P3,path=d3.geoPath(proj),rot=[...ROT0],base={s:1,t:[0,0]},last=d3.zoomIdentity;
const defs=svg.append('defs');
defs.append('radialGradient').attr('id','gOcean').attr('cx','38%').attr('cy','32%').attr('r','75%').html(
  '<stop offset="0" style="stop-color:var(--sea)"/><stop offset="1" style="stop-color:var(--sead)"/>');
defs.append('radialGradient').attr('id','gShade').attr('cx','38%').attr('cy','32%').attr('r','70%').html(
  '<stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/>');
const g=svg.append('g'),gsea=g.append('path').attr('class','sea'),ggr=g.append('path').attr('class','grat'),
  gc=g.append('g'),gsh=g.append('path').attr('class','shade'),gs=g.append('g'),gd=g.append('g');
const visible=(lon,lat)=>mode==='2d'||d3.geoDistance([lon,lat],[-rot[0],-rot[1]])<Math.PI/2-.02;
const rScale=d3.scaleSqrt().domain([0,2000000]).range([3.5,26]);
const st={reg:null,pick:null,sort:'y',on:new Set(Object.keys(TYPES)),mg:false,mgLoad:false,mgErr:null,station:null,mpick:null};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let STATIONS=[];const MG_COLOR='#0b4f8a';
let k=1;

const cs=gc.selectAll('path').data(countries).join('path').attr('class','c')
 .on('mouseenter',(e,f)=>{cs.classed('hov',c=>c.properties.r===f.properties.r);showTip(e,`<b>${f.properties.n}</b><br>${REG[f.properties.r]}`)})
 .on('mousemove',moveTip).on('mouseleave',()=>{cs.classed('hov',false);hideTip()})
 .on('click',(e,f)=>{st.pick=null;st.station=null;renderStations();select(f.properties.r,false,true)});

function draw(){
  const W=fig.clientWidth,H=fig.clientHeight;
  if(mode==='3d')P3.rotate([0,0]).fitExtent([[14,14],[W-14,H-14]],sphere);
  else P2.fitExtent([[10,10],[W-10,H-10]],{type:'FeatureCollection',features:countries});
  base={s:proj.scale(),t:proj.translate()};redraw();
}
function redraw(){
  if(mode==='3d')P3.scale(base.s*k).translate([fig.clientWidth/2,fig.clientHeight/2]).rotate(rot);
  else P2.scale(base.s*k).translate([last.x+k*base.t[0],last.y+k*base.t[1]]);
  gsea.attr('d',path(sphere));ggr.attr('d',path(grat));cs.attr('d',path);
  gsh.attr('d',mode==='3d'?path(sphere):null);renderStations();renderDots();
}
// Gira el globo hasta centrar [lon,lat] por el camino más corto
function rotateTo(lon,lat){
  if(mode!=='3d')return;
  let tx=-lon;while(tx-rot[0]>180)tx-=360;while(tx-rot[0]<-180)tx+=360;
  const i=d3.interpolate(rot,[tx,Math.max(-70,Math.min(70,-lat))]);
  svg.transition('rot').duration(900).tween('rot',()=>t=>{rot=i(t);redraw()});
}
function renderDots(){
  const data=D.filter(d=>st.on.has(d.t)).sort((a,b)=>b.m-a.m);
  gd.selectAll('circle').data(data,d=>d.id).join('circle').attr('class','dot')
   .attr('cx',d=>proj([d.lon,d.lat])[0]).attr('cy',d=>proj([d.lon,d.lat])[1])
   .attr('display',d=>visible(d.lon,d.lat)?null:'none')
   .attr('r',d=>rScale(d.m)*Math.sqrt(k))
   .attr('fill',d=>TYPES[d.t][1]).classed('pick',d=>d.id===st.pick)
   .on('mouseenter',(e,d)=>showTip(e,`<b>${d.n}</b> (${yr(d.y)})<br>${d.p}<br>Muertes: ${d.d}`))
   .on('mousemove',moveTip).on('mouseleave',hideTip)
   .on('click',(e,d)=>{e.stopPropagation();st.pick=d.id;st.station=null;renderStations();select(d.r,true)});
}
// Capa de estaciones mareográficas (API NOAA Hazel)
const tri=d3.symbol(d3.symbolTriangle);
function renderStations(){
  const data=st.mg?STATIONS:[];
  gs.selectAll('path').data(data,d=>d.key).join('path').attr('class','st')
   .attr('d',d=>tri.size(28+Math.sqrt(d.items.length)*14)())
   .attr('transform',d=>{const [x,y]=proj([d.lon,d.lat]);return `translate(${x},${y}) scale(${Math.sqrt(k)})`})
   .attr('display',d=>visible(d.lon,d.lat)?null:'none')
   .attr('fill',MG_COLOR).classed('pick',d=>d.key===st.station)
   .on('mouseenter',(e,d)=>showTip(e,`<b>${esc(d.name)}</b><br>Estación mareográfica · ${d.items.length} mareograma${d.items.length>1?'s':''}<br>${d.y0}–${d.y1}`))
   .on('mousemove',moveTip).on('mouseleave',hideTip)
   .on('click',(e,d)=>{e.stopPropagation();st.station=d.key;st.mpick=null;renderStations();renderPanel();list.scrollTop=0});
}
async function loadMarigrams(){
  if(STATIONS.length||st.mgLoad)return;
  st.mgLoad=true;st.mgErr=null;updateMgChip();
  try{
    const items=await NOAA.marigrams(),by=new Map();
    for(const m of items){const key=m.locationName+'|'+m.latitude+'|'+m.longitude;
      if(!by.has(key))by.set(key,{key,name:m.locationName,country:m.country,lat:m.latitude,lon:m.longitude,items:[]});
      by.get(key).items.push(m)}
    STATIONS=[...by.values()].map(s=>{s.items.sort((a,b)=>a.year-b.year||a.month-b.month||a.day-b.day);s.y0=s.items[0].year;s.y1=s.items.at(-1).year;return s})
      .sort((a,b)=>b.items.length-a.items.length);
  }catch(e){st.mgErr=e;console.error(e)}
  st.mgLoad=false;updateMgChip();renderStations();
}
const MES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const fecha=m=>[m.day,m.month?MES[m.month-1]:null,m.year].filter(Boolean).join(' ');
const mb=b=>b>=1e6?(b/1e6).toFixed(0)+' MB':Math.round(b/1e3)+' kB';
function stationPanel(){
  const s=STATIONS.find(s=>s.key===st.station);
  ph.innerHTML=`<h2>${esc(s.name)}</h2><p>Estación mareográfica · ${esc(s.country)} · ${s.items.length} mareograma${s.items.length>1?'s':''} (${s.y0}–${s.y1})</p>
   <div class="sort"><button data-s="b" aria-pressed="false">← Volver</button></div>`;
  list.innerHTML=s.items.map(m=>{const open=m.id===st.mpick,img=m.plotPreview||m.scanPreview;
    return `<li data-mid="${m.id}" style="--t:${MG_COLOR}" class="${open?'pick':''}">
    <h3>Tsunami del ${fecha(m)}</h3><div class="meta"><span>Evento NOAA #${m.tsunamiEventId}</span>${m.csv?'<span>Digitalizado</span>':''}${img?'':'<span>Sin imagen</span>'}</div>
    ${open?`<div class="mg">${img?`<a href="${esc(img)}" target="_blank" rel="noopener"><img src="${esc(img)}" alt="Mareograma de ${esc(s.name)}, ${fecha(m)}" loading="lazy"></a>`:''}
      <div class="ev" id="ev${m.id}">Cargando datos del evento…</div>
      <div class="links">${m.scan?`<a href="${esc(m.scan)}">Escaneo ZIP (${mb(m.scanSize)})</a>`:''}${m.csv?`<a href="${esc(m.csv)}">CSV</a>`:''}${m.netcdf?`<a href="${esc(m.netcdf)}">NetCDF</a>`:''}${m.reference?`<a href="${esc(m.reference)}" target="_blank" rel="noopener">DOI</a>`:''}<a href="${NOAA.eventPage(m.tsunamiEventId)}" target="_blank" rel="noopener">Ficha del evento ↗</a></div></div>`:''}</li>`}).join('');
  const m=s.items.find(m=>m.id===st.mpick);
  if(m)NOAA.event(m.tsunamiEventId).then(ev=>{const el=document.getElementById('ev'+m.id);if(!el)return;
    const mag=ev.eqMagMw??ev.eqMagMs??ev.eqMagUnk??ev.eqMagMb,dead=ev.deathsTotal??ev.deaths;
    el.innerHTML=[`<b>Origen:</b> ${esc(ev.locationName)}${ev.country?', '+esc(ev.country):''}`,mag!=null?`<b>Magnitud del sismo:</b> ${mag}`:'',
      ev.maxWaterHeight!=null?`<b>Altura máx. del agua:</b> ${ev.maxWaterHeight} m`:'',dead?`<b>Muertes:</b> ${fmt(dead)}`:'',
      ev.comments?`<span class="cm">${esc(ev.comments)}</span>`:''].filter(Boolean).join('<br>')})
   .catch(()=>{const el=document.getElementById('ev'+m.id);if(el)el.textContent='No se pudo cargar el evento.'});
}
const yr=y=>y<1000?y+' d. C.':y;
function showTip(e,h){tip.innerHTML=h;tip.style.display='block';moveTip(e)}
function moveTip(e){const b=fig.getBoundingClientRect();let x=e.clientX-b.left+14,y=e.clientY-b.top+14;if(x>b.width-250)x-=260;tip.style.left=x+'px';tip.style.top=y+'px'}
function hideTip(){tip.style.display='none'}

// En 3D arrastrar gira el globo; en 2D desplaza el mapa. La rueda y los botones hacen zoom en ambos.
const zoom=d3.zoom().scaleExtent([1,8]).on('zoom',e=>{const t=e.transform;
  if(mode==='3d'&&e.sourceEvent&&t.k===last.k){const dpp=57.3/(base.s*t.k);
    rot=[rot[0]+(t.x-last.x)*dpp,Math.max(-80,Math.min(80,rot[1]-(t.y-last.y)*dpp))]}
  k=t.k;last=t;redraw()});
svg.call(zoom).on('dblclick.zoom',null);
document.getElementById('zin').onclick=()=>svg.transition().call(zoom.scaleBy,1.6);
document.getElementById('zout').onclick=()=>svg.transition().call(zoom.scaleBy,1/1.6);
document.getElementById('zre').onclick=()=>{svg.transition().call(zoom.transform,d3.zoomIdentity);
  if(mode==='3d'){rot=[...rot];const i=d3.interpolate(rot,ROT0);svg.transition('rot').duration(900).tween('rot',()=>t=>{rot=i(t);redraw()})}};
const zmode=document.getElementById('zmode');
function setMode(m){
  mode=m;proj=m==='3d'?P3:P2;path=d3.geoPath(proj);
  svg.interrupt('rot');svg.property('__zoom',d3.zoomIdentity);k=1;last=d3.zoomIdentity;
  fig.classList.toggle('globe',m==='3d');
  zmode.textContent=m==='3d'?'2D':'3D';zmode.setAttribute('aria-label',m==='3d'?'Ver mapa plano':'Ver globo 3D');
  draw();
}
zmode.onclick=()=>setMode(mode==='3d'?'2d':'3d');
fig.classList.add('globe');

const chips=document.getElementById('chips');
chips.innerHTML=Object.entries(TYPES).map(([k,[n,c]])=>`<button class="chip" data-t="${k}" aria-pressed="true"><i style="background:${c}"></i>${n}</button>`).join('')
  +`<button class="chip layer" id="mgchip" aria-pressed="false" title="Estaciones con registros de mareógrafo (API NOAA/NCEI)"><i class="tri" style="background:${MG_COLOR}"></i><span>Mareogramas NOAA</span></button>`;
const mgchip=document.getElementById('mgchip');
function updateMgChip(){mgchip.setAttribute('aria-pressed',st.mg);mgchip.querySelector('span').textContent=st.mgLoad?'Cargando mareogramas…':st.mgErr?'Mareogramas NOAA (error, reintentar)':STATIONS.length?`Mareogramas NOAA · ${STATIONS.length} estaciones`:'Mareogramas NOAA'}
chips.onclick=e=>{const b=e.target.closest('.chip');if(!b)return;
  if(b===mgchip){st.mg=!st.mg;if(!st.mg&&st.station){st.station=null;renderPanel()}updateMgChip();renderStations();if(st.mg)loadMarigrams();return}
  const t=b.dataset.t;
  st.on.has(t)?st.on.delete(t):st.on.add(t);b.setAttribute('aria-pressed',st.on.has(t));renderDots();renderPanel()};

const ph=document.getElementById('ph'),list=document.getElementById('list');
function select(r,scroll,focus){st.reg=r;
  if(focus){const c=d3.geoCentroid({type:'FeatureCollection',features:countries.filter(c=>c.properties.r===r)});rotateTo(c[0],c[1])}cs.classed('on',c=>c.properties.r===r);renderDots();renderPanel(scroll)}
const fmt=n=>n.toLocaleString('es-MX');
function renderPanel(scroll){
  if(st.station){stationPanel();return}
  if(!st.reg){
    ph.innerHTML=`<h2>Elige una región</h2><p>${D.length} desastres en ${Object.keys(REG).length} regiones. Haz clic en el mapa o en una región:</p>`;
    list.innerHTML=`<li style="all:unset;display:block"><div class="regs">${Object.entries(REG).map(([k,n])=>`<button data-r="${k}">${n}</button>`).join('')}</div></li>`;
    return;
  }
  const items=D.filter(d=>d.r===st.reg&&st.on.has(d.t)).sort((a,b)=>st.sort==='y'?a.y-b.y:b.m-a.m);
  const sum=items.reduce((s,d)=>s+d.m,0),tot=sum>=1000?Math.round(sum/1000)*1000:sum;
  ph.innerHTML=`<h2>${REG[st.reg]}</h2><p>${items.length} eventos · ~${fmt(tot)} muertes estimadas en total</p>
   <div class="sort"><button data-s="y" aria-pressed="${st.sort==='y'}">Por año</button><button data-s="m" aria-pressed="${st.sort==='m'}">Por mortalidad</button><button data-s="x" aria-pressed="false">← Regiones</button></div>`;
  list.innerHTML=items.length?items.map(d=>`<li data-id="${d.id}" style="--t:${TYPES[d.t][1]}" class="${d.id===st.pick?'pick':''}">
    <h3>${d.n}</h3><div class="meta"><span>${yr(d.y)}</span><span>${TYPES[d.t][0]}</span><span>${d.p}</span><b>${/\d/.test(d.d)?d.d+' muertes':d.d}</b></div><p>${d.x}</p></li>`).join('')
   :'<div class="empty">No hay eventos con los filtros activos en esta región.</div>';
  if(scroll){const el=list.querySelector('.pick');el&&el.scrollIntoView({block:'nearest',behavior:'smooth'})}
}
ph.onclick=e=>{const b=e.target.closest('[data-s]');if(!b)return;
  if(b.dataset.s==='b'){st.station=null;st.mpick=null;renderStations();renderPanel();return}
  if(b.dataset.s==='x'){st.reg=null;st.pick=null;cs.classed('on',false);renderDots();renderPanel();return}
  st.sort=b.dataset.s;renderPanel()};
list.onclick=e=>{if(e.target.closest('a'))return;
  const mi=e.target.closest('li[data-mid]');if(mi){const id=+mi.dataset.mid;st.mpick=st.mpick===id?null:id;renderPanel();return}
  const r=e.target.closest('[data-r]');if(r){select(r.dataset.r,false,true);return}
  const li=e.target.closest('li[data-id]');if(!li)return;const id=+li.dataset.id;st.pick=st.pick===id?null:id;renderDots();renderPanel()};

const ro=new ResizeObserver(draw);ro.observe(fig);
renderPanel();
})().catch(e=>{document.getElementById("ph").innerHTML="<h2>No se pudieron cargar los datos</h2><p>Abre el proyecto con un servidor local (ver README).</p>";console.error(e)});
