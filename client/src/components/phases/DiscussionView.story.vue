<script setup lang="ts">
import DiscussionView from './DiscussionView.vue'
import { mockBoards, mockPlayers } from '../../__mocks__/gameData'
</script>

<template>
  <Story title="通用/发言" group="phases" :layout="{ type: 'single', iframe: true }">
    <Variant title="Round 1 - Detective (Can Solve)">
      <DiscussionView
        :boards="mockBoards"
        :players="mockPlayers"
        :round-number="1"
        :is-witness="false"
        :can-solve="true"
        :blackout="false"
        @solve="() => console.log('solve')"
        @end-discussion="() => console.log('end-discussion')"
      />
    </Variant>
    <Variant title="Round 2 - Detective (No Solve Right)">
      <DiscussionView
        :boards="mockBoards"
        :players="mockPlayers"
        :round-number="2"
        :is-witness="false"
        :can-solve="false"
        :blackout="false"
        @solve="() => console.log('solve')"
        @end-discussion="() => console.log('end-discussion')"
      />
    </Variant>
    <Variant title="Round 3 - Witness (End Discussion Button)">
      <DiscussionView
        :boards="mockBoards"
        :players="mockPlayers"
        :round-number="3"
        :is-witness="true"
        :can-solve="false"
        :blackout="false"
        @solve="() => console.log('solve')"
        @end-discussion="() => console.log('end-discussion')"
      />
    </Variant>
    <Variant title="Blackout Active">
      <DiscussionView
        :boards="mockBoards"
        :players="mockPlayers"
        :round-number="2"
        :is-witness="false"
        :can-solve="true"
        :blackout="true"
        @solve="() => console.log('solve')"
        @end-discussion="() => console.log('end-discussion')"
      />
    </Variant>
  </Story>
</template>
