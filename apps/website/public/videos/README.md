# Videos del sitio

## Hero — fondo de video (PENDIENTE de entrega por el cliente)

El Hero (`src/components/sections/Hero.astro`) espera:

- `hero.webm` y/o `hero.mp4` — clip de planta / conformado de lámina / operación.
  Recomendado: **muted + loop**, ~10–20 s, comprimido, sin audio.
- `hero-poster.svg` — poster de respaldo (ya incluido como placeholder). Reemplazar por
  `hero-poster.jpg` (primer frame del video) cuando exista el clip, y actualizar el
  atributo `poster` en `Hero.astro`.

Mientras no exista el video, el Hero muestra el poster sobre fondo grafito; el overlay
garantiza la legibilidad del texto. El `<video>` usa `preload="none"` para no penalizar
la carga en móvil.
