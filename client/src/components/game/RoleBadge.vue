<script setup lang="ts">
import { computed } from 'vue'
import type { Role } from '../../types'

const props = defineProps<{
  role: Role
  showLabel?: boolean
}>()

const roleConfig: Record<Role, { label: string; cssVar: string }> = {
  witness: { label: '目击者', cssVar: 'var(--color-witness)' },
  murderer: { label: '凶手', cssVar: 'var(--color-murderer)' },
  accomplice: { label: '帮凶', cssVar: 'var(--color-accomplice)' },
  detective: { label: '侦探', cssVar: 'var(--color-detective)' },
}

const config = computed(() => roleConfig[props.role])
</script>

<template>
  <span
    v-if="showLabel !== false"
    class="role-badge"
    :style="{
      '--role-color': config.cssVar,
    }"
  >
    {{ config.label }}
  </span>
  <span v-else class="role-dot" :style="{ backgroundColor: config.cssVar }" />
</template>

<style scoped>
.role-badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  white-space: nowrap;
  user-select: none;
  color: color-mix(in srgb, var(--role-color) 70%, white);
  border: 1px solid color-mix(in srgb, var(--role-color) 35%, transparent);
  background: color-mix(in srgb, var(--role-color) 12%, var(--bg-card));
}

.role-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
