import {
  computed,
  shallowRef,
  toValue,
  watch,
  type CSSProperties,
  type MaybeRefOrGetter,
} from 'vue'

interface ViewportBounds {
  height: number
  width: number
  top: number
  left: number
}

// Mobile keyboards can shrink/pan the visual viewport without changing 100dvh.
// Keep listeners scoped to the open dialog, including when several are stacked.
export function useVisualViewport(enabled: MaybeRefOrGetter<boolean> = true) {
  const viewport = shallowRef<ViewportBounds | null>(null)

  watch(
    () => toValue(enabled),
    (active, _previous, onCleanup) => {
      viewport.value = null
      if (!active || typeof window === 'undefined') return

      const visualViewport = window.visualViewport
      function update() {
        const bounds = {
          height: visualViewport?.height ?? window.innerHeight,
          width: visualViewport?.width ?? window.innerWidth,
          top: visualViewport?.offsetTop ?? 0,
          left: visualViewport?.offsetLeft ?? 0,
        }
        const previous = viewport.value
        if (
          !previous ||
          previous.height !== bounds.height ||
          previous.width !== bounds.width ||
          previous.top !== bounds.top ||
          previous.left !== bounds.left
        ) {
          viewport.value = bounds
        }
      }

      update()
      visualViewport?.addEventListener('resize', update)
      visualViewport?.addEventListener('scroll', update)
      window.addEventListener('resize', update)
      onCleanup(() => {
        visualViewport?.removeEventListener('resize', update)
        visualViewport?.removeEventListener('scroll', update)
        window.removeEventListener('resize', update)
      })
    },
    { immediate: true },
  )

  const viewportStyle = computed<CSSProperties>(() => {
    if (!viewport.value) return {}
    return {
      '--visual-viewport-height': `${viewport.value.height}px`,
      '--visual-viewport-width': `${viewport.value.width}px`,
      '--visual-viewport-top': `${viewport.value.top}px`,
      '--visual-viewport-left': `${viewport.value.left}px`,
    }
  })

  return { viewport, viewportStyle }
}
