import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const TOKEN_KEY = 'csi_token'

function parseJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const parts = jwt.split('.')
    if (parts.length !== 3) return null
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(payload) as Record<string, unknown>
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const isAuthenticated = computed(() => !!token.value)

  const userId = computed(() => {
    if (!token.value) return null
    const payload = parseJwtPayload(token.value)
    return (payload?.id as string) ?? null
  })

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

  return { token, userId, isAuthenticated, verifyPassword, logout }
})
