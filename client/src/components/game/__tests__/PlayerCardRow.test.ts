import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, reactive, type App } from 'vue'
import PlayerCardRow from '../PlayerCardRow.vue'
import { mockPlayers } from '../../../__mocks__/gameData'

let app: App | undefined
let container: HTMLDivElement
beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
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
  const player = reactive(structuredClone(mockPlayers[1]!))
  app = createApp({ render: () => h(PlayerCardRow, { player }) })
  app.mount(container)
  await nextTick()
  return player
}
async function tick() {
  await nextTick()
  await nextTick()
}
function button(text: string) {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(
    (element) => element.textContent?.trim() === text,
  )!
}

describe('readable player card inspection', () => {
  it('opens the selected card, navigates across types and returns focus on close', async () => {
    await mount()
    const opener = container.querySelectorAll<HTMLButtonElement>('.player-card-row__thumb')[3]!
    expect(opener.getAttribute('aria-haspopup')).toBe('dialog')
    opener.focus()
    opener.click()
    await tick()
    expect(document.querySelector('.card-detail__name')?.textContent).toBe('枕头')
    button('下一张').click()
    await tick()
    expect(document.querySelector('.card-detail__name')?.textContent).toBe('血迹')
    expect(document.querySelector('.card-detail__owner')?.textContent).toContain('线索牌')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await tick()
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
    expect(document.activeElement).toBe(opener)
  })
  it('bounds previous/next controls at the ends of the public hand', async () => {
    await mount()
    container.querySelector<HTMLButtonElement>('.player-card-row__thumb')!.click()
    await tick()
    expect(button('上一张').disabled).toBe(true)
    for (let i = 0; i < 7; i++) {
      button('下一张').click()
      await tick()
    }
    expect(button('下一张').disabled).toBe(true)
    expect(document.querySelector('.card-detail__name')?.textContent).toBe('手套')
  })
  it('closes a stale card detail when effects replace the public hand', async () => {
    const player = await mount()
    container.querySelector<HTMLButtonElement>('.player-card-row__thumb')!.click()
    await tick()
    player.meansCards = [{ id: 'M012', name: '铁管' }]
    await tick()
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
    expect(container.textContent).toContain('铁管')
    expect(container.querySelectorAll('.player-card-row__thumb')).toHaveLength(5)
  })
})
