<script setup lang="ts">
import LoadingSpinner from './LoadingSpinner.vue'
</script>

<template>
  <Story title="ui/LoadingSpinner" group="ui">
    <Variant title="Default">
      <LoadingSpinner />
    </Variant>
    <Variant title="With Label">
      <LoadingSpinner label="正在加载中..." />
    </Variant>
  </Story>
</template>
