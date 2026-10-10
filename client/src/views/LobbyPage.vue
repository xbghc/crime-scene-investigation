<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSocket } from '../composables/useSocket'
import { useGameStore } from '../stores/game'
import { useAuthStore } from '../stores/auth'
import IconButton from '../components/ui/IconButton.vue'
import RoomControls from '../components/room/RoomControls.vue'
import BaseToast from '../components/ui/BaseToast.vue'
import BaseModal from '../components/ui/BaseModal.vue'
import AppIcon from '../components/ui/AppIcon.vue'

const router = useRouter()
const route = useRoute()
const game = useGameStore()
const auth = useAuthStore()
const {
  connected,
  connectionError,
  roomPending,
  roomError,
  sessionReplaced,
  connect,
  createRoom,
  joinRoom,
  resumeRoom,
  updateNickname,
  startGame,
} = useSocket()

const NICKNAME_KEY = 'csi_nickname'
const PWA_DISMISS_KEY = 'csi_pwa_dismissed'
const nickname = ref(localStorage.getItem(NICKNAME_KEY) || '')
const joined = computed(() => !!game.roomCode)
const inviteCode = typeof route.query.room === 'string' ? route.query.room.toUpperCase() : ''
const roomCode = ref(inviteCode)
const entryMode = ref<'create' | 'join'>(inviteCode ? 'join' : 'create')
const canSubmit = computed(
  () =>
    connected.value &&
    !roomPending.value &&
    !!nickname.value.trim() &&
    (entryMode.value === 'create' || /^[A-Z0-9]{6}$/.test(roomCode.value.trim().toUpperCase())),
)
const canRetryResume = computed(() => !joined.value && connected.value)

function updateRoomCode(event: Event) {
  roomCode.value = (event.target as HTMLInputElement).value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6)
}
const editingNickname = ref(false)
const newNickname = ref('')

// === PWA install prompt ===
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true
const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)
const showPwaPrompt = ref(false)

// Detect iOS Safari (no beforeinstallprompt support)
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
const isSafari =
  /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|Chrome/.test(navigator.userAgent)
const isIOSSafari = isIOS && isSafari

function onBeforeInstallPrompt(e: Event) {
  e.preventDefault()
  deferredPrompt.value = e as BeforeInstallPromptEvent
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

const minPlayers = computed(() => game.minPlayers)
const maxPlayers = computed(() => game.maxPlayers)

const players = computed(() => game.roomPlayers)
const isHost = computed(() => game.hostId === auth.userId)
const missingPlayers = computed(() => Math.max(0, minPlayers.value - players.value.length))
const allConnected = computed(() => players.value.every((player) => player.connected !== false))
const canStart = computed(
  () =>
    connected.value &&
    !roomPending.value &&
    players.value.length >= minPlayers.value &&
    isHost.value &&
    allConnected.value,
)

function getInitial(name: string) {
  return name.charAt(0).toUpperCase()
}

async function handleEnterRoom() {
  if (!canSubmit.value) return
  const name = nickname.value.trim()
  const result =
    entryMode.value === 'create' ? await createRoom(name) : await joinRoom(name, roomCode.value)
  if (result.ok) localStorage.setItem(NICKNAME_KEY, name)
}

function handleStartGame() {
  if (canStart.value) startGame()
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
  if (!connected.value || roomPending.value) return
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

// Enter the game only after the server restores both membership and game state.
watch(
  () => [game.roomCode, game.phase],
  () => {
    if (game.roomCode && game.phase !== 'waiting') router.replace('/game')
    if (!game.roomCode) editingNickname.value = false
  },
  { immediate: true },
)

onMounted(() => {
  connect()

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
  <main v-if="!joined" class="entry-page vignette">
    <section class="entry-panel" aria-labelledby="entry-title">
      <header class="entry-header">
        <div class="entry-emblem"><AppIcon name="shield" style="font-size: 24px" /></div>
        <div>
          <p class="section-eyebrow">CRIME SCENE INVESTIGATION</p>
          <h1 id="entry-title">犯罪现场</h1>
        </div>
      </header>
      <p class="entry-description">创建专属房间，邀请朋友一起推理。</p>

      <template v-if="sessionReplaced">
        <p class="entry-message" role="alert"><AppIcon name="info" />{{ roomError }}</p>
        <p class="entry-hint">如需回到此窗口，请刷新页面重新连接。</p>
      </template>
      <template v-else>
        <div class="entry-tabs" role="group" aria-label="加入方式">
          <button
            type="button"
            :aria-pressed="entryMode === 'create'"
            :disabled="!!roomPending"
            @click="entryMode = 'create'"
          >
            创建房间
          </button>
          <button
            type="button"
            :aria-pressed="entryMode === 'join'"
            :disabled="!!roomPending"
            @click="entryMode = 'join'"
          >
            加入房间
          </button>
        </div>
        <form class="entry-form" :aria-busy="!!roomPending" @submit.prevent="handleEnterRoom">
          <div class="entry-field">
            <label class="entry-label" for="nickname">你的代号</label>
            <input
              id="nickname"
              v-model="nickname"
              type="text"
              class="lobby-input"
              placeholder="例如：神探小李"
              maxlength="10"
              autocomplete="nickname"
              aria-describedby="nickname-hint"
              :disabled="!!roomPending"
              required
            />
            <p id="nickname-hint" class="field-hint">向其他玩家展示的名字，最多 10 个字符</p>
          </div>
          <div v-if="entryMode === 'join'" class="entry-field">
            <label class="entry-label" for="room-code">房间码</label>
            <input
              id="room-code"
              :value="roomCode"
              @input="updateRoomCode"
              type="text"
              class="lobby-input room-code-input"
              placeholder="例如：AB3K9X"
              maxlength="6"
              minlength="6"
              autocomplete="off"
              autocapitalize="characters"
              spellcheck="false"
              aria-describedby="room-code-hint"
              :disabled="!!roomPending"
              required
            />
            <p id="room-code-hint" class="field-hint">输入朋友分享的 6 位字母或数字</p>
          </div>
          <IconButton
            type="submit"
            :icon="entryMode === 'create' ? 'add' : 'arrow_forward'"
            icon-position="right"
            :disabled="!canSubmit"
            :loading="roomPending === 'create' || roomPending === 'join'"
            block
            >{{ entryMode === 'create' ? '创建房间' : '加入调查' }}</IconButton
          >
        </form>
        <p v-if="roomPending === 'resume'" class="entry-hint" role="status">正在恢复上次的房间…</p>
        <p v-else-if="!connected" class="entry-hint" role="status">
          {{ connectionError || '正在连接服务器…' }}
        </p>
        <p v-if="roomError" class="entry-message" role="alert">
          <AppIcon name="error" />{{ roomError }}
        </p>
        <button
          v-if="roomError && canRetryResume"
          type="button"
          class="entry-retry"
          :disabled="!connected || !!roomPending"
          @click="resumeRoom"
        >
          <AppIcon name="refresh" />重试恢复房间
        </button>
        <div class="entry-details">
          <span><AppIcon name="groups" />{{ minPlayers }}–{{ maxPlayers }} 人</span>
          <span><AppIcon name="lock" />独立私人房间</span>
        </div>
      </template>
    </section>
    <p class="entry-caption">真相，藏在每一处细节中</p>
  </main>

  <div v-else class="lobby-page">
    <header class="lobby-header">
      <div class="lobby-header__inner">
        <div class="lobby-brand"><AppIcon name="shield" /><span>犯罪现场</span></div>
        <span class="lobby-connection" role="status">
          <span class="connection-dot" :class="{ 'connection-dot--offline': !connected }" />
          {{ connected ? '房间已连接' : '正在重新连接' }}
        </span>
      </div>
    </header>

    <main class="lobby-content">
      <header class="lobby-title">
        <div>
          <p class="section-eyebrow">准备开始下一场调查</p>
          <h1>调查准备室</h1>
        </div>
        <span class="lobby-capacity"
          ><AppIcon name="groups" />{{ players.length }} / {{ maxPlayers }} 人</span
        >
      </header>

      <div class="lobby-layout">
        <aside class="lobby-sidebar" aria-label="邀请与游戏说明">
          <RoomControls />
          <div class="preparation-note">
            <AppIcon name="info" />
            <div>
              <h2>等待伙伴集结</h2>
              <p>分享房间码或邀请链接，朋友加入后即可开始。</p>
              <p>需要 {{ minPlayers }}–{{ maxPlayers }} 人，所有玩家保持在线。</p>
            </div>
          </div>
        </aside>

        <section class="players-panel" aria-labelledby="players-title">
          <div class="players-panel__header">
            <h2 id="players-title">调查小队</h2>
            <span>{{ players.length }} 位已加入</span>
          </div>
          <ul class="player-list">
            <li
              v-for="player in players"
              :key="player.id"
              class="player-card"
              :class="{ 'player-card--host': player.isHost }"
            >
              <div
                class="player-avatar"
                :style="{ backgroundColor: player.color + '20', color: player.color }"
              >
                <AppIcon v-if="player.isHost" name="local_police" style="font-size: 20px" />
                <template v-else>{{ getInitial(player.nickname) }}</template>
              </div>
              <div class="player-info">
                <p class="player-name">
                  {{ player.nickname
                  }}<span v-if="player.id === auth.userId" class="player-self">你</span>
                </p>
                <p class="player-caption" :class="{ 'player-caption--host': player.isHost }">
                  {{ player.isHost ? '房主' : '调查成员' }}
                </p>
              </div>
              <button
                v-if="player.id === auth.userId"
                type="button"
                class="edit-nickname-btn"
                :disabled="!connected || !!roomPending"
                @click="startEditNickname(player.nickname)"
                aria-label="修改昵称"
                title="修改昵称"
              >
                <AppIcon name="edit" />
              </button>
              <span
                class="player-status"
                :class="{ 'player-status--offline': player.connected === false }"
              >
                <AppIcon v-if="player.connected !== false" name="check" style="font-size: 12px" />
                {{ player.connected === false ? '暂时离线' : '已就绪' }}
              </span>
            </li>
          </ul>
          <div v-if="missingPlayers > 0" class="empty-seats">
            <AppIcon name="person_add" style="font-size: 20px" />
            <div>
              <p>再邀请 {{ missingPlayers }} 位朋友，即可开始</p>
              <span>复制房间邀请，发给朋友即可加入</span>
            </div>
          </div>
          <p v-else class="players-ready">
            <AppIcon :name="allConnected ? 'check' : 'info'" />{{
              allConnected ? '人数已满足，可以开始调查' : '等待离线玩家重新连接'
            }}
          </p>
        </section>
      </div>
    </main>

    <footer class="lobby-footer">
      <div class="lobby-footer__inner">
        <p class="lobby-footer__hint">
          {{ isHost ? '准备就绪后，由你开启调查' : '所有玩家就绪后，由房主开启调查' }}
        </p>
        <IconButton v-if="isHost" icon="play_arrow" :disabled="!canStart" @click="handleStartGame">
          {{
            !allConnected
              ? '等待玩家重连…'
              : missingPlayers > 0
                ? `开始调查（至少${minPlayers}人）`
                : '开始调查'
          }}
        </IconButton>
        <p v-else class="host-waiting"><span class="connection-dot" />等待房主开始游戏…</p>
      </div>
    </footer>

    <div v-if="!connected" class="connection-notice" role="alert">
      <AppIcon name="info" />{{ connectionError || '连接已断开，正在重连…' }}
    </div>
  </div>

  <BaseToast
    v-if="game.systemMessage"
    :message="game.systemMessage.content"
    :type="game.systemMessage.type"
    :duration="4000"
    @dismiss="game.clearSystemMessage"
  />

  <BaseModal
    :model-value="editingNickname"
    title="修改昵称"
    @update:model-value="cancelEditNickname"
  >
    <form id="nickname-form" class="nickname-form" @submit.prevent="confirmEditNickname">
      <p id="edit-nickname-description" class="dialog-description">
        换一个代号，其他玩家会看到你的新名字。
      </p>
      <div class="entry-field">
        <label class="entry-label" for="edit-nickname">你的代号</label>
        <input
          id="edit-nickname"
          v-model="newNickname"
          type="text"
          class="lobby-input"
          placeholder="例如：神探小李"
          maxlength="10"
          autocomplete="off"
          aria-describedby="edit-nickname-description edit-nickname-hint"
          autofocus
        />
        <p id="edit-nickname-hint" class="field-hint">最多 10 个字符</p>
      </div>
    </form>
    <template #footer>
      <button
        type="button"
        class="dialog-button dialog-button--secondary"
        @click="cancelEditNickname"
      >
        取消
      </button>
      <button
        type="submit"
        form="nickname-form"
        class="dialog-button dialog-button--primary"
        :disabled="!newNickname.trim() || !connected || !!roomPending"
      >
        保存昵称
      </button>
    </template>
  </BaseModal>

  <BaseModal
    :model-value="showPwaPrompt && !isStandalone"
    title="添加到主屏幕"
    @update:model-value="dismissPwaPrompt"
  >
    <div class="install-content">
      <div class="install-intro">
        <AppIcon name="install_mobile" style="font-size: 24px" />
        <p class="dialog-description">将「犯罪现场」添加到主屏幕，下次更快进入，全屏体验更沉浸。</p>
      </div>
      <ol v-if="!deferredPrompt" class="install-steps">
        <template v-if="isIOSSafari">
          <li>
            <span class="install-step-number">1</span
            ><span>点击浏览器底部的 <AppIcon name="ios_share" class="inline-icon" /> 分享按钮</span>
          </li>
          <li><span class="install-step-number">2</span><span>选择「添加到主屏幕」</span></li>
        </template>
        <template v-else>
          <li>
            <span class="install-step-number">1</span
            ><span>打开浏览器右上角的 <AppIcon name="more_vert" class="inline-icon" /> 菜单</span>
          </li>
          <li>
            <span class="install-step-number">2</span
            ><span>选择「添加到主屏幕」或「安装应用」</span>
          </li>
        </template>
      </ol>
    </div>
    <template #footer>
      <button
        type="button"
        class="dialog-button dialog-button--secondary"
        @click="dismissPwaPrompt"
      >
        以后再说
      </button>
      <button
        v-if="deferredPrompt"
        type="button"
        class="dialog-button dialog-button--primary"
        @click="handleInstallPwa"
      >
        <AppIcon name="download" />立即安装
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.entry-page {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-6);
  padding: calc(var(--space-8) + var(--safe-area-top)) var(--space-4)
    calc(var(--space-8) + var(--safe-area-bottom));
  background: var(--background);
}

.entry-panel {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 432px;
  padding: var(--space-6);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--card);
  box-shadow: var(--shadow-sm);
}

.entry-header,
.entry-emblem,
.entry-details,
.entry-details > span,
.entry-message,
.entry-retry {
  display: flex;
  align-items: center;
}

.entry-header {
  gap: var(--space-4);
}
.entry-emblem {
  justify-content: center;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--background);
  color: var(--color-amber);
}

.section-eyebrow {
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 16px;
}
.entry-header .section-eyebrow {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.04em;
}
.entry-header h1 {
  margin-top: var(--space-1);
  font-size: 24px;
  line-height: 32px;
  font-weight: 600;
}
.entry-description {
  margin: var(--space-4) 0 var(--space-6);
  color: var(--color-text-muted);
  font-size: 14px;
}

.entry-tabs {
  display: flex;
  gap: var(--space-1);
  padding: var(--space-1);
  margin-bottom: var(--space-6);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--background);
}
.entry-tabs button {
  flex: 1;
  min-height: 44px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  font-size: 14px;
  font-weight: 500;
}
.entry-tabs button[aria-pressed='true'] {
  border-color: var(--border);
  background: var(--secondary);
  color: var(--foreground);
  box-shadow: var(--shadow-xs);
}
.entry-tabs button:hover:not(:disabled) {
  color: var(--foreground);
}
.entry-form,
.nickname-form {
  display: grid;
  gap: var(--space-6);
}
.entry-field {
  display: grid;
  gap: var(--space-2);
}
.entry-label {
  color: var(--foreground);
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
}
.field-hint {
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 16px;
}
.lobby-input {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--input);
  border-radius: var(--radius-md);
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 24px;
  outline: none;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.lobby-input:focus-visible {
  border-color: var(--ring);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 35%, transparent);
}
.lobby-input::placeholder {
  color: var(--color-text-muted);
}
.room-code-input {
  font-family: var(--font-mono);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.entry-hint,
.entry-message {
  margin-top: var(--space-4);
  font-size: 12px;
  line-height: 20px;
  color: var(--color-text-muted);
}
.entry-message {
  align-items: flex-start;
  gap: var(--space-2);
  color: var(--destructive);
}
.entry-message :deep(svg) {
  flex-shrink: 0;
  margin-top: 2px;
}
.entry-retry {
  gap: var(--space-2);
  margin-top: var(--space-2);
  color: var(--color-amber);
  font-size: 12px;
  border-radius: var(--radius-md);
}
.entry-details {
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border);
  color: var(--color-text-muted);
  font-size: 12px;
}
.entry-details > span {
  gap: var(--space-2);
}
.entry-caption {
  position: relative;
  color: var(--color-text-muted);
  font-size: 12px;
  letter-spacing: 0.08em;
}

.lobby-page {
  min-height: 100dvh;
  background: var(--background);
}
.lobby-header {
  position: sticky;
  top: 0;
  z-index: 20;
  padding: calc(var(--space-3) + var(--safe-area-top)) var(--space-4) var(--space-3);
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--background) 95%, transparent);
  backdrop-filter: blur(12px);
}
.lobby-header__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  max-width: 960px;
  margin: 0 auto;
}
.lobby-brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 14px;
  font-weight: 600;
}
.lobby-brand :deep(svg) {
  color: var(--color-amber);
}
.lobby-connection {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-muted);
  font-size: 12px;
}
.connection-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--color-success);
}
.connection-dot--offline {
  background: var(--color-amber);
}
.lobby-content {
  width: 100%;
  max-width: 992px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-4) calc(144px + var(--safe-area-bottom));
}
.lobby-title {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-8);
}
.lobby-title h1 {
  margin-top: var(--space-2);
  font-size: 28px;
  line-height: 36px;
  font-weight: 600;
  letter-spacing: -0.025em;
}
.lobby-capacity {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.lobby-layout {
  display: grid;
  gap: var(--space-6);
  align-items: start;
}
.lobby-sidebar {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
}
.preparation-note {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: 0 var(--space-1);
  color: var(--color-text-muted);
}
.preparation-note > :deep(svg) {
  flex-shrink: 0;
  margin-top: 2px;
}
.preparation-note h2 {
  margin-bottom: var(--space-1);
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  color: var(--foreground);
}
.preparation-note p {
  font-size: 12px;
  line-height: 20px;
}
.players-panel {
  min-width: 0;
  padding: var(--space-6);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--card);
}
.players-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}
.players-panel__header h2 {
  font-size: 16px;
  line-height: 24px;
  font-weight: 600;
}
.players-panel__header > span {
  color: var(--color-text-muted);
  font-size: 12px;
}
.player-list {
  list-style: none;
  padding: 0;
}
.player-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) 0;
}
.player-card + .player-card {
  border-top: 1px solid var(--border);
}
.player-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 50%;
  font-size: 14px;
  font-weight: 600;
}
.player-info {
  min-width: 0;
  flex: 1;
}
.player-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--foreground);
  font-size: 14px;
  font-weight: 500;
}
.player-self {
  margin-left: var(--space-2);
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 400;
}
.player-caption {
  margin-top: var(--space-1);
  font-size: 12px;
  line-height: 16px;
  color: var(--color-text-muted);
}
.player-caption--host {
  color: var(--color-amber);
}
.edit-nickname-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
}
.edit-nickname-btn:hover:not(:disabled) {
  color: var(--foreground);
  background: var(--secondary);
}
.player-status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-success) 10%, transparent);
  color: var(--color-success);
  font-size: 12px;
  line-height: 16px;
  white-space: nowrap;
}
.player-status--offline {
  background: var(--secondary);
  color: var(--color-text-muted);
}
.empty-seats {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-4);
  padding: var(--space-4);
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
}
.empty-seats > :deep(svg) {
  flex-shrink: 0;
}
.empty-seats p {
  font-size: 14px;
  line-height: 20px;
}
.empty-seats span {
  display: block;
  margin-top: var(--space-1);
  font-size: 12px;
  line-height: 20px;
}
.players-ready {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border);
  color: var(--color-text-muted);
  font-size: 12px;
}
.lobby-footer {
  position: fixed;
  inset: auto 0 0;
  z-index: 20;
  padding: var(--space-4) var(--space-4) calc(var(--space-4) + var(--safe-area-bottom));
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--background) 95%, transparent);
  backdrop-filter: blur(12px);
}
.lobby-footer__inner {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-3);
  max-width: 960px;
  margin: 0 auto;
}
.lobby-footer__hint {
  color: var(--color-text-muted);
  font-size: 12px;
  text-align: center;
}
.host-waiting {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-2);
  min-height: 44px;
  color: var(--color-text-muted);
  font-size: 14px;
}
.connection-notice {
  position: fixed;
  bottom: calc(132px + var(--safe-area-bottom));
  left: 50%;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: max-content;
  max-width: calc(100% - 32px);
  padding: var(--space-3) var(--space-4);
  transform: translateX(-50%);
  border: 1px solid var(--color-crimson-light);
  border-radius: var(--radius-lg);
  background: var(--card);
  color: var(--destructive);
  font-size: 14px;
  box-shadow: var(--shadow-sm);
}

.dialog-description {
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 24px;
}
.dialog-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 44px;
  padding: var(--space-2) var(--space-4);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
}
.dialog-button--primary {
  background: var(--primary);
  color: var(--primary-foreground);
}
.dialog-button--secondary {
  border-color: var(--border);
  background: var(--background);
  color: var(--foreground);
}
.dialog-button:hover:not(:disabled) {
  filter: brightness(1.1);
}
.install-content {
  display: grid;
  gap: var(--space-6);
}
.install-intro {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
}
.install-intro > :deep(svg) {
  margin-top: var(--space-1);
  flex-shrink: 0;
  color: var(--color-amber);
}
.install-steps {
  display: grid;
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
}
.install-steps li {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: 14px;
  line-height: 24px;
}
.install-step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--secondary);
  color: var(--color-text-muted);
  font-size: 12px;
}
.inline-icon {
  display: inline-block;
  vertical-align: text-bottom;
}
button:disabled,
.lobby-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (min-width: 768px) {
  .lobby-layout {
    grid-template-columns: 304px minmax(0, 1fr);
    gap: var(--space-6);
  }
  .lobby-content {
    padding-top: var(--space-12);
  }
  .lobby-title h1 {
    font-size: 32px;
    line-height: 40px;
  }
  .lobby-footer__inner {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
  .lobby-footer__inner > :deep(button) {
    min-width: 240px;
  }
  .connection-notice {
    bottom: calc(96px + var(--safe-area-bottom));
  }
  .lobby-input {
    font-size: 14px;
    line-height: 20px;
  }
}

@media (max-width: 374px) {
  .players-panel {
    padding: var(--space-4);
  }
  .player-card {
    gap: var(--space-2);
  }
  .lobby-title h1 {
    font-size: 24px;
  }
  .entry-header .section-eyebrow {
    font-size: 9px;
  }
}
</style>
