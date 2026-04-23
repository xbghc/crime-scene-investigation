<script setup lang="ts">
import { ref } from 'vue'
import WitnessAccuseView from './WitnessAccuseView.vue'
import { mockPlayers } from '../../__mocks__/gameData'
import type { SceneBoard } from '../../types'

const murderer = mockPlayers[1]!
const selection = { meansCardId: 'M01', clueCardId: 'C01' }

const baseBoards: SceneBoard[] = [
  {
    id: 'B01', type: 'cause', title: '死亡原因',
    options: ['窒息', '失血', '中毒', '重击', '烧伤', '溺亡'],
  },
  {
    id: 'B02', type: 'location', title: '案发地点A',
    options: ['卧室', '浴室', '客厅', '厨房', '后院', '车库'],
  },
  {
    id: 'B03', type: 'scene', title: '作案时间',
    options: ['凌晨', '清晨', '上午', '下午', '傍晚', '深夜'],
  },
  {
    id: 'B04', type: 'scene', title: '凶手体型',
    options: ['高大', '矮小', '健壮', '瘦弱', '普通身材', '肥胖'],
  },
  {
    id: 'B05', type: 'scene', title: '遗留痕迹',
    options: ['脚印', '指纹', '血迹', '毛发', '气味', '划痕'],
  },
  {
    id: 'B06', type: 'scene', title: '作案动机',
    options: ['仇恨', '贪财', '情杀', '灭口', '意外', '自卫'],
  },
]

// === Interactive variant state ===
const interactiveBoards = ref<SceneBoard[]>(
  baseBoards.map(b => ({ ...b, marker: undefined }))
)

function handleSelectOption(payload: { boardId: string; optionIndex: number }) {
  interactiveBoards.value = interactiveBoards.value.map(b => {
    if (b.id !== payload.boardId) return b
    // optionIndex -1 means deselect
    if (payload.optionIndex < 0) {
      return { ...b, marker: undefined }
    }
    // Select or change the option (markerNumber is a placeholder; display derives from position)
    return { ...b, marker: { optionIndex: payload.optionIndex, markerNumber: 0 } }
  })
}

function handleReorder(boardIds: string[]) {
  const boardMap = new Map(interactiveBoards.value.map(b => [b.id, b]))
  interactiveBoards.value = boardIds
    .map(id => boardMap.get(id))
    .filter((b): b is SceneBoard => !!b)
}

// === Pre-filled boards for static variants ===
const partialBoards: SceneBoard[] = baseBoards.map((b, i) =>
  i < 3
    ? { ...b, marker: { optionIndex: i + 1, markerNumber: 0 } }
    : { ...b, marker: undefined }
)

const fullBoards: SceneBoard[] = baseBoards.map((b, i) => ({
  ...b,
  marker: { optionIndex: i, markerNumber: 0 },
}))
</script>

<template>
  <Story title="目击者/指证" group="phases" :layout="{ type: 'single', iframe: true }">
    <Variant title="Interactive (Try It)">
      <WitnessAccuseView
        :boards="interactiveBoards"
        :murderer-selection="selection"
        :murderer-player="murderer"
        @select-option="handleSelectOption"
        @reorder="handleReorder"
        @confirm="() => console.log('confirm — boards:', JSON.stringify(interactiveBoards))"
      />
    </Variant>
    <Variant title="Empty (No Markers)">
      <WitnessAccuseView
        :boards="baseBoards"
        :murderer-selection="selection"
        :murderer-player="murderer"
        @select-option="(p) => console.log('select-option:', p)"
        @reorder="(ids) => console.log('reorder:', ids)"
        @confirm="() => console.log('confirm')"
      />
    </Variant>
    <Variant title="Partial Markers (3/6)">
      <WitnessAccuseView
        :boards="partialBoards"
        :murderer-selection="selection"
        :murderer-player="murderer"
        @select-option="(p) => console.log('select-option:', p)"
        @reorder="(ids) => console.log('reorder:', ids)"
        @confirm="() => console.log('confirm')"
      />
    </Variant>
    <Variant title="All Markers Placed">
      <WitnessAccuseView
        :boards="fullBoards"
        :murderer-selection="selection"
        :murderer-player="murderer"
        @select-option="(p) => console.log('select-option:', p)"
        @reorder="(ids) => console.log('reorder:', ids)"
        @confirm="() => console.log('confirm')"
      />
    </Variant>
  </Story>
</template>
