# Nature Explorer (versión 4 · diseño del prototipo)

Versión basada en el diseño de `prototype/prototype.jpg`, con **todas las funciones** de la v3 (sonidos, avatar, radar, íconos de plantas, XP, niveles, rareza, logros, captura con validación, descargas y ficha de especie). Las versiones 1, 2 y 3 no cambian.

## Ejecutar

```bash
python -m http.server 5176 --directory app-v4
```

Abre http://localhost:5176

## Pantallas según el prototipo

| Pantalla del prototipo | Cómo quedó en la v4 |
|---|---|
| 1 · Selección de reino | Logo de hojas centrado, «¿Qué quieres explorar hoy?», paisaje de montañas de fondo, tres tarjetas horizontales (foto, ícono, nombre, descripción y flecha) y la frase «Un mundo por descubrir». Fauna y Hongos siguen como *Próximamente*. |
| 2 · Mapa (Flora) | Cabecera blanca con logo «Nature Explorer · Flora» y engranaje de ajustes; tarjeta «Radio de búsqueda» con botones segmentados; pines tipo gota con la foto de cada especie; botones redondos de ubicación y capas; botones grandes **Capturar** y **Nuevo Registro**; escala del mapa; panel con «N especies de plantas en un radio de X km · registros», un resumen de una línea (nativas · endémicas · amenazadas) y al final de esa línea el enlace **Ir al detalle**, que abre el listado completo ordenado por cercanía. |
| 3 · Listado de especies | «Flora del entorno» con volver y lupa; buscador con botón de filtros; filas con foto, nombre, nombre científico, distancia, registros y flecha; botón pequeño **Descargar lista** arriba, junto al orden, que despliega Excel, CSV, PDF, KML y KMZ (abajo queda el banner de publicidad). |
| 4 · Nuevo registro | Todo en una sola pantalla: foto principal con lápiz para cambiarla, miniaturas y «Agregar fotos» (cada vez se elige **Cámara** o **Galería**). Después de agregar fotos se abre un mapa que parte desde tu ubicación y **tú marcas el punto** donde las tomaste; cada foto guarda sus coordenadas y la observación usa las de la foto principal. Fecha y hora con **Editar**; «Identificar especie» parte en **Buscar en catálogo** y como segunda opción **Sugerir con IA**; aviso de resultado (por ejemplo «Posible nuevo registro local») y un botón **Guardar observación** grande, fijo al pie de la pantalla. |

## Cambios de navegación

- Barra inferior de 4 pestañas como el prototipo: **Mapa · Especies · Mis Observaciones · Más**.
- **Más** abre: perfil, avatar y logros; ajustes; créditos del mapa; volver a elegir reino.
- El nivel y el XP se ven en la pantalla de inicio, en Mis Observaciones y en Más.
- El botón de capas alterna entre mapa **satelital** y **topográfico**.

## Modo DEMO y publicidad

- **DEMO** (botón pequeño bajo los botones del mapa): pone 6 especies reales de la zona alrededor de tu avatar, 4 dentro de la distancia de captura y 2 un poco más lejos para probar el radar. Se marcan con la etiqueta «DEMO». Al capturarlas, la cámara ofrece **Simular foto y validación**: usa la foto de la especie, simula la IA y valida con los registros reales de la zona. Lo guardado queda marcado «DEMO» en la colección. Si se toma una foto real, la validación es la normal.
- **Banner de publicidad**: franja de 30 px sobre la barra inferior con Banco de Chile y CORFO desplazándose; aparece en todas las pantallas (en el inicio y la captura, al pie) y se puede cerrar con la X: vuelve a aparecer a los 10 segundos. Los avisos están en `ADS` en `app.js`; para usar los logos oficiales, agrega el archivo y pon su ruta en `img`.

## Uso sin conexión (cerros y montañas sin señal)

1. **Antes de salir, con conexión:** en el mapa elige el radio y toca el botón de la nube (o **Más › Mapa sin conexión**) y luego **Guardar esta zona**. Se descargan:
   - el mapa del radio (satelital o topográfico, según la capa activa) desde zoom 10 hasta el máximo que quepa en ~2.600 partes;
   - las especies, sus registros y coordenadas, y sus familias;
   - las fotos que lo permiten (las de licencia abierta de iNaturalist).
2. **En terreno, sin señal:** la app abre igual (queda guardada en el teléfono). El GPS no necesita datos móviles, así que tu posición, las capturas y los nuevos registros se ubican sobre el mapa guardado. La validación usa los registros de la zona y queda marcada **por verificar**; el catálogo busca entre las especies de la zona.
3. **Al volver la conexión:** la app verifica sola con iNaturalist y GBIF las observaciones hechas sin señal y recarga los datos en vivo.

Lo que necesita conexión sí o sí: la identificación con IA (token de iNaturalist), el gráfico de observaciones por mes y las fichas de especies que no hayas abierto antes.

Técnicamente: `sw.js` es un *service worker* (app y librerías guardadas; APIs con red primero y respaldo guardado; mapa y fotos con lo guardado primero). Al publicar cambios, sube `VERSION` en `sw.js`.

## Datos guardados

En `localStorage` con claves propias (`nx4.settings`, `nx4.collection`, `nx4.game`), separadas de las otras versiones.
