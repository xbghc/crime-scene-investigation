import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { defineSetupVue3 } from '@histoire/plugin-vue'
import './assets/main.css'

export const setupVue3 = defineSetupVue3(({ app }) => {
  app.use(createPinia())

  // @histoire/plugin-vue 在挂载 story 前会预先注册一个 stub 的 RouterLink；
  // 之后再 app.use(vue-router) 会因 app.component('RouterLink', ...) 重复注册
  // 而触发 Vue 的 "has already been registered" 警告。先移除 stub 让真实组件
  // 干净接管。
  const components = (app as unknown as { _context: { components: Record<string, unknown> } })._context.components
  delete components.RouterLink
  delete components.RouterView

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
  app.use(router)
})
