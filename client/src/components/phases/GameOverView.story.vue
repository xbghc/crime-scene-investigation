<script setup lang="ts">
import GameOverView from './GameOverView.vue'
import { mockPlayers } from '../../__mocks__/gameData'

const scores: Record<string, number> = {
  p1: 3,
  p2: 0,
  p3: 0,
  p4: 2,
  p5: 2,
  p6: 2,
  p7: 2,
}
const murdererWinScores: Record<string, number> = {
  p1: 0,
  p2: 3,
  p3: 3,
  p4: 0,
  p5: 0,
  p6: 0,
  p7: 0,
}
const solution = { meansCard: { id: 'M001', name: '手枪' }, clueCard: { id: 'C001', name: '血迹' } }
</script>

<template>
  <Story title="通用/游戏结算" group="phases" :layout="{ type: 'single', iframe: true }">
    <Variant title="侦探阵营获胜（房主视角）">
      <GameOverView
        winner="detective"
        :players="mockPlayers"
        :scores="scores"
        :solution="solution"
        :is-host="true"
        @play-again="() => console.log('play-again')"
      />
    </Variant>
    <Variant title="凶手阵营获胜（非房主视角）">
      <GameOverView
        winner="murderer"
        :players="mockPlayers"
        :scores="murdererWinScores"
        :solution="solution"
        :is-host="false"
        @play-again="() => console.log('play-again')"
      />
    </Variant>
  </Story>
</template>
