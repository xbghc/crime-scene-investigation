import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Histoire 作为静态文档站部署，不需要 Service Worker；其打包出的 vendor
// bundle 又超过了 workbox 的 2 MiB precache 上限，因此 histoire build 时跳过 PWA。
const isHistoire = !!process.env.HISTOIRE

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    !isHistoire && VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '犯罪现场',
        short_name: '犯罪现场',
        description: '犯罪现场推理桌游',
        theme_color: '#1a1a2e',
        background_color: '#0d1117',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/pwa-icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  server: {
    port: 8030,
    proxy: {
      '/api': {
        target: 'http://localhost:8040',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:8040',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
