<script setup lang="ts">
import SceneBoardsOverview from './SceneBoardsOverview.vue'
import { mockBoards } from '../../__mocks__/gameData'
</script>

<template>
  <Story title="场景板总览" group="game">
    <Variant title="Normal">
      <div style="padding: 20px; background: var(--bg-primary); max-width: 320px;">
        <SceneBoardsOverview :boards="mockBoards" />
      </div>
    </Variant>
    <Variant title="Blackout">
      <div style="padding: 20px; background: var(--bg-primary); max-width: 320px;">
        <SceneBoardsOverview :boards="mockBoards" :blackout="true" />
      </div>
    </Variant>
  </Story>
</template>
