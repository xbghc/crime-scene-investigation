import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const TOKEN_KEY = 'csi_token'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const isAuthenticated = computed(() => !!token.value)

  async function verifyPassword(password: string): Promise<boolean> {
    const res = await fetch('/api/verify-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await res.json()
    if (data.success && data.token) {
      token.value = data.token
      localStorage.setItem(TOKEN_KEY, data.token)
      return true
    }
    return false
  }

  function logout() {
    token.value = null
    localStorage.removeItem(TOKEN_KEY)
  }

  return { token, isAuthenticated, verifyPassword, logout }
})
