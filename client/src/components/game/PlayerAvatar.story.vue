<script setup lang="ts">
import PlayerAvatar from './PlayerAvatar.vue'
import { PLAYER_COLORS } from '../../__mocks__/gameData'
</script>

<template>
  <Story title="game/PlayerAvatar" group="game">
    <Variant title="Normal">
      <div style="padding: 20px; background: var(--bg-primary); display: flex; gap: 24px;">
        <PlayerAvatar nickname="小明" :color="PLAYER_COLORS[0]" status="alive" />
        <PlayerAvatar nickname="小红" :color="PLAYER_COLORS[1]" status="alive" />
        <PlayerAvatar nickname="小刚" :color="PLAYER_COLORS[2]" status="alive" />
      </div>
    </Variant>

    <Variant title="Host">
      <div style="padding: 20px; background: var(--bg-primary); display: flex; gap: 24px;">
        <PlayerAvatar nickname="小明" :color="PLAYER_COLORS[0]" :is-host="true" status="alive" />
      </div>
    </Variant>

    <Variant title="Dead">
      <div style="padding: 20px; background: var(--bg-primary); display: flex; gap: 24px;">
        <PlayerAvatar nickname="小美" :color="PLAYER_COLORS[5]" status="dead" />
        <PlayerAvatar nickname="大壮" :color="PLAYER_COLORS[6]" status="dead" :is-host="true" />
      </div>
    </Variant>

    <Variant title="Disconnected">
      <div style="padding: 20px; background: var(--bg-primary); display: flex; gap: 24px;">
        <PlayerAvatar nickname="阿强" :color="PLAYER_COLORS[4]" status="disconnected" />
      </div>
    </Variant>
  </Story>
</template>
