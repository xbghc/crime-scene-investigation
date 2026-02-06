<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSocket } from '../composables/useSocket'
import IconButton from '../components/ui/IconButton.vue'

const { connected, connectionError, connect, disconnect, joinRoom } = useSocket()

const nickname = ref('')
const joined = ref(false)

const minPlayers = 4
const maxPlayers = 10

interface Player {
  id: string
  nickname: string
  isHost: boolean
  ready: boolean
}

// For now, only the current player; Phase 3 will populate via socket
const players = ref<Player[]>([])

const canStart = computed(() => players.value.length >= minPlayers)

const emptySlots = computed(() => {
  const count = minPlayers - players.value.length
  return count > 0 ? count : 0
})

const playerColors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16']

function getPlayerColor(index: number) {
  return playerColors[index % playerColors.length]
}

function getInitial(name: string) {
  return name.charAt(0).toUpperCase()
}

function handleJoin() {
  if (!nickname.value.trim()) return
  joinRoom(nickname.value.trim())
  joined.value = true
  players.value = [
    { id: 'self', nickname: nickname.value.trim(), isHost: true, ready: true }
  ]
}

onMounted(() => {
  connect()
})

onUnmounted(() => {
  disconnect()
})
</script>

<template>
  <!-- State 1: Not joined — nickname input -->
  <div v-if="!joined" class="vignette min-h-dvh flex flex-col items-center justify-center px-6 bg-bg-primary">
    <div class="relative z-10 w-full max-w-xs flex flex-col items-center">

      <!-- Icon + Title -->
      <span class="material-symbols-outlined text-amber-accent text-4xl mb-4">shield</span>
      <h1 class="text-xl font-bold tracking-[0.08em] text-text-primary mb-1">Join Investigation</h1>
      <p class="text-text-muted text-sm mb-8">输入你的代号</p>

      <!-- Form -->
      <form class="w-full flex flex-col gap-4" @submit.prevent="handleJoin">
        <input
          v-model="nickname"
          type="text"
          class="lobby-input"
          placeholder="代号（最多10个字符）"
          maxlength="10"
          autocomplete="off"
        />
        <IconButton type="submit" icon="arrow_forward" icon-position="right" :disabled="!nickname.trim() || !connected" block>
          加入调查
        </IconButton>
      </form>

      <!-- Connection status -->
      <div class="flex items-center gap-2 mt-8">
        <span
          class="inline-block w-2 h-2 rounded-full"
          :class="connected ? 'bg-success' : 'bg-text-dim'"
        />
        <span class="text-text-muted text-xs">{{ connected ? '服务器已连接' : '正在连接...' }}</span>
      </div>
    </div>
  </div>

  <!-- State 2: Joined — lobby -->
  <div v-else class="min-h-dvh flex flex-col bg-bg-primary">

    <!-- Sticky header -->
    <header class="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-bg-secondary/90 backdrop-blur-sm border-b border-border"
            :style="{ paddingTop: 'calc(12px + var(--safe-area-top))' }">
      <div class="flex items-center gap-2">
        <span class="pulse-dot" />
        <span class="text-text-primary text-sm font-semibold tracking-wide">Lobby Active</span>
      </div>
      <div class="flex items-center gap-1.5 text-text-muted text-sm">
        <span class="material-symbols-outlined text-lg">groups</span>
        <span>{{ players.length }}/{{ maxPlayers }}</span>
      </div>
    </header>

    <!-- Scrollable player list -->
    <main class="flex-1 overflow-y-auto px-4 py-4 pb-36">
      <div class="max-w-md mx-auto flex flex-col gap-3">

        <!-- Players -->
        <div
          v-for="(player, index) in players"
          :key="player.id"
          class="player-card"
          :class="{ 'player-card--host': player.isHost }"
        >
          <!-- Avatar -->
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            :style="{ backgroundColor: getPlayerColor(index) + '20', color: getPlayerColor(index) }"
          >
            <span v-if="player.isHost" class="material-symbols-outlined text-xl">local_police</span>
            <template v-else>{{ getInitial(player.nickname) }}</template>
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <p class="text-text-primary text-sm font-semibold truncate">{{ player.nickname }}</p>
            <p v-if="player.isHost" class="text-amber-accent text-xs">Lead Investigator</p>
          </div>

          <!-- Status badge -->
          <span
            class="text-xs px-2 py-0.5 rounded-full"
            :class="player.ready
              ? 'bg-success/15 text-success'
              : 'bg-text-dim/15 text-text-muted'"
          >
            {{ player.ready ? 'Ready' : 'Pending' }}
          </span>
        </div>

        <!-- Empty slots -->
        <div
          v-for="n in emptySlots"
          :key="'empty-' + n"
          class="empty-slot"
        >
          <span class="material-symbols-outlined text-xl text-text-dim">person_add</span>
          <span class="text-text-dim text-sm">等待玩家加入...</span>
        </div>
      </div>
    </main>

    <!-- Fixed footer -->
    <footer class="fixed bottom-0 left-0 right-0 z-20 px-4 pt-3 bg-bg-primary/95 backdrop-blur-sm border-t border-border"
            :style="{ paddingBottom: 'calc(16px + var(--safe-area-bottom))' }">
      <div class="max-w-md mx-auto flex flex-col gap-3">
        <IconButton icon="play_arrow" :disabled="!canStart" block>
          {{ canStart ? '开始调查' : `开始调查（至少${minPlayers}人）` }}
        </IconButton>

        <IconButton icon="share" variant="ghost" block>
          邀请侦探
        </IconButton>
      </div>
    </footer>

    <!-- Connection error toast -->
    <div
      v-if="connectionError"
      class="fixed bottom-24 left-4 right-4 z-30 bg-crimson/90 text-text-primary text-sm text-center px-4 py-3 rounded-lg backdrop-blur-sm"
    >
      {{ connectionError }}
    </div>
  </div>
</template>

<style scoped>
.lobby-input {
  width: 100%;
  padding: 14px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  color: var(--color-text);
  font-size: 1rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.lobby-input:focus {
  border-color: var(--color-amber);
  box-shadow: 0 0 0 3px rgba(212, 168, 71, 0.15);
}

.lobby-input::placeholder {
  color: var(--color-text-dim);
}

/* Pulse dot */
.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-crimson-light);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* Player card */
.player-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-radius: var(--border-radius);
  border-left: 3px solid transparent;
  animation: slideIn 0.3s ease-out;
}

.player-card--host {
  border-left-color: var(--color-amber);
}

/* Empty slot */
.empty-slot {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: 1px dashed var(--border-color);
  border-radius: var(--border-radius);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
