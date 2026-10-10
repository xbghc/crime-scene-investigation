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
    :aria-busy="loading || undefined"
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
  gap: var(--space-2);
  min-height: 44px;
  padding: var(--space-2) var(--space-4);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  cursor: pointer;
  transition:
    opacity 0.2s ease,
    background-color 0.2s ease;
  position: relative;
  white-space: normal;
  text-align: center;
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
  background-color: var(--primary);
  color: var(--primary-foreground);
}

.base-button--primary:not(:disabled):hover {
  background-color: var(--color-crimson-light);
}

/* Secondary */
.base-button--secondary {
  background-color: var(--bg-secondary);
  color: var(--foreground);
  border-color: var(--border-color);
}

.base-button--secondary:not(:disabled):hover {
  border-color: var(--color-text-muted);
}

/* Danger */
.base-button--danger {
  background-color: var(--color-crimson);
  color: var(--primary-foreground);
}

.base-button--danger:not(:disabled):hover {
  opacity: 0.9;
}

/* Ghost */
.base-button--ghost {
  background-color: transparent;
  color: var(--foreground);
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
