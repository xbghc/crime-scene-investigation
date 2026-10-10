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
  cssZoom: number
}

function effectiveDocumentZoom() {
  // The dialog is teleported to body. CSS zoom on either ancestor scales its
  // pixel lengths again, unlike browser/pinch zoom (already reflected by vv).
  return [document.documentElement, document.body].reduce((scale, element) => {
    if (!element) return scale
    const value = window.getComputedStyle(element).zoom ?? ''
    const zoom = Number.parseFloat(value)
    if (!Number.isFinite(zoom) || zoom <= 0) return scale
    return scale * (value.trim().endsWith('%') ? zoom / 100 : zoom)
  }, 1)
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
        const cssZoom = effectiveDocumentZoom()
        const bounds = {
          height: (visualViewport?.height ?? window.innerHeight) / cssZoom,
          width: (visualViewport?.width ?? window.innerWidth) / cssZoom,
          top: (visualViewport?.offsetTop ?? 0) / cssZoom,
          left: (visualViewport?.offsetLeft ?? 0) / cssZoom,
          cssZoom,
        }
        const previous = viewport.value
        if (
          !previous ||
          previous.height !== bounds.height ||
          previous.width !== bounds.width ||
          previous.top !== bounds.top ||
          previous.left !== bounds.left ||
          previous.cssZoom !== bounds.cssZoom
        ) {
          viewport.value = bounds
        }
      }

      update()
      visualViewport?.addEventListener('resize', update)
      visualViewport?.addEventListener('scroll', update)
      window.addEventListener('resize', update)
      // Changing CSS zoom need not emit a viewport resize event. Also handle
      // class-based accessibility zoom toggled while the dialog is already open.
      const styleObserver = new MutationObserver(update)
      for (const element of [document.documentElement, document.body]) {
        if (element) {
          styleObserver.observe(element, { attributes: true, attributeFilter: ['style', 'class'] })
        }
      }
      onCleanup(() => {
        styleObserver.disconnect()
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
