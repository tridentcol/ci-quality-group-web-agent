// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// Sitio estático (Vercel sirve /dist). Sin adapter: output 'static'.
// `site` es el dominio real de producción: lo usan tanto el canonical/OG de
// BaseLayout.astro como @astrojs/sitemap para generar URLs absolutas.
export default defineConfig({
  site: 'https://ci-quality-group.com',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwind()],
  },
});
