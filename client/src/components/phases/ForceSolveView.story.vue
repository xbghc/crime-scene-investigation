<script setup lang="ts">
import ForceSolveView from './ForceSolveView.vue'
import { mockPlayers } from '../../__mocks__/gameData'

const solvePlayers = mockPlayers.filter(p => p.hasSolveRight)
</script>

<template>
  <Story title="强制破案" group="phases" :layout="{ type: 'single', iframe: true }">
    <Variant title="Waiting for Others">
      <ForceSolveView
        :players="solvePlayers"
        current-turn-player-id="p4"
        my-player-id="p5"
        @solve="() => console.log('solve')"
      />
    </Variant>
    <Variant title="My Turn">
      <ForceSolveView
        :players="solvePlayers"
        current-turn-player-id="p5"
        my-player-id="p5"
        @solve="() => console.log('solve')"
      />
    </Variant>
  </Story>
</template>
