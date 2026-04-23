<script setup lang="ts">
import NightMurdererView from './NightMurdererView.vue'
</script>

<template>
  <Story title="凶手/夜晚 · 选牌" group="phases" :layout="{ type: 'single', iframe: true }">
    <Variant
      title="默认"
      :init-state="() => ({
        meansCards: [
          { id: 'M001', name: '刀' },
          { id: 'M002', name: '毒药' },
          { id: 'M003', name: '绳索' },
          { id: 'M004', name: '手枪' },
        ],
        clueCards: [
          { id: 'C001', name: '血迹' },
          { id: 'C002', name: '指纹' },
          { id: 'C003', name: '脚印' },
          { id: 'C004', name: '烟蒂' },
        ],
        accompliceCardIds: ['M003', 'C004'],
      })"
    >
      <template #default="{ state }">
        <NightMurdererView
          :means-cards="state.meansCards"
          :clue-cards="state.clueCards"
          :accomplice-card-ids="state.accompliceCardIds"
          :time-remaining="45"
          @confirm="(sel) => console.log('Confirmed:', sel)"
        />
      </template>
    </Variant>
  </Story>
</template>
