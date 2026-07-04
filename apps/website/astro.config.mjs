// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@tailwindcss/vite';

// Sitio estático (Cloudflare Pages sirve /dist). Sin adapter: output 'static'.
// El dominio raíz definitivo se ajusta en `site` cuando el cliente lo confirme.
export default defineConfig({
  site: 'https://ci-quality-group.com',
  vite: {
    plugins: [tailwind()],
  },
});
