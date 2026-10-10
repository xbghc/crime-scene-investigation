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
