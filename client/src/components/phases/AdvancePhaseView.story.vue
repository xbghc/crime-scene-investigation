<script setup lang="ts">
import AdvancePhaseView from './AdvancePhaseView.vue'
import { mockBoards, mockPlayers } from '../../__mocks__/gameData'
import type { SceneBoard } from '../../types'

const murderer = mockPlayers[1]!

const newBoards: SceneBoard[] = [
  {
    id: 'B07', type: 'scene', title: '天气状况',
    options: ['晴天', '阴天', '小雨', '暴雨', '大雾', '下雪'],
  },
  {
    id: 'B08', type: 'scene', title: '现场光线',
    options: ['明亮', '昏暗', '黑暗', '闪烁', '自然光', '人造光'],
  },
]
</script>

<template>
  <Story title="通用/推进" group="phases" :layout="{ type: 'single', iframe: true }">
    <Variant title="Accomplice Decision (Advance 1)">
      <AdvancePhaseView
        :boards="mockBoards"
        :new-boards="newBoards"
        :is-witness="false"
        :is-accomplice="true"
        :is-advance1="true"
        :murderer-player="murderer"
        @accomplice-choose="(p) => console.log('accomplice-choose:', p)"
        @witness-replace="(p) => console.log('witness-replace:', p)"
      />
    </Variant>
    <Variant title="Witness Board Replacement (Advance 2)">
      <AdvancePhaseView
        :boards="mockBoards"
        :new-boards="newBoards"
        :is-witness="true"
        :is-accomplice="false"
        :is-advance1="false"
        @accomplice-choose="(p) => console.log('accomplice-choose:', p)"
        @witness-replace="(p) => console.log('witness-replace:', p)"
      />
    </Variant>
    <Variant title="Detective Waiting">
      <AdvancePhaseView
        :boards="mockBoards"
        :new-boards="[]"
        :is-witness="false"
        :is-accomplice="false"
        :is-advance1="true"
        @accomplice-choose="(p) => console.log('accomplice-choose:', p)"
        @witness-replace="(p) => console.log('witness-replace:', p)"
      />
    </Variant>
  </Story>
</template>
