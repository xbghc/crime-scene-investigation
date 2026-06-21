<script setup lang="ts">
import { computed } from 'vue'
import type { MurdererSelection } from '../../types'
import { getMeansCardImage, getClueCardImage } from '../../types/stitch-cards'

interface Props {
  selection?: MurdererSelection
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'confirm-murder': []
}>()

const hasSelection = computed(() => !!props.selection?.meansCard && !!props.selection?.clueCard)

const selectedMeansName = computed(() => props.selection?.meansCard.name ?? '未知')

const selectedClueName = computed(() => props.selection?.clueCard.name ?? '未知')

const selectedMeansImage = computed(() =>
  props.selection?.meansCard.id ? getMeansCardImage(props.selection.meansCard.id) : undefined,
)
const selectedClueImage = computed(() =>
  props.selection?.clueCard.id ? getClueCardImage(props.selection.clueCard.id) : undefined,
)
</script>

<template>
  <div class="vignette witness-night">
    <header class="witness-night__header">
      <div class="witness-night__phase">
        <span class="material-symbols-outlined text-amber-accent witness-night__pulse"
          >dark_mode</span
        >
        <span>Night Phase</span>
      </div>
    </header>

    <main class="witness-night__body">
      <!-- Waiting state -->
      <template v-if="!hasSelection">
        <div class="witness-night__icon-wrap">
          <span class="material-symbols-outlined witness-night__eye">visibility</span>
          <div class="witness-night__glow" />
        </div>
        <h1 class="witness-night__title">夜晚降临，凶手正在作案…</h1>
        <p class="witness-night__subtitle">你是目击者，等待凶手做出选择</p>
      </template>

      <!-- Selection revealed -->
      <template v-else>
        <div class="witness-night__icon-wrap">
          <span class="material-symbols-outlined witness-night__eye witness-night__eye--alert"
            >emergency</span
          >
          <div class="witness-night__glow witness-night__glow--alert" />
        </div>
        <h1 class="witness-night__title">凶手已做出选择</h1>
        <p class="witness-night__subtitle">记住以下信息，准备在指证阶段给出线索</p>

        <div class="witness-night__cards">
          <div class="witness-night__card witness-night__card--means">
            <img
              v-if="selectedMeansImage"
              :src="selectedMeansImage"
              :alt="selectedMeansName"
              class="witness-night__card-img"
            />
            <span class="witness-night__card-label">手段</span>
            <span class="witness-night__card-name">{{ selectedMeansName }}</span>
          </div>
          <div class="witness-night__card witness-night__card--clue">
            <img
              v-if="selectedClueImage"
              :src="selectedClueImage"
              :alt="selectedClueName"
              class="witness-night__card-img"
            />
            <span class="witness-night__card-label">线索</span>
            <span class="witness-night__card-name">{{ selectedClueName }}</span>
          </div>
        </div>

        <p class="witness-night__private">
          <span class="material-symbols-outlined" style="font-size: 14px">lock</span>
          仅你可见
        </p>

        <button class="witness-night__confirm-btn" @click="emit('confirm-murder')">
          <span class="material-symbols-outlined" style="font-size: 18px">check</span>
          我记住了，继续
        </button>
      </template>
    </main>

    <footer class="witness-night__footer">
      <div class="witness-night__loader">
        <div class="witness-night__loader-bar" />
      </div>
    </footer>
  </div>
</template>

<style scoped>
.witness-night {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.witness-night__header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  padding-top: calc(12px + var(--safe-area-top));
  z-index: 10;
}

.witness-night__phase {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: 0.04em;
}

.witness-night__pulse {
  animation: pulse 2s ease-in-out infinite;
}

.witness-night__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
  z-index: 10;
}

.witness-night__icon-wrap {
  position: relative;
  margin-bottom: 32px;
}

.witness-night__eye {
  font-size: 4rem;
  color: var(--color-witness);
  animation: float 4s ease-in-out infinite;
}

.witness-night__eye--alert {
  color: var(--color-crimson-light);
}

.witness-night__glow {
  position: absolute;
  inset: -24px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%);
  pointer-events: none;
  animation: glow-pulse 4s ease-in-out infinite;
}

.witness-night__glow--alert {
  background: radial-gradient(circle, rgba(211, 47, 47, 0.2) 0%, transparent 70%);
}

.witness-night__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
  text-align: center;
  margin: 0 0 12px;
}

.witness-night__subtitle {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  text-align: center;
  margin: 0 0 24px;
}

.witness-night__cards {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.witness-night__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 24px;
  border-radius: 8px;
  min-width: 120px;
}

.witness-night__card--means {
  background: rgba(166, 28, 28, 0.15);
  border: 1px solid rgba(211, 47, 47, 0.4);
}

.witness-night__card--clue {
  background: rgba(139, 148, 158, 0.1);
  border: 1px solid rgba(139, 148, 158, 0.3);
}

.witness-night__card-img {
  width: 80px;
  border-radius: 6px;
}

.witness-night__card-label {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.witness-night__card-name {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text);
}

.witness-night__private {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7rem;
  color: var(--color-text-dim);
  margin: 0;
}

.witness-night__confirm-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 20px;
  padding: 10px 24px;
  border-radius: 8px;
  background: var(--color-amber);
  color: var(--bg-primary);
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: opacity 0.15s;
}

.witness-night__confirm-btn:hover {
  opacity: 0.9;
}

.witness-night__footer {
  padding: 24px 32px;
  padding-bottom: calc(24px + var(--safe-area-bottom));
  z-index: 10;
}

.witness-night__loader {
  height: 3px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 2px;
  overflow: hidden;
}

.witness-night__loader-bar {
  width: 40%;
  height: 100%;
  background: var(--color-witness);
  border-radius: 2px;
  animation: loading 2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

@keyframes glow-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
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
</style>
