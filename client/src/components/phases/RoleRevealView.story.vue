<script setup lang="ts">
import RoleRevealView from './RoleRevealView.vue'
</script>

<template>
  <Story title="通用/身份揭示" group="phases" :layout="{ type: 'single', iframe: true }">
    <Variant title="侦探">
      <RoleRevealView role="detective" @confirm="() => console.log('confirm')" />
    </Variant>
    <Variant title="凶手">
      <RoleRevealView role="murderer" @confirm="() => console.log('confirm')" />
    </Variant>
    <Variant title="帮凶">
      <RoleRevealView role="accomplice" @confirm="() => console.log('confirm')" />
    </Variant>
    <Variant title="目击者">
      <RoleRevealView role="witness" @confirm="() => console.log('confirm')" />
    </Variant>
  </Story>
</template>
