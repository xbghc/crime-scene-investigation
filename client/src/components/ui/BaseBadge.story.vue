<script setup lang="ts">
import BaseBadge from './BaseBadge.vue'
</script>

<template>
  <Story title="基础标签" group="ui">
    <Variant title="Witness">
      <BaseBadge variant="witness" label="目击者" />
    </Variant>
    <Variant title="Murderer">
      <BaseBadge variant="murderer" label="凶手" />
    </Variant>
    <Variant title="Accomplice">
      <BaseBadge variant="accomplice" label="帮凶" />
    </Variant>
    <Variant title="Detective">
      <BaseBadge variant="detective" label="侦探" />
    </Variant>
    <Variant title="Host">
      <BaseBadge variant="host" label="房主" />
    </Variant>
  </Story>
</template>
