<script setup lang="ts">
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

const suspect = computed(() => props.players.find(p => p.id === suspectId.value))

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
  if (step.value === 4) { clueCardId.value = null; step.value = 3 }
  else if (step.value === 3) { meansCardId.value = null; step.value = 2 }
  else if (step.value === 2) { suspectId.value = null; step.value = 1 }
  else { emit('cancel') }
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
      <button class="solve__back" @click="goBack">
        <span class="material-symbols-outlined">arrow_back</span>
      </button>
      <h2 class="solve__title">{{ forced ? '强制破案' : '破案' }}</h2>
      <div class="solve__steps">
        <span v-for="s in 4" :key="s" class="solve__step-dot" :class="{ 'solve__step-dot--active': step >= s }" />
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
          :class="{ 'solve__suspect--selected': suspectId === player.id }"
          @click="selectSuspect(player.id)"
        >
          <PlayerAvatar
            :nickname="player.nickname"
            :color="player.color"
            :status="player.status"
          />
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
            {{ suspect.meansCards.find(c => c.id === meansCardId)?.name }}
          </span>
        </div>
        <div class="solve__summary-row">
          <span class="solve__summary-label">线索</span>
          <span class="solve__summary-value">
            {{ suspect.clueCards.find(c => c.id === clueCardId)?.name }}
          </span>
        </div>
      </div>

      <div class="solve__confirm-area">
        <button class="solve__confirm-btn" @click="handleConfirm">
          <span class="material-symbols-outlined" style="font-size: 20px">gavel</span>
          确认破案
        </button>
        <button class="solve__cancel-btn" @click="goBack">
          返回修改
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.solve {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.solve__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  padding-top: calc(12px + var(--safe-area-top));
  border-bottom: 1px solid var(--border-color);
}

.solve__back {
  color: var(--color-text-muted);
}

.solve__title {
  flex: 1;
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.solve__steps {
  display: flex;
  gap: 4px;
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
  padding: 24px 16px;
}

.solve__instruction {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  margin: 0 0 20px;
  text-align: center;
}

.solve__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  justify-items: center;
}

.solve__suspect {
  padding: 12px;
  border-radius: 8px;
  border: 2px solid transparent;
  background: var(--bg-secondary);
  transition: all 0.2s;
}

.solve__suspect--selected {
  border-color: var(--color-amber);
  background: rgba(212, 168, 71, 0.1);
}

.solve__card-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.solve__summary {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  margin-bottom: 24px;
}

.solve__summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.solve__summary-label {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.solve__summary-value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}

.solve__summary-value--means {
  color: var(--color-crimson-light);
}

.solve__confirm-area {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.solve__confirm-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 52px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 700;
  background: var(--color-crimson);
  color: #fff;
  letter-spacing: 0.06em;
  transition: opacity 0.2s;
}

.solve__confirm-btn:active {
  opacity: 0.85;
}

.solve__cancel-btn {
  width: 100%;
  height: 44px;
  border-radius: 8px;
  font-size: 0.9rem;
  color: var(--color-text-muted);
  background: var(--bg-secondary);
  transition: opacity 0.2s;
}

.solve__cancel-btn:active {
  opacity: 0.85;
}
</style>
