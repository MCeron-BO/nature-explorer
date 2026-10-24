# Nature Explorer Aventura (versión 2)

Versión con estilo de juego para adolescentes. Usa los mismos datos reales de **iNaturalist** y **GBIF** que la versión 1 (carpeta `app/`), que no se modificó.

## Ejecutar

```bash
python -m http.server 5174 --directory app-v2
```

Abre http://localhost:5174

## Qué cambia respecto a la versión 1

| Área | Versión 2 |
|---|---|
| Estilo | Tipografías Fredoka y Nunito, colores vivos (lima, sol, coral, morado, cielo), bordes gruesos y sombras tipo sticker. Archivo extra: `aventura.css`. |
| Botones flotantes | Botones de colores que flotan y se hunden al tocarlos; botón central **Atrapar** en la barra inferior. |
| Juego | XP, 8 niveles (Semilla → Leyenda verde), rareza de 1 a 5 estrellas, 9 logros, recompensas visibles (+XP) y datos curiosos al capturar. |
| Avatar | Tu posición es un avatar elegible (10 opciones). En modo prueba se **arrastra** para "caminar"; con GPS real te sigue mientras caminas. |
| Plantas en el mapa | Cada especie aparece con **su propia foto** como ícono (las 160 más cercanas), con borde del color de su rareza. El resto, como puntitos. |
| Radar con sonidos | Indica qué tan cerca estás de la planta más próxima: Frío, Tibio, Caliente, ¡Ardiendo! y ¡Está aquí! Suena y vibra cada vez que te acercas más. |
| Regla de captura | Solo se captura lo que está cerca (por defecto, 50 m), también en modo prueba. |

## Rareza (basada en datos reales)

| Rareza | Condición (registros en tu zona) | Bonus |
|---|---|---|
| ★ Común | más de 40 | +0 XP |
| ★★ Poco común | 16 a 40 | +10 XP |
| ★★★ Rara | endémica, o 6 a 15 | +25 XP |
| ★★★★ Épica | amenazada, o 3 a 5 | +50 XP |
| ★★★★★ Legendaria | endémica y amenazada, o 1 a 2 | +100 XP |

## XP

Capturar +10 · Especie nueva para ti +25 · Bonus de rareza · Validar con foto +50 · Posible nuevo registro local +150 · Posible ampliación de distribución +300 · Nuevo registro propio +20 extra.

## Datos guardados

En `localStorage` con claves propias (`nx2.settings`, `nx2.collection`, `nx2.game`), así no se mezclan con la versión 1 aunque se publiquen en el mismo dominio.
