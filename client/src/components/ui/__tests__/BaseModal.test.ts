import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref, type App } from 'vue'
import BaseModal from '../BaseModal.vue'

let app: App | undefined
let container: HTMLDivElement
const open = ref(false)

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  open.value = false
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([
    { width: 1 },
  ] as unknown as DOMRectList)
})
afterEach(() => {
  app?.unmount()
  container.remove()
  document.querySelectorAll('.modal-overlay').forEach((element) => element.remove())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
async function mount() {
  app = createApp({
    setup: () => () =>
      h('div', [
        h(
          'button',
          {
            id: 'opener',
            onClick: () => {
              open.value = true
            },
          },
          '打开',
        ),
        h(
          BaseModal,
          {
            modelValue: open.value,
            title: '确认操作',
            'onUpdate:modelValue': (value: boolean) => {
              open.value = value
            },
          },
          {
            default: () => h('input', { 'aria-label': '内容' }),
            footer: () => h('button', { id: 'last' }, '保存'),
          },
        ),
      ]),
  })
  app.mount(container)
  const opener = document.querySelector<HTMLButtonElement>('#opener')!
  opener.focus()
  opener.click()
  await nextTick()
  await nextTick()
  return opener
}

describe('BaseModal keyboard accessibility', () => {
  it('names the dialog, focuses close, closes with Escape and restores focus', async () => {
    const opener = await mount()
    const dialog = document.querySelector('[role="dialog"]')!
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe(
      '确认操作',
    )
    expect(document.activeElement?.getAttribute('aria-label')).toBe('关闭')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(open.value).toBe(false)
    expect(document.activeElement).toBe(opener)
  })
  it('keeps forward and reverse Tab navigation within the dialog', async () => {
    await mount()
    const close = document.querySelector<HTMLButtonElement>('.modal-close')!
    const last = document.querySelector<HTMLButtonElement>('#last')!
    close.focus()
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
    )
    expect(document.activeElement).toBe(last)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(close)
  })
  it('does not let an underlying dialog consume Escape', async () => {
    await mount()
    const upper = document.createElement('div')
    upper.dataset.baseDialog = ''
    document.body.append(upper)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(open.value).toBe(true)
    upper.remove()
  })
  it.each([1, 2])(
    'adapts keyboard bounds and focused-field scrolling at CSS zoom %sx',
    async (cssZoom) => {
      const getComputedStyle = window.getComputedStyle
      vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
        const style = getComputedStyle(element)
        if (element === document.documentElement) {
          Object.defineProperty(style, 'zoom', { value: String(cssZoom), configurable: true })
        }
        return style
      })
      const visualViewport = Object.assign(new EventTarget(), {
        height: 844,
        width: 390,
        offsetTop: 0,
        offsetLeft: 0,
      })
      vi.stubGlobal('visualViewport', visualViewport)
      await mount()
      const overlay = document.querySelector<HTMLElement>('.modal-overlay')!
      const body = document.querySelector<HTMLElement>('.modal-body')!
      const input = body.querySelector('input')!
      input.focus()
      vi.spyOn(body, 'getBoundingClientRect').mockReturnValue({
        top: 100,
        bottom: 280,
      } as DOMRect)
      vi.spyOn(input, 'getBoundingClientRect').mockReturnValue({
        top: 300,
        bottom: 344,
      } as DOMRect)

      visualViewport.height = 360
      visualViewport.offsetTop = 50
      visualViewport.dispatchEvent(new Event('resize'))
      await nextTick()
      await nextTick()
      expect(overlay.style.getPropertyValue('--visual-viewport-height')).toBe(`${360 / cssZoom}px`)
      expect(overlay.style.getPropertyValue('--visual-viewport-top')).toBe(`${50 / cssZoom}px`)
      expect(overlay.classList.contains('modal-overlay--compact')).toBe(true)
      expect(body.scrollTop).toBe(64 / cssZoom + 12)
      expect(document.activeElement).toBe(input)

      visualViewport.height = 844
      visualViewport.offsetTop = 0
      visualViewport.dispatchEvent(new Event('resize'))
      await nextTick()
      expect(overlay.classList.contains('modal-overlay--compact')).toBe(844 / cssZoom <= 500)
    },
  )
  it('keeps fullscreen dismissal explicit and its dialog accessible', async () => {
    open.value = true
    app = createApp({
      setup: () => () =>
        h(
          BaseModal,
          {
            modelValue: open.value,
            fullscreen: true,
            ariaLabel: '破案',
            'onUpdate:modelValue': (value: boolean) => {
              open.value = value
            },
          },
          { default: () => h('button', { id: 'cancel' }, '取消') },
        ),
    })
    app.mount(container)
    await nextTick()
    await nextTick()
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('破案')
    expect(document.activeElement?.id).toBe('cancel')
    document.querySelector<HTMLElement>('.modal-overlay')!.click()
    expect(open.value).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(open.value).toBe(false)
  })
  it('preserves focus in the upper dialog when a lower timed dialog opens and closes', async () => {
    const lower = ref(false)
    const upper = ref(true)
    app = createApp({
      setup: () => () =>
        h('div', [
          h(BaseModal, { modelValue: lower.value, title: '阶段变更' }),
          h(BaseModal, {
            modelValue: upper.value,
            title: '重置游戏',
            'onUpdate:modelValue': (value: boolean) => {
              upper.value = value
            },
          }),
        ]),
    })
    app.mount(container)
    await nextTick()
    await nextTick()
    const upperDialog = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).find(
      (element) => element.textContent?.includes('重置游戏'),
    )!
    const upperClose = upperDialog.querySelector<HTMLButtonElement>('button')!
    upperClose.focus()
    lower.value = true
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(upperClose)
    lower.value = false
    await nextTick()
    expect(document.activeElement).toBe(upperClose)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(upper.value).toBe(false)
  })
})
