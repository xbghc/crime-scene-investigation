<script setup lang="ts">
import { ref, computed } from 'vue'
import type { SceneBoard, MurdererSelection, Player } from '../../types'
import SceneBoardPanel from '../game/SceneBoardPanel.vue'
import MarkerSelector from '../game/MarkerSelector.vue'

interface Props {
  boards: SceneBoard[]
  murdererSelection?: MurdererSelection
  murdererPlayer?: Player
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'set-marker': [payload: { boardId: string; optionIndex: number; markerNumber: number }]
  confirm: []
}>()

const selectedMarker = ref<number | null>(null)
const selectedBoardId = ref<string | null>(null)

const usedMarkers = computed(() =>
  props.boards
    .filter(b => b.marker)
    .map(b => b.marker!.markerNumber)
)

const availableMarkers = computed(() =>
  [1, 2, 3, 4, 5, 6].filter(n => !usedMarkers.value.includes(n))
)

const allMarkersPlaced = computed(() => usedMarkers.value.length === 6)

const selectedMeansName = computed(() => {
  if (!props.murdererSelection || !props.murdererPlayer) return null
  return props.murdererPlayer.meansCards.find(c => c.id === props.murdererSelection!.meansCardId)?.name
})

const selectedClueName = computed(() => {
  if (!props.murdererSelection || !props.murdererPlayer) return null
  return props.murdererPlayer.clueCards.find(c => c.id === props.murdererSelection!.clueCardId)?.name
})

function handleSelectOption(boardId: string, optionIndex: number) {
  if (selectedMarker.value === null) return
  selectedBoardId.value = boardId
  emit('set-marker', { boardId, optionIndex, markerNumber: selectedMarker.value })
  selectedMarker.value = null
  selectedBoardId.value = null
}
</script>

<template>
  <div class="witness-accuse">
    <!-- Header hint -->
    <div class="witness-accuse__hint">
      <span class="material-symbols-outlined" style="font-size: 16px">lock</span>
      <span>凶手选择：</span>
      <span class="witness-accuse__hint-means">{{ selectedMeansName || '?' }}</span>
      <span>+</span>
      <span class="witness-accuse__hint-clue">{{ selectedClueName || '?' }}</span>
    </div>

    <!-- Marker selector -->
    <div class="witness-accuse__selector">
      <p class="witness-accuse__selector-label">选择选项物编号后，点击场景板上的选项</p>
      <MarkerSelector
        :available-markers="availableMarkers"
        :model-value="selectedMarker"
        @update:model-value="selectedMarker = $event"
      />
    </div>

    <!-- Boards -->
    <div class="witness-accuse__boards">
      <SceneBoardPanel
        v-for="board in boards"
        :key="board.id"
        :board="board"
        :editable="selectedMarker !== null"
        @select-option="handleSelectOption(board.id, $event.optionIndex)"
      />
    </div>

    <!-- Confirm button -->
    <div class="witness-accuse__footer">
      <button
        class="witness-accuse__confirm"
        :class="{ 'witness-accuse__confirm--active': allMarkersPlaced }"
        :disabled="!allMarkersPlaced"
        @click="emit('confirm')"
      >
        <span class="material-symbols-outlined" style="font-size: 20px">check_circle</span>
        确认布置
      </button>
    </div>
  </div>
</template>

<style scoped>
.witness-accuse {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 100px;
}

.witness-accuse__hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.witness-accuse__hint-means {
  color: var(--color-crimson-light);
  font-weight: 600;
}

.witness-accuse__hint-clue {
  color: var(--color-text);
  font-weight: 600;
}

.witness-accuse__selector {
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.witness-accuse__selector-label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin: 0 0 10px;
}

.witness-accuse__boards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.witness-accuse__footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 40px 16px 24px;
  padding-bottom: calc(24px + var(--safe-area-bottom));
  background: linear-gradient(to top, var(--bg-primary), rgba(13, 17, 23, 0.95), transparent);
  z-index: 50;
}

.witness-accuse__confirm {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 52px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.25);
  transition: all 0.3s ease;
}

.witness-accuse__confirm--active {
  background: var(--color-amber);
  color: #fff;
  box-shadow: 0 4px 14px rgba(212, 168, 71, 0.4);
}

.witness-accuse__confirm--active:active {
  transform: scale(0.98);
}
</style>
