import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref, type App } from 'vue'
import { useVisualViewport } from '../useVisualViewport'

let app: App | undefined
let container: HTMLDivElement | undefined

afterEach(() => {
  app?.unmount()
  container?.remove()
  document.documentElement.removeAttribute('style')
  document.body.removeAttribute('style')
  document.documentElement.classList.remove('zoomed')
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
  it('normalizes CSS zoom changes and keyboard pan without waiting for viewport resize', async () => {
    const visualViewport = Object.assign(new EventTarget(), {
      height: 800,
      width: 1200,
      offsetTop: 0,
      offsetLeft: 0,
      scale: 1,
    })
    vi.stubGlobal('visualViewport', visualViewport)
    vi.spyOn(window, 'getComputedStyle').mockImplementation(
      (element) =>
        ({
          zoom: element.getAttribute('style')?.match(/zoom:\s*([^;]+)/)?.[1] || '1',
        }) as CSSStyleDeclaration,
    )
    const { viewportStyle, viewport } = mountViewport()
    // jsdom does not implement CSS zoom; model its computed value but keep the
    // real style-attribute mutation and MutationObserver lifecycle under test.
    document.documentElement.setAttribute('style', 'zoom: 2')
    await nextTick()
    expect(viewportStyle.value['--visual-viewport-width']).toBe('600px')
    expect(viewportStyle.value['--visual-viewport-height']).toBe('400px')
    expect(viewport.value?.cssZoom).toBe(2)

    Object.assign(visualViewport, { height: 300, offsetTop: 80, offsetLeft: 20 })
    visualViewport.dispatchEvent(new Event('resize'))
    expect(viewportStyle.value).toEqual({
      '--visual-viewport-height': '150px',
      '--visual-viewport-width': '600px',
      '--visual-viewport-top': '40px',
      '--visual-viewport-left': '10px',
    })

    document.documentElement.removeAttribute('style')
    await nextTick()
    expect(viewportStyle.value['--visual-viewport-height']).toBe('300px')
    expect(viewportStyle.value['--visual-viewport-top']).toBe('80px')

    // Pinch zoom is already represented by the reported visual viewport size.
    Object.assign(visualViewport, { scale: 2, width: 600 })
    visualViewport.dispatchEvent(new Event('resize'))
    expect(viewportStyle.value['--visual-viewport-width']).toBe('600px')
  })

  it('combines html/body CSS zoom, including percentage and class-based values', async () => {
    vi.stubGlobal('visualViewport', undefined)
    vi.stubGlobal('innerHeight', 900)
    vi.stubGlobal('innerWidth', 1200)
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      const zoom =
        element === document.documentElement && element.classList.contains('zoomed')
          ? '150%'
          : element.getAttribute('style')?.match(/zoom:\s*([^;]+)/)?.[1] || 'normal'
      return { zoom } as CSSStyleDeclaration
    })
    const { viewportStyle } = mountViewport()
    document.documentElement.classList.add('zoomed')
    document.body.setAttribute('style', 'zoom: 2')
    await nextTick()
    expect(viewportStyle.value['--visual-viewport-width']).toBe('400px')
    expect(viewportStyle.value['--visual-viewport-height']).toBe('300px')
  })

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
    const observerDisconnect = vi.spyOn(MutationObserver.prototype, 'disconnect')
    const enabled = ref(true)
    const { viewportStyle } = mountViewport(enabled)

    enabled.value = false
    await nextTick()
    expect(viewportRemove).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(viewportRemove).toHaveBeenCalledWith('scroll', expect.any(Function))
    expect(windowRemove).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(observerDisconnect).toHaveBeenCalledTimes(1)
    visualViewport.height = 300
    visualViewport.dispatchEvent(new Event('resize'))
    expect(viewportStyle.value).toEqual({})

    enabled.value = true
    await nextTick()
    expect(viewportStyle.value['--visual-viewport-height']).toBe('300px')
    app?.unmount()
    app = undefined
    expect(viewportRemove).toHaveBeenCalledTimes(4)
    expect(observerDisconnect).toHaveBeenCalledTimes(2)
    visualViewport.height = 500
    visualViewport.dispatchEvent(new Event('resize'))
    expect(viewportStyle.value['--visual-viewport-height']).toBe('300px')
  })
})
