<script setup lang="ts">
import AppIcon from '../ui/AppIcon.vue'
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
  reorder: [boardIds: string[]]
  confirm: []
}>()

// Derive marker numbers from board position (top=1, bottom=6)
const displayBoards = computed(() =>
  props.boards.map((board, index) => ({
    ...board,
    marker: board.marker ? { ...board.marker, markerNumber: index + 1 } : undefined,
  })),
)

const markedCount = computed(() => props.boards.filter((b) => b.marker).length)
const allMarkersPlaced = computed(() => markedCount.value === props.boards.length)

const selectedMeansName = computed(() => props.murdererSelection?.meansCard.name ?? null)

const selectedClueName = computed(() => props.murdererSelection?.clueCard.name ?? null)

function handleSelectOption(boardId: string, optionIndex: number) {
  const board = props.boards.find((b) => b.id === boardId)
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

  const ids = props.boards.map((b) => b.id)
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
      <AppIcon name="lock" class="app-icon" style="font-size: 16px" />
      <span>凶手选择：</span>
      <span class="witness-accuse__hint-means">{{ selectedMeansName || '?' }}</span>
      <span>+</span>
      <span class="witness-accuse__hint-clue">{{ selectedClueName || '?' }}</span>
    </div>

    <!-- Instruction -->
    <div class="witness-accuse__instruction">
      <p class="witness-accuse__instruction-text">
        点击选项标记线索，用箭头调整优先级（越靠上越重要）
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
            type="button"
            :aria-label="`上移${board.title}`"
            :disabled="index === 0"
            @click="moveBoard(index, 'up')"
          >
            <AppIcon name="keyboard_arrow_up" class="app-icon" style="font-size: 18px" />
          </button>
          <button
            class="witness-accuse__arrow"
            type="button"
            :aria-label="`下移${board.title}`"
            :disabled="index === displayBoards.length - 1"
            @click="moveBoard(index, 'down')"
          >
            <AppIcon name="keyboard_arrow_down" class="app-icon" style="font-size: 18px" />
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
        <AppIcon name="check_circle" class="app-icon" style="font-size: 20px" />
        确认布置
      </button>
    </div>
  </div>
</template>

<style scoped>
.witness-accuse {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-bottom: 100px;
}

.witness-accuse__hint {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--color-text-muted);
  flex-wrap: wrap;
}

.witness-accuse__hint-means {
  color: var(--destructive);
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
  padding: var(--space-4);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  gap: var(--space-3);
}

.witness-accuse__instruction-text {
  font-size: 12px;
  color: var(--color-text-muted);
  margin: 0;
  flex: 1;
}

.witness-accuse__progress {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-amber);
  padding: 2px 8px;
  border: 1px solid rgba(212, 168, 71, 0.3);
  background: rgba(212, 168, 71, 0.1);
  border-radius: 4px;
  flex-shrink: 0;
  margin-left: 12px;
  font-family: var(--font-mono);
}

.witness-accuse__boards {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
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
  gap: var(--space-2);
  flex-shrink: 0;
  width: 44px;
}

.witness-accuse__position {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--color-amber);
  color: var(--bg-primary);
  font-size: 12px;
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
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
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
  padding: var(--space-4) max(var(--space-4), calc((100% - 1056px) / 2));
  padding-bottom: calc(var(--space-4) + var(--safe-area-bottom));
  background: var(--bg-primary);
  z-index: 50;
  border-top: 1px solid var(--border);
}

.witness-accuse__confirm {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.25);
  transition: all 0.3s ease;
}

.witness-accuse__confirm--active {
  background: var(--color-amber);
  color: var(--bg-primary);
  box-shadow: none;
}

.witness-accuse__confirm--active:active {
  transform: scale(0.98);
}
</style>
