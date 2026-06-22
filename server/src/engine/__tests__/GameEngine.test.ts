import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GameEngine } from '../GameEngine.js'
import { getRoleAssignment, getScores } from '../../types.js'
import type { PlayerState, EffectCardRef } from '../../types.js'

// === Mock Socket.IO ===

function createMockSocket(id: string) {
  return {
    id,
    emit: vi.fn(),
    data: { userId: id },
  }
}

function createMockIO() {
  const sockets = new Map<string, ReturnType<typeof createMockSocket>>()
  return {
    emit: vi.fn(),
    sockets: { sockets },
    _addSocket(sock: ReturnType<typeof createMockSocket>) {
      sockets.set(sock.id, sock)
    },
  }
}

type MockIO = ReturnType<typeof createMockIO>

interface PlayerInfo {
  userId: string
  nickname: string
  socketId: string
}

// === Helper: add N players and return their info ===

function addPlayers(engine: GameEngine, io: MockIO, count: number): PlayerInfo[] {
  const players: PlayerInfo[] = []
  for (let i = 0; i < count; i++) {
    const userId = `user-${i}`
    const nickname = `Player${i}`
    const socketId = `socket-${i}`
    const sock = createMockSocket(socketId)
    io._addSocket(sock)
    engine.addPlayer(userId, nickname, socketId)
    players.push({ userId, nickname, socketId })
  }
  return players
}

// === Helper: find the player with a specific role after startGame ===

function getPlayerByRole(
  engine: GameEngine,
  players: PlayerInfo[],
  role: string,
): PlayerState | undefined {
  for (const p of players) {
    const state = engine.getPlayerById(p.userId)
    if (state?.role === role) return state
  }
  return undefined
}

// === Phase advancement helpers (through public API) ===

function advanceToNightMurder(engine: GameEngine): void {
  engine.startGame()
  engine.triggerNightMurder()
}

function advanceToWitnessAccuse(engine: GameEngine, io: MockIO, players: PlayerInfo[]): void {
  advanceToNightMurder(engine)
  const murderer = getPlayerByRole(engine, players, 'murderer')
  expect(murderer).toBeDefined()
  engine.handleMurdererSelect(murderer!.id, murderer!.meansCards[0].id, murderer!.clueCards[0].id)
  const witness = getPlayerByRole(engine, players, 'witness')
  expect(witness).toBeDefined()
  engine.handleWitnessConfirmMurder(witness!.id)
}

function advanceToDiscussion1(engine: GameEngine, io: MockIO, players: PlayerInfo[]): void {
  advanceToWitnessAccuse(engine, io, players)
  const witness = getPlayerByRole(engine, players, 'witness')
  expect(witness).toBeDefined()
  const boards = engine.getActiveBoards()
  for (let i = 0; i < 6; i++) {
    engine.handleWitnessSetMarker(witness!.id, boards[i].id, 0, i + 1)
  }
  engine.handleWitnessConfirmAccuse(witness!.id)
}

function advanceToAdvance1(engine: GameEngine, io: MockIO, players: PlayerInfo[]): void {
  advanceToDiscussion1(engine, io, players)
  const witness = getPlayerByRole(engine, players, 'witness')
  expect(witness).toBeDefined()
  engine.setEffectDeckForTest([])
  engine.handleEndDiscussion(witness!.id)
}

function advanceToDiscussion2(engine: GameEngine, io: MockIO, players: PlayerInfo[]): void {
  advanceToAdvance1(engine, io, players)
  engine.finishAdvancePhase()
}

function advanceToAdvance2(engine: GameEngine, io: MockIO, players: PlayerInfo[]): void {
  advanceToDiscussion2(engine, io, players)
  const witness = getPlayerByRole(engine, players, 'witness')
  expect(witness).toBeDefined()
  engine.setEffectDeckForTest([])
  engine.handleEndDiscussion(witness!.id)
}

function advanceToDiscussion3(engine: GameEngine, io: MockIO, players: PlayerInfo[]): void {
  advanceToAdvance2(engine, io, players)
  engine.finishAdvancePhase()
}

function advanceToForceSolve(engine: GameEngine, io: MockIO, players: PlayerInfo[]): void {
  advanceToDiscussion3(engine, io, players)
  const witness = getPlayerByRole(engine, players, 'witness')
  expect(witness).toBeDefined()
  engine.handleEndDiscussion(witness!.id)
}

/** Get the solution known to the witness (for correct solve attempts) */
function getSolution(
  engine: GameEngine,
  _players: PlayerInfo[],
): { meansCardId: string; clueCardId: string } {
  const solution = engine.getSolution()
  expect(solution).not.toBeNull()
  return { meansCardId: solution!.meansCard.id, clueCardId: solution!.clueCard.id }
}

// =========================================================================
// Tests
// =========================================================================

describe('GameEngine', () => {
  let engine: GameEngine
  let io: MockIO

  beforeEach(() => {
    io = createMockIO()
    engine = new GameEngine(io as any)
  })

  // ===== 玩家管理 =====
  describe('玩家管理', () => {
    it('should make the first player host when they join an empty room', () => {
      const sock = createMockSocket('s1')
      io._addSocket(sock)
      const player = engine.addPlayer('u1', 'Alice', 's1')
      expect(player).not.toBeNull()
      expect(player!.id).toBe('u1')
      expect(player!.nickname).toBe('Alice')
      expect(player!.isHost).toBe(true)
    })

    it('should not grant host to subsequent players', () => {
      addPlayers(engine, io, 3)
      const p1 = engine.getPlayerById('user-1')
      expect(p1).toBeDefined()
      expect(p1!.isHost).toBe(false)
    })

    it('should reject players when room is full at 10', () => {
      addPlayers(engine, io, 10)
      const sock = createMockSocket('s-extra')
      io._addSocket(sock)
      const result = engine.addPlayer('u-extra', 'Extra', 's-extra')
      expect(result).toBeNull()
    })

    it('should reject new players when game is in progress', () => {
      addPlayers(engine, io, 4)
      engine.startGame()
      const sock = createMockSocket('s-late')
      io._addSocket(sock)
      const result = engine.addPlayer('u-late', 'Late', 's-late')
      expect(result).toBeNull()
    })

    it('should transfer host to next player when host leaves during lobby', () => {
      addPlayers(engine, io, 3)
      engine.removePlayer('user-0')
      const p1 = engine.getPlayerById('user-1')
      expect(p1).toBeDefined()
      expect(p1!.isHost).toBe(true)
    })

    it('should assign unique colors to all players', () => {
      addPlayers(engine, io, 5)
      const colors = new Set<string>()
      for (let i = 0; i < 5; i++) {
        const p = engine.getPlayerById(`user-${i}`)
        expect(p).toBeDefined()
        colors.add(p!.color)
      }
      expect(colors.size).toBe(5)
    })
  })

  // ===== 游戏启动 =====
  describe('游戏启动', () => {
    it('should reject start from non-host player', () => {
      addPlayers(engine, io, 4)
      const result = engine.canStartGame('user-1')
      expect(result.ok).toBe(false)
      expect(result.error).toContain('房主')
    })

    it('should reject start with fewer than 4 players', () => {
      addPlayers(engine, io, 3)
      const result = engine.canStartGame('user-0')
      expect(result.ok).toBe(false)
      expect(result.error).toContain('4人')
    })

    it('should allow start with 4-10 players', () => {
      for (let count = 4; count <= 10; count++) {
        const localIO = createMockIO()
        const localEngine = new GameEngine(localIO as any)
        addPlayers(localEngine, localIO, count)
        const result = localEngine.canStartGame('user-0')
        expect(result.ok).toBe(true)
      }
    })

    it('should assign exactly 1 witness, 1 murderer, and remaining detectives for 4 players', () => {
      addPlayers(engine, io, 4)
      engine.startGame()

      const roles = { witness: 0, murderer: 0, accomplice: 0, detective: 0 }
      for (let i = 0; i < 4; i++) {
        const p = engine.getPlayerById(`user-${i}`)
        expect(p).toBeDefined()
        roles[p!.role as keyof typeof roles]++
      }
      expect(roles).toEqual({ witness: 1, murderer: 1, accomplice: 0, detective: 2 })
    })

    it('should include an accomplice for 6+ players', () => {
      for (const count of [6, 7, 8, 9, 10]) {
        const localIO = createMockIO()
        const localEngine = new GameEngine(localIO as any)
        addPlayers(localEngine, localIO, count)
        localEngine.startGame()

        const roles = { witness: 0, murderer: 0, accomplice: 0, detective: 0 }
        for (let i = 0; i < count; i++) {
          const p = localEngine.getPlayerById(`user-${i}`)
          expect(p).toBeDefined()
          roles[p!.role as keyof typeof roles]++
        }
        const expected = getRoleAssignment(count)
        expect(roles).toEqual(expected)
      }
    })

    it('should deal 4 means + 4 clue cards to each non-witness player', () => {
      addPlayers(engine, io, 7)
      engine.startGame()

      for (let i = 0; i < 7; i++) {
        const p = engine.getPlayerById(`user-${i}`)
        expect(p).toBeDefined()
        if (p!.role === 'witness') {
          expect(p!.meansCards).toHaveLength(0)
          expect(p!.clueCards).toHaveLength(0)
        } else {
          expect(p!.meansCards).toHaveLength(4)
          expect(p!.clueCards).toHaveLength(4)
        }
      }
    })

    it('should not deal duplicate cards across different players', () => {
      addPlayers(engine, io, 10)
      engine.startGame()

      const meansIds = new Set<string>()
      const clueIds = new Set<string>()

      for (let i = 0; i < 10; i++) {
        const p = engine.getPlayerById(`user-${i}`)
        expect(p).toBeDefined()
        for (const c of p!.meansCards) {
          expect(meansIds.has(c.id)).toBe(false)
          meansIds.add(c.id)
        }
        for (const c of p!.clueCards) {
          expect(clueIds.has(c.id)).toBe(false)
          clueIds.add(c.id)
        }
      }
    })

    it('should setup 6 active boards (1 cause + 1 location + 4 scene)', () => {
      addPlayers(engine, io, 7)
      advanceToNightMurder(engine)

      const boards = engine.getActiveBoards()
      expect(boards).toHaveLength(6)
      expect(boards.filter((b) => b.type === 'cause')).toHaveLength(1)
      expect(boards.filter((b) => b.type === 'location')).toHaveLength(1)
      expect(boards.filter((b) => b.type === 'scene')).toHaveLength(4)
    })

    it('should deny solve right to the witness', () => {
      addPlayers(engine, io, 5)
      engine.startGame()

      for (let i = 0; i < 5; i++) {
        const p = engine.getPlayerById(`user-${i}`)
        expect(p).toBeDefined()
        if (p!.role === 'witness') {
          expect(p!.hasSolveRight).toBe(false)
        } else {
          expect(p!.hasSolveRight).toBe(true)
        }
      }
    })

    it('should transition to role-reveal phase on start', () => {
      addPlayers(engine, io, 4)
      engine.startGame()
      expect(engine.getPhase()).toBe('role-reveal')
    })

    it('should transition to night-murder when triggerNightMurder is called', () => {
      addPlayers(engine, io, 4)
      advanceToNightMurder(engine)
      expect(engine.getPhase()).toBe('night-murder')
    })

    it('should emit game_started to each player with their assigned role', () => {
      addPlayers(engine, io, 4)
      engine.startGame()

      for (let i = 0; i < 4; i++) {
        const sock = io.sockets.sockets.get(`socket-${i}`)
        expect(sock).toBeDefined()
        const calls = sock!.emit.mock.calls.filter((c: any[]) => c[0] === 'game_started')
        expect(calls.length).toBe(1)
        const data = calls[0][1]
        expect(data.role).toBeDefined()
        expect(['witness', 'murderer', 'accomplice', 'detective']).toContain(data.role)
      }
    })
  })

  // ===== 夜晚阶段 - 凶手选牌 =====
  describe('夜晚阶段 - 凶手选牌', () => {
    let players: PlayerInfo[]

    beforeEach(() => {
      players = addPlayers(engine, io, 7)
      advanceToNightMurder(engine)
    })

    it('should reject card selection from a non-murderer player', () => {
      const witness = getPlayerByRole(engine, players, 'witness')
      expect(witness).toBeDefined()
      const result = engine.handleMurdererSelect(witness!.id, 'M001', 'C001')
      expect(result.ok).toBe(false)
    })

    it('should reject selection with cards not in murderer hand', () => {
      const murderer = getPlayerByRole(engine, players, 'murderer')
      expect(murderer).toBeDefined()
      const result = engine.handleMurdererSelect(murderer!.id, 'INVALID', 'C001')
      expect(result.ok).toBe(false)
      expect(result.error).toContain('无效的卡牌')
    })

    it('should accept valid means + clue selection from murderer', () => {
      const murderer = getPlayerByRole(engine, players, 'murderer')
      expect(murderer).toBeDefined()
      const result = engine.handleMurdererSelect(
        murderer!.id,
        murderer!.meansCards[0].id,
        murderer!.clueCards[0].id,
      )
      expect(result.ok).toBe(true)
    })

    it('should store solution when murderer selects valid cards', () => {
      const murderer = getPlayerByRole(engine, players, 'murderer')
      expect(murderer).toBeDefined()
      engine.handleMurdererSelect(
        murderer!.id,
        murderer!.meansCards[0].id,
        murderer!.clueCards[0].id,
      )
      const solution = engine.getSolution()
      expect(solution).not.toBeNull()
      expect(solution!.meansCard.id).toBe(murderer!.meansCards[0].id)
      expect(solution!.clueCard.id).toBe(murderer!.clueCards[0].id)
    })

    it('should notify witness of the murder selection', () => {
      const murderer = getPlayerByRole(engine, players, 'murderer')
      expect(murderer).toBeDefined()
      const witness = getPlayerByRole(engine, players, 'witness')
      expect(witness).toBeDefined()

      engine.handleMurdererSelect(
        murderer!.id,
        murderer!.meansCards[0].id,
        murderer!.clueCards[0].id,
      )

      const witnessSock = io.sockets.sockets.get(witness!.socketId!)
      expect(witnessSock).toBeDefined()
      const calls = witnessSock!.emit.mock.calls.filter((c: any[]) => c[0] === 'murderer_selected')
      expect(calls.length).toBeGreaterThanOrEqual(1)
    })

    it('should expose selection to witness via getGameStateForPlayer after murderer selects', () => {
      const murderer = getPlayerByRole(engine, players, 'murderer')
      expect(murderer).toBeDefined()
      engine.handleMurdererSelect(
        murderer!.id,
        murderer!.meansCards[0].id,
        murderer!.clueCards[0].id,
      )

      const witness = getPlayerByRole(engine, players, 'witness')
      expect(witness).toBeDefined()
      const state = engine.getGameStateForPlayer(witness!.id)
      expect(state.murdererSelection).toBeDefined()
    })

    it('should transition to witness-accuse when witness confirms murder', () => {
      const murderer = getPlayerByRole(engine, players, 'murderer')
      expect(murderer).toBeDefined()
      engine.handleMurdererSelect(
        murderer!.id,
        murderer!.meansCards[0].id,
        murderer!.clueCards[0].id,
      )

      const witness = getPlayerByRole(engine, players, 'witness')
      expect(witness).toBeDefined()
      engine.handleWitnessConfirmMurder(witness!.id)
      expect(engine.getPhase()).toBe('witness-accuse')
    })

    it('should reject witness confirm when no murderer selection made', () => {
      const witness = getPlayerByRole(engine, players, 'witness')
      expect(witness).toBeDefined()
      // No murderer select has been done, so confirm should fail
      const result = engine.handleWitnessConfirmMurder(witness!.id)
      expect(result.ok).toBe(false)
    })

    it('should reject confirm from a non-witness player', () => {
      const murderer = getPlayerByRole(engine, players, 'murderer')
      expect(murderer).toBeDefined()
      engine.handleMurdererSelect(
        murderer!.id,
        murderer!.meansCards[0].id,
        murderer!.clueCards[0].id,
      )

      const result = engine.handleWitnessConfirmMurder(murderer!.id)
      expect(result.ok).toBe(false)
    })

    it('should broadcast boards_revealed when transitioning to witness-accuse', () => {
      const murderer = getPlayerByRole(engine, players, 'murderer')
      expect(murderer).toBeDefined()
      engine.handleMurdererSelect(
        murderer!.id,
        murderer!.meansCards[0].id,
        murderer!.clueCards[0].id,
      )

      const witness = getPlayerByRole(engine, players, 'witness')
      expect(witness).toBeDefined()
      engine.handleWitnessConfirmMurder(witness!.id)

      const calls = io.emit.mock.calls.filter((c: any[]) => c[0] === 'boards_revealed')
      expect(calls.length).toBeGreaterThanOrEqual(1)
      expect(calls[calls.length - 1][1].boards).toHaveLength(6)
    })
  })

  // ===== 指证阶段 - 目击者放选项物 =====
  describe('指证阶段 - 目击者放选项物', () => {
    let players: PlayerInfo[]

    beforeEach(() => {
      players = addPlayers(engine, io, 7)
      advanceToWitnessAccuse(engine, io, players)
    })

    it('should reject marker placement from a non-witness player', () => {
      const detective = getPlayerByRole(engine, players, 'detective')
      expect(detective).toBeDefined()
      const boards = engine.getActiveBoards()
      const result = engine.handleWitnessSetMarker(detective!.id, boards[0].id, 0, 1)
      expect(result.ok).toBe(false)
    })

    it('should accept valid marker placement from witness', () => {
      const witness = getPlayerByRole(engine, players, 'witness')
      expect(witness).toBeDefined()
      const boards = engine.getActiveBoards()
      const result = engine.handleWitnessSetMarker(witness!.id, boards[0].id, 0, 1)
      expect(result.ok).toBe(true)
    })

    it('should reject marker number outside 1-6 range', () => {
      const witness = getPlayerByRole(engine, players, 'witness')
      expect(witness).toBeDefined()
      const boards = engine.getActiveBoards()
      const result = engine.handleWitnessSetMarker(witness!.id, boards[0].id, 0, 7)
      expect(result.ok).toBe(false)
    })

    it('should reject invalid option index', () => {
      const witness = getPlayerByRole(engine, players, 'witness')
      expect(witness).toBeDefined()
      const boards = engine.getActiveBoards()
      const result = engine.handleWitnessSetMarker(witness!.id, boards[0].id, 99, 1)
      expect(result.ok).toBe(false)
    })

    it('should move marker to new board when same marker number is placed again', () => {
      const witness = getPlayerByRole(engine, players, 'witness')
      expect(witness).toBeDefined()
      const boards = engine.getActiveBoards()

      engine.handleWitnessSetMarker(witness!.id, boards[0].id, 0, 1)
      engine.handleWitnessSetMarker(witness!.id, boards[1].id, 2, 1)

      const state = engine.getGameStateForPlayer(witness!.id)
      const updatedBoards = state.boards as Array<{
        id: string
        marker?: { optionIndex: number; markerNumber: number }
      }>
      const board0 = updatedBoards.find((b) => b.id === boards[0].id)
      const board1 = updatedBoards.find((b) => b.id === boards[1].id)

      expect(board0?.marker).toBeUndefined()
      expect(board1?.marker).toEqual({ optionIndex: 2, markerNumber: 1 })
    })

    it('should broadcast marker_placed event after placement', () => {
      const witness = getPlayerByRole(engine, players, 'witness')
      expect(witness).toBeDefined()
      const boards = engine.getActiveBoards()

      engine.handleWitnessSetMarker(witness!.id, boards[0].id, 0, 1)

      const calls = io.emit.mock.calls.filter((c: any[]) => c[0] === 'marker_placed')
      expect(calls.length).toBeGreaterThanOrEqual(1)
    })

    it('should reject confirm when not all 6 markers are placed', () => {
      const witness = getPlayerByRole(engine, players, 'witness')
      expect(witness).toBeDefined()
      const boards = engine.getActiveBoards()

      for (let i = 0; i < 3; i++) {
        engine.handleWitnessSetMarker(witness!.id, boards[i].id, 0, i + 1)
      }

      const result = engine.handleWitnessConfirmAccuse(witness!.id)
      expect(result.ok).toBe(false)
      expect(result.error).toContain('6张场景板')
    })

    it('should transition to discussion-1 when all 6 markers placed and confirmed', () => {
      const witness = getPlayerByRole(engine, players, 'witness')
      expect(witness).toBeDefined()
      const boards = engine.getActiveBoards()

      for (let i = 0; i < 6; i++) {
        engine.handleWitnessSetMarker(witness!.id, boards[i].id, 0, i + 1)
      }

      const result = engine.handleWitnessConfirmAccuse(witness!.id)
      expect(result.ok).toBe(true)
      expect(engine.getPhase()).toBe('discussion-1')
    })
  })

  // ===== 发言阶段 =====
  describe('发言阶段', () => {
    let players: PlayerInfo[]

    beforeEach(() => {
      players = addPlayers(engine, io, 7)
      advanceToDiscussion1(engine, io, players)
    })

    it('should be in discussion-1 phase', () => {
      expect(engine.getPhase()).toBe('discussion-1')
    })

    it('should reject end discussion from non-witness player', () => {
      const detective = getPlayerByRole(engine, players, 'detective')
      expect(detective).toBeDefined()
      const result = engine.handleEndDiscussion(detective!.id)
      expect(result.ok).toBe(false)
    })

    it('should transition from discussion-1 to advance-1', () => {
      const witness = getPlayerByRole(engine, players, 'witness')
      expect(witness).toBeDefined()
      engine.setEffectDeckForTest([])
      engine.handleEndDiscussion(witness!.id)
      expect(engine.getPhase()).toBe('advance-1')
    })
  })

  // ===== 破案 =====
  describe('破案', () => {
    let players: PlayerInfo[]

    beforeEach(() => {
      players = addPlayers(engine, io, 7)
      advanceToDiscussion1(engine, io, players)
    })

    it('should reject solve attempt from witness', () => {
      const witness = getPlayerByRole(engine, players, 'witness')
      expect(witness).toBeDefined()
      const result = engine.handleAttemptSolve(witness!.id, {
        suspectId: 'user-0',
        meansCardId: 'M001',
        clueCardId: 'C001',
      })
      expect(result.ok).toBe(false)
      expect(result.error).toContain('目击者')
    })

    it('should succeed when detective guesses correct suspect, means, and clue', () => {
      const detective = getPlayerByRole(engine, players, 'detective')
      expect(detective).toBeDefined()
      const murderer = getPlayerByRole(engine, players, 'murderer')
      expect(murderer).toBeDefined()
      const solution = getSolution(engine, players)

      const result = engine.handleAttemptSolve(detective!.id, {
        suspectId: murderer!.id,
        meansCardId: solution.meansCardId,
        clueCardId: solution.clueCardId,
      })
      expect(result.ok).toBe(true)
      expect(result.success).toBe(true)
      expect(engine.getPhase()).toBe('game-over')
    })

    it('should fail when detective guesses wrong suspect', () => {
      const detective = getPlayerByRole(engine, players, 'detective')
      expect(detective).toBeDefined()
      const solution = getSolution(engine, players)

      const result = engine.handleAttemptSolve(detective!.id, {
        suspectId: detective!.id,
        meansCardId: solution.meansCardId,
        clueCardId: solution.clueCardId,
      })
      expect(result.ok).toBe(true)
      expect(result.success).toBe(false)
      expect(detective!.hasSolveRight).toBe(false)
    })

    it('should fail when detective guesses wrong means card', () => {
      const detective = getPlayerByRole(engine, players, 'detective')
      expect(detective).toBeDefined()
      const murderer = getPlayerByRole(engine, players, 'murderer')
      expect(murderer).toBeDefined()
      const solution = getSolution(engine, players)

      const wrongMeans = murderer!.meansCards.find((c) => c.id !== solution.meansCardId)

      const result = engine.handleAttemptSolve(detective!.id, {
        suspectId: murderer!.id,
        meansCardId: wrongMeans?.id || 'WRONG',
        clueCardId: solution.clueCardId,
      })
      expect(result.ok).toBe(true)
      expect(result.success).toBe(false)
    })

    it('should consume solve right on failed attempt', () => {
      const detective = getPlayerByRole(engine, players, 'detective')
      expect(detective).toBeDefined()
      expect(detective!.hasSolveRight).toBe(true)

      engine.handleAttemptSolve(detective!.id, {
        suspectId: 'user-0',
        meansCardId: 'WRONG',
        clueCardId: 'WRONG',
      })

      expect(detective!.hasSolveRight).toBe(false)
    })

    it('should reject a second solve attempt from the same player', () => {
      const detective = getPlayerByRole(engine, players, 'detective')
      expect(detective).toBeDefined()

      engine.handleAttemptSolve(detective!.id, {
        suspectId: 'user-0',
        meansCardId: 'WRONG',
        clueCardId: 'WRONG',
      })

      const result = engine.handleAttemptSolve(detective!.id, {
        suspectId: 'user-0',
        meansCardId: 'M001',
        clueCardId: 'C001',
      })
      expect(result.ok).toBe(false)
      expect(result.error).toContain('破案权')
    })

    it('should broadcast solve_result event after attempt', () => {
      const detective = getPlayerByRole(engine, players, 'detective')
      expect(detective).toBeDefined()
      io.emit.mockClear()

      engine.handleAttemptSolve(detective!.id, {
        suspectId: 'user-0',
        meansCardId: 'WRONG',
        clueCardId: 'WRONG',
      })

      const calls = io.emit.mock.calls.filter((c: any[]) => c[0] === 'solve_result')
      expect(calls.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ===== 推进阶段 =====
  describe('推进阶段', () => {
    let players: PlayerInfo[]

    beforeEach(() => {
      players = addPlayers(engine, io, 7)
      advanceToAdvance1(engine, io, players)
    })

    it('should be in advance-1 phase', () => {
      expect(engine.getPhase()).toBe('advance-1')
    })

    it('should reject accomplice choice from non-accomplice player', () => {
      const detective = getPlayerByRole(engine, players, 'detective')
      expect(detective).toBeDefined()
      const result = engine.handleAccompliceChoose(detective!.id, false)
      expect(result.ok).toBe(false)
    })

    it('should accept no-replace choice from accomplice', () => {
      const accomplice = getPlayerByRole(engine, players, 'accomplice')
      expect(accomplice).toBeDefined()

      const result = engine.handleAccompliceChoose(accomplice!.id, false)
      expect(result.ok).toBe(true)
    })

    it('should replace clue card in solution when accomplice chooses to replace', () => {
      const accomplice = getPlayerByRole(engine, players, 'accomplice')
      expect(accomplice).toBeDefined()
      const murderer = getPlayerByRole(engine, players, 'murderer')
      expect(murderer).toBeDefined()

      const oldSolution = getSolution(engine, players)
      const oldClueId = oldSolution.clueCardId

      const newClue = murderer!.clueCards.find((c) => c.id !== oldClueId)
      expect(newClue).toBeDefined()

      const result = engine.handleAccompliceChoose(accomplice!.id, true, newClue!.id)
      expect(result.ok).toBe(true)

      const newSolution = getSolution(engine, players)
      expect(newSolution.clueCardId).toBe(newClue!.id)
    })

    it('should reject double choice from accomplice', () => {
      const accomplice = getPlayerByRole(engine, players, 'accomplice')
      expect(accomplice).toBeDefined()

      engine.handleAccompliceChoose(accomplice!.id, false)
      const result = engine.handleAccompliceChoose(accomplice!.id, false)
      expect(result.ok).toBe(false)
    })

    it('should transition from advance-1 to discussion-2 via finishAdvancePhase', () => {
      engine.finishAdvancePhase()
      expect(engine.getPhase()).toBe('discussion-2')
    })

    it('should transition through advance-2 to discussion-3', () => {
      engine.finishAdvancePhase() // advance-1 -> discussion-2
      expect(engine.getPhase()).toBe('discussion-2')

      const witness = getPlayerByRole(engine, players, 'witness')
      expect(witness).toBeDefined()
      engine.setEffectDeckForTest([])
      engine.handleEndDiscussion(witness!.id) // discussion-2 -> advance-2
      expect(engine.getPhase()).toBe('advance-2')

      engine.finishAdvancePhase() // advance-2 -> discussion-3
      expect(engine.getPhase()).toBe('discussion-3')
    })
  })

  // ===== 强制破案 =====
  describe('强制破案', () => {
    let players: PlayerInfo[]

    beforeEach(() => {
      players = addPlayers(engine, io, 5)
      advanceToForceSolve(engine, io, players)
    })

    it('should be in force-solve phase after 3 discussion rounds', () => {
      expect(engine.getPhase()).toBe('force-solve')
    })

    it('should have a non-empty force solve order', () => {
      const order = engine.getForceSolveOrder()
      expect(order.length).toBeGreaterThan(0)
    })

    it('should end game as murderer win when all players fail force solve', () => {
      const order = engine.getForceSolveOrder()
      for (const playerId of order) {
        if (engine.getPhase() === 'game-over') break
        engine.handleAttemptSolve(playerId, {
          suspectId: playerId,
          meansCardId: 'WRONG',
          clueCardId: 'WRONG',
        })
      }

      expect(engine.getPhase()).toBe('game-over')
      expect(engine.getWinner()).toBe('murderer')
    })

    it('should end game as detective win on correct guess during force solve', () => {
      const order = engine.getForceSolveOrder()
      const firstTurnPlayerId = order[0]
      expect(firstTurnPlayerId).toBeDefined()

      const murderer = getPlayerByRole(engine, players, 'murderer')
      expect(murderer).toBeDefined()
      const solution = getSolution(engine, players)

      engine.handleAttemptSolve(firstTurnPlayerId, {
        suspectId: murderer!.id,
        meansCardId: solution.meansCardId,
        clueCardId: solution.clueCardId,
      })

      expect(engine.getPhase()).toBe('game-over')
      expect(engine.getWinner()).toBe('detective')
    })

    it('should reject out-of-turn solve attempt during force solve', () => {
      const order = engine.getForceSolveOrder()
      // Try to solve out of turn (skip the first player)
      if (order.length >= 2) {
        const result = engine.handleAttemptSolve(order[1], {
          suspectId: 'user-0',
          meansCardId: 'WRONG',
          clueCardId: 'WRONG',
        })
        expect(result.ok).toBe(false)
        expect(result.error).toContain('轮到你')
      }
    })
  })

  // ===== 效果牌 =====
  describe('效果牌', () => {
    let players: PlayerInfo[]

    beforeEach(() => {
      players = addPlayers(engine, io, 7)
      engine.startGame()
      engine.triggerNightMurder()
    })

    // E01 - Assassination (via handleEffectAction)
    it('should allow witness to assassinate a detective via E01 effect', () => {
      const witness = getPlayerByRole(engine, players, 'witness')
      expect(witness).toBeDefined()
      const detective = getPlayerByRole(engine, players, 'detective')
      expect(detective).toBeDefined()

      const result = engine.handleEffectAction(witness!.id, 'E01', { targetId: detective!.id })
      expect(result.ok).toBe(true)
      expect(detective!.hasSolveRight).toBe(false)
      expect(detective!.status).toBe('dead')
    })

    // E02 - Random Kill (via testApplyEffectCard)
    it('should randomly kill a player via E02 effect', () => {
      const card: EffectCardRef = { id: 'E02', name: '意外死亡', effect: '' }
      const result = engine.testApplyEffectCard(card)
      expect(result.applied).toBe(true)
      expect(result.victimId).toBeDefined()
    })

    // E03 - Clear Suspicion (via handleEffectAction)
    it('should allow witness to clear suspicion on a player via E03 effect', () => {
      const witness = getPlayerByRole(engine, players, 'witness')
      expect(witness).toBeDefined()
      const detective = getPlayerByRole(engine, players, 'detective')
      expect(detective).toBeDefined()

      const result = engine.handleEffectAction(witness!.id, 'E03', { targetId: detective!.id })
      expect(result.ok).toBe(true)
    })

    // E04 - Key Clue (requiresWitnessAction)
    it('should return requiresWitnessAction for E04 effect', () => {
      const card: EffectCardRef = { id: 'E04', name: '关键线索', effect: '' }
      const result = engine.testApplyEffectCard(card)
      expect(result.applied).toBe(false)
      expect(result.requiresWitnessAction).toBe(true)
    })

    // E05 - Evidence Lost (via handleEffectAction)
    it('should allow witness to remove a marker via E05 effect', () => {
      // Need to set up boards with markers first
      const murderer = getPlayerByRole(engine, players, 'murderer')
      expect(murderer).toBeDefined()
      engine.handleMurdererSelect(
        murderer!.id,
        murderer!.meansCards[0].id,
        murderer!.clueCards[0].id,
      )

      const witness = getPlayerByRole(engine, players, 'witness')
      expect(witness).toBeDefined()
      engine.handleWitnessConfirmMurder(witness!.id)

      // Place a marker on the first board
      const boards = engine.getActiveBoards()
      engine.handleWitnessSetMarker(witness!.id, boards[0].id, 0, 1)

      // Now apply E05 - remove marker from the first board
      const result = engine.handleEffectAction(witness!.id, 'E05', { boardId: boards[0].id })
      expect(result.ok).toBe(true)

      // Verify the marker was removed
      const updatedBoards = engine.getActiveBoards()
      const board = updatedBoards.find((b) => b.id === boards[0].id)
      expect(board).toBeDefined()
      expect(board!.marker).toBeUndefined()
    })

    // E06 - Witness Notes (requiresWitnessAction)
    it('should return requiresWitnessAction for E06 effect', () => {
      const card: EffectCardRef = { id: 'E06', name: '目击者笔录', effect: '' }
      const result = engine.testApplyEffectCard(card)
      expect(result.applied).toBe(false)
      expect(result.requiresWitnessAction).toBe(true)
    })

    // E07 - Blackout (via testApplyEffectCard)
    it('should activate blackout via E07 effect', () => {
      // Need to be in an advance phase for blackout to have proper context
      // Advance to advance-1 first
      const murderer = getPlayerByRole(engine, players, 'murderer')
      expect(murderer).toBeDefined()
      engine.handleMurdererSelect(
        murderer!.id,
        murderer!.meansCards[0].id,
        murderer!.clueCards[0].id,
      )
      const witness = getPlayerByRole(engine, players, 'witness')
      expect(witness).toBeDefined()
      engine.handleWitnessConfirmMurder(witness!.id)
      const boards = engine.getActiveBoards()
      for (let i = 0; i < 6; i++) {
        engine.handleWitnessSetMarker(witness!.id, boards[i].id, 0, i + 1)
      }
      engine.handleWitnessConfirmAccuse(witness!.id)
      engine.setEffectDeckForTest([])
      engine.handleEndDiscussion(witness!.id)

      // Now in advance-1, test E07
      const card: EffectCardRef = { id: 'E07', name: '停电', effect: '' }
      const result = engine.testApplyEffectCard(card)
      expect(result.applied).toBe(true)
      expect(result.blackout).toBe(true)
      expect(engine.getBlackout()).toBe(true)
    })

    // E08 - Info Leak (via handleEffectAction)
    it('should allow witness to point to a card via E08 effect', () => {
      const witness = getPlayerByRole(engine, players, 'witness')
      expect(witness).toBeDefined()

      const result = engine.handleEffectAction(witness!.id, 'E08', { cardId: 'M001' })
      expect(result.ok).toBe(true)
    })

    // E09 - Shuffle Means (via testApplyEffectCard)
    it('should shuffle means cards via E09 effect', () => {
      const card: EffectCardRef = { id: 'E09', name: '混乱现场', effect: '' }
      const result = engine.testApplyEffectCard(card)
      expect(result.applied).toBe(true)
      expect(result.shuffledMeans).toBe(true)
    })

    // E10 - Case within Case (requiresWitnessAction)
    it('should return requiresWitnessAction for E10 effect', () => {
      const card: EffectCardRef = { id: 'E10', name: '案中案', effect: '' }
      const result = engine.testApplyEffectCard(card)
      expect(result.applied).toBe(false)
      expect(result.requiresWitnessAction).toBe(true)
    })

    it('should reject effect action from non-witness player', () => {
      const detective = getPlayerByRole(engine, players, 'detective')
      expect(detective).toBeDefined()
      const result = engine.handleEffectAction(detective!.id, 'E01', { targetId: detective!.id })
      expect(result.ok).toBe(false)
    })
  })

  // ===== 计分系统 =====
  describe('计分系统', () => {
    it('should scale detective side scores up for fewer players (4 players)', () => {
      const s = getScores(4)
      expect(s.witnessWin).toBe(6)
      expect(s.detectiveWin).toBe(5)
      expect(s.murdererWin).toBe(3)
    })

    it('should use base scores for 7 players', () => {
      const s = getScores(7)
      expect(s.witnessWin).toBe(3)
      expect(s.detectiveWin).toBe(2)
      expect(s.murdererWin).toBe(3)
    })

    it('should scale murderer side scores up for more players (10 players)', () => {
      const s = getScores(10)
      expect(s.witnessWin).toBe(3)
      expect(s.detectiveWin).toBe(2)
      expect(s.murdererWin).toBe(6)
    })

    it('should assign correct scores on detective win', () => {
      const players = addPlayers(engine, io, 7)
      advanceToDiscussion1(engine, io, players)

      const detective = getPlayerByRole(engine, players, 'detective')
      expect(detective).toBeDefined()
      const murderer = getPlayerByRole(engine, players, 'murderer')
      expect(murderer).toBeDefined()
      const witness = getPlayerByRole(engine, players, 'witness')
      expect(witness).toBeDefined()
      const solution = getSolution(engine, players)

      engine.handleAttemptSolve(detective!.id, {
        suspectId: murderer!.id,
        meansCardId: solution.meansCardId,
        clueCardId: solution.clueCardId,
      })

      expect(engine.getPhase()).toBe('game-over')

      const scores = engine.getScoresMap()
      expect(scores).not.toBeNull()
      expect(scores![witness!.id]).toBe(3)
      expect(scores![detective!.id]).toBe(2)
      expect(scores![murderer!.id]).toBe(0)
    })

    it('should assign correct scores on murderer win via force solve', () => {
      const players = addPlayers(engine, io, 5)
      advanceToForceSolve(engine, io, players)

      const order = engine.getForceSolveOrder()
      for (const playerId of order) {
        if (engine.getPhase() === 'game-over') break
        engine.handleAttemptSolve(playerId, {
          suspectId: playerId,
          meansCardId: 'WRONG',
          clueCardId: 'WRONG',
        })
      }

      expect(engine.getPhase()).toBe('game-over')

      const scores = engine.getScoresMap()
      expect(scores).not.toBeNull()
      const witness = getPlayerByRole(engine, players, 'witness')
      expect(witness).toBeDefined()
      const murderer = getPlayerByRole(engine, players, 'murderer')
      expect(murderer).toBeDefined()

      expect(scores![witness!.id]).toBe(0)
      expect(scores![murderer!.id]).toBe(3)
    })
  })

  // ===== 私密信息隔离 =====
  describe('私密信息隔离', () => {
    let players: PlayerInfo[]

    beforeEach(() => {
      players = addPlayers(engine, io, 7)
      advanceToNightMurder(engine)
      const murderer = getPlayerByRole(engine, players, 'murderer')
      expect(murderer).toBeDefined()
      engine.handleMurdererSelect(
        murderer!.id,
        murderer!.meansCards[0].id,
        murderer!.clueCards[0].id,
      )
    })

    it('should not expose murderer identity to detectives', () => {
      const detective = getPlayerByRole(engine, players, 'detective')
      expect(detective).toBeDefined()
      const state = engine.getGameStateForPlayer(detective!.id)
      const statePlayers = state.players as any[]

      for (const p of statePlayers) {
        if (p.role) {
          // Only witness role is publicly visible
          expect(p.role).toBe('witness')
        }
      }
    })

    it('should expose each player own role via myRole', () => {
      for (const p of players) {
        const state = engine.getGameStateForPlayer(p.userId)
        const playerState = engine.getPlayerById(p.userId)
        expect(playerState).toBeDefined()
        expect(state.myRole).toBe(playerState!.role)
      }
    })

    it('should only expose murderer selection to witness, murderer, and accomplice', () => {
      const detective = getPlayerByRole(engine, players, 'detective')
      expect(detective).toBeDefined()
      const witness = getPlayerByRole(engine, players, 'witness')
      expect(witness).toBeDefined()
      const murderer = getPlayerByRole(engine, players, 'murderer')
      expect(murderer).toBeDefined()
      const accomplice = getPlayerByRole(engine, players, 'accomplice')

      expect(engine.getGameStateForPlayer(detective!.id).murdererSelection).toBeUndefined()
      expect(engine.getGameStateForPlayer(witness!.id).murdererSelection).toBeDefined()
      expect(engine.getGameStateForPlayer(murderer!.id).murdererSelection).toBeDefined()

      if (accomplice) {
        expect(engine.getGameStateForPlayer(accomplice.id).murdererSelection).toBeDefined()
      }
    })

    it('should reveal all info during game-over', () => {
      const witness = getPlayerByRole(engine, players, 'witness')
      expect(witness).toBeDefined()
      engine.handleWitnessConfirmMurder(witness!.id)

      const boards = engine.getActiveBoards()
      for (let i = 0; i < boards.length; i++) {
        engine.handleWitnessSetMarker(witness!.id, boards[i].id, 0, i + 1)
      }
      engine.handleWitnessConfirmAccuse(witness!.id)

      const detective = getPlayerByRole(engine, players, 'detective')
      expect(detective).toBeDefined()
      const murderer = getPlayerByRole(engine, players, 'murderer')
      expect(murderer).toBeDefined()
      const solution = getSolution(engine, players)

      engine.handleAttemptSolve(detective!.id, {
        suspectId: murderer!.id,
        meansCardId: solution.meansCardId,
        clueCardId: solution.clueCardId,
      })

      expect(engine.getPhase()).toBe('game-over')

      const state = engine.getGameStateForPlayer(detective!.id)
      expect(state.winner).toBeDefined()
      expect(state.scores).toBeDefined()
      expect(state.roles).toBeDefined()
      expect(state.murdererSelection).toBeDefined()
    })
  })

  // ===== 断线重连 =====
  describe('断线重连', () => {
    it('should allow a disconnected player to reconnect with a new socket', () => {
      addPlayers(engine, io, 4)
      engine.startGame()

      engine.handleDisconnect('user-0')
      const disconnectedPlayer = engine.getPlayerById('user-0')
      expect(disconnectedPlayer).toBeDefined()
      expect(disconnectedPlayer!.status).toBe('disconnected')

      const newSock = createMockSocket('s-reconnect')
      io._addSocket(newSock)
      const reconnected = engine.addPlayer('user-0', 'Player0', 's-reconnect')
      expect(reconnected).not.toBeNull()
      expect(reconnected!.status).toBe('alive')
      expect(reconnected!.socketId).toBe('s-reconnect')
    })

    it('should mark player as disconnected on disconnect during game', () => {
      addPlayers(engine, io, 4)
      engine.startGame()

      engine.handleDisconnect('user-0')
      const player = engine.getPlayerById('user-0')
      expect(player).toBeDefined()
      expect(player!.status).toBe('disconnected')
      expect(player!.socketId).toBeNull()
    })
  })

  // ===== 游戏重置 =====
  describe('游戏重置', () => {
    it('should return to waiting state after reset', () => {
      addPlayers(engine, io, 7)
      engine.startGame()
      engine.resetGame()

      expect(engine.getPhase()).toBe('waiting')
      expect(engine.isPlaying()).toBe(false)
    })

    it('should keep players but clear their roles and cards', () => {
      addPlayers(engine, io, 7)
      engine.startGame()
      engine.resetGame()

      for (let i = 0; i < 7; i++) {
        const p = engine.getPlayerById(`user-${i}`)
        expect(p).toBeDefined()
        expect(p!.role).toBeNull()
        expect(p!.meansCards).toHaveLength(0)
        expect(p!.clueCards).toHaveLength(0)
        expect(p!.hasSolveRight).toBe(true)
        expect(p!.status).toBe('alive')
      }
    })

    it('should assign first player as host after reset', () => {
      addPlayers(engine, io, 7)
      engine.startGame()
      engine.resetGame()

      const p0 = engine.getPlayerById('user-0')
      expect(p0).toBeDefined()
      expect(p0!.isHost).toBe(true)
    })

    it('should clear solution after reset', () => {
      const players = addPlayers(engine, io, 7)
      advanceToNightMurder(engine)
      const murderer = getPlayerByRole(engine, players, 'murderer')
      expect(murderer).toBeDefined()
      engine.handleMurdererSelect(
        murderer!.id,
        murderer!.meansCards[0].id,
        murderer!.clueCards[0].id,
      )
      expect(engine.getSolution()).not.toBeNull()

      engine.resetGame()
      expect(engine.getSolution()).toBeNull()
    })
  })

  // ===== getRoleAssignment 纯函数 =====
  describe('getRoleAssignment', () => {
    it('should not include accomplice for fewer than 6 players', () => {
      for (const count of [4, 5]) {
        const r = getRoleAssignment(count)
        expect(r.accomplice).toBe(0)
        expect(r.witness + r.murderer + r.accomplice + r.detective).toBe(count)
      }
    })

    it('should include 1 accomplice for 6 or more players', () => {
      for (const count of [6, 7, 8, 9, 10]) {
        const r = getRoleAssignment(count)
        expect(r.accomplice).toBe(1)
        expect(r.witness + r.murderer + r.accomplice + r.detective).toBe(count)
      }
    })
  })

  // ===== Board Replacement =====
  describe('场景板替换', () => {
    let players: PlayerInfo[]

    beforeEach(() => {
      players = addPlayers(engine, io, 7)
      advanceToAdvance1(engine, io, players)
    })

    it('should reject replacing the death cause board', () => {
      const witness = getPlayerByRole(engine, players, 'witness')
      expect(witness).toBeDefined()
      const boards = engine.getActiveBoards()
      const causeBoard = boards.find((b) => b.type === 'cause')
      expect(causeBoard).toBeDefined()

      const result = engine.handleWitnessReplaceBoard(witness!.id, causeBoard!.id, 'SB999', 0, 1)
      expect(result.ok).toBe(false)
      expect(result.error).toContain('死亡原因')
    })
  })

  // ===== 端到端流程 =====
  describe('端到端流程', () => {
    it('侦探在第一轮发言成功破案', () => {
      const players = addPlayers(engine, io, 7)
      advanceToDiscussion1(engine, io, players)

      expect(engine.getPhase()).toBe('discussion-1')

      const detective = getPlayerByRole(engine, players, 'detective')
      expect(detective).toBeDefined()
      const murderer = getPlayerByRole(engine, players, 'murderer')
      expect(murderer).toBeDefined()
      const solution = getSolution(engine, players)

      const result = engine.handleAttemptSolve(detective!.id, {
        suspectId: murderer!.id,
        meansCardId: solution.meansCardId,
        clueCardId: solution.clueCardId,
      })

      expect(result.ok).toBe(true)
      expect(result.success).toBe(true)
      expect(engine.getPhase()).toBe('game-over')
      expect(engine.getWinner()).toBe('detective')

      // Verify scores are assigned
      const scores = engine.getScoresMap()
      expect(scores).not.toBeNull()

      const witness = getPlayerByRole(engine, players, 'witness')
      expect(witness).toBeDefined()
      expect(scores![witness!.id]).toBeGreaterThan(0)
      expect(scores![detective!.id]).toBeGreaterThan(0)
      expect(scores![murderer!.id]).toBe(0)
    })

    it('所有人强制破案失败后凶手获胜', () => {
      const players = addPlayers(engine, io, 5)
      advanceToForceSolve(engine, io, players)

      expect(engine.getPhase()).toBe('force-solve')

      const order = engine.getForceSolveOrder()
      expect(order.length).toBeGreaterThan(0)

      // All players fail force solve
      for (const playerId of order) {
        if (engine.getPhase() === 'game-over') break
        engine.handleAttemptSolve(playerId, {
          suspectId: playerId,
          meansCardId: 'WRONG',
          clueCardId: 'WRONG',
        })
      }

      expect(engine.getPhase()).toBe('game-over')
      expect(engine.getWinner()).toBe('murderer')

      // Verify scores
      const scores = engine.getScoresMap()
      expect(scores).not.toBeNull()
      const murderer = getPlayerByRole(engine, players, 'murderer')
      expect(murderer).toBeDefined()
      expect(scores![murderer!.id]).toBeGreaterThan(0)
    })

    it('帮凶在推进阶段1更换线索牌', () => {
      const players = addPlayers(engine, io, 7)
      advanceToAdvance1(engine, io, players)

      expect(engine.getPhase()).toBe('advance-1')

      const accomplice = getPlayerByRole(engine, players, 'accomplice')
      expect(accomplice).toBeDefined()
      const murderer = getPlayerByRole(engine, players, 'murderer')
      expect(murderer).toBeDefined()

      const oldSolution = getSolution(engine, players)
      const oldClueId = oldSolution.clueCardId

      const newClue = murderer!.clueCards.find((c) => c.id !== oldClueId)
      expect(newClue).toBeDefined()

      const result = engine.handleAccompliceChoose(accomplice!.id, true, newClue!.id)
      expect(result.ok).toBe(true)

      // Verify solution changed
      const newSolution = getSolution(engine, players)
      expect(newSolution.clueCardId).toBe(newClue!.id)
      expect(newSolution.meansCardId).toBe(oldSolution.meansCardId)

      // Continue to finish: advance phase boards then discussion-2
      engine.finishAdvancePhase()
      expect(engine.getPhase()).toBe('discussion-2')

      // Detective tries to solve with old clue (should fail)
      const detective = getPlayerByRole(engine, players, 'detective')
      expect(detective).toBeDefined()
      const solveWithOldClue = engine.handleAttemptSolve(detective!.id, {
        suspectId: murderer!.id,
        meansCardId: newSolution.meansCardId,
        clueCardId: oldClueId,
      })
      expect(solveWithOldClue.ok).toBe(true)
      expect(solveWithOldClue.success).toBe(false)
    })
  })
})
