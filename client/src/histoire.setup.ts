import { createPinia } from 'pinia'
import './assets/main.css'

export function setupApp({ app }: { app: import('vue').App }) {
  app.use(createPinia())
}
