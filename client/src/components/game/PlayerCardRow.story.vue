<script setup lang="ts">
import PlayerCardRow from './PlayerCardRow.vue'
import { mockPlayers } from '../../__mocks__/gameData'

// p2 = murderer with full cards (alive, has solve right)
const normalPlayer = mockPlayers[1]!

// p6 = dead player
const deadPlayer = mockPlayers[5]!

// p7 = alive but no solve right
const noSolvePlayer = mockPlayers[6]!
</script>

<template>
  <Story title="玩家卡牌行" group="game">
    <Variant title="Normal Player">
      <div style="padding: 20px; background: var(--bg-primary); max-width: 360px">
        <PlayerCardRow :player="normalPlayer" />
      </div>
    </Variant>

    <Variant title="Dead Player">
      <div style="padding: 20px; background: var(--bg-primary); max-width: 360px">
        <PlayerCardRow :player="deadPlayer" />
      </div>
    </Variant>

    <Variant title="Lost Solve Right">
      <div style="padding: 20px; background: var(--bg-primary); max-width: 360px">
        <PlayerCardRow :player="noSolvePlayer" />
      </div>
    </Variant>

    <Variant title="Multiple Players">
      <div
        style="
          padding: 20px;
          background: var(--bg-primary);
          max-width: 360px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        "
      >
        <PlayerCardRow :player="normalPlayer" />
        <PlayerCardRow :player="deadPlayer" />
        <PlayerCardRow :player="noSolvePlayer" />
      </div>
    </Variant>
  </Story>
</template>
