<script setup lang="ts">
import NightWitnessView from './NightWitnessView.vue'
import { mockPlayers } from '../../__mocks__/gameData'

const murderer = mockPlayers[1]!
</script>

<template>
  <Story title="目击者/夜晚 · 视角" group="phases" :layout="{ type: 'single', iframe: true }">
    <Variant title="Waiting for Murderer">
      <NightWitnessView />
    </Variant>
    <Variant title="Murderer Has Selected">
      <NightWitnessView
        :murderer-player="murderer"
        :selection="{ meansCardId: 'M01', clueCardId: 'C01' }"
      />
    </Variant>
  </Story>
</template>
