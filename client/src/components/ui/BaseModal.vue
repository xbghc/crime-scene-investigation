<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import AppIcon from './AppIcon.vue'

interface Props {
  modelValue: boolean
  title?: string
  fullscreen?: boolean
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  fullscreen: false,
  ariaLabel: '游戏提示',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const dialog = ref<HTMLElement | null>(null)
const titleId = useId()
let previousFocus: HTMLElement | null = null

function focusableElements() {
  return Array.from(
    dialog.value?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ) ?? [],
  )
    .filter((element) => !element.hidden && element.getClientRects().length > 0)
    .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
}

function topDialog(excludeSelf = false) {
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[data-base-dialog]')).filter(
    (element) => element !== dialog.value || (!excludeSelf && props.modelValue),
  )
  return dialogs[dialogs.length - 1]
}

function restoreFocus() {
  if (!previousFocus) return
  const top = topDialog(true)
  if (top?.contains(document.activeElement)) {
    previousFocus = null
    return
  }
  if (previousFocus?.isConnected && (!top || top.contains(previousFocus))) {
    previousFocus.focus()
  } else if (top) {
    ;(
      top.querySelector<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
      ) ?? top
    ).focus()
  }
  previousFocus = null
}

function onKeydown(event: KeyboardEvent) {
  if (!props.modelValue || !dialog.value) return
  if (topDialog() !== dialog.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
  } else if (event.key === 'Tab') {
    const elements = focusableElements()
    const first = elements[0]
    const last = elements[elements.length - 1]
    if (!first) {
      event.preventDefault()
      dialog.value.focus()
    } else if (
      event.shiftKey &&
      (document.activeElement === first || !dialog.value.contains(document.activeElement))
    ) {
      event.preventDefault()
      last?.focus()
    } else if (
      !event.shiftKey &&
      (document.activeElement === last || !dialog.value.contains(document.activeElement))
    ) {
      event.preventDefault()
      first.focus()
    }
  }
}

watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
      document.addEventListener('keydown', onKeydown)
      await nextTick()
      if (props.modelValue && topDialog() === dialog.value)
        (
          dialog.value?.querySelector<HTMLElement>('[autofocus]') ??
          focusableElements()[0] ??
          dialog.value
        )?.focus()
    } else {
      document.removeEventListener('keydown', onKeydown)
      restoreFocus()
    }
  },
  { immediate: true, flush: 'post' },
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  restoreFocus()
})

function onBeforeLeave(element: Element) {
  // A leaving transition remains in the DOM briefly, but must no longer own focus.
  element.querySelector('[data-base-dialog]')?.removeAttribute('data-base-dialog')
}

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
    <Transition name="modal" @before-leave="onBeforeLeave">
      <div
        v-if="modelValue"
        :class="['modal-overlay', { 'modal-overlay--fullscreen': fullscreen }]"
        @click.self="onBackdropClick"
      >
        <div
          ref="dialog"
          data-base-dialog
          tabindex="-1"
          :aria-labelledby="title ? titleId : undefined"
          :aria-label="title ? undefined : ariaLabel"
          :class="['modal-card', { 'modal-card--fullscreen': fullscreen }]"
          role="dialog"
          aria-modal="true"
        >
          <header v-if="title || !fullscreen" class="modal-header">
            <h2 v-if="title" :id="titleId" class="modal-title">{{ title }}</h2>
            <button class="modal-close" aria-label="关闭" @click="close">
              <AppIcon name="close" />
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
  padding: var(--space-4);
}

.modal-card {
  background: var(--popover);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 480px;
  max-height: calc(100dvh - 48px);
  box-shadow: var(--shadow-lg);
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
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--border-color);
}

.modal-title {
  font-size: 20px;
  line-height: 28px;
  font-weight: 600;
  color: var(--color-text);
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  min-height: 44px;
  min-width: 44px;
  border-radius: var(--radius-lg);
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
  padding: var(--space-6);
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  overflow-wrap: anywhere;
}

.modal-footer {
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2);
}

@media (max-width: 480px) {
  .modal-overlay {
    padding: var(--space-3);
  }
  .modal-card {
    max-height: calc(100dvh - 24px);
  }
  .modal-header,
  .modal-body,
  .modal-footer {
    padding: var(--space-4);
  }
  .modal-footer {
    flex-wrap: wrap;
  }
}

.modal-overlay--fullscreen {
  padding: 0;
}
.modal-card--fullscreen {
  max-height: 100dvh;
}
.modal-card--fullscreen .modal-body {
  padding: 0;
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-active .modal-card,
.modal-leave-active .modal-card {
  transition:
    transform 0.25s ease,
    opacity 0.25s ease;
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
