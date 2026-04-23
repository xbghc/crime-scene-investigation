import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { defineSetupVue3 } from '@histoire/plugin-vue'
import './assets/main.css'

export const setupVue3 = defineSetupVue3(({ app }) => {
  app.use(createPinia())

  /* 先移除 @histoire/plugin-vue 预注册的 stub RouterLink，避免 app.use(router) 重复注册触发 Vue 警告。 */
  const components = (app as unknown as { _context: { components: Record<string, unknown> } })._context.components
  delete components.RouterLink
  delete components.RouterView

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
  app.use(router)
})
