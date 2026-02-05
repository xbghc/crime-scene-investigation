<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

interface Props {
  message: string
  type?: 'info' | 'success' | 'error'
  duration?: number
}

const props = withDefaults(defineProps<Props>(), {
  type: 'info',
  duration: 3000,
})

const emit = defineEmits<{
  dismiss: []
}>()

let timer: ReturnType<typeof setTimeout> | null = null

function dismiss() {
  emit('dismiss')
}

onMounted(() => {
  if (props.duration > 0) {
    timer = setTimeout(dismiss, props.duration)
  }
})

onUnmounted(() => {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <div :class="['base-toast', `base-toast--${type}`]" role="alert" @click="dismiss">
        <span class="base-toast__message">{{ message }}</span>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.base-toast {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  padding: 10px 20px;
  border-radius: var(--border-radius);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  max-width: 90vw;
  text-align: center;
}

.base-toast--info {
  background-color: var(--bg-card);
  color: var(--color-text);
  border: 1px solid var(--border-color);
}

.base-toast--success {
  background-color: rgba(34, 197, 94, 0.15);
  color: var(--color-detective);
  border: 1px solid var(--color-detective);
}

.base-toast--error {
  background-color: rgba(166, 28, 28, 0.2);
  color: var(--color-crimson-light);
  border: 1px solid var(--color-crimson);
}

/* Transitions */
.toast-enter-active,
.toast-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.toast-enter-from {
  transform: translateX(-50%) translateY(-20px);
  opacity: 0;
}

.toast-leave-to {
  transform: translateX(-50%) translateY(-20px);
  opacity: 0;
}
</style>
