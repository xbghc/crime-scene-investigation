<script setup lang="ts">
import WitnessAccuseView from './WitnessAccuseView.vue'
import { mockBoards, mockPlayers } from '../../__mocks__/gameData'
import type { SceneBoard } from '../../types'

const murderer = mockPlayers[1]!
const selection = { meansCardId: 'M01', clueCardId: 'C01' }

const emptyBoards: SceneBoard[] = mockBoards.map(b => ({ ...b, marker: undefined }))
const partialBoards: SceneBoard[] = mockBoards.map((b, i) =>
  i < 3 ? b : { ...b, marker: undefined }
)
</script>

<template>
  <Story title="指证阶段" group="phases" :layout="{ type: 'single', iframe: true }">
    <Variant title="Empty (No Markers)">
      <WitnessAccuseView
        :boards="emptyBoards"
        :murderer-selection="selection"
        :murderer-player="murderer"
        @set-marker="(p) => console.log('set-marker:', p)"
        @confirm="() => console.log('confirm')"
      />
    </Variant>
    <Variant title="Partial Markers (3/6)">
      <WitnessAccuseView
        :boards="partialBoards"
        :murderer-selection="selection"
        :murderer-player="murderer"
        @set-marker="(p) => console.log('set-marker:', p)"
        @confirm="() => console.log('confirm')"
      />
    </Variant>
    <Variant title="All Markers Placed">
      <WitnessAccuseView
        :boards="mockBoards"
        :murderer-selection="selection"
        :murderer-player="murderer"
        @set-marker="(p) => console.log('set-marker:', p)"
        @confirm="() => console.log('confirm')"
      />
    </Variant>
  </Story>
</template>
