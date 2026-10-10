<script setup lang="ts">
import AppIcon from '../ui/AppIcon.vue'
import { ref, computed } from 'vue'
import type { Player } from '../../types'
import PlayerAvatar from '../game/PlayerAvatar.vue'
import GameCard from '../game/GameCard.vue'

interface Props {
  players: Player[]
  forced?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  confirm: [payload: { suspectId: string; meansCardId: string; clueCardId: string }]
  cancel: []
}>()

const step = ref<1 | 2 | 3 | 4>(1)
const suspectId = ref<string | null>(null)
const meansCardId = ref<string | null>(null)
const clueCardId = ref<string | null>(null)

const suspect = computed(() => props.players.find((p) => p.id === suspectId.value))

function selectSuspect(id: string) {
  suspectId.value = id
  step.value = 2
}

function selectMeans(id: string) {
  meansCardId.value = id
  step.value = 3
}

function selectClue(id: string) {
  clueCardId.value = id
  step.value = 4
}

function goBack() {
  if (step.value === 4) {
    clueCardId.value = null
    step.value = 3
  } else if (step.value === 3) {
    meansCardId.value = null
    step.value = 2
  } else if (step.value === 2) {
    suspectId.value = null
    step.value = 1
  } else {
    emit('cancel')
  }
}

function handleConfirm() {
  if (suspectId.value && meansCardId.value && clueCardId.value) {
    emit('confirm', {
      suspectId: suspectId.value,
      meansCardId: meansCardId.value,
      clueCardId: clueCardId.value,
    })
  }
}
</script>

<template>
  <div class="solve">
    <!-- Header -->
    <header class="solve__header">
      <button
        class="solve__back"
        type="button"
        :aria-label="step === 1 ? '取消破案' : '返回上一步'"
        @click="goBack"
      >
        <AppIcon name="arrow_back" class="app-icon" />
      </button>
      <h2 class="solve__title">{{ forced ? '强制破案' : '破案' }}</h2>
      <div class="solve__steps" role="status" :aria-label="`第 ${step} 步，共 4 步`">
        <span class="solve__step-label">{{ step }} / 4</span>
        <span
          v-for="s in 4"
          :key="s"
          class="solve__step-dot"
          :class="{ 'solve__step-dot--active': step >= s }"
        />
      </div>
    </header>

    <!-- Step 1: Select suspect -->
    <div v-if="step === 1" class="solve__body">
      <p class="solve__instruction">选择你怀疑的凶手</p>
      <div class="solve__grid">
        <button
          v-for="player in players"
          :key="player.id"
          class="solve__suspect"
          type="button"
          :aria-label="`选择 ${player.nickname} 为嫌疑人`"
          :class="{ 'solve__suspect--selected': suspectId === player.id }"
          @click="selectSuspect(player.id)"
        >
          <PlayerAvatar :nickname="player.nickname" :color="player.color" :status="player.status" />
        </button>
      </div>
    </div>

    <!-- Step 2: Select means card -->
    <div v-if="step === 2 && suspect" class="solve__body">
      <p class="solve__instruction">
        选择 <strong>{{ suspect.nickname }}</strong> 的作案手段
      </p>
      <div class="solve__card-grid">
        <GameCard
          v-for="card in suspect.meansCards"
          :key="card.id"
          type="means"
          :id="card.id"
          :name="card.name"
          :selected="meansCardId === card.id"
          @click="selectMeans(card.id)"
        />
      </div>
    </div>

    <!-- Step 3: Select clue card -->
    <div v-if="step === 3 && suspect" class="solve__body">
      <p class="solve__instruction">
        选择 <strong>{{ suspect.nickname }}</strong> 的线索
      </p>
      <div class="solve__card-grid">
        <GameCard
          v-for="card in suspect.clueCards"
          :key="card.id"
          type="clue"
          :id="card.id"
          :name="card.name"
          :selected="clueCardId === card.id"
          @click="selectClue(card.id)"
        />
      </div>
    </div>

    <!-- Step 4: Confirm -->
    <div v-if="step === 4 && suspect" class="solve__body">
      <p class="solve__instruction">确认你的推理</p>

      <div class="solve__summary">
        <div class="solve__summary-row">
          <span class="solve__summary-label">嫌疑人</span>
          <span class="solve__summary-value">{{ suspect.nickname }}</span>
        </div>
        <div class="solve__summary-row">
          <span class="solve__summary-label">手段</span>
          <span class="solve__summary-value solve__summary-value--means">
            {{ suspect.meansCards.find((c) => c.id === meansCardId)?.name }}
          </span>
        </div>
        <div class="solve__summary-row">
          <span class="solve__summary-label">线索</span>
          <span class="solve__summary-value">
            {{ suspect.clueCards.find((c) => c.id === clueCardId)?.name }}
          </span>
        </div>
      </div>

      <div class="solve__confirm-area">
        <button class="solve__confirm-btn" @click="handleConfirm">
          <AppIcon name="gavel" class="app-icon" style="font-size: 20px" />
          确认破案
        </button>
        <button class="solve__cancel-btn" @click="goBack">返回修改</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.solve {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.solve__header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-6);
  padding-top: var(--space-4);
  border-bottom: 1px solid var(--border-color);
}

.solve__back {
  color: var(--color-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.solve__title {
  flex: 1;
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.solve__steps {
  display: flex;
  gap: var(--space-1);
  align-items: center;
}

.solve__step-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border-color);
  transition: background 0.2s;
}

.solve__step-dot--active {
  background: var(--color-amber);
}

.solve__body {
  flex: 1;
  padding: var(--space-6);
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
}

.solve__instruction {
  font-size: 14px;
  color: var(--color-text);
  margin: 0 0 var(--space-6);
  text-align: left;
}

.solve__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
  justify-items: stretch;
}

.solve__suspect {
  padding: var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s;
}

.solve__suspect--selected {
  border-color: var(--color-amber);
  background: rgba(212, 168, 71, 0.1);
}

.solve__card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

.solve__summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-6);
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  margin-bottom: 24px;
}

.solve__summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.solve__summary-label {
  font-size: 12px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: normal;
}

.solve__summary-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  text-align: right;
  overflow-wrap: anywhere;
}

.solve__summary-value--means {
  color: var(--destructive);
}

.solve__confirm-area {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.solve__confirm-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  background: var(--color-crimson);
  color: #fff;
  letter-spacing: normal;
  transition: opacity 0.2s;
}

.solve__confirm-btn:active {
  opacity: 0.85;
}

.solve__cancel-btn {
  width: 100%;
  height: 44px;
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--color-text-muted);
  background: var(--bg-secondary);
  transition: opacity 0.2s;
}

.solve__cancel-btn:active {
  opacity: 0.85;
}

.solve__step-label {
  margin-right: var(--space-2);
  font: 12px/16px var(--font-mono);
  color: var(--color-text-muted);
}
.solve__card-grid :deep(.game-card) {
  width: 100%;
}
@media (min-width: 640px) {
  .solve__card-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
@media (max-width: 380px) {
  .solve__body,
  .solve__header {
    padding-left: var(--space-4);
    padding-right: var(--space-4);
  }
  .solve__grid {
    gap: var(--space-2);
  }
}
.solve__suspect {
  min-width: 0;
}
.solve__suspect :deep(.player-avatar__name) {
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
  font-size: 14px;
}
.solve__body {
  padding-bottom: var(--space-6);
}
@media (max-width: 600px) {
  .solve__header {
    gap: 12px;
  }
  .solve__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .solve__suspect {
    padding: 12px 8px;
  }
  .solve__card-grid :deep(.game-card__name) {
    font-size: 16px;
    line-height: 24px;
  }
}
@media (max-height: 500px) {
  .solve__header {
    padding-top: 8px;
    padding-bottom: 8px;
  }
  .solve__body {
    padding-top: 16px;
  }
  .solve__card-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
