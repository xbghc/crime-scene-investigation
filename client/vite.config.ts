import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
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
