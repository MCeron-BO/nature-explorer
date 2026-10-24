# Nature Explorer Campo (versión 3)

Versión intermedia entre la v1 (formal y científica) y la v2 Aventura (juego para adolescentes), pensada para personas de **25 a 40 años**: tono cercano y moderno, sin perder lo entretenido.

## Ejecutar

```bash
python -m http.server 5175 --directory app-v3
```

Abre http://localhost:5175

## Qué conserva de la v2

- Sonidos y vibración: radar de cercanía, captura, XP y logros.
- Botones flotantes de colores con un leve vaivén y botón central **Capturar**.
- Avatar como tu posición (persona, mujer, hombre o animales), que se arrastra en modo prueba y te sigue con GPS real.
- Cada planta con su propia foto como ícono, con borde según su rareza.
- XP, niveles, rareza de 1 a 5 estrellas, logros y datos curiosos al capturar.

## Qué cambia respecto a la v2

| Área | v2 Aventura | v3 Campo |
|---|---|---|
| Tipografía | Fredoka + Nunito (redondeada) | Outfit + Manrope (moderna, limpia) |
| Acabado | Bordes negros gruesos y sombras tipo sticker | Sombras suaves, fondos translúcidos, sin bordes gruesos |
| Colores | Lima, coral y morado vivos | Verde bosque, salvia, ámbar y terracota |
| Textos | «¡Planta salvaje encontrada!», «¡CAPTURAR!» | «Especie encontrada», «Capturar» |
| Radar | Frío · Tibio · Caliente · ¡Ardiendo! · ¡Está aquí! | Lejos · Cerca · Muy cerca · A pocos metros · Aquí |
| Niveles | Semilla → Leyenda verde | Semilla, Brote, Raíz, Tallo, Follaje, Floración, Fruto, Bosque maduro |
| Rareza | … Épica, Legendaria | … Muy rara, Excepcional |
| Logros | Nombres de juego (Mano verde, Rompe mapas) | Nombres descriptivos (Cinco especies, Ampliación de rango) |
| Emojis | Muchos, como decoración | Solo en avatares y logros |

## Datos guardados

En `localStorage` con claves propias (`nx3.settings`, `nx3.collection`, `nx3.game`), separadas de la v1 y la v2.
