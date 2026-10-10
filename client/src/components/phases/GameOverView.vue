<script setup lang="ts">
import AppIcon from '../ui/AppIcon.vue'
import type { Player, MurdererSelection } from '../../types'
import RoleBadge from '../game/RoleBadge.vue'
import PlayerAvatar from '../game/PlayerAvatar.vue'

interface Props {
  winner: 'detective' | 'murderer'
  players: Player[]
  scores?: Record<string, number>
  solution?: MurdererSelection
  isHost: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  'play-again': []
}>()
</script>

<template>
  <div class="game-over">
    <!-- Winner banner -->
    <div class="game-over__banner" :class="`game-over__banner--${winner}`">
      <AppIcon name="emoji_events" class="app-icon game-over__trophy" />
      <h2 class="game-over__winner-text">
        {{ winner === 'detective' ? '侦探方获胜' : '凶手方获胜' }}
      </h2>
    </div>

    <!-- Solution reveal -->
    <div v-if="solution" class="game-over__solution">
      <h3 class="game-over__section-title">犯罪真相</h3>
      <div class="game-over__solution-cards">
        <div class="game-over__solution-card game-over__solution-card--means">
          <span class="game-over__card-label">手段</span>
          <span class="game-over__card-name">
            {{ solution?.meansCard.name || '未知' }}
          </span>
        </div>
        <div class="game-over__solution-card game-over__solution-card--clue">
          <span class="game-over__card-label">线索</span>
          <span class="game-over__card-name">
            {{ solution?.clueCard.name || '未知' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Player identity reveal -->
    <div class="game-over__identities">
      <h3 class="game-over__section-title">身份揭示</h3>
      <div class="game-over__player-list">
        <div v-for="player in players" :key="player.id" class="game-over__player">
          <PlayerAvatar :nickname="player.nickname" :color="player.color" :status="player.status" />
          <div class="game-over__player-info">
            <span class="game-over__player-name">{{ player.nickname }}</span>
            <RoleBadge v-if="player.role" :role="player.role" show-label />
          </div>
          <span v-if="scores && scores[player.id] != null" class="game-over__score">
            +{{ scores[player.id] }}
          </span>
        </div>
      </div>
    </div>

    <!-- Play again -->
    <div class="game-over__footer">
      <button v-if="isHost" class="game-over__btn" @click="emit('play-again')">
        <AppIcon name="replay" class="app-icon" style="font-size: 20px" />
        再来一局
      </button>
      <p v-else class="game-over__wait">等待房主开始新一局…</p>
    </div>
  </div>
</template>

<style scoped>
.game-over {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding-bottom: 24px;
}

.game-over__banner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-6);
  border-radius: var(--radius-xl);
  text-align: center;
  background: var(--card);
}

.game-over__banner--detective {
  background: var(--card);
  border: 1px solid var(--border);
}

.game-over__banner--murderer {
  background: var(--card);
  border: 1px solid var(--border);
}

.game-over__trophy {
  font-size: 40px;
  color: var(--color-amber);
  animation: none;
}

.game-over__winner-text {
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
  letter-spacing: normal;
  line-height: 32px;
}

.game-over__solution {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.game-over__section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  text-transform: uppercase;
  letter-spacing: normal;
  margin: 0;
}

.game-over__solution-cards {
  display: flex;
  gap: var(--space-4);
}

.game-over__solution-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px;
  border-radius: var(--radius-md);
}

.game-over__solution-card--means {
  background: rgba(166, 28, 28, 0.15);
  border: 1px solid rgba(211, 47, 47, 0.3);
}

.game-over__solution-card--clue {
  background: rgba(139, 148, 158, 0.1);
  border: 1px solid rgba(139, 148, 158, 0.3);
}

.game-over__card-label {
  font-size: 12px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.game-over__card-name {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text);
  text-align: center;
}

.game-over__identities {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.game-over__player-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.game-over__player {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--bg-card);
  border-radius: 0;
}

.game-over__player-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.game-over__player-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.game-over__score {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-amber);
}

.game-over__footer {
  padding-top: 8px;
}

.game-over__btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  background: var(--color-amber);
  color: var(--bg-primary);
  transition: opacity 0.2s;
}

.game-over__btn:active {
  opacity: 0.85;
}

.game-over__wait {
  text-align: center;
  font-size: 14px;
  color: var(--color-text-muted);
  margin: 0;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}
.game-over__player + .game-over__player {
  border-top: 1px solid var(--border);
}
.game-over__score {
  font-family: var(--font-mono);
}
.game-over__banner--detective .game-over__winner-text {
  color: var(--color-detective);
}
.game-over__banner--murderer .game-over__winner-text {
  color: var(--color-murderer);
}
</style>
