<script setup lang="ts">
defineProps<{
  availableMarkers: number[]
  modelValue: number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
}>()

function selectMarker(marker: number, available: boolean) {
  if (!available) return
  emit('update:modelValue', marker)
}
</script>

<template>
  <div class="marker-selector">
    <button
      v-for="n in 6"
      :key="n"
      type="button"
      :aria-label="`选项物 ${n}`"
      :aria-pressed="modelValue === n"
      class="marker-selector__btn"
      :class="{
        'marker-selector__btn--available': availableMarkers.includes(n),
        'marker-selector__btn--used': !availableMarkers.includes(n),
        'marker-selector__btn--selected': modelValue === n,
      }"
      :disabled="!availableMarkers.includes(n)"
      @click="selectMarker(n, availableMarkers.includes(n))"
    >
      {{ n }}
    </button>
  </div>
</template>

<style scoped>
.marker-selector {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.marker-selector__btn {
  width: 44px;
  height: 44px;
  min-height: 44px;
  min-width: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  border: 1px solid transparent;
  transition: all 0.15s ease;
  cursor: pointer;
  font-family: var(--font-mono);
}

.marker-selector__btn--available {
  background: var(--color-amber);
  color: var(--bg-primary);
}

.marker-selector__btn--available:hover {
  background: var(--color-amber-light);
}

.marker-selector__btn--used {
  background: var(--bg-card);
  color: var(--color-text-dim);
  cursor: not-allowed;
  opacity: 0.6;
}

.marker-selector__btn--selected {
  border-color: var(--color-amber-light);
  box-shadow: 0 0 0 2px rgba(240, 201, 112, 0.4);
}
</style>
