<script setup lang="ts">
import GameCard from './GameCard.vue'
</script>

<template>
  <Story title="游戏卡牌" group="game">
    <Variant title="Means Card">
      <div style="padding: 20px; background: var(--bg-primary);">
        <GameCard type="means" name="刀" />
      </div>
    </Variant>

    <Variant title="Clue Card">
      <div style="padding: 20px; background: var(--bg-primary);">
        <GameCard type="clue" name="血迹" />
      </div>
    </Variant>

    <Variant title="Selected">
      <div style="padding: 20px; background: var(--bg-primary); display: flex; gap: 12px;">
        <GameCard type="means" name="毒药" :selected="true" />
        <GameCard type="clue" name="指纹" :selected="true" />
      </div>
    </Variant>

    <Variant title="Disabled">
      <div style="padding: 20px; background: var(--bg-primary); display: flex; gap: 12px;">
        <GameCard type="means" name="绳索" :disabled="true" />
        <GameCard type="clue" name="脚印" :disabled="true" />
      </div>
    </Variant>

    <Variant title="All States">
      <div style="padding: 20px; background: var(--bg-primary); display: flex; flex-wrap: wrap; gap: 12px;">
        <GameCard type="means" name="手枪" />
        <GameCard type="clue" name="烟蒂" />
        <GameCard type="means" name="毒药" :selected="true" />
        <GameCard type="clue" name="指纹" :selected="true" />
        <GameCard type="means" name="绳索" :disabled="true" />
        <GameCard type="clue" name="脚印" :disabled="true" />
      </div>
    </Variant>
  </Story>
</template>
