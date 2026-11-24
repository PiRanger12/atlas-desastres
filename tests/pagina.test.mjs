// Comprobaciones estáticas de index.html y de los scripts
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {leer,raiz} from './helpers.mjs';

const html=leer('index.html');
const locales=[...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)].map(m=>m[1]).filter(u=>!/^https?:/.test(u));

test('los archivos locales que carga index.html existen',()=>{
  assert.ok(locales.length>0);
  for(const f of locales)assert.ok(existsSync(path.join(raiz,f)),`no existe ${f}`);
});

test('noaa.js y meteo.js se cargan antes que app.js',()=>{
  const i=f=>html.indexOf(`src="js/${f}"`);
  assert.ok(i('noaa.js')>=0&&i('meteo.js')>=0&&i('app.js')>=0,'falta algún script');
  assert.ok(i('noaa.js')<i('app.js'),'noaa.js debe ir antes de app.js');
  assert.ok(i('meteo.js')<i('app.js'),'meteo.js debe ir antes de app.js');
});

test('las librerías de CDN están fijadas a una versión exacta',()=>{
  const cdn=[...html.matchAll(/src="(https:[^"]+)"/g)].map(m=>m[1]);
  for(const u of cdn)assert.match(u,/@\d+\.\d+\.\d+\//,`versión no fijada: ${u}`);
});

test('los scripts de js/ no tienen errores de sintaxis',()=>{
  for(const f of ['js/app.js','js/noaa.js','js/meteo.js'])
    assert.doesNotThrow(()=>new vm.Script(leer(f),{filename:f}),`error de sintaxis en ${f}`);
});

test('el footer da crédito a las fuentes de datos',()=>{
  for(const fuente of ['Open-Meteo','NOAA','Natural Earth'])assert.ok(html.includes(fuente),`falta el crédito a ${fuente}`);
});
