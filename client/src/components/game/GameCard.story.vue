<script setup lang="ts">
import GameCard from './GameCard.vue'
</script>

<template>
  <Story title="游戏卡牌" group="game">
    <Variant title="Means Card (with image)">
      <div style="padding: 20px; background: var(--bg-primary); display: flex; gap: 12px">
        <GameCard type="means" id="M001" name="刀" />
        <GameCard type="means" id="M006" name="毒药" />
        <GameCard type="means" id="M008" name="手枪" />
      </div>
    </Variant>

    <Variant title="Clue Card (with image)">
      <div style="padding: 20px; background: var(--bg-primary); display: flex; gap: 12px">
        <GameCard type="clue" id="C001" name="头发" />
        <GameCard type="clue" id="C004" name="血迹" />
        <GameCard type="clue" id="C002" name="指纹" />
      </div>
    </Variant>

    <Variant title="Selected">
      <div style="padding: 20px; background: var(--bg-primary); display: flex; gap: 12px">
        <GameCard type="means" id="M006" name="毒药" :selected="true" />
        <GameCard type="clue" id="C002" name="指纹" :selected="true" />
      </div>
    </Variant>

    <Variant title="Disabled">
      <div style="padding: 20px; background: var(--bg-primary); display: flex; gap: 12px">
        <GameCard type="means" id="M004" name="绳索" :disabled="true" />
        <GameCard type="clue" id="C003" name="脚印" :disabled="true" />
      </div>
    </Variant>

    <Variant title="Without ID (text fallback)">
      <div style="padding: 20px; background: var(--bg-primary); display: flex; gap: 12px">
        <GameCard type="means" name="手枪" />
        <GameCard type="clue" name="烟蒂" />
      </div>
    </Variant>

    <Variant title="All States">
      <div
        style="
          padding: 20px;
          background: var(--bg-primary);
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        "
      >
        <GameCard type="means" id="M008" name="手枪" />
        <GameCard type="clue" id="C007" name="烟蒂" />
        <GameCard type="means" id="M006" name="毒药" :selected="true" />
        <GameCard type="clue" id="C002" name="指纹" :selected="true" />
        <GameCard type="means" id="M004" name="绳索" :disabled="true" />
        <GameCard type="clue" id="C003" name="脚印" :disabled="true" />
      </div>
    </Variant>
  </Story>
</template>
