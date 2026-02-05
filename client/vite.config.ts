import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
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
