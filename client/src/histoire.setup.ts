import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { defineSetupVue3 } from '@histoire/plugin-vue'
import './assets/main.css'

export const setupVue3 = defineSetupVue3(({ app }) => {
  app.use(createPinia())

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
  app.use(router)
})
