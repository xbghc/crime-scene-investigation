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
  <div
    class="game-card"
    :class="[
      `game-card--${type}`,
      { 'game-card--selected': selected, 'game-card--disabled': disabled },
    ]"
  >
    <img v-if="imageUrl" :src="imageUrl" :alt="name" class="game-card__img" loading="lazy" />
    <span class="game-card__name">{{ name }}</span>
  </div>
</template>

<style scoped>
.game-card {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px;
  border-radius: var(--border-radius);
  background: var(--bg-card);
  color: var(--color-text);
  border: 1.5px solid var(--border-color);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  width: 80px;
}

.game-card__img {
  width: 100%;
  border-radius: calc(var(--border-radius) - 2px);
  display: block;
}

.game-card__name {
  font-size: 0.7rem;
  text-align: center;
  line-height: 1.2;
  word-break: keep-all;
}

.game-card--means {
  border-color: var(--color-crimson);
}

.game-card--means .game-card__name {
  color: var(--color-crimson-light);
}

.game-card--clue {
  border-color: var(--color-text-muted);
}

.game-card--clue .game-card__name {
  color: var(--color-text-muted);
}

.game-card--selected {
  border-color: var(--color-amber);
  box-shadow:
    0 0 8px rgba(212, 168, 71, 0.4),
    0 2px 8px rgba(0, 0, 0, 0.3);
  transform: translateY(-2px);
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
</style>
