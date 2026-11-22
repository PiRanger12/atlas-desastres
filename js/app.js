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
const proj=d3.geoNaturalEarth1(),path=d3.geoPath(proj);
const g=svg.append('g'),gc=g.append('g'),gd=g.append('g');
const rScale=d3.scaleSqrt().domain([0,2000000]).range([3.5,26]);
const st={reg:null,pick:null,sort:'y',on:new Set(Object.keys(TYPES))};
let k=1;

const cs=gc.selectAll('path').data(countries).join('path').attr('class','c')
 .on('mouseenter',(e,f)=>{cs.classed('hov',c=>c.properties.r===f.properties.r);showTip(e,`<b>${f.properties.n}</b><br>${REG[f.properties.r]}`)})
 .on('mousemove',moveTip).on('mouseleave',()=>{cs.classed('hov',false);hideTip()})
 .on('click',(e,f)=>{st.pick=null;select(f.properties.r)});

function draw(){
  const W=fig.clientWidth,H=fig.clientHeight;
  proj.fitExtent([[10,10],[W-10,H-10]],{type:'FeatureCollection',features:countries});
  cs.attr('d',path);renderDots();
}
function renderDots(){
  const data=D.filter(d=>st.on.has(d.t)).sort((a,b)=>b.m-a.m);
  gd.selectAll('circle').data(data,d=>d.id).join('circle').attr('class','dot')
   .attr('cx',d=>proj([d.lon,d.lat])[0]).attr('cy',d=>proj([d.lon,d.lat])[1])
   .attr('r',d=>rScale(d.m)/Math.sqrt(k)).attr('stroke-width',1/k)
   .attr('fill',d=>TYPES[d.t][1]).classed('pick',d=>d.id===st.pick)
   .on('mouseenter',(e,d)=>showTip(e,`<b>${d.n}</b> (${yr(d.y)})<br>${d.p}<br>Muertes: ${d.d}`))
   .on('mousemove',moveTip).on('mouseleave',hideTip)
   .on('click',(e,d)=>{e.stopPropagation();st.pick=d.id;select(d.r,true)});
}
const yr=y=>y<1000?y+' d. C.':y;
function showTip(e,h){tip.innerHTML=h;tip.style.display='block';moveTip(e)}
function moveTip(e){const b=fig.getBoundingClientRect();let x=e.clientX-b.left+14,y=e.clientY-b.top+14;if(x>b.width-250)x-=260;tip.style.left=x+'px';tip.style.top=y+'px'}
function hideTip(){tip.style.display='none'}

const zoom=d3.zoom().scaleExtent([1,8]).on('zoom',e=>{k=e.transform.k;g.attr('transform',e.transform);gc.selectAll('path').attr('stroke-width',.5/k);renderDots()});
svg.call(zoom);
document.getElementById('zin').onclick=()=>svg.transition().call(zoom.scaleBy,1.6);
document.getElementById('zout').onclick=()=>svg.transition().call(zoom.scaleBy,1/1.6);
document.getElementById('zre').onclick=()=>svg.transition().call(zoom.transform,d3.zoomIdentity);

const chips=document.getElementById('chips');
chips.innerHTML=Object.entries(TYPES).map(([k,[n,c]])=>`<button class="chip" data-t="${k}" aria-pressed="true"><i style="background:${c}"></i>${n}</button>`).join('');
chips.onclick=e=>{const b=e.target.closest('.chip');if(!b)return;const t=b.dataset.t;
  st.on.has(t)?st.on.delete(t):st.on.add(t);b.setAttribute('aria-pressed',st.on.has(t));renderDots();renderPanel()};

const ph=document.getElementById('ph'),list=document.getElementById('list');
function select(r,scroll){st.reg=r;cs.classed('on',c=>c.properties.r===r);renderDots();renderPanel(scroll)}
const fmt=n=>n.toLocaleString('es-MX');
function renderPanel(scroll){
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
  if(b.dataset.s==='x'){st.reg=null;st.pick=null;cs.classed('on',false);renderDots();renderPanel();return}
  st.sort=b.dataset.s;renderPanel()};
list.onclick=e=>{const r=e.target.closest('[data-r]');if(r){select(r.dataset.r);return}
  const li=e.target.closest('li[data-id]');if(!li)return;const id=+li.dataset.id;st.pick=st.pick===id?null:id;renderDots();renderPanel()};

const ro=new ResizeObserver(draw);ro.observe(fig);
renderPanel();
})().catch(e=>{document.getElementById("ph").innerHTML="<h2>No se pudieron cargar los datos</h2><p>Abre el proyecto con un servidor local (ver README).</p>";console.error(e)});
