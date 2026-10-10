import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GameEngine } from '../GameEngine.js'
import { ALL_EFFECT_CARDS } from '../../data/cards.js'
import type {
  EffectActionData,
  EffectCardRef,
  PendingEffect,
  PlayerState,
  PublicBoard,
  SceneBoardState,
} from '../../types.js'

const INTERACTIVE_EFFECTS = ['E01', 'E03', 'E05', 'E08'] as const
const MANDATORY_EFFECTS = ['E01', 'E03', 'E05'] as const

function mockIO() {
  const sockets = new Map()
  const roomEmit = vi.fn()
  return { sockets: { sockets }, to: vi.fn(() => ({ emit: roomEmit })), roomEmit }
}

describe('playable effect lifecycle', () => {
  let engine: GameEngine
  let io: ReturnType<typeof mockIO>
  let players: PlayerState[]
  let witness: PlayerState
  let murderer: PlayerState
  let detectives: PlayerState[]

  beforeEach(() => {
    vi.useFakeTimers()
    io = mockIO()
    engine = new GameEngine(io as any)
    players = Array.from({ length: 4 }, (_, index) => {
      const id = `player-${index}`
      io.sockets.sockets.set(id, {
        emit: vi.fn(),
        data: { userId: id, roomCode: 'test-room' },
      })
      return engine.addPlayer(id, `玩家${index}`, id)!
    })
    engine.startGame()
    engine.triggerNightMurder()
    witness = players.find((p) => p.role === 'witness')!
    murderer = players.find((p) => p.role === 'murderer')!
    detectives = players.filter((p) => p.role === 'detective')
    expect(
      engine.handleMurdererSelect(murderer.id, murderer.meansCards[0].id, murderer.clueCards[0].id),
    ).toEqual({ ok: true })
    expect(engine.handleWitnessConfirmMurder(witness.id)).toEqual({ ok: true })
    engine.getActiveBoards().forEach((b, i) => {
      expect(engine.handleWitnessSetMarker(witness.id, b.id, 0, i + 1)).toEqual({ ok: true })
    })
    expect(engine.handleWitnessConfirmAccuse(witness.id)).toEqual({ ok: true })
    vi.clearAllMocks()
  })

  afterEach(() => {
    engine.dispose()
    vi.useRealTimers()
  })

  function state(id = witness.id) {
    return engine.getGameStateForPlayer(id)
  }

  function draw(effectId: string | null) {
    engine.setEffectDeckForTest(
      effectId ? [ALL_EFFECT_CARDS.find((card) => card.id === effectId)!] : [],
    )
    expect(engine.handleEndDiscussion(witness.id)).toEqual({ ok: true })
  }

  function validData(effectId: string): EffectActionData {
    if (effectId === 'E01' || effectId === 'E03') return { targetId: detectives[0].id }
    if (effectId === 'E05') return { boardId: engine.getActiveBoards()[0].id }
    return { cardId: engine.getSolution()!.meansCard.id }
  }

  function replaceBoards() {
    for (const board of state().newBoards as PublicBoard[]) {
      const old = engine.getActiveBoards().find((b) => b.type !== 'cause')!
      expect(
        engine.handleWitnessReplaceBoard(
          witness.id,
          old.id,
          board.id,
          0,
          old.marker?.markerNumber ?? 2,
        ),
      ).toEqual({ ok: true })
    }
  }

  it.each(INTERACTIVE_EFFECTS)(
    '%s publishes the drawn card but keeps eligible choices witness-only',
    (effectId) => {
      draw(effectId)
      const pending = state().pendingEffect as PendingEffect
      expect(pending).toMatchObject({ effectId, optional: effectId === 'E08' })
      if (effectId === 'E01') {
        expect(pending.targetIds).toEqual(
          players.filter((p) => p.role !== 'witness').map((p) => p.id),
        )
      } else if (effectId === 'E03') {
        expect(pending.targetIds).toEqual(detectives.map((p) => p.id))
      } else if (effectId === 'E05') {
        expect(pending.boardIds).toEqual(engine.getActiveBoards().map((b) => b.id))
      } else {
        expect(pending.cardIds).toEqual([
          engine.getSolution()!.meansCard.id,
          engine.getSolution()!.clueCard.id,
        ])
      }
      expect(io.sockets.sockets.get(witness.id).emit).toHaveBeenCalledWith('effect_pending', {
        pendingEffect: pending,
      })
      expect(io.roomEmit.mock.calls.some(([name]) => name === 'effect_pending')).toBe(false)
      for (const player of players) {
        const snapshot = state(player.id)
        expect(snapshot.effectCard).toEqual(ALL_EFFECT_CARDS.find((card) => card.id === effectId))
        expect(snapshot.effectResult).toEqual({
          applied: false,
          requiresWitnessAction: true,
          effectId,
        })
        if (player.role !== 'witness') {
          expect(snapshot).not.toHaveProperty('pendingEffect')
          expect(snapshot).not.toHaveProperty('newBoards')
          expect(
            io.sockets.sockets
              .get(player.id)
              .emit.mock.calls.some(([name]: [string]) => name === 'effect_pending'),
          ).toBe(false)
        }
        if (player.role === 'detective') {
          expect(snapshot).not.toHaveProperty('murdererSelection')
          expect((snapshot.players as any[]).find((p) => p.id === murderer.id).role).toBeUndefined()
        }
      }
    },
  )

  it('computes E01 candidates from life status, including offline players and spent solve rights', () => {
    detectives[0].hasSolveRight = false
    engine.handleDisconnect(detectives[0].id)
    detectives[1].status = 'dead'
    draw('E01')
    expect((state().pendingEffect as PendingEffect).targetIds).toEqual(
      players.filter((p) => p.role !== 'witness' && p.status === 'alive').map((p) => p.id),
    )
    expect(engine.handleEffectAction(witness.id, 'E01', { targetId: detectives[0].id })).toEqual({
      ok: true,
    })
  })

  it('E03 can clear a dead innocent player without disclosing their role', () => {
    detectives[0].status = 'dead'
    draw('E03')
    expect((state().pendingEffect as PendingEffect).targetIds).toContain(detectives[0].id)
    expect(engine.handleEffectAction(witness.id, 'E03', { targetId: detectives[0].id })).toEqual({
      ok: true,
    })
    expect(state(detectives[1].id).effectResult).toMatchObject({
      applied: true,
      targetId: detectives[0].id,
    })
    expect(
      (state(detectives[1].id).players as any[]).find((p) => p.id === detectives[0].id).role,
    ).toBeUndefined()
  })

  it.each(MANDATORY_EFFECTS)(
    '%s blocks replacements and finish until one valid effect, without arbitrary skip',
    (effectId) => {
      draw(effectId)
      const before = structuredClone(state())
      const old = engine.getActiveBoards().find((b) => b.type !== 'cause')!
      const board = (state().newBoards as PublicBoard[])[0]
      expect(engine.handleWitnessReplaceBoard(witness.id, old.id, board.id, 0, 2).ok).toBe(false)
      expect(engine.handleWitnessFinishAdvance(witness.id).ok).toBe(false)
      engine.finishAdvancePhase()
      expect(engine.getPhase()).toBe('advance-1')
      expect(engine.handleEffectAction(witness.id, effectId, { skip: true }).ok).toBe(false)
      expect(engine.handleEffectAction(witness.id, effectId, {}).ok).toBe(false)
      expect(state()).toEqual(before)
      expect(engine.handleEffectAction(witness.id, effectId, validData(effectId))).toEqual({
        ok: true,
      })
      expect(state().pendingEffect).toBeNull()
      expect(engine.handleEffectAction(witness.id, effectId, validData(effectId)).ok).toBe(false)
      expect(state().advanceReady).toBe(false)
      replaceBoards()
      expect(state().advanceReady).toBe(true)
      expect(engine.handleWitnessFinishAdvance(witness.id)).toEqual({ ok: true })
      expect(engine.getPhase()).toBe('discussion-2')
      expect(state()).not.toHaveProperty('pendingEffect')
      expect(state().effectResult).toMatchObject({ applied: true })
    },
  )

  it.each(MANDATORY_EFFECTS)(
    '%s resolves impossible mandatory choices without deadlocking replacement',
    (effectId) => {
      if (effectId === 'E01') {
        players
          .filter((p) => p.role !== 'witness')
          .forEach((p) => {
            p.status = 'dead'
          })
      } else if (effectId === 'E05') {
        engine.getActiveBoards().forEach((board) => {
          board.marker = undefined
        })
      } else {
        // Defensive impossible-state fixture: a normal four-player round always has innocents.
        ;(engine as any).state.players = [witness, murderer]
      }
      draw(effectId)
      expect(state().pendingEffect).toBeNull()
      expect(state().effectResult).toMatchObject({
        applied: false,
        message: expect.stringContaining('此效果已结束'),
      })
      expect(engine.handleEffectAction(witness.id, effectId, validData(effectId)).ok).toBe(false)
      replaceBoards()
      expect(engine.handleWitnessFinishAdvance(witness.id)).toEqual({ ok: true })
    },
  )

  it.each(INTERACTIVE_EFFECTS)(
    '%s stays pending with an empty scene pool and can still complete',
    (effectId) => {
      ;(engine.getSceneBoardPool() as SceneBoardState[]).splice(0)
      draw(effectId)
      expect(engine.getPhase()).toBe('advance-1')
      expect(state().newBoards).toEqual([])
      expect(state().advanceReady).toBe(false)
      expect(engine.handleWitnessFinishAdvance(witness.id).ok).toBe(false)
      expect(engine.handleEffectAction(witness.id, effectId, validData(effectId))).toEqual({
        ok: true,
      })
      expect(state().advanceReady).toBe(true)
      expect(engine.handleWitnessFinishAdvance(witness.id)).toEqual({ ok: true })
    },
  )

  it('E05 marker removal cannot be undone by witness_set_marker, while normal replacement remains possible', () => {
    draw('E05')
    const board = engine.getActiveBoards()[0]
    const marker = board.marker!
    expect(
      engine.handleWitnessSetMarker(witness.id, board.id, marker.optionIndex, marker.markerNumber)
        .ok,
    ).toBe(false)
    expect(board.marker).toEqual(marker)
    expect(engine.handleEffectAction(witness.id, 'E05', { boardId: board.id })).toEqual({
      ok: true,
    })
    expect(
      engine.handleWitnessSetMarker(witness.id, board.id, marker.optionIndex, marker.markerNumber)
        .ok,
    ).toBe(false)
    expect(board.marker).toBeUndefined()
    replaceBoards()
    expect(engine.handleWitnessFinishAdvance(witness.id)).toEqual({ ok: true })
    expect(board.marker).toBeUndefined()
  })

  it('E08 can explicitly skip, persists the outcome, and cannot be revealed afterward', () => {
    draw('E08')
    replaceBoards()
    expect(state().advanceReady).toBe(false)
    expect(engine.handleWitnessFinishAdvance(witness.id).ok).toBe(false)
    expect(engine.handleEffectAction(witness.id, 'E08', { skip: true })).toEqual({ ok: true })
    expect(state().pendingEffect).toBeNull()
    expect(state().advanceReady).toBe(true)
    expect(state(detectives[0].id).effectResult).toMatchObject({ applied: false, skipped: true })
    expect(state(detectives[0].id).effectResult).not.toHaveProperty('pointedCardId')
    expect(engine.handleEffectAction(witness.id, 'E08', validData('E08')).ok).toBe(false)
    expect(engine.handleWitnessFinishAdvance(witness.id)).toEqual({ ok: true })
    expect(state(detectives[0].id).effectResult).toMatchObject({ skipped: true })
  })

  it.each(['meansCard', 'clueCard'] as const)(
    'E08 publishes the %s name/category with the complete effect card',
    (kind) => {
      draw('E08')
      const card = engine.getSolution()![kind]
      expect(engine.handleEffectAction(witness.id, 'E08', { cardId: card.id })).toEqual({
        ok: true,
      })
      const snapshot = state(detectives[0].id)
      expect(snapshot.effectCard).toEqual(ALL_EFFECT_CARDS.find((c) => c.id === 'E08'))
      expect((snapshot.effectCard as EffectCardRef).effect).not.toBe('')
      expect(snapshot.effectResult).toEqual({
        applied: true,
        pointedCardId: card.id,
        message: `目击者指向了凶手所选的${kind === 'meansCard' ? '手段牌' : '线索牌'}「${card.name}」`,
      })
      expect(snapshot).not.toHaveProperty('murdererSelection')
      expect(snapshot.effectResult).not.toHaveProperty('cardIds')
    },
  )

  it('E01 immediately broadcasts death and lost solve rights, while pending metadata remains private', () => {
    draw('E01')
    vi.clearAllMocks()
    expect(engine.handleEffectAction(witness.id, 'E01', validData('E01'))).toEqual({ ok: true })
    for (const player of players) {
      const calls = io.sockets.sockets.get(player.id).emit.mock.calls
      const snapshot = calls.find(([name]: [string]) => name === 'full_state')[1]
      expect(snapshot.effectResult).toMatchObject({ applied: true, targetId: detectives[0].id })
      expect(snapshot.players.find((p: PlayerState) => p.id === detectives[0].id)).toMatchObject({
        status: 'dead',
        hasSolveRight: false,
      })
      if (player.role !== 'witness') expect(snapshot).not.toHaveProperty('pendingEffect')
    }
    expect(io.sockets.sockets.get(witness.id).emit).toHaveBeenCalledWith('effect_pending', {
      pendingEffect: null,
    })
  })

  it('E07 stays automatic and never needs an effect action before finishing', () => {
    draw('E07')
    expect(state().pendingEffect).toBeNull()
    expect(state().effectResult).toEqual({ applied: true, blackout: true })
    expect(state(detectives[0].id).boards).toEqual([])
    replaceBoards()
    expect(state().advanceReady).toBe(true)
    expect(engine.handleWitnessFinishAdvance(witness.id)).toEqual({ ok: true })
    expect(state(detectives[0].id).boards).toEqual([])
    expect(state(detectives[0].id).effectResult).toEqual({ applied: true, blackout: true })
  })

  it.each(['E04', 'E06', 'E10'])(
    '%s remains explicitly unsupported without blocking advance',
    (effectId) => {
      draw(effectId)
      expect(state().pendingEffect).toBeNull()
      expect(state().effectResult).toMatchObject({
        applied: false,
        unsupported: true,
        message: expect.stringContaining('暂未实现'),
      })
      expect(engine.handleEffectAction(witness.id, effectId, {}).ok).toBe(false)
      replaceBoards()
      expect(engine.handleWitnessFinishAdvance(witness.id)).toEqual({ ok: true })
    },
  )

  it('a new advance clears the previous public outcome, even with an empty effect deck', () => {
    draw('E08')
    expect(engine.handleEffectAction(witness.id, 'E08', validData('E08'))).toEqual({ ok: true })
    replaceBoards()
    expect(engine.handleWitnessFinishAdvance(witness.id)).toEqual({ ok: true })
    expect(state().effectResult).toMatchObject({ applied: true })
    draw(null)
    expect(state()).toMatchObject({ effectCard: null, effectResult: null, pendingEffect: null })
  })

  it.each(['resetGame', 'resetToInitial', 'gameOver'] as const)(
    '%s clears pending and public effect state',
    (operation) => {
      draw('E08')
      if (operation === 'gameOver') engine.triggerEndGame('murderer')
      else engine[operation]()
      expect(io.sockets.sockets.get(witness.id).emit).toHaveBeenCalledWith('effect_pending', {
        pendingEffect: null,
      })
      if (operation === 'resetToInitial') {
        engine.addPlayer(witness.id, witness.nickname, witness.id)
      }
      expect(state()).toMatchObject({ effectCard: null, effectResult: null })
      expect(state()).not.toHaveProperty('pendingEffect')
      expect(engine.handleEffectAction(witness.id, 'E08', { skip: true }).ok).toBe(false)
    },
  )
})
