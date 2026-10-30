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
| 4 · Registrar | Arriba dos pestañas: **Nuevo Registro** y **Mis Registros**. **Nuevo Registro:** foto principal con lápiz y papelera, miniaturas y «Agregar fotos» (**Cámara** o **Galería**). Con la cámara cada foto toma tu **ubicación actual**; desde la galería, la **ubicación guardada en la foto** (EXIF) y su fecha, o tu ubicación actual si no la trae. No hay confirmación aparte: bajo «Ubicación» se ve un **mapa** con la foto elegida como pin; tocas el mapa o arrastras el pin para ajustarla, «Cambiar» lo agranda y el botón de mira vuelve a tu ubicación. **Cada foto tiene su propia ubicación**: eliges la foto arriba (o su número en el mapa) y la ajustas; el registro usa la de la foto elegida. Se muestra el lugar (comuna, región). Identificación: **Buscar en catálogo** (con especies recientes y alias) o **Identificar después**, que guarda el registro «Sin identificar». **Mis Registros:** filtros Todas · Identificadas · Sin identificar, orden (recientes, antiguos, nombre), casillas para **Eliminar** o **Exportar** (CSV o KML) los seleccionados y menú ⋮ por registro (sugerencias de la IA, cambiar especie en el catálogo, volver a identificar, ver en el mapa, eliminar). Los registros sin identificar los **identifica la IA de iNaturalist automáticamente** (requiere el token en Ajustes); queda «Identificada · IA 87 %». |

## Cambios de navegación

- Barra inferior: **Mapa · Especies · Registrar · Mi Herbario · Colección · Más** (se personaliza en Más › Personalizar la barra inferior).
- **Más** abre: perfil, avatar y logros; ajustes; créditos del mapa; volver a elegir reino.
- El nivel y el XP se ven en la pantalla de inicio, en Mis Observaciones y en Más.
- El botón de capas alterna entre mapa **satelital** y **topográfico**.

## Alias de especies

- En la ficha de cada especie, **+ Agregar alias** guarda un apodo tuyo (por ejemplo «bambú AS»). Sugiere abreviaturas con un toque: primera palabra + iniciales («Aguja DP»), solo iniciales («ADP») o el científico abreviado («E. cicutarium»). Una especie puede tener varios alias; si repites uno en dos especies, la búsqueda muestra ambas.
- El buscador del mapa, el de Especies y «Buscar en catálogo» de Nuevo registro revisan tus alias **primero**, sin importar mayúsculas, tildes ni espacios («bambu as», «BambúAS»). Los resultados con alias llevan la etiqueta ★. Además reconocen las iniciales del nombre común aunque no tengas alias («adp» → Aguja del pastor).
- **Más › Mis alias** lista todos para editarlos (toca el alias), eliminarlos (X), abrir la ficha, y **Exportar / Importar** un archivo `.json` para respaldarlos o pasarlos a otro teléfono.
- Se guardan solo en este teléfono (`nx4.aliases`), por especie (id de iNaturalist o nombre científico), y funcionan sin conexión.

## Mi Herbario

Álbum de lo que has capturado e identificado (capturas y nuevos registros con especie), que se llena solo a medida que descubres plantas:

1. **Familias:** tarjetas con el nombre de la familia, «N especies descubiertas», su nombre común y la foto de una de sus especies.
2. **Géneros** de la familia: tarjetas con foto y cuántas especies llevas en cada uno.
3. **Especies** del género: foto tuya (o de iNaturalist), nombre, cuántas veces la registraste y la fecha del último registro; abre la ficha. Tiene buscador (también por alias).

En los tres niveles se ordena por **Más completados**, **Recientes** o **Por fecha** (primer descubrimiento). La familia y el género salen de la taxonomía de iNaturalist y se guardan en el teléfono (`nx4.taxa`), así que el herbario funciona sin conexión.

## Tus fotos en el mapa

- El mapa principal marca con un círculo con la foto cada lugar donde tomaste fotos: capturas (borde ámbar) y nuevos registros (borde azul, uno por foto). Al tocarlo muestra la especie, la fecha y el lugar.
- **Mantener presionado** un punto del mapa (o clic derecho en el computador) lleva el avatar ahí y recarga las especies alrededor. Si estabas con GPS real, pasa a ubicación de prueba; para volver: **Ajustes › GPS real**.

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

En `localStorage` con claves propias (`nx4.settings`, `nx4.collection`, `nx4.game`, `nx4.aliases`, `nx4.taxa`), separadas de las otras versiones.
