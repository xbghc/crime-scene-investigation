<script setup lang="ts">
import IconButton from './IconButton.vue'
</script>

<template>
  <Story title="图标按钮" group="ui">
    <Variant title="Icon Left (default)">
      <IconButton icon="key">进入档案</IconButton>
    </Variant>
    <Variant title="Icon Right">
      <IconButton icon="arrow_forward" icon-position="right">加入调查</IconButton>
    </Variant>
    <Variant title="Secondary">
      <IconButton icon="shield" variant="secondary">查看线索</IconButton>
    </Variant>
    <Variant title="Ghost">
      <IconButton icon="share" variant="ghost">邀请侦探</IconButton>
    </Variant>
    <Variant title="Loading">
      <IconButton icon="play_arrow" :loading="true">开始调查</IconButton>
    </Variant>
    <Variant title="Disabled">
      <IconButton icon="play_arrow" :disabled="true">开始调查（至少4人）</IconButton>
    </Variant>
    <Variant title="Block">
      <div style="max-width: 320px">
        <IconButton icon="key" block>进入档案</IconButton>
      </div>
    </Variant>
  </Story>
</template>
