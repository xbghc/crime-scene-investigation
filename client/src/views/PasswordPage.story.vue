<script setup lang="ts">
import PasswordPage from './PasswordPage.vue'
</script>

<template>
  <Story title="密码验证页" group="pages" :layout="{ type: 'single', iframe: true }">
    <Variant title="Default">
      <PasswordPage />
    </Variant>
  </Story>
</template>
