<script setup lang="ts">
import AdvancePhaseView from './AdvancePhaseView.vue'
import { mockBoards, mockPlayers } from '../../__mocks__/gameData'
import type { SceneBoard } from '../../types'

const murderer = mockPlayers[1]!

const newBoards: SceneBoard[] = [
  {
    id: 'B07',
    type: 'scene',
    title: '天气状况',
    options: ['晴天', '阴天', '小雨', '暴雨', '大雾', '下雪'],
  },
  {
    id: 'B08',
    type: 'scene',
    title: '现场光线',
    options: ['明亮', '昏暗', '黑暗', '闪烁', '自然光', '人造光'],
  },
]
</script>

<template>
  <Story title="通用/推进" group="phases" :layout="{ type: 'single', iframe: true }">
    <Variant title="帮凶抉择（推进 1）">
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
    <Variant title="目击者先处理效果，再换板">
      <AdvancePhaseView
        :boards="mockBoards"
        :new-boards="newBoards"
        :players="mockPlayers"
        :is-witness="true"
        :is-accomplice="false"
        :is-advance1="true"
        :effect-card="{
          id: 'E05',
          name: '证据遗失',
          effect: '目击者必须移除一张当前场景板上的选项物',
        }"
        :pending-effect="{
          effectId: 'E05',
          boardIds: mockBoards.filter((board) => board.marker).map((board) => board.id),
          optional: false,
        }"
        @effect-action="(action) => console.log('effect-action:', action)"
      />
    </Variant>
    <Variant title="目击者等待推进准备">
      <AdvancePhaseView
        :boards="mockBoards"
        :new-boards="[]"
        :is-witness="true"
        :is-accomplice="false"
        :is-advance1="true"
      />
    </Variant>
    <Variant title="目击者推进完成">
      <AdvancePhaseView
        :boards="mockBoards"
        :new-boards="[]"
        :is-witness="true"
        :is-accomplice="false"
        :is-advance1="true"
        :advance-ready="true"
        @witness-finish-advance="() => console.log('witness-finish-advance')"
      />
    </Variant>
    <Variant title="目击者换板（推进 2）">
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
    <Variant title="侦探等待">
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
