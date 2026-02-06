<script setup lang="ts">
import SolveAttemptView from './SolveAttemptView.vue'
import { mockPlayers } from '../../__mocks__/gameData'
</script>

<template>
  <Story title="破案界面" group="phases" :layout="{ type: 'single', iframe: true }">
    <Variant title="Normal Solve">
      <SolveAttemptView
        :players="mockPlayers"
        @confirm="(p) => console.log('confirm:', p)"
        @cancel="() => console.log('cancel')"
      />
    </Variant>
    <Variant title="Forced Solve">
      <SolveAttemptView
        :players="mockPlayers"
        :forced="true"
        @confirm="(p) => console.log('confirm:', p)"
        @cancel="() => console.log('cancel')"
      />
    </Variant>
    <Variant title="4 Players">
      <SolveAttemptView
        :players="mockPlayers.slice(0, 4)"
        @confirm="(p) => console.log('confirm:', p)"
        @cancel="() => console.log('cancel')"
      />
    </Variant>
  </Story>
</template>
