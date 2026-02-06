<script setup lang="ts">
import SceneBoardPanel from './SceneBoardPanel.vue'
import { mockBoards } from '../../__mocks__/gameData'

function onSelectOption(payload: { optionIndex: number }) {
  console.log('select-option:', payload)
}
</script>

<template>
  <Story title="场景板面板" group="game">
    <Variant title="Read-only with Marker">
      <div style="padding: 20px; background: var(--bg-primary); max-width: 320px;">
        <SceneBoardPanel :board="mockBoards[0]!" @select-option="onSelectOption" />
      </div>
    </Variant>

    <Variant title="Editable">
      <div style="padding: 20px; background: var(--bg-primary); max-width: 320px;">
        <SceneBoardPanel :board="mockBoards[1]!" :editable="true" @select-option="onSelectOption" />
      </div>
    </Variant>

    <Variant title="Hidden (Blackout)">
      <div style="padding: 20px; background: var(--bg-primary); max-width: 320px;">
        <SceneBoardPanel :board="mockBoards[2]!" :hidden="true" @select-option="onSelectOption" />
      </div>
    </Variant>

    <Variant title="All Board Types">
      <div style="padding: 20px; background: var(--bg-primary); display: flex; flex-direction: column; gap: 16px; max-width: 320px;">
        <SceneBoardPanel
          v-for="board in mockBoards.slice(0, 3)"
          :key="board.id"
          :board="board"
        />
      </div>
    </Variant>
  </Story>
</template>
