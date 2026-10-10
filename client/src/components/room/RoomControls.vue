<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGameStore } from '../../stores/game'
import { useSocket } from '../../composables/useSocket'

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
        <span class="room-controls__label">房间码</span>
        <strong class="room-controls__code">{{ game.roomCode }}</strong>
      </div>
      <div class="room-controls__actions">
        <button class="room-controls__invite" @click="copyInvitation" aria-label="复制邀请">
          <span class="material-symbols-outlined" aria-hidden="true">content_copy</span>
          <span>邀请</span>
        </button>
        <button
          class="room-controls__leave"
          :disabled="!canLeave"
          :title="isActiveGame ? '游戏进行中，请先由房主重置游戏再退出' : '退出房间'"
          @click="leaveRoom"
        >
          {{ roomPending === 'leave' ? '退出中…' : '退出' }}
        </button>
      </div>
    </div>
    <p v-if="isActiveGame" class="room-controls__hint">游戏进行中，房主重置后可退出房间</p>
    <p v-if="copyMessage" class="room-controls__hint" role="status">{{ copyMessage }}</p>
    <p v-if="roomError" class="room-controls__error" role="alert">{{ roomError }}</p>
  </section>
</template>

<style scoped>
.room-controls {
  padding: 12px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
}

.room-controls__row,
.room-controls__identity,
.room-controls__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.room-controls__row {
  justify-content: space-between;
  flex-wrap: wrap;
}

.room-controls__label,
.room-controls__hint {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.room-controls__code {
  font-size: 1.15rem;
  color: var(--color-text);
  letter-spacing: 0.12em;
  font-variant-numeric: tabular-nums;
  user-select: all;
}

.room-controls__invite,
.room-controls__leave {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 44px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
  color: var(--color-text);
}

.room-controls__invite {
  background: var(--bg-card);
  color: var(--color-text);
}

.room-controls__invite .material-symbols-outlined {
  font-size: 16px;
}

.room-controls__leave {
  color: var(--color-text-muted);
}

.room-controls button:focus-visible {
  outline: 3px solid var(--color-text-muted);
  outline-offset: 3px;
}

.room-controls__leave:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.room-controls__hint,
.room-controls__error {
  margin: 8px 0 0;
  line-height: 1.5;
}

.room-controls__error {
  font-size: 0.8rem;
  color: var(--color-crimson-light);
}
</style>
