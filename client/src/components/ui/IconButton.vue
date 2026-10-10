<script setup lang="ts">
import BaseButton from './BaseButton.vue'
import AppIcon from './AppIcon.vue'

interface Props {
  icon: string
  iconPosition?: 'left' | 'right'
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  disabled?: boolean
  loading?: boolean
  block?: boolean
}

withDefaults(defineProps<Props>(), {
  iconPosition: 'left',
  variant: 'primary',
  disabled: false,
  loading: false,
  block: false,
})
</script>

<template>
  <BaseButton :variant="variant" :disabled="disabled" :loading="loading" :block="block">
    <span class="icon-button__inner">
      <AppIcon v-if="iconPosition === 'left'" :name="icon" class="icon-button__icon" />
      <span class="icon-button__label"><slot /></span>
      <AppIcon v-if="iconPosition === 'right'" :name="icon" class="icon-button__icon" />
    </span>
  </BaseButton>
</template>

<style scoped>
.icon-button__inner {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.icon-button__icon {
  font-size: 1.125rem;
  line-height: 1;
}
</style>
