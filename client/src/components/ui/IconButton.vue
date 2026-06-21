<script setup lang="ts">
import BaseButton from './BaseButton.vue'

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
      <span v-if="iconPosition === 'left'" class="material-symbols-outlined icon-button__icon">{{
        icon
      }}</span>
      <span class="icon-button__label"><slot /></span>
      <span v-if="iconPosition === 'right'" class="material-symbols-outlined icon-button__icon">{{
        icon
      }}</span>
    </span>
  </BaseButton>
</template>

<style scoped>
.icon-button__inner {
  display: flex;
  align-items: center;
  gap: 6px;
}

.icon-button__icon {
  font-size: 1.125rem;
  line-height: 1;
}
</style>
