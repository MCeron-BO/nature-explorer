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
| 2 · Mapa (Flora) | Cabecera blanca con logo «Nature Explorer · Flora» y engranaje de ajustes; tarjeta «Radio de búsqueda» con botones segmentados; pines tipo gota con la foto de cada especie; botones redondos de ubicación y capas; botones grandes **Capturar** y **Nuevo Registro**; escala del mapa; panel con «N especies de plantas en un radio de X km» y 4 cifras (Nativas, Endémicas, Amenazadas, Registros). |
| 3 · Listado de especies | «Flora del entorno» con volver y lupa; buscador con botón de filtros; filas con foto, nombre, nombre científico, distancia, registros y flecha; barra verde **Descargar listado del entorno** que se despliega con Excel, CSV, PDF, KML y KMZ. |
| 4 · Nuevo registro | Todo en una sola pantalla: foto principal con lápiz para cambiarla, miniaturas y «Agregar fotos», Ubicación y Fecha y hora con **Editar**, «Identificar especie» con **Sugerir con IA** o **Buscar en catálogo**, coincidencias con barra y porcentaje, aviso de resultado (por ejemplo «Posible nuevo registro local») y **Guardar observación**. |

## Cambios de navegación

- Barra inferior de 4 pestañas como el prototipo: **Mapa · Especies · Mis Observaciones · Más**.
- **Más** abre: perfil, avatar y logros; ajustes; créditos del mapa; volver a elegir reino.
- El nivel y el XP se ven en la pantalla de inicio, en Mis Observaciones y en Más.
- El botón de capas alterna entre mapa **satelital** y **topográfico**.

## Datos guardados

En `localStorage` con claves propias (`nx4.settings`, `nx4.collection`, `nx4.game`), separadas de las otras versiones.
