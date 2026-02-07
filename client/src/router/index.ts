import { createRouter, createWebHistory } from 'vue-router'
import PasswordPage from '../views/PasswordPage.vue'
import LobbyPage from '../views/LobbyPage.vue'
import GamePage from '../views/GamePage.vue'
import { useAuthStore } from '../stores/auth'
import { useGameStore } from '../stores/game'

const GAME_ACTIVE_PHASES = new Set([
  'role-reveal',
  'night-murder',
  'witness-accuse',
  'discussion-1',
  'advance-1',
  'discussion-2',
  'advance-2',
  'discussion-3',
  'force-solve',
  'game-over',
])

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
  const gameStore = useGameStore()

  // Must authenticate first
  if (to.name !== 'password' && !authStore.isAuthenticated) {
    return { name: 'password' }
  }

  // Already authenticated → skip password page
  if (to.name === 'password' && authStore.isAuthenticated) {
    return { name: 'lobby' }
  }

  // If game is active, redirect lobby → game
  if (to.name === 'lobby' && GAME_ACTIVE_PHASES.has(gameStore.phase)) {
    return { name: 'game' }
  }

  // If no game is active, redirect game → lobby
  if (to.name === 'game' && !GAME_ACTIVE_PHASES.has(gameStore.phase)) {
    return { name: 'lobby' }
  }
})

export default router
