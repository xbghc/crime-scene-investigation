<script setup lang="ts">
import CardArtwork from '../game/CardArtwork.vue'
import AppIcon from '../ui/AppIcon.vue'
import { computed } from 'vue'
import type { MeansCard, ClueCard } from '../../types'
import RoleBadge from '../game/RoleBadge.vue'
import { getMeansCardImage, getClueCardImage } from '../../types/stitch-cards'

interface Props {
  murdererNickname: string
  meansCards: MeansCard[]
  clueCards: ClueCard[]
  selectedMeansId?: string | null
  selectedClueId?: string | null
  accompliceCardIds?: string[]
  confirmed?: boolean
  timeRemaining?: number
}

const props = withDefaults(defineProps<Props>(), {
  selectedMeansId: null,
  selectedClueId: null,
  accompliceCardIds: () => [],
  confirmed: false,
  timeRemaining: 45,
})

const timerDisplay = computed(() => {
  const m = Math.floor(props.timeRemaining / 60)
  const s = props.timeRemaining % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

const meansStatus = computed(() => (props.selectedMeansId ? '1/1' : '0/1'))
const clueStatus = computed(() => (props.selectedClueId ? '1/1' : '0/1'))

function isAccomplice(id: string) {
  return props.accompliceCardIds.includes(id)
}
</script>

<template>
  <div class="vignette accomplice-view">
    <!-- Header -->
    <header class="accomplice-view__header">
      <div class="accomplice-view__phase">
        <AppIcon name="dark_mode" class="app-icon text-amber-accent accomplice-view__pulse" />
        <span>夜晚阶段</span>
      </div>
      <div class="accomplice-view__timer">
        <AppIcon name="timer" class="app-icon" style="font-size: 16px" />
        <span>{{ timerDisplay }}</span>
      </div>
    </header>

    <!-- Title area -->
    <div class="accomplice-view__title-area">
      <RoleBadge role="accomplice" show-label />
      <h1 class="accomplice-view__title">观察凶手的选择</h1>
      <p class="accomplice-view__murderer">
        <AppIcon name="domino_mask" class="app-icon" style="font-size: 16px" />
        {{ murdererNickname }}
      </p>
    </div>

    <!-- Means section -->
    <section class="accomplice-view__section">
      <div class="accomplice-view__section-header">
        <div class="accomplice-view__section-icon accomplice-view__section-icon--means">
          <AppIcon name="domino_mask" class="app-icon" style="font-size: 20px" />
        </div>
        <div>
          <h3 class="accomplice-view__section-title">作案手段</h3>
          <p class="accomplice-view__section-sub">凶手的作案手段</p>
        </div>
        <span class="accomplice-view__counter accomplice-view__counter--means">{{
          meansStatus
        }}</span>
      </div>

      <div class="accomplice-view__grid">
        <div
          v-for="card in meansCards"
          :key="card.id"
          class="observe-card"
          :class="{
            'observe-card--selected-means': selectedMeansId === card.id,
            'observe-card--mine': isAccomplice(card.id),
          }"
        >
          <!-- Selected badge -->
          <div
            v-if="selectedMeansId === card.id"
            class="observe-card__check observe-card__check--means"
          >
            <AppIcon name="check" class="app-icon" style="font-size: 16px" />
          </div>
          <!-- Accomplice badge -->
          <div v-if="isAccomplice(card.id)" class="observe-card__mine-badge">
            <AppIcon name="person" class="app-icon" style="font-size: 12px" />
            <span>我的卡牌</span>
          </div>
          <!-- Card body -->
          <div class="observe-card__body">
            <CardArtwork
              :src="getMeansCardImage(card.id)"
              class="observe-card__card-img"
              loading="lazy"
            />
            <p class="observe-card__name">{{ card.name }}</p>
          </div>
          <!-- Selected tag -->
          <div
            v-if="selectedMeansId === card.id"
            class="observe-card__tag observe-card__tag--means"
          >
            凶手已选
          </div>
        </div>
      </div>
    </section>

    <!-- Divider -->
    <div class="accomplice-view__divider">
      <span class="accomplice-view__divider-text">与</span>
    </div>

    <!-- Clue section -->
    <section class="accomplice-view__section">
      <div class="accomplice-view__section-header">
        <div class="accomplice-view__section-icon accomplice-view__section-icon--clue">
          <AppIcon name="fingerprint" class="app-icon" style="font-size: 20px" />
        </div>
        <div>
          <h3 class="accomplice-view__section-title">留下的线索</h3>
          <p class="accomplice-view__section-sub">凶手留下的线索</p>
        </div>
        <span class="accomplice-view__counter accomplice-view__counter--clue">{{
          clueStatus
        }}</span>
      </div>

      <div class="accomplice-view__grid">
        <div
          v-for="card in clueCards"
          :key="card.id"
          class="observe-card"
          :class="{
            'observe-card--selected-clue': selectedClueId === card.id,
            'observe-card--mine': isAccomplice(card.id),
          }"
        >
          <div
            v-if="selectedClueId === card.id"
            class="observe-card__check observe-card__check--clue"
          >
            <AppIcon name="check" class="app-icon" style="font-size: 16px" />
          </div>
          <div v-if="isAccomplice(card.id)" class="observe-card__mine-badge">
            <AppIcon name="person" class="app-icon" style="font-size: 12px" />
            <span>我的卡牌</span>
          </div>
          <div class="observe-card__body">
            <CardArtwork
              :src="getClueCardImage(card.id)"
              class="observe-card__card-img"
              loading="lazy"
            />
            <p class="observe-card__name">{{ card.name }}</p>
          </div>
          <div v-if="selectedClueId === card.id" class="observe-card__tag observe-card__tag--clue">
            凶手已选
          </div>
        </div>
      </div>
    </section>

    <!-- Bottom waiting indicator -->
    <div class="accomplice-view__waiting">
      <template v-if="confirmed">
        <AppIcon
          name="check_circle"
          class="app-icon"
          style="font-size: 20px; color: var(--color-role-accomplice)"
        />
        <span>凶手已确认作案组合</span>
      </template>
      <template v-else>
        <div class="accomplice-view__loader">
          <div class="accomplice-view__loader-bar" />
        </div>
        <span>等待凶手做出选择…</span>
      </template>
    </div>
  </div>
</template>

<style scoped>
.accomplice-view {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow-x: hidden;
  padding-bottom: 0;
}

/* Header */
.accomplice-view__header {
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

.accomplice-view__phase {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: normal;
  text-transform: uppercase;
}

.accomplice-view__pulse {
  animation: pulse 2s ease-in-out infinite;
}

.accomplice-view__timer {
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

/* Title area */
.accomplice-view__title-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 24px 8px;
  gap: 8px;
  z-index: 10;
}

.accomplice-view__title {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -0.025em;
  line-height: 32px;
  margin: 4px 0 0;
  text-align: center;
}

.accomplice-view__murderer {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 14px;
  font-weight: 600;
  color: var(--destructive);
  margin: 0;
}

/* Section */
.accomplice-view__section {
  padding: 0 var(--space-6);
  margin-top: 16px;
  z-index: 10;
  width: 100%;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
}

.accomplice-view__section-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: 16px;
  padding: 0 4px;
}

.accomplice-view__section-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.accomplice-view__section-icon--means {
  background: rgba(245, 158, 11, 0.15);
  color: var(--color-role-accomplice);
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.accomplice-view__section-icon--clue {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.accomplice-view__section-title {
  font-size: 20px;
  font-weight: 600;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: normal;
  line-height: 28px;
  margin: 0;
}

.accomplice-view__section-sub {
  font-size: 12px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: normal;
  margin: 4px 0 0;
  line-height: 16px;
}

.accomplice-view__counter {
  margin-left: auto;
  font-size: 12px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
}

.accomplice-view__counter--means {
  color: var(--color-role-accomplice);
  border: 1px solid rgba(245, 158, 11, 0.3);
  background: rgba(245, 158, 11, 0.1);
}

.accomplice-view__counter--clue {
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.1);
}

/* Card grid */
.accomplice-view__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
}

/* Observe card (read-only) */
.observe-card {
  position: relative;
  border-radius: var(--radius-xl);
  background: var(--card);
  border: 1px solid var(--border);
  overflow: hidden;
  transition: all 0.3s ease;
}

.observe-card--selected-means {
  border-color: transparent;
  outline: 2px solid var(--color-role-accomplice);
  outline-offset: -1px;
  box-shadow: none;
  background: rgba(245, 158, 11, 0.05);
  transform: none;
}

.observe-card--selected-clue {
  border-color: transparent;
  outline: 2px solid #fff;
  outline-offset: -1px;
  box-shadow: none;
  background: var(--bg-primary);
  transform: none;
}

.observe-card--mine {
  outline: 2px dashed rgba(245, 158, 11, 0.5);
  outline-offset: -1px;
  border-color: transparent;
}

/* Card check badge */
.observe-card__check {
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
  border: 2px solid var(--bg-primary);
  animation: pop-in 0.3s ease;
}

.observe-card__check--means {
  background: var(--color-role-accomplice);
  color: #fff;
}

.observe-card__check--clue {
  background: #fff;
  color: var(--bg-primary);
}

/* Mine badge */
.observe-card__mine-badge {
  position: absolute;
  top: -1px;
  left: -1px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background: rgba(245, 158, 11, 0.2);
  color: var(--color-role-accomplice);
  border: 1px solid rgba(245, 158, 11, 0.4);
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* Card body */
.observe-card__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-2) var(--space-2) var(--space-3);
  gap: var(--space-2);
}

.observe-card__card-img {
  width: 100%;
  border-radius: 6px;
  display: block;
  opacity: 0.85;
  transition: opacity 0.2s;
}

.observe-card--selected-means .observe-card__card-img,
.observe-card--selected-clue .observe-card__card-img {
  opacity: 1;
}

.observe-card__name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  text-transform: uppercase;
  letter-spacing: normal;
  text-align: center;
  margin: 0;
  transition: color 0.2s;
}

.observe-card--selected-means .observe-card__name,
.observe-card--selected-clue .observe-card__name {
  color: #fff;
}

/* Selected tag */
.observe-card__tag {
  padding: var(--space-2);
  font-size: 12px;
  text-align: center;
  letter-spacing: normal;
}

.observe-card__tag--means {
  background: rgba(245, 158, 11, 0.15);
  color: rgba(245, 158, 11, 0.8);
}

.observe-card__tag--clue {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

/* Divider */
.accomplice-view__divider {
  position: relative;
  margin: 32px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.accomplice-view__divider-text {
  position: absolute;
  left: 50%;
  top: -10px;
  transform: translateX(-50%);
  background: var(--bg-primary);
  padding: 0 8px;
  color: var(--color-text-muted);
  font-size: 12px;
  font-style: italic;
}

/* Bottom waiting */
.accomplice-view__waiting {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: 32px 24px;
  padding-bottom: calc(32px + var(--safe-area-bottom));
  font-size: 14px;
  color: var(--color-text-muted);
  z-index: 10;
}

.accomplice-view__loader {
  width: 120px;
  height: 3px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 2px;
  overflow: hidden;
}

.accomplice-view__loader-bar {
  width: 40%;
  height: 100%;
  background: var(--color-role-accomplice);
  border-radius: 2px;
  animation: loading 2s ease-in-out infinite;
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

@keyframes loading {
  0% {
    transform: translateX(-100%);
  }
  50% {
    transform: translateX(200%);
  }
  100% {
    transform: translateX(-100%);
  }
}

@keyframes pop-in {
  0% {
    transform: scale(0);
  }
  50% {
    transform: scale(1.2);
  }
  100% {
    transform: scale(1);
  }
}

@media (min-width: 640px) {
  .accomplice-view__grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .accomplice-view__section {
    padding: 0 var(--space-4);
  }
}
</style>
