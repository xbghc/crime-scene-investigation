<script setup lang="ts">
import type { SceneBoard } from '../../types'
import { computed } from 'vue'

const props = defineProps<{
  board: SceneBoard
  editable?: boolean
  hidden?: boolean
}>()

const emit = defineEmits<{
  'select-option': [payload: { optionIndex: number }]
}>()

const typeColor = computed(() => {
  switch (props.board.type) {
    case 'cause':
      return 'var(--color-crimson-light)'
    case 'location':
      return 'var(--color-amber)'
    case 'scene':
      return 'var(--color-witness)'
    default:
      return 'var(--color-text-muted)'
  }
})

const typeLabel = computed(() => {
  switch (props.board.type) {
    case 'cause':
      return '死因'
    case 'location':
      return '地点'
    case 'scene':
      return '现场'
    default:
      return ''
  }
})

function handleSelect(optionIndex: number) {
  if (props.editable && !props.hidden) {
    emit('select-option', { optionIndex })
  }
}
</script>

<template>
  <div class="scene-board" :class="{ 'scene-board--hidden': hidden }">
    <div class="scene-board__header">
      <span class="scene-board__type" :style="{ color: typeColor }">{{ typeLabel }}</span>
      <span class="scene-board__title">{{ board.title }}</span>
    </div>

    <div class="scene-board__grid">
      <button
        v-for="(option, index) in board.options"
        :key="index"
        class="scene-board__cell"
        :class="{
          'scene-board__cell--editable': editable && !hidden,
          'scene-board__cell--marked': board.marker && board.marker.optionIndex === index,
        }"
        :disabled="!editable || hidden"
        @click="handleSelect(index)"
      >
        <span class="scene-board__option-text">{{ option }}</span>
        <span
          v-if="board.marker && board.marker.optionIndex === index"
          class="scene-board__marker"
        >
          {{ board.marker.markerNumber }}
        </span>
      </button>
    </div>

    <div v-if="hidden" class="scene-board__overlay">
      <span class="scene-board__blackout-text">停电中</span>
    </div>
  </div>
</template>

<style scoped>
.scene-board {
  position: relative;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  padding: 12px;
  overflow: hidden;
}

.scene-board__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.scene-board__type {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.scene-board__title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
}

.scene-board__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.scene-board__cell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 6px 4px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: calc(var(--border-radius) / 2);
  color: var(--color-text);
  font-size: 0.8rem;
  cursor: default;
  transition: all 0.15s ease;
}

.scene-board__cell--editable {
  cursor: pointer;
}

.scene-board__cell--editable:hover {
  background: rgba(212, 168, 71, 0.1);
  border-color: var(--color-amber);
}

.scene-board__cell--editable:active {
  background: rgba(212, 168, 71, 0.2);
}

.scene-board__cell--marked {
  border-color: var(--color-amber);
  background: rgba(212, 168, 71, 0.08);
}

.scene-board__option-text {
  text-align: center;
  line-height: 1.2;
}

.scene-board__marker {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-amber);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

/* Blackout overlay */
.scene-board--hidden {
  pointer-events: none;
}

.scene-board__overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  border-radius: var(--border-radius);
}

.scene-board__blackout-text {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text-dim);
  letter-spacing: 0.15em;
}
</style>
