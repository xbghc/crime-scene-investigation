<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import IconButton from '../components/ui/IconButton.vue'

const router = useRouter()
const authStore = useAuthStore()

const digitCount = 6
const digits = ref<string[]>(Array(digitCount).fill(''))
const inputRefs = ref<HTMLInputElement[]>([])
const error = ref('')
const loading = ref(false)
const hintHover = ref(false)

function reload() { window.location.reload() }

const password = computed(() => digits.value.join(''))
const isFilled = computed(() => digits.value.every(d => d !== ''))

function focusInput(index: number) {
  nextTick(() => inputRefs.value[index]?.focus())
}

function handleInput(index: number, event: Event) {
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
  const text = event.clipboardData?.getData('text') ?? ''
  const chars = text.replace(/\s/g, '').slice(0, digitCount).split('')
  chars.forEach((ch, i) => { digits.value[i] = ch })
  // Focus the next empty or last
  const nextIndex = Math.min(chars.length, digitCount - 1)
  focusInput(nextIndex)
  if (isFilled.value) {
    handleSubmit()
  }
}

async function handleSubmit() {
  if (!isFilled.value) return
  error.value = ''
  loading.value = true
  try {
    const success = await authStore.verifyPassword(password.value)
    if (success) {
      router.push('/lobby')
    } else {
      error.value = '密码错误'
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
  <div class="vignette min-h-dvh flex flex-col items-center justify-center px-6 bg-bg-primary">
    <div class="relative z-10 w-full max-w-xs flex flex-col items-center">

      <!-- Top badge -->
      <div class="flex items-center gap-2 mb-8">
        <span class="material-symbols-outlined text-crimson-light text-2xl">lock</span>
        <span class="text-crimson-light text-xs font-semibold tracking-[0.2em] uppercase">Restricted</span>
      </div>

      <!-- PIN Input Group: 3 + spacer + 3 -->
      <form class="w-full flex flex-col items-center" @submit.prevent="handleSubmit">
        <div class="flex justify-center gap-2 mb-8">
          <template v-for="(_, i) in digitCount" :key="i">
            <!-- Spacer between group of 3 -->
            <div v-if="i === 3" class="w-2" />
            <input
              :ref="(el) => { if (el) inputRefs[i] = el as HTMLInputElement }"
              :value="digits[i]"
              type="text"
              inputmode="numeric"
              maxlength="1"
              class="pin-cell"
              placeholder="·"
              :disabled="loading"
              @input="handleInput(i, $event)"
              @keydown="handleKeydown(i, $event)"
              @paste="handlePaste"
              @focus="($event.target as HTMLInputElement).select()"
            />
          </template>
        </div>

        <p v-if="error" class="text-crimson-light text-sm text-center mb-4">{{ error }}</p>

        <IconButton type="submit" icon="key" :loading="loading" :disabled="!isFilled" block>
          进入档案
        </IconButton>
      </form>

      <!-- Footer hint: hover 切换文字，点击刷新页面 -->
      <p
        class="mt-10 text-text-dim text-xs tracking-widest uppercase cursor-pointer transition-colors hover:text-text-muted"
        @mouseenter="hintHover = true"
        @mouseleave="hintHover = false"
        @click="reload()"
      >
        {{ hintHover ? '刷新页面' : '连接有问题？' }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.pin-cell {
  width: 2.5rem;
  height: 3.5rem;
  background: rgba(255, 255, 255, 0.05);
  border: none;
  border-bottom: 2px solid var(--color-crimson);
  border-radius: 4px 4px 0 0;
  color: var(--color-text);
  font-size: 1.25rem;
  font-weight: 700;
  font-family: inherit;
  text-align: center;
  outline: none;
  transition: border-color 0.2s, background-color 0.2s;
  -webkit-user-select: text;
  user-select: text;
}

.pin-cell:focus {
  border-bottom-color: var(--color-crimson-light);
  background: rgba(255, 255, 255, 0.1);
}

.pin-cell::placeholder {
  color: rgba(255, 255, 255, 0.2);
}

.pin-cell:disabled {
  opacity: 0.5;
}
</style>
