import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useGameStore } from '../game'
import type { GameState } from '../../types'

const card = { id: 'E08', name: '信息泄露', effect: '公开一张凶手所选的牌' }
const snapshot: GameState = {
  phase: 'advance-1',
  round: 1,
  players: [],
  boards: [],
  myRole: 'witness',
  effectCard: card,
  pendingEffect: { effectId: 'E08', cardIds: ['M001', 'C001'], optional: true },
}

beforeEach(() => setActivePinia(createPinia()))

describe('effect state privacy and recovery', () => {
  it('restores pending witness eligibility and clears transient submission state', () => {
    const store = useGameStore()
    store.syncFullState(snapshot)
    expect(store.pendingEffect).toEqual(snapshot.pendingEffect)
    expect(store.beginEffectAction('E08')).toBe(true)
    expect(store.beginEffectAction('E08')).toBe(false)
    store.syncFullState(snapshot)
    expect(store.effectSubmitting).toBe(false)
    expect(store.pendingEffect).toEqual(snapshot.pendingEffect)
    expect(store.effectAnnouncement).toBe(0)
  })

  it('never retains eligible solution IDs for another role or outside an advance', () => {
    const store = useGameStore()
    store.syncFullState(snapshot)
    store.syncFullState({ ...snapshot, myRole: 'detective' })
    expect(store.pendingEffect).toBeNull()
    store.syncFullState({ ...snapshot, phase: 'discussion-2' })
    expect(store.pendingEffect).toBeNull()
    store.syncFullState(snapshot)
    store.setMyInfo('p1', 'murderer')
    expect(store.pendingEffect).toBeNull()
  })

  it('announces live draws once, but not completion or a snapshot of the same effect', () => {
    const store = useGameStore()
    store.setEffectCard(card)
    expect(store.effectAnnouncement).toBe(1)
    store.syncFullState(snapshot)
    store.setEffectCard({ ...card }, { applied: true, pointedCardId: 'M001' })
    expect(store.effectAnnouncement).toBe(1)
    store.syncFullState({
      ...snapshot,
      pendingEffect: null,
      effectResult: { applied: true, pointedCardId: 'M001' },
    })
    expect(store.effectAnnouncement).toBe(1)
    expect(store.effectResult?.pointedCardId).toBe('M001')
  })

  it('keeps the public result after advance ends, and clears it on omitted snapshot or reset', () => {
    const store = useGameStore()
    store.syncFullState({ ...snapshot, effectResult: { applied: true, pointedCardId: 'C001' } })
    store.setPhase('discussion-2')
    expect(store.pendingEffect).toBeNull()
    expect(store.effectResult?.pointedCardId).toBe('C001')
    expect(store.effectCard).toEqual(card)
    store.syncFullState({ phase: 'discussion-2', round: 2, players: [], boards: [] })
    expect(store.effectResult).toBeUndefined()
    expect(store.effectCard).toBeUndefined()
    store.syncFullState(snapshot)
    store.reset()
    expect(store.effectCard).toBeUndefined()
    expect(store.effectResult).toBeUndefined()
    expect(store.pendingEffect).toBeNull()
  })
  it('clears the previous public effect when entering a new advance and announces its next draw', () => {
    const store = useGameStore()
    store.syncFullState({ ...snapshot, effectResult: { applied: true, pointedCardId: 'C001' } })
    store.setPhase('discussion-2')
    expect(store.effectCard).toEqual(card)
    store.setPhase('advance-2')
    expect(store.effectCard).toBeUndefined()
    expect(store.effectResult).toBeUndefined()
    store.setEffectCard(card)
    expect(store.effectAnnouncement).toBe(1)
    store.setPhase('advance-2')
    expect(store.effectCard).toEqual(card)
  })
  it('clears the public effect on live game-over and normalizes null snapshot fields', () => {
    const store = useGameStore()
    store.syncFullState({ ...snapshot, effectResult: { applied: true, pointedCardId: 'C001' } })
    store.setGameOver('detective', {})
    expect(store.effectCard).toBeUndefined()
    expect(store.effectResult).toBeUndefined()
    store.syncFullState({ ...snapshot, effectCard: null, effectResult: null })
    expect(store.effectCard).toBeUndefined()
    expect(store.effectResult).toBeUndefined()
  })
})
