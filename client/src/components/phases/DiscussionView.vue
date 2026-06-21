<script setup lang="ts">
import { ref } from 'vue'
import type { SceneBoard, Player } from '../../types'
import SceneBoardPanel from '../game/SceneBoardPanel.vue'
import PlayerCardRow from '../game/PlayerCardRow.vue'

interface Props {
  boards: SceneBoard[]
  players: Player[]
  roundNumber: number
  isWitness: boolean
  canSolve: boolean
  blackout: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  solve: []
  'end-discussion': []
}>()

const activeTab = ref<'boards' | 'cards'>('boards')
</script>

<template>
  <div class="discussion">
    <!-- Round indicator -->
    <div class="discussion__round">
      <span class="material-symbols-outlined" style="font-size: 18px">forum</span>
      <span>第 {{ roundNumber }} 轮发言</span>
    </div>

    <!-- Tab switcher -->
    <div class="discussion__tabs">
      <button
        class="discussion__tab"
        :class="{ 'discussion__tab--active': activeTab === 'boards' }"
        @click="activeTab = 'boards'"
      >
        <span class="material-symbols-outlined" style="font-size: 18px">dashboard</span>
        场景板
      </button>
      <button
        class="discussion__tab"
        :class="{ 'discussion__tab--active': activeTab === 'cards' }"
        @click="activeTab = 'cards'"
      >
        <span class="material-symbols-outlined" style="font-size: 18px">style</span>
        玩家卡牌
      </button>
    </div>

    <!-- Content -->
    <div class="discussion__content">
      <!-- Boards tab -->
      <div v-if="activeTab === 'boards'" class="discussion__boards">
        <SceneBoardPanel
          v-for="board in boards"
          :key="board.id"
          :board="board"
          :hidden="blackout"
        />
      </div>

      <!-- Cards tab -->
      <div v-if="activeTab === 'cards'" class="discussion__cards">
        <PlayerCardRow v-for="player in players" :key="player.id" :player="player" />
      </div>
    </div>

    <!-- Spacer for fixed footer -->
    <div style="height: 80px" />

    <!-- Footer actions -->
    <div class="discussion__footer">
      <div class="discussion__actions">
        <button
          v-if="!isWitness && canSolve"
          class="discussion__btn discussion__btn--solve"
          @click="emit('solve')"
        >
          <span class="material-symbols-outlined" style="font-size: 20px">gavel</span>
          破案
        </button>
        <button
          v-if="!isWitness && !canSolve"
          class="discussion__btn discussion__btn--disabled"
          disabled
        >
          已用破案权
        </button>
        <button
          v-if="isWitness"
          class="discussion__btn discussion__btn--end"
          @click="emit('end-discussion')"
        >
          <span class="material-symbols-outlined" style="font-size: 20px">skip_next</span>
          结束本轮发言
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.discussion {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.discussion__round {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--bg-card);
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-amber);
}

.discussion__tabs {
  display: flex;
  gap: 4px;
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 4px;
}

.discussion__tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-muted);
  transition: all 0.2s;
}

.discussion__tab--active {
  background: var(--bg-card);
  color: var(--color-text);
  font-weight: 600;
}

.discussion__content {
  min-height: 0;
}

.discussion__boards {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.discussion__cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.discussion__footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px;
  padding-bottom: calc(16px + var(--safe-area-bottom));
  background: linear-gradient(to top, var(--bg-primary), rgba(13, 17, 23, 0.95), transparent);
  z-index: 50;
}

.discussion__actions {
  display: flex;
  gap: 10px;
}

.discussion__btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 52px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.2s;
}

.discussion__btn--solve {
  background: var(--color-crimson);
  color: #fff;
}

.discussion__btn--solve:active {
  opacity: 0.85;
}

.discussion__btn--end {
  background: var(--color-amber);
  color: #fff;
}

.discussion__btn--end:active {
  opacity: 0.85;
}

.discussion__btn--disabled {
  background: var(--bg-secondary);
  color: var(--color-text-dim);
  cursor: not-allowed;
}
</style>
