<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import IconButton from '../components/ui/IconButton.vue'

const router = useRouter()
const authStore = useAuthStore()

const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  if (!password.value.trim()) return
  error.value = ''
  loading.value = true
  try {
    const success = await authStore.verifyPassword(password.value)
    if (success) {
      router.push('/lobby')
    } else {
      error.value = '密码错误'
    }
  } catch {
    error.value = '连接失败，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="vignette min-h-dvh flex flex-col items-center justify-center px-6 bg-bg-primary">
    <!-- Content (above vignette) -->
    <div class="relative z-10 w-full max-w-xs flex flex-col items-center">

      <!-- Top badge -->
      <div class="flex items-center gap-2 mb-6">
        <span class="material-symbols-outlined text-crimson-light text-2xl">lock</span>
        <span class="text-crimson-light text-xs font-semibold tracking-[0.2em] uppercase">Restricted</span>
      </div>

      <!-- Clearance level -->
      <p class="text-text-dim text-[0.7rem] tracking-[0.25em] uppercase mb-10">Level 4 Clearance Required</p>

      <!-- Main title area with fingerprint watermark -->
      <div class="relative mb-10 text-center">
        <span class="fingerprint-bg material-symbols-outlined">fingerprint</span>
        <h1 class="text-2xl font-bold tracking-[0.08em] text-text-primary mb-1">DECRYPT CASE FILE</h1>
        <p class="text-text-muted text-sm tracking-[0.1em]">犯罪现场调查</p>
      </div>

      <!-- Form -->
      <form class="w-full flex flex-col gap-4" @submit.prevent="handleSubmit">
        <input
          v-model="password"
          type="password"
          class="auth-input"
          placeholder="输入访问密码"
          autocomplete="off"
          :disabled="loading"
        />

        <p v-if="error" class="text-crimson-light text-sm text-center">{{ error }}</p>

        <IconButton type="submit" icon="key" :loading="loading" :disabled="!password.trim()" block>
          进入档案
        </IconButton>
      </form>

      <!-- Footer hint -->
      <p class="mt-10 text-text-dim text-xs">连接有问题？</p>
    </div>
  </div>
</template>

<style scoped>
.fingerprint-bg {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 8rem;
  color: var(--color-text-dim);
  opacity: 0.08;
  pointer-events: none;
  user-select: none;
}

.auth-input {
  width: 100%;
  padding: 14px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  color: var(--color-text);
  font-size: 1rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.auth-input:focus {
  border-color: var(--color-crimson-light);
  box-shadow: 0 0 0 3px rgba(211, 47, 47, 0.15);
}

.auth-input::placeholder {
  color: var(--color-text-dim);
}
</style>
