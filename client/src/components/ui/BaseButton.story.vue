<script setup lang="ts">
import BaseButton from './BaseButton.vue'
</script>

<template>
  <Story title="ui/BaseButton" group="ui">
    <Variant title="Primary">
      <BaseButton>主要按钮</BaseButton>
    </Variant>
    <Variant title="Secondary">
      <BaseButton variant="secondary">次要按钮</BaseButton>
    </Variant>
    <Variant title="Danger">
      <BaseButton variant="danger">危险操作</BaseButton>
    </Variant>
    <Variant title="Ghost">
      <BaseButton variant="ghost">幽灵按钮</BaseButton>
    </Variant>
    <Variant title="Loading">
      <BaseButton :loading="true">加载中</BaseButton>
    </Variant>
    <Variant title="Disabled">
      <BaseButton :disabled="true">禁用</BaseButton>
    </Variant>
  </Story>
</template>
