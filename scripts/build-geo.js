const fs=require('fs');
const t=JSON.parse(fs.readFileSync(require.resolve('world-atlas/countries-110m.json')));
const w=require('world-countries');
const by={};w.forEach(c=>by[c.ccn3]=c);
const cauc=new Set(['051','268','031']);
function reg(id,name){
  if(name==='N. Cyprus')return 'medio';
  if(name==='Kosovo')return 'europa';
  if(name==='Somaliland')return 'africa';
  const c=by[id];if(!c)return null;
  if(id==='484')return 'meso';
  if(id==='643'||cauc.has(id)||c.subregion==='Central Asia')return 'rusia';
  if(id==='364')return 'medio';
  switch(c.region){
    case 'Europe':return 'europa';case 'Africa':return 'africa';case 'Oceania':return 'oceania';
    case 'Americas':return c.subregion==='South America'?'sudamerica':c.subregion==='North America'?'norte':'meso';
    case 'Asia':return {"Western Asia":'medio',"Southern Asia":'sur',"Eastern Asia":'oriental',"South-Eastern Asia":'sudeste'}[c.subregion];
  }return null;
}
t.objects.countries.geometries.forEach(g=>{
  const c=by[g.id];g.properties={n:(c&&c.translations.spa?.common)||g.properties.name,r:reg(g.id,g.properties.name)};
});
t.objects.countries.geometries=t.objects.countries.geometries.filter(g=>g.properties.r);
fs.writeFileSync(require('path').join(__dirname,'../data/paises.topo.json'),JSON.stringify(t));
console.log('data/paises.topo.json generado');
