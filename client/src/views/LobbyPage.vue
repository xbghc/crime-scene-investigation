<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSocket } from '../composables/useSocket'
import { useGameStore } from '../stores/game'
import { useAuthStore } from '../stores/auth'
import IconButton from '../components/ui/IconButton.vue'

const router = useRouter()
const game = useGameStore()
const auth = useAuthStore()
const { connected, connectionError, connect, disconnect, joinRoom, updateNickname, startGame } = useSocket()

const NICKNAME_KEY = 'csi_nickname'
const PWA_DISMISS_KEY = 'csi_pwa_dismissed'
const nickname = ref(localStorage.getItem(NICKNAME_KEY) || '')
const joined = ref(false)
const editingNickname = ref(false)
const newNickname = ref('')

// === PWA install prompt ===
const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  || (navigator as any).standalone === true
const deferredPrompt = ref<any>(null)
const showPwaPrompt = ref(false)

// Detect iOS Safari (no beforeinstallprompt support)
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
const isSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|Chrome/.test(navigator.userAgent)
const isIOSSafari = isIOS && isSafari

function onBeforeInstallPrompt(e: Event) {
  e.preventDefault()
  deferredPrompt.value = e
  if (!localStorage.getItem(PWA_DISMISS_KEY)) {
    showPwaPrompt.value = true
  }
}

async function handleInstallPwa() {
  if (deferredPrompt.value) {
    deferredPrompt.value.prompt()
    const { outcome } = await deferredPrompt.value.userChoice
    if (outcome === 'accepted') {
      showPwaPrompt.value = false
    }
    deferredPrompt.value = null
  }
}

function dismissPwaPrompt() {
  showPwaPrompt.value = false
  localStorage.setItem(PWA_DISMISS_KEY, '1')
}

const minPlayers = 4
const maxPlayers = 10

const players = computed(() => game.roomPlayers)
const isHost = computed(() => game.hostId === auth.userId)
const canStart = computed(() => players.value.length >= minPlayers && isHost.value)

function getInitial(name: string) {
  return name.charAt(0).toUpperCase()
}

function handleJoin() {
  const name = nickname.value.trim()
  if (!name) return
  localStorage.setItem(NICKNAME_KEY, name)
  joinRoom(name)
  joined.value = true
}

function handleStartGame() {
  startGame()
}

function startEditNickname(currentNickname: string) {
  newNickname.value = currentNickname
  editingNickname.value = true
}

function cancelEditNickname() {
  editingNickname.value = false
  newNickname.value = ''
}

function confirmEditNickname() {
  const trimmed = newNickname.value.trim()
  if (!trimmed || trimmed === nickname.value) {
    editingNickname.value = false
    return
  }
  // Update local storage and send to server
  nickname.value = trimmed
  localStorage.setItem(NICKNAME_KEY, trimmed)
  updateNickname(trimmed)
  editingNickname.value = false
}

// Navigate to /game when game is active (start or reconnect)
const GAME_ACTIVE_PHASES = new Set([
  'role-reveal', 'night-murder', 'witness-accuse',
  'discussion-1', 'advance-1', 'discussion-2', 'advance-2',
  'discussion-3', 'force-solve', 'game-over',
])
watch(() => game.phase, (p) => {
  if (GAME_ACTIVE_PHASES.has(p)) {
    router.push('/game')
  }
})

// Also redirect if room status is 'playing' (handles reconnection case)
watch(() => game.roomStatus, (status) => {
  if (status === 'playing') {
    router.push('/game')
  }
}, { immediate: true })

onMounted(() => {
  connect()
  // Auto-join if nickname was saved
  const saved = nickname.value
  if (saved) {
    const stop = watch(connected, (isConnected) => {
      if (isConnected) {
        joinRoom(saved)
        joined.value = true
        stop()
      }
    }, { immediate: true })
  }

  // PWA install prompt — show for all non-standalone mobile browsers
  if (!isStandalone && !localStorage.getItem(PWA_DISMISS_KEY)) {
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    showPwaPrompt.value = true
  }
})

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
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
          v-for="player in players"
          :key="player.id"
          class="player-card"
          :class="{ 'player-card--host': player.isHost }"
        >
          <!-- Avatar -->
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            :style="{ backgroundColor: player.color + '20', color: player.color }"
          >
            <span v-if="player.isHost" class="material-symbols-outlined text-xl">local_police</span>
            <template v-else>{{ getInitial(player.nickname) }}</template>
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0">
            <p class="text-text-primary text-sm font-semibold truncate">{{ player.nickname }}</p>
            <p v-if="player.isHost" class="text-amber-accent text-xs">Lead Investigator</p>
          </div>

          <!-- Edit button (only for current user) -->
          <button
            v-if="player.id === auth.userId"
            class="edit-nickname-btn"
            @click="startEditNickname(player.nickname)"
            title="修改昵称"
          >
            <span class="material-symbols-outlined">edit</span>
          </button>

          <!-- Status badge -->
          <div class="flex items-center gap-2 shrink-0">
            <span
              class="text-xs px-2 py-0.5 rounded-full bg-success/15 text-success"
            >
              Ready
            </span>
          </div>
        </div>

        <IconButton icon="share" variant="ghost" block>
          邀请
        </IconButton>
      </div>
    </main>

    <!-- Fixed footer -->
    <footer class="fixed bottom-0 left-0 right-0 z-20 px-4 pt-3 bg-bg-primary/95 backdrop-blur-sm border-t border-border"
            :style="{ paddingBottom: 'calc(16px + var(--safe-area-bottom))' }">
      <div class="max-w-md mx-auto">
        <IconButton v-if="isHost" icon="play_arrow" :disabled="!canStart" block @click="handleStartGame">
          {{ canStart ? '开始调查' : `开始调查（至少${minPlayers}人）` }}
        </IconButton>
        <p v-else class="text-text-muted text-sm text-center py-3">
          等待房主开始游戏…
        </p>
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

  <!-- Edit nickname dialog -->
  <Teleport to="body">
    <Transition name="pwa-fade">
      <div v-if="editingNickname" class="pwa-overlay" @click.self="cancelEditNickname">
        <div class="pwa-dialog">
          <div class="pwa-dialog__icon">
            <span class="material-symbols-outlined">edit</span>
          </div>
          <h2 class="pwa-dialog__title">修改昵称</h2>
          <p class="pwa-dialog__desc">输入新的代号（最多10个字符）</p>

          <input
            v-model="newNickname"
            type="text"
            class="nickname-edit-input"
            placeholder="新昵称"
            maxlength="10"
            autocomplete="off"
            @keyup.enter="confirmEditNickname"
            @keyup.esc="cancelEditNickname"
          />

          <div class="flex gap-2 w-full mt-2">
            <button class="pwa-dialog__dismiss flex-1" @click="cancelEditNickname">
              取消
            </button>
            <button class="pwa-dialog__install flex-1" @click="confirmEditNickname" :disabled="!newNickname.trim()">
              确认
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- PWA install prompt overlay -->
  <Teleport to="body">
    <Transition name="pwa-fade">
      <div v-if="showPwaPrompt && !isStandalone" class="pwa-overlay" @click.self="dismissPwaPrompt">
        <div class="pwa-dialog">
          <div class="pwa-dialog__icon">
            <span class="material-symbols-outlined">install_mobile</span>
          </div>
          <h2 class="pwa-dialog__title">添加到主屏幕</h2>
          <p class="pwa-dialog__desc">
            安装「犯罪现场」到主屏幕，获得更好的全屏体验。<br/>
            <span class="pwa-dialog__hint">几乎不占存储空间</span>
          </p>

          <!-- One-click install (Chrome + HTTPS) -->
          <button v-if="deferredPrompt" class="pwa-dialog__install" @click="handleInstallPwa">
            <span class="material-symbols-outlined" style="font-size: 20px">download</span>
            立即安装
          </button>

          <!-- Manual instructions when no native prompt -->
          <div v-else class="pwa-dialog__steps">
            <template v-if="isIOSSafari">
              <div class="pwa-dialog__step">
                <span class="pwa-dialog__step-num">1</span>
                <span>点击底部 <span class="material-symbols-outlined pwa-dialog__inline-icon">ios_share</span> 分享按钮</span>
              </div>
              <div class="pwa-dialog__step">
                <span class="pwa-dialog__step-num">2</span>
                <span>选择「添加到主屏幕」</span>
              </div>
            </template>
            <template v-else>
              <div class="pwa-dialog__step">
                <span class="pwa-dialog__step-num">1</span>
                <span>点击浏览器右上角 <span class="material-symbols-outlined pwa-dialog__inline-icon">more_vert</span> 菜单</span>
              </div>
              <div class="pwa-dialog__step">
                <span class="pwa-dialog__step-num">2</span>
                <span>选择「添加到主屏幕」或「安装应用」</span>
              </div>
            </template>
          </div>

          <button class="pwa-dialog__dismiss" @click="dismissPwaPrompt">
            以后再说
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
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

/* Edit nickname button */
.edit-nickname-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.edit-nickname-btn:hover {
  background: rgba(212, 168, 71, 0.1);
  color: var(--color-amber);
}

.edit-nickname-btn .material-symbols-outlined {
  font-size: 18px;
}

/* Nickname edit input */
.nickname-edit-input {
  width: 100%;
  padding: 12px 14px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: var(--color-text);
  font-size: 0.95rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.nickname-edit-input:focus {
  border-color: var(--color-amber);
  box-shadow: 0 0 0 3px rgba(212, 168, 71, 0.15);
}

.nickname-edit-input::placeholder {
  color: var(--color-text-dim);
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

/* PWA install prompt */
.pwa-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  padding: 16px;
  padding-bottom: calc(16px + var(--safe-area-bottom));
}

.pwa-dialog {
  width: 100%;
  max-width: 360px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  animation: slideUp 0.3s ease-out;
}

.pwa-dialog__icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: rgba(212, 168, 71, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
}

.pwa-dialog__icon .material-symbols-outlined {
  font-size: 28px;
  color: var(--color-amber);
}

.pwa-dialog__title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.pwa-dialog__desc {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  text-align: center;
  line-height: 1.5;
  margin: 0;
}

.pwa-dialog__hint {
  font-size: 0.75rem;
  color: var(--color-text-dim);
}

.pwa-dialog__steps {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}

.pwa-dialog__step {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.85rem;
  color: var(--color-text);
}

.pwa-dialog__step-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--color-amber);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.pwa-dialog__inline-icon {
  font-size: 18px;
  vertical-align: middle;
  color: var(--color-amber);
}

.pwa-dialog__install {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 48px;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 600;
  background: var(--color-amber);
  color: #fff;
  margin-top: 4px;
  transition: opacity 0.15s;
}

.pwa-dialog__install:active {
  opacity: 0.85;
}

.pwa-dialog__dismiss {
  background: none;
  border: none;
  font-size: 0.8rem;
  color: var(--color-text-dim);
  cursor: pointer;
  padding: 8px 16px;
}

.pwa-dialog__dismiss:hover {
  color: var(--color-text-muted);
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(40px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.pwa-fade-enter-active {
  transition: opacity 0.25s ease;
}
.pwa-fade-enter-active .pwa-dialog {
  animation: slideUp 0.3s ease-out;
}
.pwa-fade-leave-active {
  transition: opacity 0.2s ease;
}
.pwa-fade-enter-from,
.pwa-fade-leave-to {
  opacity: 0;
}
</style>
