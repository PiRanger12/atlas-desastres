// Utilidades compartidas por las pruebas: cargar los scripts del navegador en un contexto aislado
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export const raiz=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const leer=rel=>readFileSync(path.join(raiz,rel),'utf8');
export const leerJSON=rel=>JSON.parse(leer(rel));

// Copia un valor creado dentro del contexto vm a objetos normales (para deepStrictEqual)
export const plano=v=>JSON.parse(JSON.stringify(v));

// sessionStorage en memoria (opcionalmente compartido entre cargas)
export function almacen(){
  const m=new Map();
  return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),get size(){return m.size}};
}

// fetch falso: `responder(url)` devuelve {status, body}. Registra cada URL pedida.
export function fetchFalso(responder){
  const llamadas=[];
  const fn=async url=>{
    llamadas.push(url);
    const {status=200,body}=await responder(url);
    return {ok:status>=200&&status<300,status,json:async()=>body};
  };
  fn.llamadas=llamadas;
  return fn;
}

// Ejecuta un script de js/ como en el navegador y devuelve su `window`
export function cargarScript(rel,{fetch,sessionStorage=almacen()}={}){
  const ctx={window:{},fetch,sessionStorage,console};
  vm.createContext(ctx);
  vm.runInContext(leer(rel),ctx,{filename:rel});
  return ctx.window;
}

// Lee un objeto literal declarado en app.js (p. ej. REG o TYPES) para no duplicar la lista en las pruebas
export function constanteDeApp(nombre){
  const m=leer('js/app.js').match(new RegExp(`const ${nombre}=(\\{[^;]*\\});`));
  if(!m)throw new Error(`No se encontró ${nombre} en js/app.js`);
  return vm.runInNewContext(`(${m[1]})`);
}
