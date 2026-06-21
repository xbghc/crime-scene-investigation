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
      backgroundColor: config.cssVar,
      color: '#fff',
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
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  user-select: none;
}

.role-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
