<script setup lang="ts">
import NightAccompliceView from './NightAccompliceView.vue'
import { mockMeansCards, mockClueCards } from '../../__mocks__/gameData'

const accompliceCardIds = ['M03', 'C04']
</script>

<template>
  <Story title="帮凶/夜晚 · 视角" group="phases" :layout="{ type: 'single', iframe: true }">
    <Variant title="等待（未选择）">
      <NightAccompliceView
        murderer-nickname="探长老王"
        :means-cards="mockMeansCards"
        :clue-cards="mockClueCards"
        :accomplice-card-ids="accompliceCardIds"
        :time-remaining="45"
      />
    </Variant>
    <Variant title="已选手段">
      <NightAccompliceView
        murderer-nickname="探长老王"
        :means-cards="mockMeansCards"
        :clue-cards="mockClueCards"
        :accomplice-card-ids="accompliceCardIds"
        selected-means-id="M02"
        :time-remaining="30"
      />
    </Variant>
    <Variant title="均已选择（未确认）">
      <NightAccompliceView
        murderer-nickname="探长老王"
        :means-cards="mockMeansCards"
        :clue-cards="mockClueCards"
        :accomplice-card-ids="accompliceCardIds"
        selected-means-id="M02"
        selected-clue-id="C03"
        :time-remaining="15"
      />
    </Variant>
    <Variant title="已确认">
      <NightAccompliceView
        murderer-nickname="探长老王"
        :means-cards="mockMeansCards"
        :clue-cards="mockClueCards"
        :accomplice-card-ids="accompliceCardIds"
        selected-means-id="M02"
        selected-clue-id="C03"
        :confirmed="true"
        :time-remaining="10"
      />
    </Variant>
  </Story>
</template>
