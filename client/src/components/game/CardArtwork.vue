<script setup lang="ts">
import { ref, watch } from 'vue'
import { Image as ImageIcon } from '@lucide/vue'
import AppIcon from '../ui/AppIcon.vue'

const props = withDefaults(
  defineProps<{
    src?: string
    shape?: 'portrait' | 'square'
    loading?: 'lazy' | 'eager'
  }>(),
  { shape: 'portrait', loading: 'lazy' },
)

const failed = ref(false)
watch(
  () => props.src,
  () => {
    failed.value = false
  },
)
</script>

<template>
  <!-- Artwork is decorative: its card name or board title is rendered beside it. -->
  <span class="card-artwork" :class="`card-artwork--${shape}`" aria-hidden="true">
    <img
      v-if="src && !failed"
      :key="src"
      class="card-artwork__image"
      :src="src"
      alt=""
      :loading="loading"
      decoding="async"
      @error="failed = true"
    />
    <span v-else class="card-artwork__fallback" data-testid="artwork-fallback">
      <AppIcon v-if="shape === 'square'" name="dashboard" />
      <ImageIcon v-else :stroke-width="2" aria-hidden="true" focusable="false" />
    </span>
  </span>
</template>

<style scoped>
.card-artwork {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 113 / 256;
  overflow: hidden;
  background: var(--muted);
}

.card-artwork--square {
  aspect-ratio: 1;
}

.card-artwork__image,
.card-artwork__fallback {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.card-artwork__image {
  display: block;
  object-fit: contain;
}

.card-artwork--square .card-artwork__image {
  object-fit: cover;
}

.card-artwork__fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted-foreground);
}

.card-artwork__fallback svg {
  width: min(32px, 40%);
  height: auto;
}
</style>
