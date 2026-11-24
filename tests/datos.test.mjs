// Validación del catálogo de desastres y de la geometría de países
import {test,describe} from 'node:test';
import assert from 'node:assert/strict';
import {leerJSON,constanteDeApp} from './helpers.mjs';

const D=leerJSON('data/desastres.json');
const TOPO=leerJSON('data/paises.topo.json');
const REG=constanteDeApp('REG');
const TYPES=constanteDeApp('TYPES');
const CAMPOS=['region','anio','tipo','nombre','lugar','lat','lon','muertes','muertes_texto','descripcion'];
const ISO=/^\d{4}-\d{2}-\d{2}$/;
const fechaValida=f=>ISO.test(f)&&new Date(f+'T00:00:00Z').toISOString().slice(0,10)===f;

describe('data/desastres.json',()=>{
  test('es un arreglo con eventos',()=>{
    assert.ok(Array.isArray(D));
    assert.ok(D.length>=50,`solo hay ${D.length} eventos`);
  });

  test('cada evento tiene todos los campos obligatorios con el tipo correcto',()=>{
    for(const d of D){
      for(const c of CAMPOS)assert.ok(c in d,`${d.nombre??'(sin nombre)'}: falta "${c}"`);
      assert.equal(typeof d.nombre,'string');
      assert.ok(Number.isInteger(d.anio),`${d.nombre}: anio no es entero`);
      for(const c of ['lat','lon','muertes'])assert.equal(typeof d[c],'number',`${d.nombre}: ${c} no es número`);
      for(const c of ['lugar','muertes_texto','descripcion'])assert.ok(d[c].trim().length>0,`${d.nombre}: ${c} vacío`);
    }
  });

  test('no hay campos desconocidos',()=>{
    const permitidos=new Set([...CAMPOS,'fecha','fecha_fin']);
    for(const d of D)for(const k of Object.keys(d))assert.ok(permitidos.has(k),`${d.nombre}: campo desconocido "${k}"`);
  });

  test('los nombres no se repiten',()=>{
    const vistos=new Set();
    for(const d of D){assert.ok(!vistos.has(d.nombre),`nombre repetido: ${d.nombre}`);vistos.add(d.nombre)}
  });

  test('región y tipo existen en app.js',()=>{
    for(const d of D){
      assert.ok(d.region in REG,`${d.nombre}: región "${d.region}" no existe`);
      assert.ok(d.tipo in TYPES,`${d.nombre}: tipo "${d.tipo}" no existe`);
    }
  });

  test('coordenadas dentro de rango',()=>{
    for(const d of D){
      assert.ok(d.lat>=-90&&d.lat<=90,`${d.nombre}: lat ${d.lat}`);
      assert.ok(d.lon>=-180&&d.lon<=180,`${d.nombre}: lon ${d.lon}`);
    }
  });

  test('años y muertes razonables',()=>{
    const hoy=new Date().getUTCFullYear();
    for(const d of D){
      assert.ok(d.anio>0&&d.anio<=hoy,`${d.nombre}: año ${d.anio}`);
      assert.ok(d.muertes>=0,`${d.nombre}: muertes negativas`);
    }
  });

  test('fechas en formato AAAA-MM-DD y que existen en el calendario',()=>{
    for(const d of D){
      if('fecha' in d)assert.ok(fechaValida(d.fecha),`${d.nombre}: fecha inválida "${d.fecha}"`);
      if('fecha_fin' in d)assert.ok(fechaValida(d.fecha_fin),`${d.nombre}: fecha_fin inválida "${d.fecha_fin}"`);
    }
  });

  test('fecha_fin solo va con fecha y es posterior',()=>{
    for(const d of D.filter(d=>'fecha_fin' in d)){
      assert.ok('fecha' in d,`${d.nombre}: tiene fecha_fin pero no fecha`);
      assert.ok(d.fecha_fin>d.fecha,`${d.nombre}: fecha_fin (${d.fecha_fin}) no es posterior a fecha (${d.fecha})`);
    }
  });

  test('el año de la fecha coincide con anio',()=>{
    for(const d of D.filter(d=>'fecha' in d)){
      const anios=[d.fecha,d.fecha_fin].filter(Boolean).map(f=>+f.slice(0,4));
      assert.ok(anios.includes(d.anio),`${d.nombre}: anio ${d.anio} no coincide con ${anios.join('–')}`);
    }
  });

  test('todos los eventos desde 1940 tienen fecha (para el clima histórico)',()=>{
    const faltan=D.filter(d=>d.anio>=1940&&!d.fecha).map(d=>d.nombre);
    assert.deepEqual(faltan,[],`sin fecha: ${faltan.join(', ')}`);
  });
});

describe('data/paises.topo.json',()=>{
  const geoms=TOPO.objects?.countries?.geometries??[];

  test('es un TopoJSON con países',()=>{
    assert.equal(TOPO.type,'Topology');
    assert.ok(geoms.length>150,`solo hay ${geoms.length} países`);
  });

  test('cada país tiene nombre y una región válida',()=>{
    for(const g of geoms){
      assert.ok(g.properties?.n,`país sin nombre (id ${g.id})`);
      assert.ok(g.properties.r in REG,`${g.properties.n}: región "${g.properties.r}" no existe`);
    }
  });

  test('cada región tiene al menos un país y un desastre',()=>{
    for(const r of Object.keys(REG)){
      assert.ok(geoms.some(g=>g.properties.r===r),`la región ${r} no tiene países`);
      assert.ok(D.some(d=>d.region===r),`la región ${r} no tiene desastres`);
    }
  });
});
