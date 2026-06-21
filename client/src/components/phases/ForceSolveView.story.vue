<script setup lang="ts">
import ForceSolveView from './ForceSolveView.vue'
import { mockPlayers } from '../../__mocks__/gameData'

const solvePlayers = mockPlayers.filter((p) => p.hasSolveRight)
</script>

<template>
  <Story title="通用/强制破案" group="phases" :layout="{ type: 'single', iframe: true }">
    <Variant title="等待其他人">
      <ForceSolveView
        :players="solvePlayers"
        current-turn-player-id="p4"
        my-player-id="p5"
        @solve="() => console.log('solve')"
      />
    </Variant>
    <Variant title="轮到我">
      <ForceSolveView
        :players="solvePlayers"
        current-turn-player-id="p5"
        my-player-id="p5"
        @solve="() => console.log('solve')"
      />
    </Variant>
  </Story>
</template>
