// @ts-check
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';
import AstroPWA from '@vite-pwa/astro';

const PAPER = '#0b0f0e';

export default defineConfig({
  output: 'static',
  devToolbar: { enabled: false },
  build: {
    // Emit every stylesheet as a file so the CSP can stay at style-src 'self'.
    inlineStylesheets: 'never',
  },
  vite: {
    plugins: [tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    build: {
      // Never turn fonts/images into data: URIs; keep everything as same-origin files.
      assetsInlineLimit: 0,
    },
  },
  integrations: [
    preact(),
    AstroPWA({
      registerType: 'prompt',
      // We register the service worker ourselves (src/lib/pwa.ts) so no inline script is injected.
      injectRegister: false,
      manifest: {
        id: '/',
        name: 'Yaad — gentle reminders',
        short_name: 'Yaad',
        description: 'Water, eyes, posture and your own task reminders, on a simple interval. Everything stays on your phone.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: PAPER,
        background_color: PAPER,
        categories: ['health', 'productivity', 'lifestyle'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Long-press the app icon for these. Hash routes open the matching screen.
        shortcuts: [
          { name: 'New reminder', short_name: 'New', url: '/#/edit', icons: [{ src: '/icons/shortcut-add.png', sizes: '96x96', type: 'image/png' }] },
          {
            name: 'Wellness presets',
            short_name: 'Presets',
            url: '/#/presets',
            icons: [{ src: '/icons/shortcut-presets.png', sizes: '96x96', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{html,js,css,svg,png,woff2}'],
        navigateFallback: '/',
        cleanupOutdatedCaches: true,
        // Adds the periodic-sync catch-up handler to the generated service worker.
        importScripts: ['/sw-reminders.js'],
      },
    }),
  ],
});
