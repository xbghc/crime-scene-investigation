<script setup lang="ts">
import NightAccompliceView from './NightAccompliceView.vue'
</script>

<template>
  <Story title="夜晚 · 帮凶视角" group="phases" :layout="{ type: 'single', iframe: true }">
    <Variant title="Default">
      <NightAccompliceView murderer-nickname="探长老王" :time-remaining="45" />
    </Variant>
  </Story>
</template>
