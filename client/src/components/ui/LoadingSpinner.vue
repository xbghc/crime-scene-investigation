<script setup lang="ts">
interface Props {
  label?: string
}

withDefaults(defineProps<Props>(), {
  label: '',
})
</script>

<template>
  <div class="loading-spinner">
    <div class="loading-spinner__circle" />
    <p v-if="label" class="loading-spinner__label">{{ label }}</p>
  </div>
</template>

<style scoped>
.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.loading-spinner__circle {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--color-crimson);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-spinner__label {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
