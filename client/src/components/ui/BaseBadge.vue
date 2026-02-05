<script setup lang="ts">
interface Props {
  variant?: 'witness' | 'murderer' | 'accomplice' | 'detective' | 'host'
  label: string
}

withDefaults(defineProps<Props>(), {
  variant: 'detective',
})
</script>

<template>
  <span :class="['base-badge', `base-badge--${variant}`]">
    {{ label }}
  </span>
</template>

<style scoped>
.base-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
}

.base-badge--witness {
  background-color: rgba(59, 130, 246, 0.15);
  color: var(--color-witness);
}

.base-badge--murderer {
  background-color: rgba(239, 68, 68, 0.15);
  color: var(--color-murderer);
}

.base-badge--accomplice {
  background-color: rgba(245, 158, 11, 0.15);
  color: var(--color-accomplice);
}

.base-badge--detective {
  background-color: rgba(34, 197, 94, 0.15);
  color: var(--color-detective);
}

.base-badge--host {
  background-color: rgba(212, 168, 71, 0.15);
  color: var(--color-amber);
}
</style>
