<script setup lang="ts">
import type { Player } from '../../types'
import { getMeansCardImage, getClueCardImage } from '../../types/stitch-cards'

defineProps<{
  player: Player
}>()
</script>

<template>
  <div
    class="player-card-row"
    :class="{
      'player-card-row--dead': player.status === 'dead',
    }"
  >
    <div class="player-card-row__header">
      <span class="player-card-row__dot" :style="{ backgroundColor: player.color }" />
      <span class="player-card-row__nickname">{{ player.nickname }}</span>
      <span
        v-if="player.status === 'alive' && !player.hasSolveRight"
        class="player-card-row__no-solve"
      >
        无破案权
      </span>
    </div>

    <div class="player-card-row__cards">
      <div class="player-card-row__row">
        <div
          v-for="card in player.meansCards"
          :key="card.id"
          class="player-card-row__thumb player-card-row__thumb--means"
          :title="card.name"
        >
          <img
            :src="getMeansCardImage(card.id)"
            :alt="card.name"
            class="player-card-row__img"
            loading="lazy"
          />
        </div>
      </div>
      <div class="player-card-row__row">
        <div
          v-for="card in player.clueCards"
          :key="card.id"
          class="player-card-row__thumb player-card-row__thumb--clue"
          :title="card.name"
        >
          <img
            :src="getClueCardImage(card.id)"
            :alt="card.name"
            class="player-card-row__img"
            loading="lazy"
          />
        </div>
      </div>
    </div>

    <div v-if="player.status === 'dead'" class="player-card-row__dead-overlay">
      <span class="player-card-row__skull">&#9760;</span>
    </div>
  </div>
</template>

<style scoped>
.player-card-row {
  position: relative;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  padding: 10px 12px;
  overflow: hidden;
}

.player-card-row__header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.player-card-row__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.player-card-row__nickname {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
}

.player-card-row__no-solve {
  margin-left: auto;
  font-size: 0.65rem;
  color: var(--color-text-dim);
  background: var(--bg-secondary);
  padding: 1px 6px;
  border-radius: 999px;
  text-decoration: line-through;
}

.player-card-row__cards {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.player-card-row__row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.player-card-row__thumb {
  width: 36px;
  border-radius: 4px;
  overflow: hidden;
  border: 1.5px solid transparent;
  transition: transform 0.15s ease;
}

.player-card-row__thumb:hover {
  transform: scale(1.15);
  z-index: 5;
  position: relative;
}

.player-card-row__thumb--means {
  border-color: rgba(166, 28, 28, 0.4);
}

.player-card-row__thumb--clue {
  border-color: rgba(139, 148, 158, 0.3);
}

.player-card-row__img {
  width: 100%;
  display: block;
}

/* Dead overlay */
.player-card-row--dead {
  opacity: 0.5;
}

.player-card-row__dead-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  z-index: 2;
  pointer-events: none;
}

.player-card-row__skull {
  font-size: 2rem;
  opacity: 0.7;
}
</style>
