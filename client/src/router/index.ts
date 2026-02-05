import { createRouter, createWebHistory } from 'vue-router'
import PasswordPage from '../views/PasswordPage.vue'
import LobbyPage from '../views/LobbyPage.vue'
import GamePage from '../views/GamePage.vue'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'password',
      component: PasswordPage,
    },
    {
      path: '/lobby',
      name: 'lobby',
      component: LobbyPage,
    },
    {
      path: '/game',
      name: 'game',
      component: GamePage,
    },
  ],
})

router.beforeEach((to) => {
  const authStore = useAuthStore()

  if (to.name !== 'password' && !authStore.isAuthenticated) {
    return { name: 'password' }
  }

  if (to.name === 'password' && authStore.isAuthenticated) {
    return { name: 'lobby' }
  }
})

export default router
