<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import BaseButton from '../components/ui/BaseButton.vue'

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
  <div class="password-page">
    <div class="content">
      <h1 class="title">犯罪现场</h1>
      <p class="subtitle">Crime Scene Investigation</p>

      <form class="form" @submit.prevent="handleSubmit">
        <input
          v-model="password"
          type="password"
          class="input"
          placeholder="输入密码"
          autocomplete="off"
          :disabled="loading"
        />
        <p v-if="error" class="error">{{ error }}</p>
        <BaseButton type="submit" :loading="loading" :disabled="!password.trim()" block>
          进入
        </BaseButton>
      </form>
    </div>
  </div>
</template>

<style scoped>
.password-page {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.content {
  width: 100%;
  max-width: 320px;
  text-align: center;
}

.title {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--color-crimson-light);
  letter-spacing: 0.1em;
  margin-bottom: 4px;
}

.subtitle {
  color: var(--color-text-muted);
  font-size: 0.85rem;
  margin-bottom: 48px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.input {
  width: 100%;
  padding: 14px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  color: var(--color-text);
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s;
}

.input:focus {
  border-color: var(--color-amber);
}

.input::placeholder {
  color: var(--color-text-dim);
}

.error {
  color: var(--color-crimson-light);
  font-size: 0.875rem;
}

</style>
