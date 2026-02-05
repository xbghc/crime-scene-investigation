<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useSocket } from '../composables/useSocket'
import BaseButton from '../components/ui/BaseButton.vue'

const { connected, connectionError, connect, disconnect, joinRoom } = useSocket()

const nickname = ref('')
const joined = ref(false)

function handleJoin() {
  if (!nickname.value.trim()) return
  joinRoom(nickname.value.trim())
  joined.value = true
}

onMounted(() => {
  connect()
})

onUnmounted(() => {
  disconnect()
})
</script>

<template>
  <div class="lobby-page">
    <div class="header">
      <h1 class="title">犯罪现场</h1>
      <div class="connection-status">
        <span class="dot" :class="{ online: connected }" />
        <span class="status-text">{{ connected ? '已连接' : '连接中...' }}</span>
      </div>
    </div>

    <div class="content">
      <template v-if="!joined">
        <form class="nickname-form" @submit.prevent="handleJoin">
          <input
            v-model="nickname"
            type="text"
            class="input"
            placeholder="输入你的昵称"
            maxlength="10"
            autocomplete="off"
          />
          <BaseButton type="submit" :disabled="!nickname.trim() || !connected" block>
            加入房间
          </BaseButton>
        </form>
      </template>

      <template v-else>
        <div class="room-info">
          <h2>等待其他玩家加入...</h2>
          <p class="hint">需要 4-10 人开始游戏</p>
        </div>

        <div class="player-list">
          <div class="player-item">
            <span class="player-color" style="background: #ef4444" />
            <span class="player-name">{{ nickname }}</span>
            <span class="host-badge">房主</span>
          </div>
        </div>

        <BaseButton :disabled="true" block>
          开始游戏（至少4人）
        </BaseButton>
      </template>

      <p v-if="connectionError" class="error">{{ connectionError }}</p>
    </div>
  </div>
</template>

<style scoped>
.lobby-page {
  min-height: 100dvh;
  padding: 24px;
  padding-top: calc(24px + var(--safe-area-top));
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32px;
}

.title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-crimson-light);
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-dim);
  transition: background 0.3s;
}

.dot.online {
  background: var(--color-detective);
}

.content {
  max-width: 400px;
  margin: 0 auto;
}

.nickname-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 40%;
}

.input {
  width: 100%;
  padding: 14px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  color: var(--color-text);
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s;
}

.input:focus {
  border-color: var(--color-amber);
}

.input::placeholder {
  color: var(--color-text-dim);
}

.room-info {
  text-align: center;
  margin-bottom: 24px;
}

.room-info h2 {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 4px;
}

.hint {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.player-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 32px;
}

.player-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-radius: var(--border-radius);
}

.player-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.player-name {
  flex: 1;
  font-weight: 500;
}

.host-badge {
  font-size: 0.75rem;
  color: var(--color-amber);
  border: 1px solid var(--color-amber);
  padding: 2px 8px;
  border-radius: 4px;
}


.error {
  color: var(--color-crimson-light);
  font-size: 0.875rem;
  text-align: center;
  margin-top: 16px;
}
</style>
