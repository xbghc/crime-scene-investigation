<script setup lang="ts">
import AppIcon from '../ui/AppIcon.vue'
import { ref } from 'vue'
import RoleBadge from '../game/RoleBadge.vue'

const revealed = ref(false)
</script>

<template>
  <div class="vignette night-view">
    <!-- Status bar -->
    <header class="night-view__header">
      <div class="night-view__phase">
        <AppIcon name="bedtime" class="app-icon text-amber-accent" />
        <span>夜晚阶段</span>
      </div>
      <div
        class="role-flip"
        role="button"
        tabindex="0"
        :aria-label="revealed ? '侦探，隐藏身份' : '查看身份'"
        :aria-pressed="revealed"
        @keydown.enter="revealed = !revealed"
        @keydown.space.prevent="revealed = !revealed"
        :class="{ 'role-flip--revealed': revealed }"
        @click="revealed = !revealed"
      >
        <div class="role-flip__inner">
          <div class="role-flip__front">
            <AppIcon name="visibility_off" class="app-icon text-base text-text-dim" />
          </div>
          <div class="role-flip__back">
            <RoleBadge role="detective" show-label />
          </div>
        </div>
      </div>
    </header>

    <!-- Center content -->
    <main class="night-view__body">
      <!-- Atmospheric moon icon -->
      <div class="night-view__icon-wrap">
        <AppIcon name="nights_stay" class="app-icon night-view__moon" />
        <div class="night-view__glow" />
      </div>

      <h1 class="night-view__title">夜晚降临，凶手正在作案</h1>
      <p class="night-view__subtitle">请保持安静，等待夜晚结束。</p>
    </main>

    <!-- Loading bar -->
    <footer class="night-view__footer">
      <div class="night-view__loader">
        <div class="night-view__loader-bar" />
      </div>
    </footer>
  </div>
</template>

<style scoped>
.night-view {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
}

/* Header */
.night-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  padding-top: calc(12px + var(--safe-area-top));
  z-index: 10;
}

.night-view__phase {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: 0.04em;
}

/* Role flip card */
.role-flip {
  perspective: 400px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
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
.night-view__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
  z-index: 10;
}

.night-view__icon-wrap {
  position: relative;
  margin-bottom: 40px;
}

.night-view__moon {
  font-size: 5rem;
  color: var(--color-amber);
  font-variation-settings:
    'FILL' 1,
    'wght' 300,
    'GRAD' 0,
    'opsz' 48;
  animation: float 4s ease-in-out infinite;
}

.night-view__glow {
  position: absolute;
  inset: -24px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(212, 168, 71, 0.15) 0%, transparent 70%);
  pointer-events: none;
  animation: glow-pulse 4s ease-in-out infinite;
}

.night-view__title {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text);
  text-align: center;
  letter-spacing: normal;
  margin: 0 0 12px;
  line-height: 32px;
}

.night-view__subtitle {
  font-size: 14px;
  color: var(--color-text-muted);
  text-align: center;
  margin: 0;
  line-height: 1.6;
}

/* Footer loader */
.night-view__footer {
  padding: 24px 32px;
  padding-bottom: calc(24px + var(--safe-area-bottom));
  z-index: 10;
}

.night-view__loader {
  height: 3px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 2px;
  overflow: hidden;
}

.night-view__loader-bar {
  width: 40%;
  height: 100%;
  background: var(--color-amber);
  border-radius: 2px;
  animation: loading 2s ease-in-out infinite;
}

/* Animations */
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
.role-flip:focus-visible {
  outline: 3px solid var(--ring);
  outline-offset: 3px;
}
</style>
