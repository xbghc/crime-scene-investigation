<script setup lang="ts">
import type { PlayerStatus } from '../../types'

defineProps<{
  nickname: string
  color: string
  isHost?: boolean
  status?: PlayerStatus
}>()
</script>

<template>
  <div
    class="player-avatar"
    :class="{
      'player-avatar--dead': status === 'dead',
      'player-avatar--disconnected': status === 'disconnected',
    }"
  >
    <div class="player-avatar__circle" :style="{ backgroundColor: color }">
      <span class="player-avatar__initial">{{ nickname.charAt(0) }}</span>
      <span v-if="isHost" class="player-avatar__crown">&#9819;</span>
    </div>
    <span class="player-avatar__name" :class="{ 'player-avatar__name--dead': status === 'dead' }">
      {{ nickname }}
    </span>
  </div>
</template>

<style scoped>
.player-avatar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.player-avatar__circle {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.player-avatar__initial {
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.player-avatar__crown {
  position: absolute;
  top: -10px;
  right: -6px;
  font-size: 0.75rem;
  color: var(--color-amber);
  line-height: 1;
}

.player-avatar__name {
  font-size: 0.75rem;
  color: var(--color-text);
  max-width: 56px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

.player-avatar__name--dead {
  text-decoration: line-through;
  color: var(--color-text-muted);
}

/* Dead state */
.player-avatar--dead .player-avatar__circle {
  filter: grayscale(1);
}

/* Disconnected state */
.player-avatar--disconnected {
  animation: pulse-opacity 2s ease-in-out infinite;
}

@keyframes pulse-opacity {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}
</style>
