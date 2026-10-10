<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '../../stores/game'
import { useSocket } from '../../composables/useSocket'
import AppIcon from '../ui/AppIcon.vue'

const game = useGameStore()
const { connected, roomPending, roomError, leaveRoom } = useSocket()
const copyMessage = ref('')
const isActiveGame = computed(() => game.phase !== 'waiting' && game.phase !== 'game-over')
const canLeave = computed(() => connected.value && !roomPending.value && !isActiveGame.value)

async function copyInvitation() {
  if (!game.roomCode) return
  const url = new URL('/lobby', window.location.origin)
  url.searchParams.set('room', game.roomCode)
  try {
    await navigator.clipboard.writeText(`犯罪现场 · 房间 ${game.roomCode}\n${url.href}`)
    copyMessage.value = '邀请已复制，发给朋友一起加入'
  } catch {
    copyMessage.value = `无法自动复制，请手动分享房间码 ${game.roomCode}`
  }
}
</script>

<template>
  <section v-if="game.roomCode" class="room-controls" aria-label="房间信息">
    <div class="room-controls__row">
      <div class="room-controls__identity">
        <span class="room-controls__label"
          ><AppIcon name="lock" style="font-size: 12px" />私人房间</span
        >
        <div class="room-controls__code-row">
          <span class="sr-only">房间码</span
          ><strong class="room-controls__code">{{ game.roomCode }}</strong>
        </div>
      </div>
      <div class="room-controls__actions">
        <button
          type="button"
          class="room-controls__invite"
          @click="copyInvitation"
          aria-label="复制邀请"
        >
          <AppIcon name="content_copy" />
          <span>复制邀请</span>
        </button>
        <button
          type="button"
          class="room-controls__leave"
          :disabled="!canLeave"
          :title="isActiveGame ? '游戏进行中，请先由房主重置游戏再退出' : '退出房间'"
          :aria-describedby="isActiveGame ? 'room-leave-hint' : undefined"
          :aria-busy="roomPending === 'leave'"
          @click="leaveRoom"
        >
          <AppIcon name="logout" />{{ roomPending === 'leave' ? '退出中…' : '退出' }}
        </button>
      </div>
    </div>
    <p v-if="isActiveGame" id="room-leave-hint" class="room-controls__hint">
      游戏进行中，房主重置后可退出房间
    </p>
    <p v-if="copyMessage" class="room-controls__hint" role="status">{{ copyMessage }}</p>
    <p v-if="roomError" class="room-controls__error" role="alert">
      <AppIcon name="error" />{{ roomError }}
    </p>
  </section>
</template>

<style scoped>
.room-controls {
  padding: var(--space-6);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
}

.room-controls__row,
.room-controls__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.room-controls__row {
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.room-controls__identity {
  display: grid;
  gap: var(--space-2);
}

.room-controls__label {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 16px;
}

.room-controls__code {
  color: var(--foreground);
  font-family: var(--font-mono);
  font-size: 24px;
  line-height: 32px;
  font-weight: 600;
  letter-spacing: 0.12em;
  font-variant-numeric: tabular-nums;
  -webkit-user-select: all;
  user-select: all;
}

.room-controls__actions {
  flex-wrap: wrap;
}

.room-controls__invite,
.room-controls__leave {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 44px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  transition:
    background-color 0.15s,
    color 0.15s;
}

.room-controls__invite {
  background: var(--secondary);
  border-color: var(--border);
  color: var(--foreground);
}

.room-controls__invite:hover {
  background: var(--background);
}

.room-controls__leave {
  color: var(--color-text-muted);
}

.room-controls__leave:hover:not(:disabled) {
  background: var(--secondary);
  color: var(--foreground);
}

.room-controls button:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--ring) 50%, transparent);
  outline-offset: 2px;
}

.room-controls__leave:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.room-controls__hint,
.room-controls__error {
  margin-top: var(--space-3);
  font-size: 12px;
  line-height: 20px;
  overflow-wrap: anywhere;
}

.room-controls__hint {
  color: var(--color-text-muted);
}

.room-controls__error {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  color: var(--destructive);
}

.room-controls__error :deep(svg) {
  flex-shrink: 0;
  margin-top: 2px;
}
</style>
