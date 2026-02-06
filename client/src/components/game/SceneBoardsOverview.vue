<script setup lang="ts">
import type { SceneBoard } from '../../types'
import SceneBoardPanel from './SceneBoardPanel.vue'

defineProps<{
  boards: SceneBoard[]
  blackout?: boolean
}>()
</script>

<template>
  <div class="scene-boards-overview">
    <SceneBoardPanel
      v-for="board in boards"
      :key="board.id"
      :board="board"
      :hidden="blackout"
    />
  </div>
</template>

<style scoped>
.scene-boards-overview {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
