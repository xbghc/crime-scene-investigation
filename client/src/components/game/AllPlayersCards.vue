<script setup lang="ts">
import type { Player } from '../../types'
import PlayerCardRow from './PlayerCardRow.vue'

defineProps<{
  players: Player[]
}>()
</script>

<template>
  <div class="all-players-cards">
    <PlayerCardRow v-for="player in players" :key="player.id" :player="player" />
  </div>
</template>

<style scoped>
.all-players-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
