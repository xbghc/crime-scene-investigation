<script setup lang="ts">
import AppIcon from '../ui/AppIcon.vue'
import type { Role } from '../../types'

interface Props {
  role: Role
}

defineProps<Props>()

const emit = defineEmits<{
  confirm: []
}>()

const roleInfo: Record<Role, { title: string; description: string; icon: string }> = {
  witness: {
    title: '目击者',
    description: '你目击了整个犯罪过程。全程不能说话，只能通过选项物传递线索。',
    icon: 'visibility',
  },
  murderer: {
    title: '凶手',
    description: '选择你的作案手段和线索，在讨论中混淆视听，不被侦探识破。',
    icon: 'domino_mask',
  },
  accomplice: {
    title: '帮凶',
    description: '你知道凶手是谁，配合凶手误导侦探方向。',
    icon: 'person',
  },
  detective: {
    title: '侦探',
    description: '根据目击者的线索推理，找出凶手和作案组合。',
    icon: 'search',
  },
}
</script>

<template>
  <div class="vignette role-reveal">
    <main class="role-reveal__body">
      <div class="role-reveal__icon-wrap">
        <AppIcon
          :name="roleInfo[role].icon"
          class="app-icon role-reveal__icon"
          :class="`role-reveal__icon--${role}`"
        />
        <div class="role-reveal__glow" :class="`role-reveal__glow--${role}`" />
      </div>

      <p class="role-reveal__label">你的身份是</p>
      <h1 class="role-reveal__title">
        {{ roleInfo[role].title }}
      </h1>
      <p class="role-reveal__desc">{{ roleInfo[role].description }}</p>
    </main>

    <footer class="role-reveal__footer">
      <button class="role-reveal__btn" @click="emit('confirm')">
        <AppIcon name="check" class="app-icon" style="font-size: 20px" />
        我知道了
      </button>
    </footer>
  </div>
</template>

<style scoped>
.role-reveal {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.role-reveal__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 32px;
  z-index: 10;
}

.role-reveal__icon-wrap {
  position: relative;
  margin-bottom: 32px;
}

.role-reveal__icon {
  font-size: 4rem;
  animation: float 3s ease-in-out infinite;
}

.role-reveal__icon--witness {
  color: var(--color-witness);
}
.role-reveal__icon--murderer {
  color: var(--color-murderer);
}
.role-reveal__icon--accomplice {
  color: var(--color-accomplice);
}
.role-reveal__icon--detective {
  color: var(--color-detective);
}

.role-reveal__glow {
  position: absolute;
  inset: -32px;
  border-radius: 50%;
  pointer-events: none;
  animation: glow-pulse 3s ease-in-out infinite;
}

.role-reveal__glow--witness {
  background: radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%);
}
.role-reveal__glow--murderer {
  background: radial-gradient(circle, rgba(239, 68, 68, 0.15) 0%, transparent 70%);
}
.role-reveal__glow--accomplice {
  background: radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, transparent 70%);
}
.role-reveal__glow--detective {
  background: radial-gradient(circle, rgba(34, 197, 94, 0.15) 0%, transparent 70%);
}

.role-reveal__label {
  font-size: 12px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: normal;
  margin: 0 0 var(--space-2);
}

.role-reveal__title {
  margin: 0 0 16px;
  font-size: 36px;
  line-height: 40px;
  font-weight: 700;
  letter-spacing: -0.025em;
}

.role-reveal__desc {
  font-size: 14px;
  color: var(--color-text-muted);
  text-align: center;
  line-height: 1.6;
  max-width: 280px;
  margin: 0;
}

.role-reveal__footer {
  padding: 24px 16px;
  padding-bottom: calc(24px + var(--safe-area-bottom));
  z-index: 10;
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
}

.role-reveal__btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  background: var(--primary);
  color: var(--primary-foreground);
  letter-spacing: normal;
  transition: opacity 0.2s;
}

.role-reveal__btn:active {
  opacity: 0.85;
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
</style>
