import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, reactive, type App } from 'vue'
import CardArtwork from '../CardArtwork.vue'
import GameCard from '../GameCard.vue'
import SceneBoardPanel from '../SceneBoardPanel.vue'

let app: App | undefined
let container: HTMLDivElement | undefined

afterEach(() => {
  app?.unmount()
  container?.remove()
})

async function mount(render: () => ReturnType<typeof h>) {
  container = document.createElement('div')
  document.body.append(container)
  app = createApp({ render })
  app.mount(container)
  await nextTick()
}

async function failImages() {
  container!.querySelectorAll('img').forEach((image) => image.dispatchEvent(new Event('error')))
  await nextTick()
}

describe('decorative card artwork', () => {
  it('replaces broken artwork with a neutral icon in the same portrait or square frame', async () => {
    await mount(() =>
      h('div', [
        h(CardArtwork, { src: '/broken-card.png', class: 'original-card-hook' }),
        h(CardArtwork, { src: '/broken-board.png', shape: 'square', class: 'original-board-hook' }),
      ]),
    )
    expect(container!.querySelectorAll('img[alt=""]')).toHaveLength(2)
    await failImages()
    expect(container!.querySelector('img')).toBeNull()
    expect(container!.querySelectorAll('[data-testid="artwork-fallback"] svg')).toHaveLength(2)
    expect(container!.querySelector('.original-card-hook.card-artwork--portrait')).not.toBeNull()
    expect(container!.querySelector('.original-board-hook.card-artwork--square')).not.toBeNull()
  })

  it('retries a new src after a previous image fails', async () => {
    const props = reactive({ src: '/broken.png' })
    await mount(() => h(CardArtwork, props))
    await failImages()
    expect(container!.querySelector('img')).toBeNull()
    props.src = '/replacement.png'
    await nextTick()
    const image = container!.querySelector('img')!
    expect(image.getAttribute('src')).toBe('/replacement.png')
    expect(image.alt).toBe('')
    expect(container!.querySelector('[data-testid="artwork-fallback"]')).toBeNull()
    image.dispatchEvent(new Event('load'))
    await nextTick()
    expect(container!.querySelector('img')).toBe(image)
  })

  it('preserves adjacent card names, board titles and card actions without duplicate image labels', async () => {
    const onClick = vi.fn()
    await mount(() =>
      h('div', [
        h(GameCard, { type: 'clue', id: 'C096', name: '重要线索', onClick }),
        h(SceneBoardPanel, {
          board: { id: 'B-CAUSE', type: 'cause', title: '死亡原因', options: ['失血'] },
        }),
      ]),
    )
    await failImages()
    const card = container!.querySelector<HTMLButtonElement>('button.game-card')!
    expect(card.textContent?.trim()).toBe('重要线索')
    expect(container!.querySelector('.scene-board__title')?.textContent).toBe('死亡原因')
    expect(container!.querySelectorAll('.card-artwork[aria-hidden="true"]')).toHaveLength(2)
    expect(container!.querySelector('img[alt]:not([alt=""])')).toBeNull()
    card.click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
