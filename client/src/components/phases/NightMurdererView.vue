<script setup lang="ts">
import { ref, computed } from 'vue'
import type { MeansCard, ClueCard } from '../../types'

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

const meansCount = computed(() => selectedMeansId.value ? '1/1' : '0/1')
const clueCount = computed(() => selectedClueId.value ? '1/1' : '0/1')

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
        <span class="material-symbols-outlined text-crimson-light murder-view__pulse">dark_mode</span>
        <span>Night Phase</span>
      </div>
      <div class="murder-view__timer">
        <span class="material-symbols-outlined text-crimson-light" style="font-size: 16px">timer</span>
        <span>{{ timerDisplay }}</span>
      </div>
    </header>

    <!-- Title -->
    <div class="murder-view__title-area">
      <h1 class="murder-view__title">SHHH... EVERYONE IS ASLEEP.</h1>
      <p class="murder-view__role-label">You are the Murderer</p>
    </div>

    <!-- Means section -->
    <section class="murder-view__section">
      <div class="murder-view__section-header">
        <div class="murder-view__section-icon murder-view__section-icon--means">
          <span class="material-symbols-outlined" style="font-size: 20px">domino_mask</span>
        </div>
        <div>
          <h3 class="murder-view__section-title">Select Means</h3>
          <p class="murder-view__section-sub">Weapon of choice</p>
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
          @click="toggleMeans(card.id)"
        >
          <!-- Check badge -->
          <div v-if="selectedMeansId === card.id" class="murder-card__check murder-card__check--means">
            <span class="material-symbols-outlined" style="font-size: 16px">check</span>
          </div>
          <!-- Accomplice badge -->
          <div v-if="isAccomplice(card.id)" class="murder-card__accomplice-badge">
            <span class="material-symbols-outlined" style="font-size: 12px">person</span>
            <span>Accomplice</span>
          </div>
          <!-- Card body -->
          <div class="murder-card__body">
            <span class="material-symbols-outlined murder-card__icon murder-card__icon--means">destruction</span>
            <p class="murder-card__name">{{ card.name }}</p>
          </div>
          <!-- Selected tag -->
          <div v-if="selectedMeansId === card.id" class="murder-card__tag murder-card__tag--means">
            Selected Weapon
          </div>
        </div>
      </div>
    </section>

    <!-- Divider -->
    <div class="murder-view__divider">
      <span class="murder-view__divider-text">and</span>
    </div>

    <!-- Clue section -->
    <section class="murder-view__section">
      <div class="murder-view__section-header">
        <div class="murder-view__section-icon murder-view__section-icon--clue">
          <span class="material-symbols-outlined" style="font-size: 20px">fingerprint</span>
        </div>
        <div>
          <h3 class="murder-view__section-title">Leave a Clue</h3>
          <p class="murder-view__section-sub">Evidence left behind</p>
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
          @click="toggleClue(card.id)"
        >
          <div v-if="selectedClueId === card.id" class="murder-card__check murder-card__check--clue">
            <span class="material-symbols-outlined" style="font-size: 16px">check</span>
          </div>
          <div v-if="isAccomplice(card.id)" class="murder-card__accomplice-badge">
            <span class="material-symbols-outlined" style="font-size: 12px">person</span>
            <span>Accomplice</span>
          </div>
          <div class="murder-card__body">
            <span class="material-symbols-outlined murder-card__icon murder-card__icon--clue">search</span>
            <p class="murder-card__name">{{ card.name }}</p>
          </div>
          <div v-if="selectedClueId === card.id" class="murder-card__tag murder-card__tag--clue">
            Selected Clue
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
        <span class="material-symbols-outlined" style="font-size: 24px">gavel</span>
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
  background: #211111;
  overflow-x: hidden;
  padding-bottom: 0;
}

/* Header */
.murder-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  padding-top: calc(24px + var(--safe-area-top));
  position: sticky;
  top: 0;
  z-index: 30;
  background: rgba(33, 17, 17, 0.95);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.murder-view__phase {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.875rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.9);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.murder-view__pulse {
  animation: pulse 2s ease-in-out infinite;
}

.murder-view__timer {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.75rem;
  font-family: 'Space Grotesk', monospace;
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
  font-size: 1.5rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.95);
  letter-spacing: 0.02em;
  line-height: 1.3;
  margin: 0 0 8px;
}

.murder-view__role-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-crimson-light);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  margin: 0;
}

/* Section */
.murder-view__section {
  padding: 0 16px;
  margin-top: 16px;
  z-index: 10;
}

.murder-view__section-header {
  display: flex;
  align-items: center;
  gap: 12px;
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
  color: var(--color-crimson-light);
  border: 1px solid rgba(211, 47, 47, 0.3);
}

.murder-view__section-icon--clue {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.murder-view__section-title {
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  line-height: 1;
  margin: 0;
}

.murder-view__section-sub {
  font-size: 0.625rem;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin: 4px 0 0;
}

.murder-view__counter {
  margin-left: auto;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
}

.murder-view__counter--means {
  color: var(--color-crimson-light);
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
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

/* Card */
.murder-card {
  position: relative;
  border-radius: 8px;
  background: #1e1e1e;
  border: 1px solid rgba(255, 255, 255, 0.05);
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
  box-shadow: 0 0 20px rgba(211, 47, 47, 0.25);
  transform: scale(1.02);
  background: #211111;
}

.murder-card--selected-clue {
  border-color: transparent;
  outline: 2px solid #fff;
  outline-offset: -1px;
  box-shadow: 0 0 15px rgba(255, 255, 255, 0.15);
  transform: scale(1.02);
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
  font-size: 0.5625rem;
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
  padding: 28px 12px 20px;
  gap: 10px;
}

.murder-card__icon {
  font-size: 2rem;
  opacity: 0.3;
}

.murder-card__icon--means {
  color: var(--color-crimson-light);
}

.murder-card__icon--clue {
  color: rgba(255, 255, 255, 0.7);
}

.murder-card--selected-means .murder-card__icon--means,
.murder-card--selected-clue .murder-card__icon--clue {
  opacity: 0.6;
}

.murder-card__name {
  font-size: 0.875rem;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.08em;
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
  padding: 6px;
  font-size: 0.625rem;
  text-align: center;
  letter-spacing: 0.04em;
}

.murder-card__tag--means {
  background: rgba(211, 47, 47, 0.15);
  color: rgba(211, 47, 47, 0.8);
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
  color: rgba(255, 255, 255, 0.2);
  font-size: 0.75rem;
  font-style: italic;
}

/* Footer */
.murder-view__footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 40px 16px 24px;
  padding-bottom: calc(24px + var(--safe-area-bottom));
  background: linear-gradient(to top, #211111, rgba(33, 17, 17, 0.95), transparent);
  z-index: 50;
}

.murder-view__confirm {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 56px;
  border-radius: 8px;
  font-size: 1.125rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.25);
  transition: all 0.3s ease;
}

.murder-view__confirm--active {
  background: var(--color-crimson-light);
  color: #fff;
  box-shadow: 0 4px 14px rgba(211, 47, 47, 0.5);
}

.murder-view__confirm--active:active {
  transform: scale(0.98);
}

/* Animations */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
