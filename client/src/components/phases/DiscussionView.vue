<script setup lang="ts">
import AppIcon from '../ui/AppIcon.vue'
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
      <AppIcon name="forum" class="app-icon" style="font-size: 18px" />
      <span>第 {{ roundNumber }} 轮发言</span>
    </div>

    <!-- Tab switcher -->
    <div class="discussion__tabs" role="group" aria-label="查看线索">
      <button
        type="button"
        :aria-pressed="activeTab === 'boards'"
        class="discussion__tab"
        :class="{ 'discussion__tab--active': activeTab === 'boards' }"
        @click="activeTab = 'boards'"
      >
        <AppIcon name="dashboard" class="app-icon" style="font-size: 18px" />
        场景板 <span class="discussion__count">{{ boards.length }}</span>
      </button>
      <button
        type="button"
        :aria-pressed="activeTab === 'cards'"
        class="discussion__tab"
        :class="{ 'discussion__tab--active': activeTab === 'cards' }"
        @click="activeTab = 'cards'"
      >
        <AppIcon name="style" class="app-icon" style="font-size: 18px" />
        玩家卡牌 <span class="discussion__count">{{ players.length }}</span>
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
          <AppIcon name="gavel" class="app-icon" style="font-size: 20px" />
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
          <AppIcon name="skip_next" class="app-icon" style="font-size: 20px" />
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
  gap: var(--space-4);
}

.discussion__round {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: var(--space-2) 0;
  background: transparent;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-muted);
}

.discussion__tabs {
  display: flex;
  gap: 4px;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  padding: var(--space-1);
  border: 1px solid var(--border);
}

.discussion__tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-muted);
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s;
  min-height: 44px;
  border: 1px solid transparent;
}

.discussion__tab--active {
  background: var(--bg-card);
  color: var(--color-text);
  font-weight: 600;
  border-color: var(--border);
}

.discussion__content {
  min-height: 0;
}

.discussion__boards {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
}

.discussion__cards {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  align-items: start;
}

.discussion__footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--space-4) max(var(--space-4), calc((100% - 1056px) / 2));
  padding-bottom: calc(16px + var(--safe-area-bottom));
  background: var(--bg-primary);
  z-index: 50;
  border-top: 1px solid var(--border);
}

.discussion__actions {
  display: flex;
  gap: var(--space-3);
}

.discussion__btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s;
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
  color: var(--bg-primary);
}

.discussion__btn--end:active {
  opacity: 0.85;
}

.discussion__btn--disabled {
  background: var(--bg-secondary);
  color: var(--color-text-dim);
  cursor: not-allowed;
}
.discussion__count {
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 400;
}
</style>
