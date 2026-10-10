import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref, type App } from 'vue'
import { useVisualViewport } from '../useVisualViewport'

let app: App | undefined
let container: HTMLDivElement | undefined

afterEach(() => {
  app?.unmount()
  container?.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function mountViewport(enabled = ref(true)) {
  let result!: ReturnType<typeof useVisualViewport>
  container = document.createElement('div')
  document.body.append(container)
  app = createApp({
    setup() {
      result = useVisualViewport(enabled)
      return () => h('div', { style: result.viewportStyle.value })
    },
  })
  app.mount(container)
  return result
}

describe('useVisualViewport', () => {
  it('tracks keyboard resize, viewport pan and restored size', async () => {
    const visualViewport = Object.assign(new EventTarget(), {
      height: 844,
      width: 390,
      offsetTop: 0,
      offsetLeft: 0,
    })
    vi.stubGlobal('visualViewport', visualViewport)
    const { viewportStyle } = mountViewport()
    expect(viewportStyle.value['--visual-viewport-height']).toBe('844px')

    visualViewport.height = 350
    visualViewport.offsetTop = 90
    visualViewport.dispatchEvent(new Event('resize'))
    await nextTick()
    expect(viewportStyle.value).toEqual({
      '--visual-viewport-height': '350px',
      '--visual-viewport-width': '390px',
      '--visual-viewport-top': '90px',
      '--visual-viewport-left': '0px',
    })

    visualViewport.offsetTop = 100
    visualViewport.offsetLeft = 10
    visualViewport.dispatchEvent(new Event('scroll'))
    expect(viewportStyle.value['--visual-viewport-top']).toBe('100px')
    expect(viewportStyle.value['--visual-viewport-left']).toBe('10px')

    visualViewport.height = 844
    visualViewport.offsetTop = 0
    visualViewport.dispatchEvent(new Event('resize'))
    expect(viewportStyle.value['--visual-viewport-height']).toBe('844px')
    expect(viewportStyle.value['--visual-viewport-top']).toBe('0px')
  })

  it('falls back to window size when VisualViewport is unavailable', () => {
    vi.stubGlobal('visualViewport', undefined)
    vi.stubGlobal('innerHeight', 720)
    vi.stubGlobal('innerWidth', 1280)
    const { viewportStyle } = mountViewport()
    expect(viewportStyle.value['--visual-viewport-height']).toBe('720px')
    expect(viewportStyle.value['--visual-viewport-width']).toBe('1280px')
    vi.stubGlobal('innerHeight', 400)
    window.dispatchEvent(new Event('resize'))
    expect(viewportStyle.value['--visual-viewport-height']).toBe('400px')
    expect(viewportStyle.value['--visual-viewport-top']).toBe('0px')
  })

  it('removes all listeners when closed, restarts on reopen and cleans up on unmount', async () => {
    const visualViewport = Object.assign(new EventTarget(), {
      height: 844,
      width: 390,
      offsetTop: 0,
      offsetLeft: 0,
    })
    vi.stubGlobal('visualViewport', visualViewport)
    const viewportRemove = vi.spyOn(visualViewport, 'removeEventListener')
    const windowRemove = vi.spyOn(window, 'removeEventListener')
    const enabled = ref(true)
    const { viewportStyle } = mountViewport(enabled)

    enabled.value = false
    await nextTick()
    expect(viewportRemove).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(viewportRemove).toHaveBeenCalledWith('scroll', expect.any(Function))
    expect(windowRemove).toHaveBeenCalledWith('resize', expect.any(Function))
    visualViewport.height = 300
    visualViewport.dispatchEvent(new Event('resize'))
    expect(viewportStyle.value).toEqual({})

    enabled.value = true
    await nextTick()
    expect(viewportStyle.value['--visual-viewport-height']).toBe('300px')
    app?.unmount()
    app = undefined
    expect(viewportRemove).toHaveBeenCalledTimes(4)
    visualViewport.height = 500
    visualViewport.dispatchEvent(new Event('resize'))
    expect(viewportStyle.value['--visual-viewport-height']).toBe('300px')
  })
})
