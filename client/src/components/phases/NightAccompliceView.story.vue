<script setup lang="ts">
import NightAccompliceView from './NightAccompliceView.vue'
</script>

<template>
  <Story title="phases/NightAccompliceView" group="phases" :layout="{ type: 'single', iframe: true }">
    <Variant title="Default">
      <NightAccompliceView murderer-nickname="探长老王" :time-remaining="45" />
    </Variant>
  </Story>
</template>
