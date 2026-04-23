<script setup lang="ts">
import SolveAttemptView from './SolveAttemptView.vue'
import { mockPlayers } from '../../__mocks__/gameData'
</script>

<template>
  <Story title="侦探/破案" group="phases" :layout="{ type: 'single', iframe: true }">
    <Variant title="常规破案">
      <SolveAttemptView
        :players="mockPlayers"
        @confirm="(p) => console.log('confirm:', p)"
        @cancel="() => console.log('cancel')"
      />
    </Variant>
    <Variant title="强制破案">
      <SolveAttemptView
        :players="mockPlayers"
        :forced="true"
        @confirm="(p) => console.log('confirm:', p)"
        @cancel="() => console.log('cancel')"
      />
    </Variant>
    <Variant title="4 人局">
      <SolveAttemptView
        :players="mockPlayers.slice(0, 4)"
        @confirm="(p) => console.log('confirm:', p)"
        @cancel="() => console.log('cancel')"
      />
    </Variant>
  </Story>
</template>
