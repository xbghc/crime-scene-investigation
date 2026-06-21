<script setup lang="ts"></script>

<template>
  <div class="app-container">
    <router-view />
  </div>
</template>

<style scoped>
.app-container {
  min-height: 100dvh;
  background: var(--bg-primary);
  color: var(--color-text);
}
</style>
