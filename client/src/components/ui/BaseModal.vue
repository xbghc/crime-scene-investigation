<script setup lang="ts">
interface Props {
  modelValue: boolean
  title?: string
  fullscreen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  fullscreen: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function close() {
  emit('update:modelValue', false)
}

function onBackdropClick() {
  if (!props.fullscreen) {
    close()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="modal-overlay" @click.self="onBackdropClick">
        <div
          :class="['modal-card', { 'modal-card--fullscreen': fullscreen }]"
          role="dialog"
          aria-modal="true"
        >
          <header v-if="title || !fullscreen" class="modal-header">
            <h2 v-if="title" class="modal-title">{{ title }}</h2>
            <button class="modal-close" aria-label="Close" @click="close">
              &times;
            </button>
          </header>

          <div class="modal-body">
            <slot />
          </div>

          <footer v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-overlay);
  padding: 16px;
}

.modal-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  width: 100%;
  max-width: 480px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-card--fullscreen {
  max-width: none;
  max-height: none;
  width: 100%;
  height: 100%;
  border-radius: 0;
  border: none;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.modal-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text);
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  min-height: 32px;
  min-width: 32px;
  border-radius: var(--border-radius);
  font-size: 1.4rem;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.modal-close:hover {
  background-color: var(--bg-secondary);
  color: var(--color-text);
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-active .modal-card,
.modal-leave-active .modal-card {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-card,
.modal-leave-to .modal-card {
  transform: scale(0.92);
  opacity: 0;
}
</style>
