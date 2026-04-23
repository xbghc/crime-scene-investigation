<script setup lang="ts">
import NightDetectiveView from './NightDetectiveView.vue'
</script>

<template>
  <Story title="侦探/夜晚 · 等待" group="phases" :layout="{ type: 'single', iframe: true }">
    <Variant title="Default">
      <NightDetectiveView />
    </Variant>
  </Story>
</template>
