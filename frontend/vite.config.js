import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          { urlPattern: ({ url, request }) => request.method === 'GET' && url.pathname.startsWith('/api/training/sessions/today/'), handler: 'NetworkFirst', options: { cacheName: 'dyno-today' } },
          { urlPattern: ({ url, request }) => request.method === 'GET' && url.pathname.startsWith('/api/training/media/exercises/'), handler: 'CacheFirst', options: { cacheName: 'dyno-images' } },
        ],
      },
    }),
    { name: 'inject-manifest-link', transformIndexHtml: () => [{ tag: 'link', attrs: { rel: 'manifest', href: '/manifest.webmanifest' }, injectTo: 'head' }] },
  ],
})
