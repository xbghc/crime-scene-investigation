<script setup lang="ts">
import CardArtwork from './CardArtwork.vue'
import AppIcon from '../ui/AppIcon.vue'
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
      <div class="player-card-row__row" role="group" aria-label="手段牌">
        <div
          v-for="card in player.meansCards"
          :key="card.id"
          class="player-card-row__thumb player-card-row__thumb--means"
          :title="card.name"
        >
          <CardArtwork
            :src="getMeansCardImage(card.id)"
            class="player-card-row__img"
            loading="lazy"
          />
          <span class="player-card-row__card-name">{{ card.name }}</span>
        </div>
      </div>
      <div class="player-card-row__row" role="group" aria-label="线索牌">
        <div
          v-for="card in player.clueCards"
          :key="card.id"
          class="player-card-row__thumb player-card-row__thumb--clue"
          :title="card.name"
        >
          <CardArtwork
            :src="getClueCardImage(card.id)"
            class="player-card-row__img"
            loading="lazy"
          />
          <span class="player-card-row__card-name">{{ card.name }}</span>
        </div>
      </div>
    </div>

    <div v-if="player.status === 'dead'" class="player-card-row__dead-overlay">
      <AppIcon name="skull" class="player-card-row__skull" /><span>已出局</span>
    </div>
  </div>
</template>

<style scoped>
.player-card-row {
  position: relative;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  padding: var(--space-6);
  overflow: hidden;
}

.player-card-row__header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.player-card-row__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.player-card-row__nickname {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  overflow-wrap: anywhere;
}

.player-card-row__no-solve {
  margin-left: auto;
  font-size: 12px;
  color: var(--color-text-muted);
  background: var(--bg-secondary);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  text-decoration: none;
  white-space: nowrap;
}

.player-card-row__cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.player-card-row__row {
  display: grid;
  gap: var(--space-2);
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.player-card-row__thumb {
  width: auto;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid transparent;
  transition: transform 0.15s ease;
  min-width: 0;
  background: var(--bg-secondary);
}

.player-card-row__thumb:hover {
  transform: none;
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
  gap: var(--space-2);
  font-size: 14px;
  font-weight: 600;
}

.player-card-row__skull {
  font-size: 2rem;
  opacity: 0.7;
}

.player-card-row__card-name {
  display: block;
  padding: var(--space-1);
  text-align: center;
  font-size: 12px;
  line-height: 16px;
  overflow-wrap: anywhere;
}
.player-card-row__thumb--means .player-card-row__card-name {
  color: var(--destructive);
}
.player-card-row__thumb--clue .player-card-row__card-name {
  color: var(--color-text-muted);
}
@media (max-width: 600px) {
  .player-card-row {
    padding: var(--space-4);
  }
}
</style>
