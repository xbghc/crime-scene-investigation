<script setup lang="ts">
import RoleRevealView from './RoleRevealView.vue'
</script>

<template>
  <Story title="身份揭示" group="phases" :layout="{ type: 'single', iframe: true }">
    <Variant title="Detective">
      <RoleRevealView role="detective" @confirm="() => console.log('confirm')" />
    </Variant>
    <Variant title="Murderer">
      <RoleRevealView role="murderer" @confirm="() => console.log('confirm')" />
    </Variant>
    <Variant title="Accomplice">
      <RoleRevealView role="accomplice" @confirm="() => console.log('confirm')" />
    </Variant>
    <Variant title="Witness">
      <RoleRevealView role="witness" @confirm="() => console.log('confirm')" />
    </Variant>
  </Story>
</template>
