<script setup lang="ts">
import { ref, computed } from 'vue'
import type { SceneBoard, Player } from '../../types'
import SceneBoardPanel from '../game/SceneBoardPanel.vue'

interface Props {
  boards: SceneBoard[]
  newBoards: SceneBoard[]
  isWitness: boolean
  isAccomplice: boolean
  isAdvance1: boolean
  murdererPlayer?: Player
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'accomplice-choose': [payload: { replaceClue: boolean; newClueCardId?: string }]
  'witness-replace': [payload: { oldBoardId: string; newBoardId: string; optionIndex: number; markerNumber: number }]
  'witness-finish-advance': []
}>()

// Accomplice state
const showClueSelect = ref(false)
const selectedClueId = ref<string | null>(null)
const accompliceDecided = ref(false)

// Witness state
const selectedOldBoardId = ref<string | null>(null)
const selectedNewBoardId = ref<string | null>(null)
const selectedOptionIndex = ref<number | null>(null)
const selectedMarkerNumber = ref<number | null>(null)

const replaceableBoards = computed(() =>
  props.boards.filter(b => b.type !== 'cause')
)

function handleAccompliceKeep() {
  accompliceDecided.value = true
  emit('accomplice-choose', { replaceClue: false })
}

function handleAccompliceReplace() {
  if (!selectedClueId.value) return
  accompliceDecided.value = true
  emit('accomplice-choose', { replaceClue: true, newClueCardId: selectedClueId.value })
}

function selectOldBoard(boardId: string) {
  selectedOldBoardId.value = boardId
}

function handleNewBoardOption(boardId: string, optionIndex: number) {
  selectedNewBoardId.value = boardId
  selectedOptionIndex.value = optionIndex
}

function handleConfirmReplace() {
  if (selectedOldBoardId.value && selectedNewBoardId.value && selectedOptionIndex.value !== null && selectedMarkerNumber.value !== null) {
    emit('witness-replace', {
      oldBoardId: selectedOldBoardId.value,
      newBoardId: selectedNewBoardId.value,
      optionIndex: selectedOptionIndex.value,
      markerNumber: selectedMarkerNumber.value,
    })
  }
}
</script>

<template>
  <div class="advance">
    <div class="advance__header">
      <span class="material-symbols-outlined text-amber-accent">fast_forward</span>
      <span>推进阶段</span>
    </div>

    <!-- Accomplice decision (only in advance-1 with accomplice) -->
    <template v-if="isAccomplice && isAdvance1 && !accompliceDecided">
      <div class="advance__section">
        <h3 class="advance__section-title">是否更换凶手的线索牌？</h3>
        <p class="advance__section-desc">更换后目击者将获得额外场景板</p>

        <template v-if="!showClueSelect">
          <div class="advance__actions">
            <button class="advance__btn advance__btn--secondary" @click="handleAccompliceKeep">
              不更换
            </button>
            <button class="advance__btn advance__btn--primary" @click="showClueSelect = true">
              更换线索牌
            </button>
          </div>
        </template>

        <template v-else>
          <p class="advance__select-label">选择新的线索牌</p>
          <div class="advance__clue-grid">
            <button
              v-for="card in (murdererPlayer?.clueCards || [])"
              :key="card.id"
              class="advance__clue-card"
              :class="{ 'advance__clue-card--selected': selectedClueId === card.id }"
              @click="selectedClueId = card.id"
            >
              {{ card.name }}
            </button>
          </div>
          <button
            class="advance__btn advance__btn--primary"
            :disabled="!selectedClueId"
            @click="handleAccompliceReplace"
          >
            确认更换
          </button>
        </template>
      </div>
    </template>

    <!-- Witness: no new boards, finish advance -->
    <template v-else-if="isWitness && newBoards.length === 0">
      <div class="advance__waiting">
        <p class="advance__waiting-text">推进阶段完成，没有新的场景板</p>
        <button class="advance__btn advance__btn--primary" style="max-width: 200px" @click="emit('witness-finish-advance')">
          继续
        </button>
      </div>
    </template>

    <!-- Witness board replacement -->
    <template v-else-if="isWitness && newBoards.length > 0">
      <div class="advance__section">
        <h3 class="advance__section-title">选择替换的场景板</h3>
        <p class="advance__section-desc">选择一张旧场景板替换（不能替换死亡原因）</p>

        <!-- Current boards -->
        <div class="advance__boards-label">当前场景板：</div>
        <div class="advance__boards">
          <div
            v-for="board in replaceableBoards"
            :key="board.id"
            class="advance__board-wrap"
            :class="{ 'advance__board-wrap--selected': selectedOldBoardId === board.id }"
            @click="selectOldBoard(board.id)"
          >
            <SceneBoardPanel :board="board" />
          </div>
        </div>

        <!-- New boards -->
        <div class="advance__boards-label">新场景板：</div>
        <div class="advance__boards">
          <SceneBoardPanel
            v-for="board in newBoards"
            :key="board.id"
            :board="board"
            :editable="!!selectedOldBoardId"
            @select-option="handleNewBoardOption(board.id, $event.optionIndex)"
          />
        </div>

        <!-- Marker number selection -->
        <div v-if="selectedOptionIndex !== null" class="advance__marker-pick">
          <span class="advance__select-label">选择选项物编号：</span>
          <div class="advance__marker-btns">
            <button
              v-for="n in 6"
              :key="n"
              class="advance__marker-btn"
              :class="{ 'advance__marker-btn--selected': selectedMarkerNumber === n }"
              @click="selectedMarkerNumber = n"
            >
              {{ n }}
            </button>
          </div>
        </div>

        <button
          class="advance__btn advance__btn--primary"
          :disabled="!selectedOldBoardId || !selectedNewBoardId || selectedOptionIndex === null || selectedMarkerNumber === null"
          @click="handleConfirmReplace"
        >
          确认替换
        </button>
      </div>
    </template>

    <!-- Waiting state for others -->
    <template v-else>
      <div class="advance__waiting">
        <div class="advance__spinner" />
        <p class="advance__waiting-text">推进阶段，目击者正在调整线索…</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.advance {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.advance__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--bg-card);
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-amber);
}

.advance__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.advance__section-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.advance__section-desc {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin: 0;
}

.advance__actions {
  display: flex;
  gap: 10px;
}

.advance__btn {
  flex: 1;
  height: 48px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  transition: all 0.2s;
}

.advance__btn--primary {
  background: var(--color-amber);
  color: #fff;
}

.advance__btn--primary:disabled {
  opacity: 0.4;
}

.advance__btn--secondary {
  background: var(--bg-secondary);
  color: var(--color-text);
  border: 1px solid var(--border-color);
}

.advance__select-label {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin: 0;
}

.advance__clue-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.advance__clue-card {
  padding: 12px;
  border-radius: 8px;
  background: var(--bg-secondary);
  border: 1.5px solid var(--border-color);
  color: var(--color-text);
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s;
}

.advance__clue-card--selected {
  border-color: var(--color-amber);
  background: rgba(212, 168, 71, 0.1);
}

.advance__boards-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.advance__boards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.advance__board-wrap {
  border: 2px solid transparent;
  border-radius: 10px;
  transition: border-color 0.2s;
  cursor: pointer;
}

.advance__board-wrap--selected {
  border-color: var(--color-crimson-light);
}

.advance__marker-pick {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.advance__marker-btns {
  display: flex;
  gap: 8px;
}

.advance__marker-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 700;
  background: var(--bg-card);
  color: var(--color-text-muted);
  border: 2px solid var(--border-color);
  transition: all 0.15s;
}

.advance__marker-btn--selected {
  background: var(--color-amber);
  color: #fff;
  border-color: var(--color-amber);
}

.advance__waiting {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  gap: 16px;
}

.advance__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--color-amber);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.advance__waiting-text {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  margin: 0;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
