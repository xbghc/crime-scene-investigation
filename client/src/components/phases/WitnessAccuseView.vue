<script setup lang="ts">
import { computed } from 'vue'
import type { SceneBoard, MurdererSelection } from '../../types'
import SceneBoardPanel from '../game/SceneBoardPanel.vue'

interface Props {
  boards: SceneBoard[]
  murdererSelection?: MurdererSelection
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'select-option': [payload: { boardId: string; optionIndex: number }]
  'reorder': [boardIds: string[]]
  confirm: []
}>()

// Derive marker numbers from board position (top=1, bottom=6)
const displayBoards = computed(() =>
  props.boards.map((board, index) => ({
    ...board,
    marker: board.marker
      ? { ...board.marker, markerNumber: index + 1 }
      : undefined,
  }))
)

const markedCount = computed(() => props.boards.filter(b => b.marker).length)
const allMarkersPlaced = computed(() => markedCount.value === props.boards.length)

const selectedMeansName = computed(() => props.murdererSelection?.meansCard.name ?? null)

const selectedClueName = computed(() => props.murdererSelection?.clueCard.name ?? null)

function handleSelectOption(boardId: string, optionIndex: number) {
  const board = props.boards.find(b => b.id === boardId)
  if (!board) return

  // Clicking the already-marked option: deselect it
  if (board.marker && board.marker.optionIndex === optionIndex) {
    emit('select-option', { boardId, optionIndex: -1 })
    return
  }

  // Select (or change) the option on this board
  emit('select-option', { boardId, optionIndex })
}

function moveBoard(index: number, direction: 'up' | 'down') {
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= props.boards.length) return

  const ids = props.boards.map(b => b.id)
  const temp = ids[index]!
  ids[index] = ids[targetIndex]!
  ids[targetIndex] = temp
  emit('reorder', ids)
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

    <!-- Instruction -->
    <div class="witness-accuse__instruction">
      <p class="witness-accuse__instruction-text">
        点击选项标记线索，上下拖动调整选项物优先级（上方 = 高优先）
      </p>
      <span class="witness-accuse__progress">{{ markedCount }}/{{ boards.length }}</span>
    </div>

    <!-- Boards with reorder controls -->
    <div class="witness-accuse__boards">
      <div
        v-for="(board, index) in displayBoards"
        :key="board.id"
        class="witness-accuse__board-row"
      >
        <!-- Position & reorder controls -->
        <div class="witness-accuse__reorder">
          <span class="witness-accuse__position">{{ index + 1 }}</span>
          <button
            class="witness-accuse__arrow"
            :disabled="index === 0"
            @click="moveBoard(index, 'up')"
          >
            <span class="material-symbols-outlined" style="font-size: 18px">keyboard_arrow_up</span>
          </button>
          <button
            class="witness-accuse__arrow"
            :disabled="index === displayBoards.length - 1"
            @click="moveBoard(index, 'down')"
          >
            <span class="material-symbols-outlined" style="font-size: 18px">keyboard_arrow_down</span>
          </button>
        </div>

        <!-- Board panel -->
        <div class="witness-accuse__board-content">
          <SceneBoardPanel
            :board="board"
            :editable="true"
            @select-option="handleSelectOption(board.id, $event.optionIndex)"
          />
        </div>
      </div>
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

.witness-accuse__instruction {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.witness-accuse__instruction-text {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin: 0;
  flex: 1;
}

.witness-accuse__progress {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-amber);
  padding: 2px 8px;
  border: 1px solid rgba(212, 168, 71, 0.3);
  background: rgba(212, 168, 71, 0.1);
  border-radius: 4px;
  flex-shrink: 0;
  margin-left: 12px;
}

.witness-accuse__boards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.witness-accuse__board-row {
  display: flex;
  gap: 8px;
  align-items: stretch;
}

.witness-accuse__reorder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  width: 32px;
}

.witness-accuse__position {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--color-amber);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.witness-accuse__arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.witness-accuse__arrow:not(:disabled):hover {
  background: rgba(212, 168, 71, 0.15);
  border-color: var(--color-amber);
  color: var(--color-amber);
}

.witness-accuse__arrow:not(:disabled):active {
  background: rgba(212, 168, 71, 0.25);
}

.witness-accuse__arrow:disabled {
  opacity: 0.2;
  cursor: not-allowed;
}

.witness-accuse__board-content {
  flex: 1;
  min-width: 0;
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
