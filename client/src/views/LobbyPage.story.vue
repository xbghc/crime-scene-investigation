<script setup lang="ts">
import { ref } from 'vue'
import LobbyPage from './LobbyPage.vue'
import IconButton from '../components/ui/IconButton.vue'

type NetworkQuality = 'good' | 'fair' | 'poor'

interface Player {
  id: string
  nickname: string
  isHost: boolean
  ready: boolean
  network: NetworkQuality
  ping: number
}

const networkIcon: Record<NetworkQuality, string> = {
  good: 'signal_cellular_alt',
  fair: 'signal_cellular_alt_2_bar',
  poor: 'signal_cellular_alt_1_bar',
}

const networkColor: Record<NetworkQuality, string> = {
  good: 'text-success',
  fair: 'text-amber-accent',
  poor: 'text-crimson-light',
}

const networkPresets: NetworkQuality[] = ['good', 'fair', 'poor']
const pingRange: Record<NetworkQuality, [number, number]> = {
  good: [8, 40],
  fair: [60, 150],
  poor: [200, 500],
}

function randomPing(quality: NetworkQuality) {
  const [min, max] = pingRange[quality]
  return Math.floor(Math.random() * (max - min) + min)
}

const showPingId = ref<string | null>(null)

function togglePing(playerId: string) {
  showPingId.value = showPingId.value === playerId ? null : playerId
}

const playerColors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16']

function getPlayerColor(index: number) {
  return playerColors[index % playerColors.length]
}

function getInitial(name: string) {
  return name.charAt(0).toUpperCase()
}

const minPlayers = 4
const maxPlayers = 10

const presetNames = ['探长老王', '神探小李', 'Sherlock', '华生', 'Poirot', '柯南', 'Lupin', '包青天', 'Holmes', '狄仁杰']

let nextId = 4

function addPlayer(state: { players: Player[] }) {
  if (state.players.length >= maxPlayers) return
  const idx = state.players.length
  const net = networkPresets[Math.floor(Math.random() * networkPresets.length)]
  state.players.push({
    id: String(nextId++),
    nickname: presetNames[idx] ?? `玩家${idx + 1}`,
    isHost: false,
    ready: false,
    network: net,
    ping: randomPing(net),
  })
}

function removeLastPlayer(state: { players: Player[] }) {
  if (state.players.length <= 1) return
  state.players.pop()
}
</script>

<template>
  <Story title="pages/LobbyPage" group="pages" :layout="{ type: 'single', iframe: true }">

    <!-- Variant 1: Not joined -->
    <Variant title="未加入 — 昵称输入">
      <LobbyPage />
    </Variant>

    <!-- Variant 2: Joined — lobby with state controls -->
    <Variant
      title="已加入 — 大厅"
      :init-state="() => ({
        players: [
          { id: '1', nickname: '探长老王', isHost: true, ready: true, network: 'good', ping: 12 },
          { id: '2', nickname: '神探小李', isHost: false, ready: true, network: 'fair', ping: 87 },
          { id: '3', nickname: 'Sherlock', isHost: false, ready: false, network: 'poor', ping: 342 },
        ],
        connectionError: '',
      })"
    >
      <template #default="{ state }">
        <div class="min-h-dvh flex flex-col bg-bg-primary">

          <!-- Sticky header -->
          <header class="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-bg-secondary/90 backdrop-blur-sm border-b border-border">
            <div class="flex items-center gap-2">
              <span class="pulse-dot" />
              <span class="text-text-primary text-sm font-semibold tracking-wide">Lobby Active</span>
            </div>
            <div class="flex items-center gap-1.5 text-text-muted text-sm">
              <span class="material-symbols-outlined text-lg">groups</span>
              <span>{{ state.players.length }}/{{ maxPlayers }}</span>
            </div>
          </header>

          <!-- Scrollable player list -->
          <main class="flex-1 overflow-y-auto px-4 py-4 pb-36">
            <div class="max-w-md mx-auto flex flex-col gap-3">

              <div
                v-for="(player, index) in state.players"
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

                <div class="flex items-center gap-2 shrink-0">
                  <span
                    class="text-xs px-2 py-0.5 rounded-full"
                    :class="player.ready
                      ? 'bg-success/15 text-success'
                      : 'bg-text-dim/15 text-text-muted'"
                  >
                    {{ player.ready ? 'Ready' : 'Pending' }}
                  </span>
                  <span
                    class="network-indicator"
                    :class="networkColor[player.network]"
                    @click="togglePing(player.id)"
                  >
                    <span class="material-symbols-outlined text-base">{{ networkIcon[player.network] }}</span>
                    <Transition name="ping-fade">
                      <span v-if="showPingId === player.id" class="ping-tooltip">{{ player.ping }}ms</span>
                    </Transition>
                  </span>
                </div>
              </div>

              <IconButton icon="share" variant="ghost" block>
                邀请
              </IconButton>
            </div>
          </main>

          <!-- Fixed footer -->
          <footer class="fixed bottom-0 left-0 right-0 z-20 px-4 pt-3 pb-4 bg-bg-primary/95 backdrop-blur-sm border-t border-border">
            <div class="max-w-md mx-auto">
              <IconButton icon="play_arrow" :disabled="state.players.length < minPlayers" block>
                {{ state.players.length >= minPlayers ? '开始调查' : `开始调查（至少${minPlayers}人）` }}
              </IconButton>
            </div>
          </footer>

          <!-- Connection error toast -->
          <div
            v-if="state.connectionError"
            class="fixed bottom-24 left-4 right-4 z-30 bg-crimson/90 text-text-primary text-sm text-center px-4 py-3 rounded-lg backdrop-blur-sm"
          >
            {{ state.connectionError }}
          </div>
        </div>
      </template>

      <template #controls="{ state }">
        <HstText v-model="state.connectionError" title="Connection Error" />

        <div style="padding: 8px 12px; display: flex; gap: 8px;">
          <button
            style="flex: 1; padding: 4px 8px; font-size: 12px; background: #22c55e20; color: #22c55e; border: 1px solid #22c55e40; border-radius: 4px; cursor: pointer;"
            :disabled="state.players.length >= maxPlayers"
            @click="addPlayer(state)"
          >
            + 添加玩家
          </button>
          <button
            style="flex: 1; padding: 4px 8px; font-size: 12px; background: #ef444420; color: #ef4444; border: 1px solid #ef444440; border-radius: 4px; cursor: pointer;"
            :disabled="state.players.length <= 1"
            @click="removeLastPlayer(state)"
          >
            − 移除末位
          </button>
        </div>

        <HstCheckbox
          v-for="player in state.players"
          :key="player.id"
          v-model="player.ready"
          :title="`${player.nickname} Ready`"
        />
      </template>
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

.network-indicator {
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  -webkit-user-select: none;
  user-select: none;
}

.ping-tooltip {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.625rem;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  padding: 3px 6px;
  border-radius: 4px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  pointer-events: none;
}

.ping-fade-enter-active { transition: opacity 0.15s, transform 0.15s; }
.ping-fade-leave-active { transition: opacity 0.3s, transform 0.3s; }
.ping-fade-enter-from,
.ping-fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(4px); }
.ping-fade-enter-to,
.ping-fade-leave-from { opacity: 1; transform: translateX(-50%) translateY(0); }

</style>
