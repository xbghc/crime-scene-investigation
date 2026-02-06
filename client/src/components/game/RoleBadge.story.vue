<script setup lang="ts">
import RoleBadge from './RoleBadge.vue'
</script>

<template>
  <Story title="角色标识" group="game">
    <Variant title="Witness">
      <div style="padding: 20px; background: var(--bg-primary); display: flex; gap: 12px; align-items: center;">
        <RoleBadge role="witness" />
        <RoleBadge role="witness" :show-label="false" />
      </div>
    </Variant>

    <Variant title="Murderer">
      <div style="padding: 20px; background: var(--bg-primary); display: flex; gap: 12px; align-items: center;">
        <RoleBadge role="murderer" />
        <RoleBadge role="murderer" :show-label="false" />
      </div>
    </Variant>

    <Variant title="Accomplice">
      <div style="padding: 20px; background: var(--bg-primary); display: flex; gap: 12px; align-items: center;">
        <RoleBadge role="accomplice" />
        <RoleBadge role="accomplice" :show-label="false" />
      </div>
    </Variant>

    <Variant title="Detective">
      <div style="padding: 20px; background: var(--bg-primary); display: flex; gap: 12px; align-items: center;">
        <RoleBadge role="detective" />
        <RoleBadge role="detective" :show-label="false" />
      </div>
    </Variant>

    <Variant title="All Roles">
      <div style="padding: 20px; background: var(--bg-primary); display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
        <RoleBadge role="witness" />
        <RoleBadge role="murderer" />
        <RoleBadge role="accomplice" />
        <RoleBadge role="detective" />
      </div>
    </Variant>
  </Story>
</template>
