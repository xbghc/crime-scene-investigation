<script setup lang="ts">
import LobbyPage from './LobbyPage.vue'
import BaseButton from '../components/ui/BaseButton.vue'

const mockPlayers = [
  { id: '1', nickname: '探长老王', isHost: true, ready: true },
  { id: '2', nickname: '神探小李', isHost: false, ready: true },
  { id: '3', nickname: 'Sherlock', isHost: false, ready: false },
]

const playerColors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6']

function getPlayerColor(index: number) {
  return playerColors[index % playerColors.length]
}

function getInitial(name: string) {
  return name.charAt(0).toUpperCase()
}

const minPlayers = 4
const maxPlayers = 10
const emptySlots = minPlayers - mockPlayers.length
</script>

<template>
  <Story title="pages/LobbyPage" group="pages" :layout="{ type: 'single', iframe: true }">

    <!-- Variant 1: Not joined -->
    <Variant title="未加入 — 昵称输入">
      <LobbyPage />
    </Variant>

    <!-- Variant 2: Joined — lobby (static mockup) -->
    <Variant title="已加入 — 大厅">
      <div class="min-h-dvh flex flex-col bg-bg-primary">

        <!-- Sticky header -->
        <header class="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-bg-secondary/90 backdrop-blur-sm border-b border-border">
          <div class="flex items-center gap-2">
            <span class="pulse-dot" />
            <span class="text-text-primary text-sm font-semibold tracking-wide">Lobby Active</span>
          </div>
          <div class="flex items-center gap-1.5 text-text-muted text-sm">
            <span class="material-symbols-outlined text-lg">groups</span>
            <span>{{ mockPlayers.length }}/{{ maxPlayers }}</span>
          </div>
        </header>

        <!-- Scrollable player list -->
        <main class="flex-1 overflow-y-auto px-4 py-4 pb-36">
          <div class="max-w-md mx-auto flex flex-col gap-3">

            <div
              v-for="(player, index) in mockPlayers"
              :key="player.id"
              class="player-card"
              :class="{ 'player-card--host': player.isHost }"
            >
              <div
                class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                :style="{ backgroundColor: getPlayerColor(index) + '20', color: getPlayerColor(index) }"
              >
                <span v-if="player.isHost" class="material-symbols-outlined text-xl">local_police</span>
                <template v-else>{{ getInitial(player.nickname) }}</template>
              </div>

              <div class="flex-1 min-w-0">
                <p class="text-text-primary text-sm font-semibold truncate">{{ player.nickname }}</p>
                <p v-if="player.isHost" class="text-amber-accent text-xs">Lead Investigator</p>
              </div>

              <span
                class="text-xs px-2 py-0.5 rounded-full"
                :class="player.ready
                  ? 'bg-success/15 text-success'
                  : 'bg-text-dim/15 text-text-muted'"
              >
                {{ player.ready ? 'Ready' : 'Pending' }}
              </span>
            </div>

            <!-- Empty slot -->
            <div v-for="n in emptySlots" :key="'empty-' + n" class="empty-slot">
              <span class="material-symbols-outlined text-xl text-text-dim">person_add</span>
              <span class="text-text-dim text-sm">等待玩家加入...</span>
            </div>
          </div>
        </main>

        <!-- Fixed footer -->
        <footer class="fixed bottom-0 left-0 right-0 z-20 px-4 pt-3 pb-4 bg-bg-primary/95 backdrop-blur-sm border-t border-border">
          <div class="max-w-md mx-auto flex flex-col gap-3">
            <BaseButton :disabled="true" block>
              <span class="material-symbols-outlined text-lg">play_arrow</span>
              开始调查（至少{{ minPlayers }}人）
            </BaseButton>

            <button class="flex items-center justify-center gap-1.5 text-amber-accent text-sm py-1">
              <span class="material-symbols-outlined text-lg">share</span>
              邀请侦探
            </button>
          </div>
        </footer>
      </div>
    </Variant>
  </Story>
</template>

<style scoped>
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

.player-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-radius: var(--border-radius);
  border-left: 3px solid transparent;
}

.player-card--host {
  border-left-color: var(--color-amber);
}

.empty-slot {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: 1px dashed var(--border-color);
  border-radius: var(--border-radius);
}
</style>
