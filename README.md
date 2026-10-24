# Nature Explorer — prototipo con datos reales

App web móvil (HTML + JS, sin compilación) conectada a las APIs públicas de **iNaturalist** y **GBIF**.

## Ejecutar

```bash
python -m http.server 5173 --directory app
```

Abre http://localhost:5173 (en el móvil, usa la IP local de tu equipo; el GPS real requiere HTTPS o localhost).

## Qué viene de cada fuente

| Dato | Fuente |
|---|---|
| Especies en el radio, nativas / endémicas / amenazadas, fotos CC | iNaturalist `observations/species_counts` |
| Puntos del mapa y distancias | iNaturalist `observations` + GBIF `occurrence/search?geoDistance=` |
| Familia, estado de conservación, resumen, galería | iNaturalist `taxa/{id}` |
| Total de ocurrencias y mapa de distribución | GBIF `occurrence/search` + `v2/map/occurrence/density` |
| Observaciones por mes (época del año) | iNaturalist `observations/histogram` |
| Catálogo oficial (nuevo registro) | iNaturalist `taxa/autocomplete` (Plantae) |
| Identificación visual con IA | iNaturalist `computervision/score_image` (requiere token) |

## Limitaciones actuales

- **IA visual**: solo funciona con un token de API de iNaturalist (Ajustes del mapa → token; se obtiene en https://www.inaturalist.org/users/api_token y dura 24 h). Sin él, el usuario confirma la especie manualmente y la validación usa distribución, época y registros cercanos.
- **Publicar en iNaturalist** abre el formulario de subida; el envío directo necesitaría OAuth.
- La colección se guarda en `localStorage` del navegador (sin cuentas ni servidor).
- Las ocurrencias de GBIF incluyen las de iNaturalist con grado de investigación, así que los conteos se solapan.
- Las especies que solo aparecen en GBIF no tienen foto en el listado.
