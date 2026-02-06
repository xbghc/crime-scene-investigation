<script setup lang="ts">
import NightMurdererView from './NightMurdererView.vue'
</script>

<template>
  <Story title="phases/NightMurdererView" group="phases" :layout="{ type: 'single', iframe: true }">
    <Variant
      title="Default"
      :init-state="() => ({
        meansCards: [
          { id: 'm1', name: 'Revolver' },
          { id: 'm2', name: 'Arsenic' },
          { id: 'm3', name: 'Dagger' },
          { id: 'm4', name: 'Rope' },
        ],
        clueCards: [
          { id: 'c1', name: 'Glove' },
          { id: 'c2', name: 'Lipstick' },
          { id: 'c3', name: 'Watch' },
          { id: 'c4', name: 'Note' },
        ],
        accompliceCardIds: ['m3', 'c4'],
      })"
    >
      <template #default="{ state }">
        <NightMurdererView
          :means-cards="state.meansCards"
          :clue-cards="state.clueCards"
          :accomplice-card-ids="state.accompliceCardIds"
          :time-remaining="45"
          @confirm="(sel) => console.log('Confirmed:', sel)"
        />
      </template>
    </Variant>
  </Story>
</template>
