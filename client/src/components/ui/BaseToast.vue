<script setup lang="ts">
import AppIcon from './AppIcon.vue'
import { onMounted, onUnmounted, ref } from 'vue'

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

const visible = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

function dismiss() {
  emit('dismiss')
}

onMounted(() => {
  visible.value = true
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
      <div
        v-show="visible"
        :class="['base-toast', `base-toast--${type}`]"
        :role="type === 'error' ? 'alert' : 'status'"
      >
        <AppIcon
          :name="type === 'error' ? 'error' : type === 'success' ? 'check_circle' : 'info'"
        />
        <span class="base-toast__message">{{ message }}</span>
        <button class="base-toast__close" aria-label="关闭提示" @click="dismiss">
          <AppIcon name="close" />
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.base-toast {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  position: fixed;
  top: calc(var(--safe-area-top) + var(--space-6));
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  padding: var(--space-2) var(--space-3) var(--space-2) var(--space-4);
  border-radius: var(--border-radius);
  font-size: 0.875rem;
  font-weight: 500;

  box-shadow: var(--shadow-lg);
  max-width: 90vw;
  text-align: center;
}

.base-toast--info {
  background-color: var(--bg-card);
  color: var(--color-text);
  border: 1px solid var(--border-color);
}

.base-toast--success {
  background-color: var(--popover);
  color: var(--color-detective);
  border: 1px solid var(--color-detective);
}

.base-toast--error {
  background-color: var(--popover);
  color: var(--destructive);
  border: 1px solid var(--color-crimson);
}

.base-toast__close {
  display: grid;
  place-items: center;
  border-radius: var(--radius-md);
}

/* Transitions */
.toast-enter-active,
.toast-leave-active {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
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
