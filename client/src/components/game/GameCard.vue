<script setup lang="ts">
import { computed } from 'vue'
import { getCardImage } from '../../types/stitch-cards'

const props = defineProps<{
  type: 'means' | 'clue'
  id?: string
  name: string
  selected?: boolean
  disabled?: boolean
}>()

const imageUrl = computed(() => (props.id ? getCardImage(props.type, props.id) : undefined))
</script>

<template>
  <component
    :is="$attrs.onClick ? 'button' : 'div'"
    :type="$attrs.onClick ? 'button' : undefined"
    :disabled="$attrs.onClick ? disabled : undefined"
    :aria-pressed="$attrs.onClick ? !!selected : undefined"
    class="game-card"
    :class="[
      `game-card--${type}`,
      { 'game-card--selected': selected, 'game-card--disabled': disabled },
    ]"
  >
    <img v-if="imageUrl" :src="imageUrl" alt="" class="game-card__img" loading="lazy" />
    <span class="game-card__name">{{ name }}</span>
  </component>
</template>

<style scoped>
.game-card {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  color: var(--color-text);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
  user-select: none;
  width: 88px;
  min-width: 0;
  vertical-align: top;
}

.game-card__img {
  width: 100%;
  border-radius: var(--radius-md);
  display: block;
}

.game-card__name {
  font-size: 12px;
  text-align: center;
  line-height: 16px;
  word-break: keep-all;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.game-card--means {
  border-color: var(--color-crimson);
}

.game-card--means .game-card__name {
  color: var(--destructive);
}

.game-card--clue {
  border-color: var(--color-text-muted);
}

.game-card--clue .game-card__name {
  color: var(--color-text-muted);
}

.game-card--selected {
  border-color: var(--color-amber);
  box-shadow: 0 0 0 1px var(--color-amber);
  transform: none;
}

.game-card--selected .game-card__name {
  color: var(--color-amber-light);
}

.game-card--disabled {
  opacity: 0.4;
  pointer-events: none;
}

.game-card:not(.game-card--disabled):not(.game-card--selected):hover {
  border-color: var(--color-text-muted);
  background: rgba(33, 38, 45, 0.8);
}

.game-card:focus-visible {
  outline: 3px solid var(--ring);
  outline-offset: 3px;
}
</style>
