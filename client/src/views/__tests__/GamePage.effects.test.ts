import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref, type App } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from '../../stores/game'
import GamePage from '../GamePage.vue'
import type { GameState } from '../../types'

vi.mock('vue-router', () => ({ useRouter: () => ({ replace: vi.fn() }) }))
vi.mock('../../composables/useSocket', () => ({
  useSocket: () => ({
    connected: ref(true),
    roomPending: ref(null),
    connect: vi.fn(),
    resetGame: vi.fn(),
    effectAction: vi.fn(),
    witnessFinishAdvance: vi.fn(),
  }),
}))

let app: App | undefined
let container: HTMLDivElement | undefined
const card = { id: 'E08', name: '信息泄露', effect: '目击者可以公开凶手所选的一张牌' }
const state: GameState = {
  phase: 'advance-1',
  round: 1,
  myRole: 'witness',
  boards: [],
  players: [],
  effectCard: card,
  murdererSelection: {
    meansCard: { id: 'M001', name: '刀' },
    clueCard: { id: 'C001', name: '血迹' },
  },
  pendingEffect: { effectId: 'E08', cardIds: ['M001', 'C001'], optional: true },
}

beforeEach(() => setActivePinia(createPinia()))
afterEach(() => {
  app?.unmount()
  container?.remove()
  document.querySelectorAll('.modal-overlay').forEach((node) => node.remove())
})

async function mountGame() {
  container = document.createElement('div')
  document.body.append(container)
  app = createApp({ render: () => h(GamePage) })
  app.mount(container)
  await nextTick()
}
function effectDialog() {
  return [...document.querySelectorAll('[role="dialog"]')].find((dialog) =>
    dialog.textContent?.includes('信息泄露'),
  )
}

describe('effect announcements and persisted actions', () => {
  it('announces the live draw once despite the immediate full snapshot, and dismissal preserves the action', async () => {
    const game = useGameStore()
    game.setMyInfo('p1', 'witness')
    game.setPhase('advance-1')
    await mountGame()
    game.setPendingEffect(state.pendingEffect!)
    game.setEffectCard(card)
    game.syncFullState(state)
    await nextTick()
    expect(effectDialog()).toBeDefined()
    const dismiss = [...effectDialog()!.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === '知道了',
    )!
    dismiss.click()
    await nextTick()
    expect(game.effectCard).toEqual(card)
    expect(game.pendingEffect?.effectId).toBe('E08')
    expect(container!.querySelector('[data-testid="effect-action"]')).not.toBeNull()

    game.syncFullState({ ...state })
    await nextTick()
    expect(game.effectAnnouncement).toBe(1)
    // Vue transition may retain a leaving node briefly; an active dialog must not reappear.
    expect(document.querySelector('.modal-overlay:not(.modal-leave-active)')).toBeNull()
    game.setPendingEffect(null)
    game.setEffectCard(
      { ...card },
      { applied: true, pointedCardId: 'M001', message: '已公开手段牌：刀' },
    )
    game.syncFullState({
      ...state,
      pendingEffect: null,
      effectResult: { applied: true, pointedCardId: 'M001', message: '已公开手段牌：刀' },
    })
    await nextTick()
    expect(document.querySelector('.modal-overlay:not(.modal-leave-active)')).toBeNull()
    expect(container!.querySelector('[data-testid="effect-action"]')).toBeNull()
    expect(container!.querySelector('[data-testid="effect-result"]')?.textContent).toContain('刀')
  })

  it('restores a pending effect after refresh without replaying the announcement', async () => {
    const game = useGameStore()
    game.syncFullState(state)
    await mountGame()
    expect(effectDialog()).toBeUndefined()
    expect(container!.querySelector('[data-testid="effect-action"]')).not.toBeNull()
    expect(container!.textContent).toContain('血迹')
  })

  it('restores the public result for another role in discussion without showing private choices', async () => {
    const game = useGameStore()
    game.syncFullState({
      ...state,
      phase: 'discussion-2',
      myRole: 'detective',
      murdererSelection: undefined,
      pendingEffect: null,
      effectResult: { applied: true, pointedCardId: 'C001', message: '已公开线索牌：血迹' },
    })
    await mountGame()
    expect(effectDialog()).toBeUndefined()
    expect(container!.querySelector('[data-testid="effect-action"]')).toBeNull()
    expect(container!.querySelector('[data-testid="effect-result"]')?.textContent).toContain('血迹')
  })
})
