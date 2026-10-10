<script setup lang="ts">
import AppIcon from '../ui/AppIcon.vue'
import { ref, computed } from 'vue'
import type { MeansCard, ClueCard } from '../../types'
import { getMeansCardImage, getClueCardImage } from '../../types/stitch-cards'

interface Props {
  meansCards: MeansCard[]
  clueCards: ClueCard[]
  accompliceCardIds?: string[]
  timeRemaining?: number
}

const props = withDefaults(defineProps<Props>(), {
  accompliceCardIds: () => [],
  timeRemaining: 45,
})

const emit = defineEmits<{
  confirm: [{ meansCardId: string; clueCardId: string }]
}>()

const selectedMeansId = ref<string | null>(null)
const selectedClueId = ref<string | null>(null)

const canConfirm = computed(() => selectedMeansId.value && selectedClueId.value)

const timerDisplay = computed(() => {
  const m = Math.floor(props.timeRemaining / 60)
  const s = props.timeRemaining % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

const meansCount = computed(() => (selectedMeansId.value ? '1/1' : '0/1'))
const clueCount = computed(() => (selectedClueId.value ? '1/1' : '0/1'))

function toggleMeans(id: string) {
  selectedMeansId.value = selectedMeansId.value === id ? null : id
}

function toggleClue(id: string) {
  selectedClueId.value = selectedClueId.value === id ? null : id
}

function handleConfirm() {
  if (canConfirm.value) {
    emit('confirm', {
      meansCardId: selectedMeansId.value!,
      clueCardId: selectedClueId.value!,
    })
  }
}

function isAccomplice(id: string) {
  return props.accompliceCardIds.includes(id)
}
</script>

<template>
  <div class="vignette murder-view">
    <!-- Header -->
    <header class="murder-view__header">
      <div class="murder-view__phase">
        <AppIcon name="dark_mode" class="app-icon text-crimson-light murder-view__pulse" />
        <span>夜晚阶段</span>
      </div>
      <div class="murder-view__timer">
        <AppIcon name="timer" class="app-icon text-crimson-light" style="font-size: 16px" />
        <span>{{ timerDisplay }}</span>
      </div>
    </header>

    <!-- Title -->
    <div class="murder-view__title-area">
      <h1 class="murder-view__title">夜深了，请选择作案组合</h1>
      <p class="murder-view__role-label">你的身份：凶手</p>
    </div>

    <!-- Means section -->
    <section class="murder-view__section">
      <div class="murder-view__section-header">
        <div class="murder-view__section-icon murder-view__section-icon--means">
          <AppIcon name="domino_mask" class="app-icon" style="font-size: 20px" />
        </div>
        <div>
          <h3 class="murder-view__section-title">选择作案手段</h3>
          <p class="murder-view__section-sub">选择一张手段牌</p>
        </div>
        <span class="murder-view__counter murder-view__counter--means">{{ meansCount }}</span>
      </div>

      <div class="murder-view__grid">
        <div
          v-for="card in meansCards"
          :key="card.id"
          class="murder-card"
          :class="{
            'murder-card--selected-means': selectedMeansId === card.id,
            'murder-card--accomplice': isAccomplice(card.id),
          }"
          role="button"
          tabindex="0"
          :aria-label="card.name"
          :aria-pressed="selectedMeansId === card.id"
          @keydown.enter="toggleMeans(card.id)"
          @keydown.space.prevent="toggleMeans(card.id)"
          @click="toggleMeans(card.id)"
        >
          <!-- Check badge -->
          <div
            v-if="selectedMeansId === card.id"
            class="murder-card__check murder-card__check--means"
          >
            <AppIcon name="check" class="app-icon" style="font-size: 16px" />
          </div>
          <!-- Accomplice badge -->
          <div v-if="isAccomplice(card.id)" class="murder-card__accomplice-badge">
            <AppIcon name="person" class="app-icon" style="font-size: 12px" />
            <span>帮凶</span>
          </div>
          <!-- Card body -->
          <div class="murder-card__body">
            <img
              :src="getMeansCardImage(card.id)"
              :alt="card.name"
              class="murder-card__card-img"
              loading="lazy"
            />
            <p class="murder-card__name">{{ card.name }}</p>
          </div>
          <!-- Selected tag -->
          <div v-if="selectedMeansId === card.id" class="murder-card__tag murder-card__tag--means">
            已选手段
          </div>
        </div>
      </div>
    </section>

    <!-- Divider -->
    <div class="murder-view__divider">
      <span class="murder-view__divider-text">与</span>
    </div>

    <!-- Clue section -->
    <section class="murder-view__section">
      <div class="murder-view__section-header">
        <div class="murder-view__section-icon murder-view__section-icon--clue">
          <AppIcon name="fingerprint" class="app-icon" style="font-size: 20px" />
        </div>
        <div>
          <h3 class="murder-view__section-title">留下线索</h3>
          <p class="murder-view__section-sub">选择一张线索牌</p>
        </div>
        <span class="murder-view__counter murder-view__counter--clue">{{ clueCount }}</span>
      </div>

      <div class="murder-view__grid">
        <div
          v-for="card in clueCards"
          :key="card.id"
          class="murder-card"
          :class="{
            'murder-card--selected-clue': selectedClueId === card.id,
            'murder-card--accomplice': isAccomplice(card.id),
          }"
          role="button"
          tabindex="0"
          :aria-label="card.name"
          :aria-pressed="selectedClueId === card.id"
          @keydown.enter="toggleClue(card.id)"
          @keydown.space.prevent="toggleClue(card.id)"
          @click="toggleClue(card.id)"
        >
          <div
            v-if="selectedClueId === card.id"
            class="murder-card__check murder-card__check--clue"
          >
            <AppIcon name="check" class="app-icon" style="font-size: 16px" />
          </div>
          <div v-if="isAccomplice(card.id)" class="murder-card__accomplice-badge">
            <AppIcon name="person" class="app-icon" style="font-size: 12px" />
            <span>帮凶</span>
          </div>
          <div class="murder-card__body">
            <img
              :src="getClueCardImage(card.id)"
              :alt="card.name"
              class="murder-card__card-img"
              loading="lazy"
            />
            <p class="murder-card__name">{{ card.name }}</p>
          </div>
          <div v-if="selectedClueId === card.id" class="murder-card__tag murder-card__tag--clue">
            已选线索
          </div>
        </div>
      </div>
    </section>

    <!-- Spacer for bottom button -->
    <div style="height: 100px" />

    <!-- Confirm button -->
    <div class="murder-view__footer">
      <button
        class="murder-view__confirm"
        :class="{ 'murder-view__confirm--active': canConfirm }"
        :disabled="!canConfirm"
        @click="handleConfirm"
      >
        <AppIcon name="gavel" class="app-icon" style="font-size: 24px" />
        Confirm Crime
      </button>
    </div>
  </div>
</template>

<style scoped>
.murder-view {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow-x: hidden;
  padding-bottom: 0;
}

/* Header */
.murder-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  padding-top: calc(var(--space-4) + var(--safe-area-top));
  position: sticky;
  top: 0;
  z-index: 30;
  background: var(--card);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
}

.murder-view__phase {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: normal;
  text-transform: uppercase;
}

.murder-view__pulse {
  animation: pulse 2s ease-in-out infinite;
}

.murder-view__timer {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 12px;
  font-family: var(--font-mono);
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
}

/* Title */
.murder-view__title-area {
  padding: 32px 24px 16px;
  text-align: center;
  z-index: 10;
}

.murder-view__title {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -0.025em;
  line-height: 32px;
  margin: 0 0 8px;
}

.murder-view__role-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--destructive);
  letter-spacing: normal;
  text-transform: uppercase;
  margin: 0;
}

/* Section */
.murder-view__section {
  padding: 0 var(--space-6);
  margin-top: 16px;
  z-index: 10;
  width: 100%;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
}

.murder-view__section-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: 16px;
  padding: 0 4px;
}

.murder-view__section-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.murder-view__section-icon--means {
  background: rgba(211, 47, 47, 0.15);
  color: var(--destructive);
  border: 1px solid rgba(211, 47, 47, 0.3);
}

.murder-view__section-icon--clue {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.murder-view__section-title {
  font-size: 20px;
  font-weight: 600;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: normal;
  line-height: 28px;
  margin: 0;
}

.murder-view__section-sub {
  font-size: 12px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: normal;
  margin: 4px 0 0;
  line-height: 16px;
}

.murder-view__counter {
  margin-left: auto;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
}

.murder-view__counter--means {
  color: var(--destructive);
  border: 1px solid rgba(211, 47, 47, 0.3);
  background: rgba(211, 47, 47, 0.1);
}

.murder-view__counter--clue {
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.1);
}

/* Card grid */
.murder-view__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

/* Card */
.murder-card {
  position: relative;
  border-radius: var(--radius-xl);
  background: var(--card);
  border: 1px solid var(--border);
  cursor: pointer;
  transition: all 0.2s ease;
  overflow: hidden;
}

.murder-card:active {
  transform: scale(0.97);
}

.murder-card--selected-means {
  border-color: transparent;
  outline: 2px solid var(--color-crimson-light);
  outline-offset: -1px;
  box-shadow: none;
  transform: none;
  background: #211111;
}

.murder-card--selected-clue {
  border-color: transparent;
  outline: 2px solid #fff;
  outline-offset: -1px;
  box-shadow: none;
  transform: none;
  background: var(--bg-primary);
}

.murder-card--accomplice {
  outline: 2px dashed #71717a;
  outline-offset: -1px;
  border-color: transparent;
}

.murder-card--accomplice:hover {
  outline-color: #a1a1aa;
}

/* Card check badge */
.murder-card__check {
  position: absolute;
  top: -1px;
  right: -1px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
  border: 2px solid #211111;
}

.murder-card__check--means {
  background: var(--color-crimson-light);
  color: #fff;
}

.murder-card__check--clue {
  background: #fff;
  color: #211111;
}

/* Accomplice badge */
.murder-card__accomplice-badge {
  position: absolute;
  top: -1px;
  left: -1px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background: #3f3f46;
  color: rgba(255, 255, 255, 0.9);
  border: 1px solid #71717a;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* Card body */
.murder-card__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-2) var(--space-2) var(--space-3);
  gap: var(--space-2);
}

.murder-card__card-img {
  width: 100%;
  border-radius: 6px;
  display: block;
  opacity: 0.85;
  transition: opacity 0.2s;
}

.murder-card--selected-means .murder-card__card-img,
.murder-card--selected-clue .murder-card__card-img {
  opacity: 1;
}

.murder-card__name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  text-transform: uppercase;
  letter-spacing: normal;
  text-align: center;
  margin: 0;
  transition: color 0.2s;
}

.murder-card--selected-means .murder-card__name,
.murder-card--selected-clue .murder-card__name {
  color: #fff;
}

/* Selected tag */
.murder-card__tag {
  padding: var(--space-2);
  font-size: 12px;
  text-align: center;
  letter-spacing: normal;
}

.murder-card__tag--means {
  background: rgba(211, 47, 47, 0.15);
  color: var(--destructive);
}

.murder-card__tag--clue {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

/* Divider */
.murder-view__divider {
  position: relative;
  margin: 32px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.murder-view__divider-text {
  position: absolute;
  left: 50%;
  top: -10px;
  transform: translateX(-50%);
  background: #211111;
  padding: 0 8px;
  color: var(--color-text-muted);
  font-size: 12px;
  font-style: italic;
}

/* Footer */
.murder-view__footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--space-4) max(var(--space-4), calc((100% - 752px) / 2));
  padding-bottom: calc(var(--space-4) + var(--safe-area-bottom));
  background: var(--bg-primary);
  z-index: 50;
  border-top: 1px solid var(--border);
}

.murder-view__confirm {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  height: 44px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: normal;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.25);
  transition: all 0.3s ease;
}

.murder-view__confirm--active {
  background: var(--color-crimson-light);
  color: #fff;
  box-shadow: none;
}

.murder-view__confirm--active:active {
  transform: scale(0.98);
}

/* Animations */
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

@media (min-width: 640px) {
  .murder-view__grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .murder-view__section {
    padding: 0 var(--space-4);
  }
}

.murder-card:focus-visible {
  outline: 3px solid var(--ring);
  outline-offset: 3px;
}
</style>
