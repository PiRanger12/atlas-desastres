# Atlas de desastres históricos

Mapa mundial interactivo para explorar los desastres más significativos de la historia por región. Al hacer clic en un país se resalta su región y se listan sus desastres, con año, tipo, lugar, muertes estimadas y una breve descripción.

## Funciones

- Mapa mundial en proyección Natural Earth con zoom y arrastre.
- 11 regiones (Norteamérica; México, Centroamérica y Caribe; Sudamérica; Europa; África; Medio Oriente; Rusia, Cáucaso y Asia Central; Asia del Sur; Asia Oriental; Sudeste Asiático; Oceanía).
- Cada desastre es un punto en el mapa; su tamaño es proporcional a la raíz cuadrada de las muertes estimadas.
- Filtros por tipo: terremoto, tsunami, volcán, ciclón/huracán, inundación, sequía/hambruna, calor/incendio y otros.
- Orden por año o por mortalidad.
- Capa opcional **Mareogramas NOAA**: carga en vivo las estaciones mareográficas de la [API Hazel de NOAA/NCEI](https://www.ngdc.noaa.gov/hazel/view/swagger#/Tsunami%20Marigrams) (`/tsunamis/marigrams`, paginada de 200 en 200). Al hacer clic en una estación se listan sus mareogramas con la imagen escaneada, enlaces de descarga (ZIP, CSV, NetCDF) y los datos del tsunami (`/tsunamis/events/{id}`). Los resultados se guardan en `sessionStorage`. El cliente está en `js/noaa.js`.
- Diseño responsivo y con modo oscuro automático.

## Tecnologías

- HTML, CSS y JavaScript sin framework.
- [D3.js](https://d3js.org/) v7 para la proyección y el dibujo del mapa.
- [topojson-client](https://github.com/topojson/topojson-client) para leer la geometría.
- Geometría de países de [world-atlas](https://github.com/topojson/world-atlas) (Natural Earth, 1:110m) y regiones de [world-countries](https://github.com/mledoze/countries).

## Estructura

```
├── index.html
├── css/styles.css
├── js/app.js                 # lógica del mapa, filtros y panel
├── data/desastres.json       # catálogo de desastres
├── data/paises.topo.json     # países con nombre en español y región asignada
└── scripts/build-geo.js      # genera paises.topo.json
```

## Cómo ejecutarlo

El proyecto carga los datos con `fetch`, así que debe abrirse desde un servidor local (no con doble clic en `index.html`):

```bash
npx serve .
# o
python -m http.server 8000
```

Después abre `http://localhost:8000` (o la URL que muestre `serve`).

Para regenerar la geometría:

```bash
npm install
npm run build:geo
```

## Datos

Cada registro de `data/desastres.json` tiene este formato:

```json
{
  "region": "meso",
  "anio": 1985,
  "tipo": "sismo",
  "nombre": "Terremoto de Ciudad de México",
  "lugar": "CDMX, México",
  "lat": 19.43,
  "lon": -99.13,
  "muertes": 10000,
  "muertes_texto": "5,000–10,000+",
  "descripcion": "..."
}
```

`muertes` es una estimación central que se usa para el tamaño del punto y el orden; `muertes_texto` es lo que se muestra.

> Las cifras son aproximadas y, en eventos antiguos, las estimaciones varían mucho. Pendiente: verificarlas contra fuentes como [EM-DAT](https://www.emdat.be/) y [NOAA NCEI](https://www.ngdc.noaa.gov/hazard/).

## Ideas a futuro

- Importar datos de EM-DAT o NOAA en lugar del catálogo manual.
- Línea de tiempo para filtrar por siglo.
- Búsqueda por nombre de desastre o país.
- Publicar en GitHub Pages.
