<script setup lang="ts">
import { ref } from 'vue'
import MarkerSelector from './MarkerSelector.vue'

const allAvailable = ref<number | null>(null)
const someUsed = ref<number | null>(3)
</script>

<template>
  <Story title="选项物选择器" group="game">
    <Variant title="All Available">
      <div style="padding: 20px; background: var(--bg-primary);">
        <MarkerSelector
          v-model="allAvailable"
          :available-markers="[1, 2, 3, 4, 5, 6]"
        />
        <p style="margin-top: 12px; color: var(--color-text-muted); font-size: 0.8rem;">
          Selected: {{ allAvailable ?? 'none' }}
        </p>
      </div>
    </Variant>

    <Variant title="Some Used">
      <div style="padding: 20px; background: var(--bg-primary);">
        <MarkerSelector
          v-model="someUsed"
          :available-markers="[3, 5, 6]"
        />
        <p style="margin-top: 12px; color: var(--color-text-muted); font-size: 0.8rem;">
          Selected: {{ someUsed ?? 'none' }} (markers 1, 2, 4 used)
        </p>
      </div>
    </Variant>
  </Story>
</template>
