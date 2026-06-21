<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  disabled?: boolean
  loading?: boolean
  block?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  disabled: false,
  loading: false,
  block: false,
})

function handleClick(e: MouseEvent) {
  if (props.loading || props.disabled) {
    e.preventDefault()
    e.stopPropagation()
  }
}
</script>

<template>
  <button
    :class="[
      'base-button',
      `base-button--${variant}`,
      { 'base-button--block': block, 'base-button--loading': loading },
    ]"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <span v-if="loading" class="base-button__spinner" />
    <span class="base-button__content" :class="{ 'base-button__content--hidden': loading }">
      <slot />
    </span>
  </button>
</template>

<style scoped>
.base-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 8px 20px;
  border: 1px solid transparent;
  border-radius: var(--border-radius);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    opacity 0.2s ease,
    background-color 0.2s ease;
  position: relative;
  white-space: nowrap;
}

.base-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.base-button:not(:disabled):active {
  opacity: 0.85;
}

/* Primary */
.base-button--primary {
  background-color: var(--color-crimson);
  color: var(--color-text);
}

.base-button--primary:not(:disabled):hover {
  background-color: var(--color-crimson-light);
}

/* Secondary */
.base-button--secondary {
  background-color: var(--bg-secondary);
  color: var(--color-text);
  border-color: var(--border-color);
}

.base-button--secondary:not(:disabled):hover {
  border-color: var(--color-text-muted);
}

/* Danger */
.base-button--danger {
  background-color: var(--color-crimson-light);
  color: var(--color-text);
}

.base-button--danger:not(:disabled):hover {
  opacity: 0.9;
}

/* Ghost */
.base-button--ghost {
  background-color: transparent;
  color: var(--color-text);
}

.base-button--ghost:not(:disabled):hover {
  background-color: var(--bg-card);
}

/* Block */
.base-button--block {
  width: 100%;
}

/* Spinner */
.base-button__spinner {
  position: absolute;
  width: 20px;
  height: 20px;
  border: 3px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.base-button__content--hidden {
  visibility: hidden;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
