<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import IconButton from '../components/ui/IconButton.vue'
import AppIcon from '../components/ui/AppIcon.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const digitCount = 6
const digits = ref<string[]>(Array(digitCount).fill(''))
const inputRefs = ref<HTMLInputElement[]>([])
const error = ref('')
const loading = ref(false)

function reload() {
  window.location.reload()
}

const password = computed(() => digits.value.join(''))
const isFilled = computed(() => digits.value.every((d) => d !== ''))

function focusInput(index: number) {
  nextTick(() => inputRefs.value[index]?.focus())
}

function handleInput(index: number, event: Event) {
  if (loading.value) return
  error.value = ''
  const input = event.target as HTMLInputElement
  const val = input.value
  // Take only last char (handles overtype)
  digits.value[index] = val.slice(-1)
  if (val && index < digitCount - 1) {
    focusInput(index + 1)
  }
  // Auto-submit when all filled
  if (isFilled.value) {
    handleSubmit()
  }
}

function handleKeydown(index: number, event: KeyboardEvent) {
  if (event.key === 'Backspace') {
    if (!digits.value[index] && index > 0) {
      // Current cell empty, go back and clear previous
      digits.value[index - 1] = ''
      focusInput(index - 1)
      event.preventDefault()
    } else {
      digits.value[index] = ''
    }
  } else if (event.key === 'ArrowLeft' && index > 0) {
    focusInput(index - 1)
  } else if (event.key === 'ArrowRight' && index < digitCount - 1) {
    focusInput(index + 1)
  }
}

function handlePaste(event: ClipboardEvent) {
  event.preventDefault()
  if (loading.value) return
  error.value = ''
  const text = event.clipboardData?.getData('text') ?? ''
  const chars = text.replace(/\s/g, '').slice(0, digitCount).split('')
  chars.forEach((ch, i) => {
    digits.value[i] = ch
  })
  // Focus the next empty or last
  const nextIndex = Math.min(chars.length, digitCount - 1)
  focusInput(nextIndex)
  if (isFilled.value) {
    handleSubmit()
  }
}

async function handleSubmit() {
  if (!isFilled.value || loading.value) return
  error.value = ''
  loading.value = true
  try {
    const success = await authStore.verifyPassword(password.value)
    if (success) {
      router.push({ path: '/lobby', query: route.query })
    } else {
      error.value = '密码不正确，请重新输入。'
      // Shake + clear on error
      digits.value.fill('')
      focusInput(0)
    }
  } catch {
    error.value = '连接失败，请重试'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="password-page vignette">
    <section class="access-panel" aria-labelledby="access-title">
      <div class="access-panel__badge">
        <AppIcon name="lock" />
        <span>访问受限</span>
      </div>
      <header class="access-panel__header">
        <p class="access-panel__eyebrow">犯罪现场 · 调查档案</p>
        <h1 id="access-title">输入访问密码</h1>
        <p id="access-description">输入 6 位密码，开启本次调查。</p>
      </header>

      <form class="access-form" :aria-busy="loading" @submit.prevent="handleSubmit">
        <fieldset class="pin-fieldset" :disabled="loading" aria-describedby="access-description">
          <legend class="sr-only">6 位访问密码</legend>
          <div class="pin-group">
            <template v-for="(_, i) in digitCount" :key="i">
              <span v-if="i === 3" class="pin-divider" aria-hidden="true"></span>
              <input
                :ref="
                  (el) => {
                    if (el) inputRefs[i] = el as HTMLInputElement
                  }
                "
                :value="digits[i]"
                type="text"
                inputmode="numeric"
                maxlength="1"
                autocomplete="off"
                :aria-label="`密码第 ${i + 1} 位`"
                :aria-invalid="!!error"
                :aria-describedby="error ? 'password-error' : undefined"
                class="pin-cell"
                :class="{ 'pin-cell--filled': digits[i] }"
                placeholder="·"
                :disabled="loading"
                @input="handleInput(i, $event)"
                @keydown="handleKeydown(i, $event)"
                @paste="handlePaste"
                @focus="($event.target as HTMLInputElement).select()"
              />
            </template>
          </div>
        </fieldset>

        <p v-if="error" id="password-error" class="access-error" role="alert">
          <AppIcon name="error" />
          <span>{{ error }}</span>
        </p>
        <p v-else class="access-form__hint" role="status">
          {{ loading ? '正在验证访问权限…' : '支持粘贴完整密码，输入后自动验证' }}
        </p>

        <IconButton type="submit" icon="key" :loading="loading" :disabled="!isFilled" block>
          进入档案
        </IconButton>
      </form>
      <div class="access-panel__footer">
        <span>连接遇到问题？</span>
        <button type="button" class="reload-button" :disabled="loading" @click="reload">
          <AppIcon name="refresh" />
          刷新页面
        </button>
      </div>
    </section>
    <p class="access-caption">观察线索，寻找真相</p>
  </main>
</template>

<style scoped>
.password-page {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-6);
  padding: calc(var(--space-8) + var(--safe-area-top)) var(--space-4)
    calc(var(--space-8) + var(--safe-area-bottom));
  background: var(--background);
}

.access-panel {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 400px;
  padding: var(--space-6);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
}

.access-panel__badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  border: 1px solid color-mix(in srgb, var(--color-crimson-light) 30%, transparent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-crimson) 10%, transparent);
  color: var(--destructive);
  font-size: 12px;
  font-weight: 500;
}

.access-panel__header {
  display: grid;
  gap: var(--space-2);
  margin: var(--space-6) 0 var(--space-8);
}

.access-panel__eyebrow {
  color: var(--color-text-muted);
  font-size: 12px;
}

.access-panel__header h1 {
  color: var(--foreground);
  font-size: 24px;
  line-height: 32px;
  font-weight: 600;
  letter-spacing: -0.025em;
}

.access-panel__header > p:last-child {
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 20px;
}

.access-form {
  display: grid;
  gap: var(--space-4);
}

.pin-fieldset {
  border: 0;
  min-width: 0;
  padding: 0;
}

.pin-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-1);
}

.pin-divider {
  width: var(--space-1);
  height: 1px;
  flex-shrink: 0;
  background: var(--border);
}

.pin-cell {
  width: 100%;
  min-width: 0;
  height: 52px;
  border: 1px solid var(--input);
  border-radius: var(--radius-md);
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 600;
  text-align: center;
  outline: none;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
  -webkit-user-select: text;
  user-select: text;
}

.pin-cell--filled {
  border-color: var(--color-text-muted);
}

.pin-cell:focus-visible {
  border-color: var(--ring);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 35%, transparent);
}

.pin-cell[aria-invalid='true'] {
  border-color: var(--destructive);
}

.pin-cell::placeholder {
  color: var(--color-text-muted);
}

.pin-cell:disabled {
  opacity: 0.5;
  cursor: wait;
}

.access-error,
.access-form__hint {
  min-height: 20px;
  font-size: 12px;
  line-height: 20px;
  color: var(--color-text-muted);
}

.access-error {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  color: var(--destructive);
}

.access-error :deep(svg) {
  margin-top: 2px;
  flex-shrink: 0;
}

.access-panel__footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border);
  color: var(--color-text-muted);
  font-size: 12px;
}

.reload-button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-2);
  border-radius: var(--radius-md);
  color: var(--foreground);
  font-size: 12px;
}

.reload-button:hover:not(:disabled) {
  background: var(--secondary);
}

.reload-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.access-caption {
  position: relative;
  color: var(--color-text-muted);
  font-size: 12px;
  letter-spacing: 0.08em;
}

@media (min-width: 640px) {
  .access-panel {
    max-width: 432px;
  }
}
</style>
