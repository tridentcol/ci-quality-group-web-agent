# Videos del sitio

## Hero — fondo de video

Archivos que consume el Hero (`src/components/sections/Hero.astro`):

- `hero.webm` (VP9, ~2.7 MB) — navegadores que lo soporten (Chrome/Firefox).
- `hero.mp4` (H.264, ~4.3 MB) — fallback universal (Safari/iOS).
- `hero-poster.jpg` — primer frame; se ve al instante mientras carga y si el
  navegador bloquea el autoplay.

Loop de ~35 s (dos clips de la operación concatenados), **sin audio**, 1280×720.
El `<video>` va `autoplay muted loop playsinline`; el overlay oscuro del hero
garantiza la legibilidad del texto.

### Para reemplazarlo por otro material

Desde los clips crudos, optimizar con ffmpeg (sin audio, 720p):

```bash
# MP4 (H.264)
ffmpeg -i clipA.mp4 -i clipB.mp4 \
  -filter_complex "[0:v:0][1:v:0]concat=n=2:v=1:a=0,scale=1280:720,fps=30,format=yuv420p[v]" \
  -map "[v]" -an -c:v libx264 -crf 27 -preset slow -movflags +faststart hero.mp4
# WEBM (VP9) — subir CRF hasta que pese menos que el mp4
ffmpeg -i clipA.mp4 -i clipB.mp4 \
  -filter_complex "[0:v:0][1:v:0]concat=n=2:v=1:a=0,scale=1280:720,fps=30[v]" \
  -map "[v]" -an -c:v libvpx-vp9 -crf 42 -b:v 0 -row-mt 1 hero.webm
# Poster
ffmpeg -ss 1.5 -i clipA.mp4 -frames:v 1 -vf scale=1280:720 -q:v 3 hero-poster.jpg
```
