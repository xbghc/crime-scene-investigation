import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/main.css'

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)

// Check auth before first navigation to avoid flashing password page
const TOKEN_KEY = 'csi_token'
const hasToken = !!localStorage.getItem(TOKEN_KEY)
const currentPath = window.location.pathname

// If authenticated and on root/password page, go directly to lobby
if (hasToken && (currentPath === '/' || currentPath === '/password')) {
  router.replace('/lobby')
}

app.use(router)

// Wait for router to be ready before mounting
router.isReady().then(() => {
  app.mount('#app')
})
