<script setup lang="ts">
import AppIcon from '../components/ui/AppIcon.vue'
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../stores/game'
import { useSocket } from '../composables/useSocket'
import RoleBadge from '../components/game/RoleBadge.vue'
import EffectCardPanel from '../components/game/EffectCardPanel.vue'
import type { EffectActionData } from '../types'
import BaseModal from '../components/ui/BaseModal.vue'
import BaseToast from '../components/ui/BaseToast.vue'

// Phase views
import RoleRevealView from '../components/phases/RoleRevealView.vue'
import NightMurdererView from '../components/phases/NightMurdererView.vue'
import NightAccompliceView from '../components/phases/NightAccompliceView.vue'
import NightDetectiveView from '../components/phases/NightDetectiveView.vue'
import NightWitnessView from '../components/phases/NightWitnessView.vue'
import WitnessAccuseView from '../components/phases/WitnessAccuseView.vue'
import DiscussionView from '../components/phases/DiscussionView.vue'
import SolveAttemptView from '../components/phases/SolveAttemptView.vue'
import AdvancePhaseView from '../components/phases/AdvancePhaseView.vue'
import ForceSolveView from '../components/phases/ForceSolveView.vue'
import GameOverView from '../components/phases/GameOverView.vue'

import RoomControls from '../components/room/RoomControls.vue'

const router = useRouter()
const game = useGameStore()
const {
  connected,
  roomPending,
  connect,
  murdererSelect,
  witnessSetMarker,
  witnessConfirm,
  witnessConfirmMurder,
  witnessReplaceBoard,
  witnessFinishAdvance,
  endDiscussion,
  effectAction,
  accompliceChoose,
  attemptSolve,
  resetGame,
} = useSocket()

// Local UI state
const showSolveModal = ref(false)
const roleRevealed = ref(false)
const showEffectCard = ref(false)
const showSolveResult = ref(false)
const showPhaseChange = ref(false)
const phaseChangeMessage = ref('')
const showResetConfirm = ref(false)

onMounted(() => {
  connect()
})

// Watch for effect card events
watch(
  () => game.effectAnnouncement,
  (announcement, previous) => {
    if (announcement > previous && game.effectCard) showEffectCard.value = true
  },
)

watch(
  () => game.effectCard,
  (card) => {
    if (!card) showEffectCard.value = false
  },
)

// Watch for solve results — show modal for important announcements
watch(
  () => game.lastSolveResult,
  (result) => {
    if (result) showSolveResult.value = true
  },
)

// Watch for phase changes — show brief announcement for key transitions
watch(
  () => game.phase,
  (phase, oldPhase) => {
    if (phase === 'waiting') {
      roleRevealed.value = false
      showSolveModal.value = false
      showEffectCard.value = false
      showSolveResult.value = false
      showResetConfirm.value = false
      showPhaseChange.value = false
      router.replace('/lobby')
      return
    }

    // Show modal announcement for key phase transitions
    const announcements: Partial<Record<string, string>> = {
      'witness-accuse': '天亮了！目击者正在布置线索…',
      'discussion-1': '第一轮发言开始',
      'discussion-2': '第二轮发言开始',
      'discussion-3': '最后一轮发言',
      'force-solve': '强制破案阶段',
    }

    const msg = announcements[phase]
    if (msg && oldPhase !== 'waiting') {
      phaseChangeMessage.value = msg
      showPhaseChange.value = true
      setTimeout(() => {
        showPhaseChange.value = false
      }, 3000)
    }
  },
)

const isHost = computed(() => {
  const me = game.me
  return me?.isHost ?? false
})

const murdererPlayer = computed(() => game.murderer)

// Night phase: which view to show
const nightView = computed(() => {
  if (game.isMurderer) return 'murderer'
  if (game.isAccomplice) return 'accomplice'
  if (game.isWitness) return 'witness'
  return 'detective'
})

// Discussion: filter players (non-witness)
const discussionPlayers = computed(() => game.nonWitnessPlayers)

// Handle role reveal confirm
function handleRoleConfirm() {
  roleRevealed.value = true
}

// Handle murderer card selection
function handleMurdererConfirm(payload: { meansCardId: string; clueCardId: string }) {
  murdererSelect(payload.meansCardId, payload.clueCardId)
}

// Witness accuse actions
function handleSelectOption(payload: { boardId: string; optionIndex: number }) {
  const boardIndex = game.boards.findIndex((b) => b.id === payload.boardId)
  if (boardIndex < 0) return
  const markerNumber = boardIndex + 1
  if (payload.optionIndex < 0) {
    // Deselect: set marker to a sentinel the backend can interpret
    witnessSetMarker(payload.boardId, -1, markerNumber)
  } else {
    witnessSetMarker(payload.boardId, payload.optionIndex, markerNumber)
  }
}

function handleReorderBoards(boardIds: string[]) {
  game.reorderBoards(boardIds)
}

function handleWitnessConfirm() {
  witnessConfirm()
}

// Discussion actions
function handleSolve() {
  showSolveModal.value = true
}

function handleEndDiscussion() {
  endDiscussion()
}

// Solve actions
function handleSolveConfirm(payload: {
  suspectId: string
  meansCardId: string
  clueCardId: string
}) {
  attemptSolve(payload.suspectId, payload.meansCardId, payload.clueCardId)
  showSolveModal.value = false
}

function handleSolveCancel() {
  showSolveModal.value = false
}

// Advance phase actions
function handleAccompliceChoose(payload: { replaceClue: boolean; newClueCardId?: string }) {
  game.setAccomplicePrompted(false)
  accompliceChoose(payload.replaceClue, payload.newClueCardId)
}

function handleEffectAction(payload: { effectId: string; data: EffectActionData }) {
  effectAction(payload.effectId, payload.data)
}

function handleWitnessReplace(payload: {
  oldBoardId: string
  newBoardId: string
  optionIndex: number
  markerNumber: number
}) {
  if (!game.isWitness || game.pendingEffect) return
  witnessReplaceBoard(
    payload.oldBoardId,
    payload.newBoardId,
    payload.optionIndex,
    payload.markerNumber,
  )
}

// Play again (host resets, others wait)
function handlePlayAgain() {
  resetGame()
}

function handleResetGame() {
  showResetConfirm.value = false
  resetGame()
}

// Witness confirms murder selection
function handleWitnessConfirmMurder() {
  witnessConfirmMurder()
}

// Witness finishes advance phase replacements
function handleWitnessFinishAdvance() {
  if (
    !game.isWitness ||
    !game.isAdvancePhase ||
    !game.advanceReady ||
    game.newBoards.length > 0 ||
    game.pendingEffect
  ) {
    return
  }
  witnessFinishAdvance()
}

// Effect card dismiss
function handleEffectDismiss() {
  showEffectCard.value = false
}

// Solve result dismiss
function handleSolveResultDismiss() {
  showSolveResult.value = false
}

// Phase change dismiss
function handlePhaseChangeDismiss() {
  showPhaseChange.value = false
}

// Toast dismiss
function handleToastDismiss() {
  game.clearSystemMessage()
}
</script>

<template>
  <div class="game-page" :inert="!connected || roomPending === 'resume'">
    <div class="game-page__room"><RoomControls /></div>
    <!-- Role Reveal (full screen overlay, before game starts) -->
    <template v-if="game.phase === 'role-reveal' && !roleRevealed">
      <RoleRevealView v-if="game.myRole" :role="game.myRole" @confirm="handleRoleConfirm" />
    </template>

    <!-- Night Murder Phase (full screen for each role) -->
    <template v-else-if="game.phase === 'night-murder'">
      <NightMurdererView
        v-if="nightView === 'murderer'"
        :means-cards="game.myCards.meansCards"
        :clue-cards="game.myCards.clueCards"
        @confirm="handleMurdererConfirm"
      />
      <NightAccompliceView
        v-else-if="nightView === 'accomplice'"
        :murderer-nickname="murdererPlayer?.nickname || '???'"
        :means-cards="murdererPlayer?.meansCards ?? []"
        :clue-cards="murdererPlayer?.clueCards ?? []"
        :selected-means-id="game.murdererSelection?.meansCard.id ?? null"
        :selected-clue-id="game.murdererSelection?.clueCard.id ?? null"
        :confirmed="!!game.murdererSelection"
      />
      <NightWitnessView
        v-else-if="nightView === 'witness'"
        :selection="game.murdererSelection"
        @confirm-murder="handleWitnessConfirmMurder"
      />
      <NightDetectiveView v-else />
    </template>

    <!-- All other phases: standard layout -->
    <template v-else>
      <div class="game-layout">
        <!-- Status bar -->
        <header class="game-layout__header">
          <div class="game-layout__phase">
            <AppIcon :name="game.phaseIcon" class="app-icon game-layout__phase-icon" />
            <div class="game-layout__phase-copy">
              <span class="game-layout__eyebrow">犯罪现场</span>
              <h1>{{ game.phaseLabel }}</h1>
            </div>
          </div>
          <div class="game-layout__header-right">
            <div v-if="game.myRole" class="game-layout__role">
              <RoleBadge :role="game.myRole" show-label />
              <span v-if="game.isWitness" class="game-layout__mute-tag">
                <AppIcon name="volume_off" class="app-icon" style="font-size: 14px" />
                禁言
              </span>
            </div>
            <button
              v-if="isHost && game.phase !== 'game-over'"
              class="game-layout__reset-btn"
              title="重置游戏"
              aria-label="重置游戏"
              type="button"
              @click="showResetConfirm = true"
            >
              <AppIcon name="restart_alt" class="app-icon" style="font-size: 18px" />
            </button>
          </div>
        </header>

        <!-- Main content area (scrollable) -->
        <main class="game-layout__body">
          <EffectCardPanel
            v-if="game.effectCard && !game.isAdvancePhase"
            class="game-layout__effect"
            :card="game.effectCard"
            :result="game.effectResult"
            :players="game.players"
            :boards="game.boards"
          />
          <!-- Waiting / post-reveal -->
          <template v-if="game.phase === 'role-reveal' && roleRevealed">
            <div class="game-layout__center">
              <div class="game-layout__spinner" />
              <p class="game-layout__center-text">等待其他玩家确认身份…</p>
            </div>
          </template>

          <!-- Witness Accuse -->
          <template v-else-if="game.phase === 'witness-accuse'">
            <template v-if="game.isWitness">
              <WitnessAccuseView
                :boards="game.boards"
                :murderer-selection="game.murdererSelection"
                @select-option="handleSelectOption"
                @reorder="handleReorderBoards"
                @confirm="handleWitnessConfirm"
              />
            </template>
            <template v-else>
              <div class="game-layout__center">
                <div class="game-layout__spinner" />
                <p class="game-layout__center-text">目击者正在布置犯罪现场…</p>
              </div>
            </template>
          </template>

          <!-- Discussion phases -->
          <template v-else-if="game.isDiscussionPhase">
            <DiscussionView
              :boards="game.boards"
              :players="discussionPlayers"
              :round-number="game.discussionRound"
              :is-witness="game.isWitness"
              :can-solve="game.canSolve"
              :blackout="game.blackout"
              @solve="handleSolve"
              @end-discussion="handleEndDiscussion"
            />
          </template>

          <!-- Advance phases -->
          <template v-else-if="game.isAdvancePhase">
            <AdvancePhaseView
              :boards="game.boards"
              :new-boards="game.newBoards"
              :is-witness="game.isWitness"
              :is-accomplice="game.isAccomplice"
              :is-advance1="game.phase === 'advance-1'"
              :advance-ready="game.advanceReady"
              :accomplice-prompted="game.accomplicePrompted"
              :murderer-player="murdererPlayer"
              :players="game.players"
              :effect-card="game.effectCard"
              :effect-result="game.effectResult"
              :pending-effect="game.pendingEffect"
              :murderer-selection="game.isWitness ? game.murdererSelection : undefined"
              :effect-submitting="game.effectSubmitting"
              :effect-error="game.effectError"
              @effect-action="handleEffectAction"
              @accomplice-choose="handleAccompliceChoose"
              @witness-replace="handleWitnessReplace"
              @witness-finish-advance="handleWitnessFinishAdvance"
            />
          </template>

          <!-- Force solve -->
          <template v-else-if="game.phase === 'force-solve'">
            <ForceSolveView
              :players="game.nonWitnessPlayers"
              :current-turn-player-id="game.forceSolveTurnPlayerId"
              :my-player-id="game.myPlayerId"
              @solve="handleSolve"
            />
          </template>

          <!-- Game over -->
          <template v-else-if="game.phase === 'game-over'">
            <GameOverView
              :winner="game.winner || 'detective'"
              :players="game.players"
              :scores="game.scores"
              :solution="game.murdererSelection"
              :is-host="isHost"
              @play-again="handlePlayAgain"
            />
          </template>
        </main>
      </div>
    </template>

    <!-- Solve modal (overlay) -->
    <BaseModal v-model="showSolveModal" fullscreen aria-label="破案">
      <SolveAttemptView
        :players="game.nonWitnessPlayers"
        :forced="game.phase === 'force-solve'"
        @confirm="handleSolveConfirm"
        @cancel="handleSolveCancel"
      />
    </BaseModal>

    <!-- Effect card modal -->
    <BaseModal v-model="showEffectCard" title="效果牌">
      <div v-if="game.effectCard" class="effect-card-display">
        <div class="effect-card-display__icon">
          <AppIcon
            name="auto_awesome"
            class="app-icon"
            style="font-size: 2.5rem; color: var(--color-purple)"
          />
        </div>
        <h3 class="effect-card-display__name">{{ game.effectCard.name }}</h3>
        <p class="effect-card-display__effect">{{ game.effectCard.effect }}</p>
        <p v-if="game.isWitness && game.pendingEffect" class="effect-card-display__effect">
          关闭提示后，请在推进页面选择效果目标。
        </p>
      </div>
      <template #footer>
        <button class="effect-card-display__btn" @click="handleEffectDismiss">知道了</button>
      </template>
    </BaseModal>

    <!-- Solve result modal -->
    <BaseModal
      v-model="showSolveResult"
      :title="game.lastSolveResult?.success ? '破案成功！' : '破案失败'"
    >
      <div v-if="game.lastSolveResult" class="solve-result-display">
        <div
          class="solve-result-display__icon"
          :class="
            game.lastSolveResult.success
              ? 'solve-result-display__icon--success'
              : 'solve-result-display__icon--fail'
          "
        >
          <AppIcon
            :name="game.lastSolveResult.success ? 'check_circle' : 'cancel'"
            class="app-icon"
            style="font-size: 2.5rem"
          />
        </div>
        <p class="solve-result-display__text">
          {{
            game.lastSolveResult.success
              ? '真相大白！侦探方成功破案'
              : `${game.players.find((p) => p.id === game.lastSolveResult?.playerId)?.nickname ?? '玩家'} 推理失败，失去破案权`
          }}
        </p>
      </div>
      <template #footer>
        <button class="effect-card-display__btn" @click="handleSolveResultDismiss">知道了</button>
      </template>
    </BaseModal>

    <!-- Phase change announcement modal -->
    <BaseModal v-model="showPhaseChange" title="阶段变更">
      <div class="phase-change-display">
        <div class="phase-change-display__icon">
          <AppIcon
            :name="game.phaseIcon"
            class="app-icon"
            style="font-size: 2.5rem; color: var(--color-amber)"
          />
        </div>
        <p class="phase-change-display__text">{{ phaseChangeMessage }}</p>
      </div>
      <template #footer>
        <button class="effect-card-display__btn" @click="handlePhaseChangeDismiss">继续</button>
      </template>
    </BaseModal>

    <!-- Reset game confirm modal -->
    <BaseModal v-model="showResetConfirm" title="重置游戏">
      <div class="reset-confirm">
        <div class="reset-confirm__icon">
          <AppIcon
            name="warning"
            class="app-icon"
            style="font-size: 2.5rem; color: var(--destructive)"
          />
        </div>
        <p class="reset-confirm__text">
          确定要结束当前游戏并返回大厅吗？所有玩家的游戏进度将丢失。
        </p>
      </div>
      <template #footer>
        <div class="reset-confirm__actions">
          <button class="reset-confirm__cancel" @click="showResetConfirm = false">取消</button>
          <button class="reset-confirm__confirm" @click="handleResetGame">确定重置</button>
        </div>
      </template>
    </BaseModal>

    <!-- System message toast -->
    <BaseToast
      v-if="game.systemMessage"
      :message="game.systemMessage.content"
      :type="game.systemMessage.type"
      :duration="4000"
      @dismiss="handleToastDismiss"
    />

    <!-- Connection lost indicator -->
    <div v-if="!connected" class="game-page__offline">
      <AppIcon name="wifi_off" class="app-icon" style="font-size: 16px" />
      连接已断开，正在重连…
    </div>
  </div>
</template>

<style scoped>
.game-page {
  min-height: 100dvh;
  background: var(--bg-primary);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
}

.game-page__room {
  padding: var(--space-2) var(--space-4);
  padding-top: calc(8px + var(--safe-area-top));
  background: var(--bg-primary);
  max-width: 1104px;
  margin: 0 auto;
}

/* Standard game layout */
.game-layout {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

.game-layout__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) max(var(--space-4), calc((100% - 1056px) / 2));
  padding-top: calc(var(--space-3) + var(--safe-area-top));
  background: var(--card);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 20;
  gap: var(--space-3);
  min-height: 72px;
}

.game-layout__phase {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: normal;
  min-width: 0;
}

.game-layout__phase-icon {
  font-size: 20px;
  color: var(--color-amber);
  flex-shrink: 0;
}

.game-layout__header-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.game-layout__role {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.game-layout__reset-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-muted);
  transition: background 0.15s;
  border: 1px solid var(--border);
}

.game-layout__reset-btn:active {
  background: rgba(211, 47, 47, 0.25);
}

.game-layout__mute-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-md);
  background: rgba(211, 47, 47, 0.15);
  color: var(--destructive);
  font-size: 12px;
  font-weight: 500;
}

.game-layout__body {
  flex: 1;
  padding: var(--space-6);
  width: 100%;
  max-width: 1104px;
  margin: 0 auto;
}

.game-layout__effect {
  margin-bottom: 16px;
}

/* Center content (waiting states) */
.game-layout__center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-16) 0;
  gap: 16px;
}

.game-layout__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--color-amber);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.game-layout__center-text {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  margin: 0;
}

/* Effect card display */
.effect-card-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
  padding: 16px 0;
}

.effect-card-display__icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(110, 64, 170, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}

.effect-card-display__name {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.effect-card-display__effect {
  font-size: 14px;
  color: var(--color-text-muted);
  line-height: 1.6;
  margin: 0;
}

.effect-card-display__btn {
  padding: var(--space-2) var(--space-6);
  border-radius: var(--radius-md);
  background: var(--primary);
  color: var(--primary-foreground);
  font-weight: 500;
  min-height: 44px;
  font-size: 14px;
}

/* Solve result display */
.solve-result-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
  padding: 16px 0;
}

.solve-result-display__icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.solve-result-display__icon--success {
  background: rgba(46, 160, 67, 0.15);
  color: var(--color-success, #2ea043);
}

.solve-result-display__icon--fail {
  background: rgba(211, 47, 47, 0.15);
  color: var(--destructive);
}

.solve-result-display__text {
  font-size: 14px;
  color: var(--color-text-muted);
  margin: 0;
  line-height: 1.6;
}

/* Phase change display */
.phase-change-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
  padding: 16px 0;
}

.phase-change-display__icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(212, 168, 71, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}

.phase-change-display__text {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

/* Offline indicator */
.game-page__offline {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(166, 28, 28, 0.9);
  color: var(--color-text);
  font-size: 12px;
  border-radius: var(--radius-md);
  z-index: 100;
  backdrop-filter: blur(8px);
  max-width: calc(100% - 32px);
  width: max-content;
}

/* Reset confirm */
.reset-confirm {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
  padding: 16px 0;
}

.reset-confirm__icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(211, 47, 47, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}

.reset-confirm__text {
  font-size: 14px;
  color: var(--color-text-muted);
  line-height: 1.6;
  margin: 0;
}

.reset-confirm__actions {
  display: flex;
  gap: 12px;
  width: 100%;
}

.reset-confirm__cancel {
  flex: 1;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  color: var(--color-text-muted);
  font-weight: 500;
  font-size: 14px;
  min-height: 44px;
}

.reset-confirm__confirm {
  flex: 1;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-crimson-light);
  color: #fff;
  font-weight: 500;
  font-size: 14px;
  min-height: 44px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.game-layout__phase-copy {
  display: grid;
  gap: var(--space-1);
}
.game-layout__phase-copy h1 {
  margin: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 600;
}
.game-layout__eyebrow {
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
}
@media (max-width: 600px) {
  .game-layout__body {
    padding: var(--space-4);
  }
  .game-layout__header {
    flex-wrap: wrap;
  }
  .game-layout__role {
    flex-wrap: wrap;
    justify-content: flex-end;
  }
}
@media (max-height: 500px) {
  .game-layout__header {
    position: static;
    min-height: 56px;
    padding-top: 8px;
    padding-bottom: 8px;
  }
  .game-layout__eyebrow {
    display: none;
  }
}
.game-page__room,
.game-layout__body {
  padding-left: max(var(--space-4), var(--safe-area-left));
  padding-right: max(var(--space-4), var(--safe-area-right));
}
.game-layout__header {
  padding-left: max(var(--space-4), var(--safe-area-left), calc((100% - 1056px) / 2));
  padding-right: max(var(--space-4), var(--safe-area-right), calc((100% - 1056px) / 2));
}
@media (max-width: 380px) {
  .game-layout__header {
    gap: 8px;
  }
  .game-layout__header-right,
  .game-layout__role {
    gap: 4px;
  }
  .game-layout__eyebrow,
  .game-layout__phase-icon {
    display: none;
  }
}
</style>
