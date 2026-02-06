<script setup lang="ts">
import { ref, computed } from 'vue'
import RoleBadge from '../game/RoleBadge.vue'

interface Props {
  murdererNickname: string
  timeRemaining?: number
}

const props = withDefaults(defineProps<Props>(), {
  timeRemaining: 45,
})

const revealed = ref(false)

const timerDisplay = computed(() => {
  const m = Math.floor(props.timeRemaining / 60)
  const s = props.timeRemaining % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})
</script>

<template>
  <div class="vignette accomplice-view">
    <!-- Header -->
    <header class="accomplice-view__header">
      <div class="accomplice-view__phase">
        <span class="material-symbols-outlined text-amber-accent accomplice-view__pulse">dark_mode</span>
        <span>Night Phase</span>
      </div>
      <div class="role-flip" :class="{ 'role-flip--revealed': revealed }" @click="revealed = !revealed">
        <div class="role-flip__inner">
          <div class="role-flip__front">
            <span class="material-symbols-outlined text-base text-text-dim">visibility_off</span>
          </div>
          <div class="role-flip__back">
            <RoleBadge role="accomplice" show-label />
          </div>
        </div>
      </div>
    </header>

    <!-- Center content -->
    <main class="accomplice-view__body">
      <!-- Murderer identity -->
      <div class="accomplice-view__identity">
        <div class="accomplice-view__avatar">
          <span class="material-symbols-outlined" style="font-size: 2rem">domino_mask</span>
        </div>
        <div class="accomplice-view__glow" />
      </div>

      <p class="accomplice-view__label">The Murderer is</p>
      <h1 class="accomplice-view__name">{{ murdererNickname }}</h1>
      <p class="accomplice-view__subtitle">Murderer is selecting weapon and clue...</p>

      <!-- Timer -->
      <div class="accomplice-view__timer">
        <span class="material-symbols-outlined" style="font-size: 16px">timer</span>
        <span>{{ timerDisplay }}</span>
      </div>
    </main>

    <!-- Loading bar -->
    <footer class="accomplice-view__footer">
      <div class="accomplice-view__loader">
        <div class="accomplice-view__loader-bar" />
      </div>
    </footer>
  </div>
</template>

<style scoped>
.accomplice-view {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
}

/* Header */
.accomplice-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  padding-top: calc(12px + var(--safe-area-top));
  z-index: 10;
}

.accomplice-view__phase {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: 0.04em;
}

.accomplice-view__pulse {
  animation: pulse 2s ease-in-out infinite;
}

/* Role flip card */
.role-flip {
  perspective: 400px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.role-flip__inner {
  position: relative;
  transition: transform 0.5s ease;
  transform-style: preserve-3d;
}

.role-flip--revealed .role-flip__inner {
  transform: rotateY(180deg);
}

.role-flip__front,
.role-flip__back {
  backface-visibility: hidden;
}

.role-flip__front {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 24px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: var(--bg-card);
}

.role-flip__back {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: rotateY(180deg);
}

/* Body */
.accomplice-view__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
  z-index: 10;
}

.accomplice-view__identity {
  position: relative;
  margin-bottom: 32px;
}

.accomplice-view__avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(245, 158, 11, 0.15);
  border: 2px solid rgba(245, 158, 11, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-role-accomplice);
  animation: float 4s ease-in-out infinite;
}

.accomplice-view__glow {
  position: absolute;
  inset: -24px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(245, 158, 11, 0.12) 0%, transparent 70%);
  pointer-events: none;
  animation: glow-pulse 4s ease-in-out infinite;
}

.accomplice-view__label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin: 0 0 8px;
}

.accomplice-view__name {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-crimson-light);
  margin: 0 0 12px;
  letter-spacing: 0.02em;
}

.accomplice-view__subtitle {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  text-align: center;
  margin: 0 0 24px;
}

.accomplice-view__timer {
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
  color: var(--color-text-muted);
}

/* Footer loader */
.accomplice-view__footer {
  padding: 24px 32px;
  padding-bottom: calc(24px + var(--safe-area-bottom));
  z-index: 10;
}

.accomplice-view__loader {
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
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@keyframes loading {
  0% { transform: translateX(-100%); }
  50% { transform: translateX(200%); }
  100% { transform: translateX(-100%); }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

@keyframes glow-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
