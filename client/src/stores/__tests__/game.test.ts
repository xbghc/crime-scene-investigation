import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useGameStore } from '../game'
import type { Player, SceneBoard, GameState } from '../../types'

// === Helpers ===

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 'p1',
    nickname: 'Alice',
    color: '#ff0000',
    isHost: false,
    status: 'alive',
    hasSolveRight: true,
    meansCards: [],
    clueCards: [],
    ...overrides,
  }
}

function makeBoard(overrides: Partial<SceneBoard> = {}): SceneBoard {
  return {
    id: 'board-1',
    type: 'scene',
    title: '测试场景板',
    options: ['选项A', '选项B', '选项C'],
    ...overrides,
  }
}

describe('GameStore', () => {
  let store: ReturnType<typeof useGameStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useGameStore()
  })

  // ===== setMyInfo =====
  describe('setMyInfo', () => {
    it('应正确设置 myPlayerId 和 myRole', () => {
      store.setMyInfo('player-1', 'detective')

      expect(store.myPlayerId).toBe('player-1')
      expect(store.myRole).toBe('detective')
    })
  })

  // ===== me computed =====
  describe('me computed', () => {
    it('应在 updatePlayers 后返回与 myPlayerId 匹配的玩家', () => {
      store.setMyInfo('p2', 'murderer')
      store.updatePlayers([
        makePlayer({ id: 'p1', nickname: 'Alice' }),
        makePlayer({ id: 'p2', nickname: 'Bob' }),
      ])

      expect(store.me).toBeDefined()
      expect(store.me!.id).toBe('p2')
      expect(store.me!.nickname).toBe('Bob')
    })

    it('myPlayerId 未设置时应返回 undefined', () => {
      store.updatePlayers([makePlayer()])
      expect(store.me).toBeUndefined()
    })
  })

  // ===== 角色 computed =====
  describe('角色 computed', () => {
    it('isWitness 在 myRole 为 witness 时应返回 true', () => {
      store.setMyInfo('p1', 'witness')
      expect(store.isWitness).toBe(true)
      expect(store.isMurderer).toBe(false)
    })

    it('isMurderer 在 myRole 为 murderer 时应返回 true', () => {
      store.setMyInfo('p1', 'murderer')
      expect(store.isMurderer).toBe(true)
    })

    it('isAccomplice 在 myRole 为 accomplice 时应返回 true', () => {
      store.setMyInfo('p1', 'accomplice')
      expect(store.isAccomplice).toBe(true)
    })

    it('isDetective 在 myRole 为 detective 时应返回 true', () => {
      store.setMyInfo('p1', 'detective')
      expect(store.isDetective).toBe(true)
    })
  })

  // ===== canSolve computed =====
  describe('canSolve computed', () => {
    it('目击者无论何时都不能破案', () => {
      store.setMyInfo('p1', 'witness')
      store.updatePlayers([makePlayer({ id: 'p1', hasSolveRight: true })])
      store.setPhase('discussion-1')

      expect(store.canSolve).toBe(false)
    })

    it('侦探有破案权且处于讨论阶段时可以破案', () => {
      store.setMyInfo('p1', 'detective')
      store.updatePlayers([makePlayer({ id: 'p1', hasSolveRight: true })])
      store.setPhase('discussion-1')

      expect(store.canSolve).toBe(true)
    })

    it('侦探在 discussion-2 阶段也可以破案', () => {
      store.setMyInfo('p1', 'detective')
      store.updatePlayers([makePlayer({ id: 'p1', hasSolveRight: true })])
      store.setPhase('discussion-2')

      expect(store.canSolve).toBe(true)
    })

    it('侦探在 force-solve 阶段可以破案', () => {
      store.setMyInfo('p1', 'detective')
      store.updatePlayers([makePlayer({ id: 'p1', hasSolveRight: true })])
      store.setPhase('force-solve')

      expect(store.canSolve).toBe(true)
    })

    it('侦探失去破案权后不能破案', () => {
      store.setMyInfo('p1', 'detective')
      store.updatePlayers([makePlayer({ id: 'p1', hasSolveRight: false })])
      store.setPhase('discussion-1')

      expect(store.canSolve).toBe(false)
    })

    it('侦探在非讨论阶段不能破案', () => {
      store.setMyInfo('p1', 'detective')
      store.updatePlayers([makePlayer({ id: 'p1', hasSolveRight: true })])
      store.setPhase('night-murder')

      expect(store.canSolve).toBe(false)
    })
  })

  // ===== 阶段 computed =====
  describe('阶段 computed', () => {
    it('isNightPhase 在 night-murder 时应返回 true', () => {
      store.setPhase('night-murder')
      expect(store.isNightPhase).toBe(true)
    })

    it('isDiscussionPhase 在 discussion-1/2/3 时应返回 true', () => {
      for (const phase of ['discussion-1', 'discussion-2', 'discussion-3'] as const) {
        store.setPhase(phase)
        expect(store.isDiscussionPhase).toBe(true)
      }
    })

    it('isAdvancePhase 在 advance-1/2 时应返回 true', () => {
      for (const phase of ['advance-1', 'advance-2'] as const) {
        store.setPhase(phase)
        expect(store.isAdvancePhase).toBe(true)
      }
    })

    it('discussionRound 应返回正确的轮次号', () => {
      store.setPhase('discussion-1')
      expect(store.discussionRound).toBe(1)
      store.setPhase('discussion-2')
      expect(store.discussionRound).toBe(2)
      store.setPhase('discussion-3')
      expect(store.discussionRound).toBe(3)
    })

    it('非讨论阶段 discussionRound 应返回 0', () => {
      store.setPhase('night-murder')
      expect(store.discussionRound).toBe(0)
    })

    it('phaseLabel 应返回中文标签', () => {
      store.setPhase('waiting')
      expect(store.phaseLabel).toBe('等待中')
      store.setPhase('game-over')
      expect(store.phaseLabel).toBe('游戏结束')
    })
  })

  // ===== setSolveResult =====
  describe('setSolveResult', () => {
    it('破案失败时应移除对应玩家的破案权', () => {
      const player = makePlayer({ id: 'p1', hasSolveRight: true })
      store.updatePlayers([player])

      store.setSolveResult({ playerId: 'p1', success: false })

      expect(store.lastSolveResult).toEqual({ playerId: 'p1', success: false })
      const p = store.players.find((pl) => pl.id === 'p1')
      expect(p!.hasSolveRight).toBe(false)
    })

    it('破案成功时不应移除破案权', () => {
      const player = makePlayer({ id: 'p1', hasSolveRight: true })
      store.updatePlayers([player])

      store.setSolveResult({ playerId: 'p1', success: true })

      const p = store.players.find((pl) => pl.id === 'p1')
      expect(p!.hasSolveRight).toBe(true)
    })
  })

  // ===== syncFullState =====
  describe('syncFullState', () => {
    it('应正确同步所有状态字段', () => {
      const fullState: GameState = {
        phase: 'discussion-2',
        round: 2,
        players: [makePlayer({ id: 'p1' })],
        boards: [makeBoard({ id: 'b1' })],
        myRole: 'detective',
        murdererSelection: {
          meansCard: { id: 'M001', name: '手枪' },
          clueCard: { id: 'C001', name: '血迹' },
        },
        currentSolverId: 'p2',
        effectCard: { id: 'E01', name: '暗杀', effect: '暗杀一名玩家' },
        winner: 'detective',
        scores: { p1: 3, p2: 0 },
        blackout: true,
      }

      store.syncFullState(fullState)

      expect(store.phase).toBe('discussion-2')
      expect(store.round).toBe(2)
      expect(store.players).toHaveLength(1)
      expect(store.boards).toHaveLength(1)
      expect(store.myRole).toBe('detective')
      expect(store.murdererSelection).toEqual({
        meansCard: { id: 'M001', name: '手枪' },
        clueCard: { id: 'C001', name: '血迹' },
      })
      expect(store.currentSolverId).toBe('p2')
      expect(store.effectCard).toEqual({ id: 'E01', name: '暗杀', effect: '暗杀一名玩家' })
      expect(store.winner).toBe('detective')
      expect(store.scores).toEqual({ p1: 3, p2: 0 })
      expect(store.blackout).toBe(true)
    })

    it('缺少可选字段时不应覆盖已有状态', () => {
      store.setMyInfo('p1', 'detective')

      store.syncFullState({
        phase: 'discussion-1',
        round: 1,
        players: [],
        boards: [],
      })

      expect(store.myRole).toBe('detective')
    })
  })

  // ===== updateMarker =====
  describe('updateMarker', () => {
    it('应更新对应场景板的标记', () => {
      store.updateBoards([makeBoard({ id: 'b1' }), makeBoard({ id: 'b2' })])

      store.updateMarker('b1', 2, 3)

      const board = store.boards.find((b) => b.id === 'b1')
      expect(board!.marker).toEqual({ optionIndex: 2, markerNumber: 3 })
    })

    it('目标场景板不存在时不应报错', () => {
      store.updateBoards([makeBoard({ id: 'b1' })])

      store.updateMarker('nonexistent', 0, 1)

      expect(store.boards[0]!.marker).toBeUndefined()
    })
  })

  // ===== replaceBoard =====
  describe('replaceBoard', () => {
    it('应正确替换指定场景板', () => {
      store.updateBoards([makeBoard({ id: 'b1' }), makeBoard({ id: 'b2' })])

      const newBoard = makeBoard({ id: 'b3', title: '新场景板' })
      store.replaceBoard('b1', newBoard)

      expect(store.boards[0]!.id).toBe('b3')
      expect(store.boards[0]!.title).toBe('新场景板')
      expect(store.boards[1]!.id).toBe('b2')
    })

    it('目标场景板不存在时不应改动', () => {
      store.updateBoards([makeBoard({ id: 'b1' })])

      store.replaceBoard('nonexistent', makeBoard({ id: 'b3' }))

      expect(store.boards).toHaveLength(1)
      expect(store.boards[0]!.id).toBe('b1')
    })
  })

  // ===== reorderBoards =====
  describe('reorderBoards', () => {
    it('应按指定 ID 顺序重排 boards', () => {
      store.updateBoards([
        makeBoard({ id: 'b1', title: 'Board1' }),
        makeBoard({ id: 'b2', title: 'Board2' }),
        makeBoard({ id: 'b3', title: 'Board3' }),
      ])

      store.reorderBoards(['b3', 'b1', 'b2'])

      expect(store.boards.map((b) => b.id)).toEqual(['b3', 'b1', 'b2'])
    })

    it('应忽略不存在的 ID', () => {
      store.updateBoards([makeBoard({ id: 'b1' }), makeBoard({ id: 'b2' })])

      store.reorderBoards(['b2', 'nonexistent', 'b1'])

      expect(store.boards.map((b) => b.id)).toEqual(['b2', 'b1'])
    })
  })

  // ===== setGameOver =====
  describe('setGameOver', () => {
    it('应设置 winner、scores 并将 phase 设为 game-over', () => {
      store.setPhase('discussion-3')

      store.setGameOver('detective', { p1: 3, p2: 2, p3: 0 })

      expect(store.winner).toBe('detective')
      expect(store.scores).toEqual({ p1: 3, p2: 2, p3: 0 })
      expect(store.phase).toBe('game-over')
    })
  })

  // ===== Room state 管理 =====
  describe('房间状态管理', () => {
    it('setRoomState 应设置房间玩家列表、状态和房主', () => {
      store.setRoomState({
        players: [{ id: 'p1', nickname: 'Alice', color: '#ff0000', isHost: true }],
        status: 'waiting',
        hostId: 'p1',
      })

      expect(store.roomPlayers).toHaveLength(1)
      expect(store.roomPlayers[0]!.nickname).toBe('Alice')
      expect(store.roomStatus).toBe('waiting')
      expect(store.hostId).toBe('p1')
    })

    it('addRoomPlayer 应添加新玩家到房间列表', () => {
      store.addRoomPlayer({ id: 'p1', nickname: 'Alice', color: '#ff0000', isHost: true })

      expect(store.roomPlayers).toHaveLength(1)
    })

    it('addRoomPlayer 不应添加已存在的玩家', () => {
      store.addRoomPlayer({ id: 'p1', nickname: 'Alice', color: '#ff0000', isHost: true })
      store.addRoomPlayer({ id: 'p1', nickname: 'Alice', color: '#ff0000', isHost: true })

      expect(store.roomPlayers).toHaveLength(1)
    })

    it('removeRoomPlayer 应从房间列表移除玩家', () => {
      store.addRoomPlayer({ id: 'p1', nickname: 'Alice', color: '#ff0000', isHost: true })
      store.addRoomPlayer({ id: 'p2', nickname: 'Bob', color: '#00ff00', isHost: false })

      store.removeRoomPlayer('p1')

      expect(store.roomPlayers).toHaveLength(1)
      expect(store.roomPlayers[0]!.id).toBe('p2')
    })
  })

  // ===== accomplicePrompted =====
  describe('accomplicePrompted', () => {
    it('setAccomplicePrompted 应设置帮凶提示状态', () => {
      expect(store.accomplicePrompted).toBe(false)

      store.setAccomplicePrompted(true)

      expect(store.accomplicePrompted).toBe(true)
    })
  })

  // ===== isMyForceSolveTurn =====
  describe('isMyForceSolveTurn', () => {
    it('在 force-solve 阶段且轮到自己时应返回 true', () => {
      store.setMyInfo('p1', 'detective')
      store.setPhase('force-solve')
      store.setForceSolveTurn('p1')

      expect(store.isMyForceSolveTurn).toBe(true)
    })

    it('不是自己的回合时应返回 false', () => {
      store.setMyInfo('p1', 'detective')
      store.setPhase('force-solve')
      store.setForceSolveTurn('p2')

      expect(store.isMyForceSolveTurn).toBe(false)
    })

    it('不在 force-solve 阶段时应返回 false', () => {
      store.setMyInfo('p1', 'detective')
      store.setPhase('discussion-1')
      store.setForceSolveTurn('p1')

      expect(store.isMyForceSolveTurn).toBe(false)
    })
  })

  // ===== murderer computed =====
  describe('murderer computed', () => {
    it('应返回角色为 murderer 的玩家', () => {
      store.updatePlayers([
        makePlayer({ id: 'p1', role: 'detective' }),
        makePlayer({ id: 'p2', role: 'murderer', nickname: 'Killer' }),
      ])

      expect(store.murderer).toBeDefined()
      expect(store.murderer!.id).toBe('p2')
    })
  })

  // ===== nonWitnessPlayers computed =====
  describe('nonWitnessPlayers computed', () => {
    it('应过滤掉目击者', () => {
      store.updatePlayers([
        makePlayer({ id: 'p1', role: 'witness' }),
        makePlayer({ id: 'p2', role: 'murderer' }),
        makePlayer({ id: 'p3', role: 'detective' }),
      ])

      expect(store.nonWitnessPlayers).toHaveLength(2)
      expect(store.nonWitnessPlayers.every((p) => p.role !== 'witness')).toBe(true)
    })
  })

  // ===== setBlackout =====
  describe('setBlackout', () => {
    it('应切换停电状态', () => {
      expect(store.blackout).toBe(false)
      store.setBlackout(true)
      expect(store.blackout).toBe(true)
      store.setBlackout(false)
      expect(store.blackout).toBe(false)
    })
  })

  // ===== systemMessage =====
  describe('systemMessage', () => {
    it('setSystemMessage 应设置系统消息', () => {
      store.setSystemMessage('测试消息', 'error')

      expect(store.systemMessage).toEqual({ content: '测试消息', type: 'error' })
    })

    it('setSystemMessage 默认类型为 info', () => {
      store.setSystemMessage('信息')

      expect(store.systemMessage!.type).toBe('info')
    })

    it('clearSystemMessage 应清空系统消息', () => {
      store.setSystemMessage('测试')
      store.clearSystemMessage()

      expect(store.systemMessage).toBeNull()
    })
  })

  // ===== reset =====
  describe('reset', () => {
    it('应清空所有状态恢复初始值', () => {
      store.setMyInfo('p1', 'detective')
      store.setPhase('discussion-2')
      store.updatePlayers([makePlayer()])
      store.updateBoards([makeBoard()])
      store.setMurdererSelection({
        meansCard: { id: 'M001', name: '手枪' },
        clueCard: { id: 'C001', name: '血迹' },
      })
      store.setBlackout(true)
      store.setSystemMessage('test')
      store.setAccomplicePrompted(true)

      store.reset()

      expect(store.phase).toBe('waiting')
      expect(store.round).toBe(1)
      expect(store.players).toHaveLength(0)
      expect(store.boards).toHaveLength(0)
      expect(store.myRole).toBeUndefined()
      expect(store.myPlayerId).toBeUndefined()
      expect(store.murdererSelection).toBeUndefined()
      expect(store.blackout).toBe(false)
      expect(store.systemMessage).toBeNull()
      expect(store.lastSolveResult).toBeNull()
      expect(store.newBoards).toHaveLength(0)
      expect(store.forceSolveTurnPlayerId).toBeUndefined()
      expect(store.accomplicePrompted).toBe(false)
    })
  })
})
