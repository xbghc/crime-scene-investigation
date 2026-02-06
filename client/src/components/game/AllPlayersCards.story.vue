<script setup lang="ts">
import AllPlayersCards from './AllPlayersCards.vue'
import { mockPlayers } from '../../__mocks__/gameData'
</script>

<template>
  <Story title="全部玩家卡牌" group="game">
    <Variant title="4 Players">
      <div style="padding: 20px; background: var(--bg-primary); max-width: 360px;">
        <AllPlayersCards :players="mockPlayers.slice(0, 4)" />
      </div>
    </Variant>
    <Variant title="7 Players">
      <div style="padding: 20px; background: var(--bg-primary); max-width: 360px;">
        <AllPlayersCards :players="mockPlayers" />
      </div>
    </Variant>
  </Story>
</template>
