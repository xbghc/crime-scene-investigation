<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseModal from '../ui/BaseModal.vue'
import CardArtwork from './CardArtwork.vue'
import AppIcon from '../ui/AppIcon.vue'
import type { Player } from '../../types'
import { getMeansCardImage, getClueCardImage } from '../../types/stitch-cards'

const props = defineProps<{
  player: Player
}>()
const inspectedIndex = ref<number | null>(null)
const cards = computed(() => [
  ...props.player.meansCards.map((card) => ({
    ...card,
    type: '手段牌',
    src: getMeansCardImage(card.id),
  })),
  ...props.player.clueCards.map((card) => ({
    ...card,
    type: '线索牌',
    src: getClueCardImage(card.id),
  })),
])
const inspectedCard = computed(() =>
  inspectedIndex.value === null ? undefined : cards.value[inspectedIndex.value],
)
function moveCard(direction: -1 | 1) {
  if (inspectedIndex.value === null) return
  inspectedIndex.value = Math.max(
    0,
    Math.min(cards.value.length - 1, inspectedIndex.value + direction),
  )
}
// Close a stale preview when a phase/effect replaces the visible cards.
watch(
  () => cards.value.map((card) => card.id).join(','),
  () => {
    inspectedIndex.value = null
  },
)
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
        <button
          v-for="(card, index) in player.meansCards"
          :key="card.id"
          class="player-card-row__thumb player-card-row__thumb--means"
          type="button"
          :aria-label="`放大查看 ${player.nickname} 的${card.name}`"
          aria-haspopup="dialog"
          @click="inspectedIndex = index"
        >
          <CardArtwork
            :src="getMeansCardImage(card.id)"
            class="player-card-row__img"
            loading="lazy"
          />
          <span class="player-card-row__card-name">{{ card.name }}</span>
        </button>
      </div>
      <div class="player-card-row__row" role="group" aria-label="线索牌">
        <button
          v-for="(card, index) in player.clueCards"
          :key="card.id"
          class="player-card-row__thumb player-card-row__thumb--clue"
          type="button"
          :aria-label="`放大查看 ${player.nickname} 的${card.name}`"
          aria-haspopup="dialog"
          @click="inspectedIndex = player.meansCards.length + index"
        >
          <CardArtwork
            :src="getClueCardImage(card.id)"
            class="player-card-row__img"
            loading="lazy"
          />
          <span class="player-card-row__card-name">{{ card.name }}</span>
        </button>
      </div>
    </div>

    <div v-if="player.status === 'dead'" class="player-card-row__dead-overlay">
      <AppIcon name="skull" class="player-card-row__skull" /><span>已出局</span>
    </div>
    <BaseModal
      :model-value="inspectedIndex !== null"
      title="卡牌详情"
      @update:model-value="inspectedIndex = null"
    >
      <div v-if="inspectedCard" class="card-detail">
        <p class="card-detail__owner">{{ player.nickname }} · {{ inspectedCard.type }}</p>
        <h3 class="card-detail__name" aria-live="polite">{{ inspectedCard.name }}</h3>
        <CardArtwork :src="inspectedCard.src" class="card-detail__artwork" />
        <p class="card-detail__position">{{ (inspectedIndex ?? 0) + 1 }} / {{ cards.length }}</p>
      </div>
      <template #footer>
        <div class="card-detail__navigation">
          <button type="button" :disabled="inspectedIndex === 0" @click="moveCard(-1)">
            上一张
          </button>
          <button
            type="button"
            :disabled="inspectedIndex === cards.length - 1"
            @click="moveCard(1)"
          >
            下一张
          </button>
        </div>
      </template>
    </BaseModal>
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
  padding: 0;
  min-height: 44px;
  text-align: center;
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
  font-size: 14px;
  line-height: 20px;
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
.card-detail {
  display: grid;
  justify-items: center;
  gap: 12px;
  text-align: center;
}
.card-detail__owner,
.card-detail__position {
  color: var(--color-text-muted);
  margin: 0;
  overflow-wrap: anywhere;
}
.card-detail__artwork {
  width: min(100%, 160px);
  max-height: 44dvh;
}
.card-detail__name {
  font-size: 20px;
  line-height: 28px;
  margin: 0;
  overflow-wrap: anywhere;
}
.card-detail__navigation {
  display: flex;
  gap: 12px;
  width: 100%;
}
.card-detail__navigation button {
  flex: 1;
  min-height: 48px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}
.card-detail__navigation button:disabled {
  opacity: 0.4;
}
@media (max-height: 500px) {
  .card-detail__artwork {
    width: 100px;
  }
}
</style>
