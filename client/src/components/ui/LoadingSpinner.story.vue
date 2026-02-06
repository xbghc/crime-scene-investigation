<script setup lang="ts">
import LoadingSpinner from './LoadingSpinner.vue'
</script>

<template>
  <Story title="加载动画" group="ui">
    <Variant title="Default">
      <LoadingSpinner />
    </Variant>
    <Variant title="With Label">
      <LoadingSpinner label="正在加载中..." />
    </Variant>
  </Story>
</template>
