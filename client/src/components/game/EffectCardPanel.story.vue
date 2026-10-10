<script setup lang="ts">
import EffectCardPanel from './EffectCardPanel.vue'
import { mockBoards, mockPlayers } from '../../__mocks__/gameData'
import type { EffectCard, PendingEffect } from '../../types'

const examples: { card: EffectCard; pending: PendingEffect }[] = [
  {
    card: { id: 'E01', name: '暗杀', effect: '目击者选择一名玩家暗杀，被暗杀的玩家失去破案权' },
    pending: { effectId: 'E01', targetIds: ['p2', 'p3', 'p4', 'p5', 'p7'], optional: false },
  },
  {
    card: { id: 'E03', name: '排除嫌疑', effect: '目击者选择一名玩家，宣布该玩家不是凶手' },
    pending: { effectId: 'E03', targetIds: ['p3', 'p4', 'p5', 'p6', 'p7'], optional: false },
  },
  {
    card: { id: 'E05', name: '证据遗失', effect: '目击者必须移除一张当前场景板上的选项物' },
    pending: {
      effectId: 'E05',
      boardIds: mockBoards.filter((board) => board.marker).map((board) => board.id),
      optional: false,
    },
  },
  {
    card: {
      id: 'E08',
      name: '信息泄露',
      effect: '目击者可以用手指向凶手所选的一张牌（手段或线索）',
    },
    pending: { effectId: 'E08', cardIds: ['M001', 'C001'], optional: true },
  },
]
const infoLeak = examples[3]!.card
const selection = { meansCard: { id: 'M001', name: '刀' }, clueCard: { id: 'C001', name: '血迹' } }
</script>

<template>
  <Story title="游戏/效果牌操作" group="game" :layout="{ type: 'single', iframe: true }">
    <Variant
      v-for="example in examples"
      :key="example.card.id"
      :title="`${example.card.id} ${example.card.name} · 目击者`"
    >
      <div style="max-width: 400px; padding: 16px">
        <EffectCardPanel
          :card="example.card"
          :pending-effect="example.pending"
          is-witness
          :players="mockPlayers"
          :boards="mockBoards"
          :murderer-selection="selection"
          @action="(action) => console.log('effect-action', action)"
        />
      </div>
    </Variant>
    <Variant title="重试 · 保留选择">
      <div style="max-width: 400px; padding: 16px">
        <EffectCardPanel
          :card="infoLeak"
          :pending-effect="examples[3]!.pending"
          is-witness
          :players="mockPlayers"
          :murderer-selection="selection"
          error="服务器响应超时，可重试；已完成的效果不会重复执行"
        />
      </div>
    </Variant>
    <Variant title="侦探 · 等待处理">
      <div style="max-width: 400px; padding: 16px">
        <EffectCardPanel
          :card="infoLeak"
          :result="{ applied: false, requiresWitnessAction: true }"
        />
      </div>
    </Variant>
    <Variant title="所有人 · 已公开手段牌">
      <div style="max-width: 400px; padding: 16px">
        <EffectCardPanel
          :card="infoLeak"
          :players="mockPlayers"
          :result="{
            applied: true,
            pointedCardId: 'M001',
            message: '目击者公开了凶手所选的一张牌',
          }"
        />
      </div>
    </Variant>
    <Variant title="所有人 · 已跳过">
      <div style="max-width: 400px; padding: 16px">
        <EffectCardPanel
          :card="infoLeak"
          :result="{ applied: false, skipped: true, message: '目击者选择跳过信息泄露' }"
        />
      </div>
    </Variant>
    <Variant title="没有选项物 · 自动结束">
      <div style="max-width: 400px; padding: 16px">
        <EffectCardPanel
          :card="examples[2]!.card"
          :result="{ applied: false, message: '没有可移除的选项物，此效果已结束' }"
        />
      </div>
    </Variant>
  </Story>
</template>
