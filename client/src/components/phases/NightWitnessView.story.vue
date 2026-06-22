<script setup lang="ts">
import NightWitnessView from './NightWitnessView.vue'
import { mockPlayers } from '../../__mocks__/gameData'

const murderer = mockPlayers[1]!
</script>

<template>
  <Story title="目击者/夜晚 · 视角" group="phases" :layout="{ type: 'single', iframe: true }">
    <Variant title="等待凶手">
      <NightWitnessView />
    </Variant>
    <Variant title="凶手已出牌">
      <NightWitnessView
        :murderer-player="murderer"
        :selection="{
          meansCard: { id: 'M001', name: '手枪' },
          clueCard: { id: 'C001', name: '血迹' },
        }"
      />
    </Variant>
  </Story>
</template>
