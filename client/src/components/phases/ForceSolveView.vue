<script setup lang="ts">
import type { Player } from '../../types'
import PlayerAvatar from '../game/PlayerAvatar.vue'

interface Props {
  players: Player[]
  currentTurnPlayerId?: string
  myPlayerId?: string
}

defineProps<Props>()

const emit = defineEmits<{
  solve: []
}>()
</script>

<template>
  <div class="force-solve">
    <div class="force-solve__header">
      <span class="material-symbols-outlined text-crimson-light force-solve__pulse">warning</span>
      <span>强制破案阶段</span>
    </div>

    <p class="force-solve__desc">所有有破案权的玩家必须依次尝试破案</p>

    <!-- Player order -->
    <div class="force-solve__order">
      <div
        v-for="player in players"
        :key="player.id"
        class="force-solve__player"
        :class="{
          'force-solve__player--current': player.id === currentTurnPlayerId,
          'force-solve__player--done': !player.hasSolveRight,
        }"
      >
        <PlayerAvatar
          :nickname="player.nickname"
          :color="player.color"
          :status="player.status"
        />
        <span v-if="player.id === currentTurnPlayerId" class="force-solve__current-tag">当前</span>
        <span v-else-if="!player.hasSolveRight" class="force-solve__done-tag">已破案</span>
      </div>
    </div>

    <!-- My turn -->
    <template v-if="currentTurnPlayerId === myPlayerId">
      <div class="force-solve__my-turn">
        <p class="force-solve__turn-text">轮到你破案了！</p>
        <button class="force-solve__btn" @click="emit('solve')">
          <span class="material-symbols-outlined" style="font-size: 20px">gavel</span>
          开始破案
        </button>
      </div>
    </template>

    <!-- Waiting -->
    <template v-else>
      <div class="force-solve__waiting">
        <div class="force-solve__spinner" />
        <p class="force-solve__wait-text">
          等待 {{ players.find(p => p.id === currentTurnPlayerId)?.nickname || '' }} 破案中…
        </p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.force-solve {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.force-solve__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(166, 28, 28, 0.1);
  border: 1px solid rgba(211, 47, 47, 0.3);
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-crimson-light);
}

.force-solve__pulse {
  animation: pulse 2s ease-in-out infinite;
}

.force-solve__desc {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin: 0;
}

.force-solve__order {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 8px 0;
}

.force-solve__player {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border-radius: 8px;
  border: 2px solid transparent;
  min-width: 64px;
  flex-shrink: 0;
}

.force-solve__player--current {
  border-color: var(--color-amber);
  background: rgba(212, 168, 71, 0.08);
}

.force-solve__player--done {
  opacity: 0.4;
}

.force-solve__current-tag {
  font-size: 0.6rem;
  color: var(--color-amber);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.force-solve__done-tag {
  font-size: 0.6rem;
  color: var(--color-text-dim);
}

.force-solve__my-turn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 32px 0;
}

.force-solve__turn-text {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.force-solve__btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 52px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 700;
  background: var(--color-crimson);
  color: #fff;
  transition: opacity 0.2s;
}

.force-solve__btn:active {
  opacity: 0.85;
}

.force-solve__waiting {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px 0;
}

.force-solve__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--color-crimson);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.force-solve__wait-text {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  margin: 0;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
