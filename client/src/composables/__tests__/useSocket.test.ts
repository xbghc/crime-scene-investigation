import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Player, SceneBoard, GameState } from '../../types'

// === Mock socket.io-client ===

type EventHandler = (...args: unknown[]) => void

interface MockSocket {
  connected: boolean
  on: ReturnType<typeof vi.fn>
  emit: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}

function createMockSocket(): MockSocket {
  return {
    connected: false,
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  }
}

let mockSocket: MockSocket = createMockSocket()

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}))

/** Retrieve the handler registered for a specific event name */
function getHandler(eventName: string): EventHandler | undefined {
  const call = mockSocket.on.mock.calls.find((c: unknown[]) => c[0] === eventName)
  return call ? (call[1] as EventHandler) : undefined
}

/** Fire a mock server event by finding the handler and invoking it */
function fireEvent(eventName: string, ...args: unknown[]): void {
  const handler = getHandler(eventName)
  if (!handler) {
    const registeredEvents = mockSocket.on.mock.calls.map((c: unknown[]) => c[0])
    throw new Error(
      `No handler registered for event: ${eventName}. Registered: ${registeredEvents.join(', ')}`,
    )
  }
  handler(...args)
}

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

// Lazy-import stores and composable (after mock is set up)
// We import them once since vi.mock is hoisted before imports
import { useGameStore } from '../../stores/game'
import { useAuthStore } from '../../stores/auth'
import { useSocket } from '../useSocket'

describe('useSocket', () => {
  let gameStore: ReturnType<typeof useGameStore>
  let authStore: ReturnType<typeof useAuthStore>

  beforeEach(() => {
    // Create fresh mock socket
    mockSocket = createMockSocket()

    // Fresh pinia for each test
    setActivePinia(createPinia())
    gameStore = useGameStore()
    authStore = useAuthStore()
    authStore.$patch({ token: 'fake-jwt-token' })

    // Disconnect any previous socket singleton to allow fresh connect()
    const { disconnect } = useSocket()
    disconnect()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  /** Helper: connect and return the composable */
  function connectSocket() {
    const socket = useSocket()
    socket.connect()
    return socket
  }

  // ===== 连接管理 =====
  describe('连接管理', () => {
    it('connect 应注册连接和游戏事件处理器', () => {
      connectSocket()

      expect(mockSocket.on).toHaveBeenCalled()
      const registeredEvents = mockSocket.on.mock.calls.map((c: unknown[]) => c[0])
      expect(registeredEvents).toContain('connect')
      expect(registeredEvents).toContain('disconnect')
      expect(registeredEvents).toContain('game_started')
      expect(registeredEvents).toContain('room_state')
      expect(registeredEvents).toContain('full_state')
      expect(registeredEvents).toContain('murderer_selection_update')
    })

    it('connect 已连接时不应重复创建 socket', () => {
      connectSocket()
      const firstCallCount = mockSocket.on.mock.calls.length
      mockSocket.connected = true

      // Second call should be a no-op
      useSocket().connect()
      expect(mockSocket.on.mock.calls.length).toBe(firstCallCount)
    })

    it('disconnect 应断开连接并重置 connected 状态', () => {
      const { connect, disconnect, connected } = useSocket()

      connect()
      fireEvent('connect')
      expect(connected.value).toBe(true)

      disconnect()
      expect(mockSocket.disconnect).toHaveBeenCalled()
      expect(connected.value).toBe(false)
    })

    it('connect 事件应将 connected 设为 true 并清除 connectionError', () => {
      const { connected, connectionError } = connectSocket()

      fireEvent('connect')

      expect(connected.value).toBe(true)
      expect(connectionError.value).toBeNull()
    })

    it('disconnect 事件应将 connected 设为 false', () => {
      const { connected } = connectSocket()

      fireEvent('connect')
      fireEvent('disconnect')

      expect(connected.value).toBe(false)
    })

    it('connect_error 事件应记录错误信息', () => {
      const { connectionError } = connectSocket()

      fireEvent('connect_error', new Error('连接失败'))

      expect(connectionError.value).toBe('连接失败')
    })

    it('reconnect 事件应 emit request_state', () => {
      connectSocket()

      fireEvent('reconnect')

      expect(mockSocket.emit).toHaveBeenCalledWith('request_state')
    })
  })

  // ===== 出站事件 =====
  describe('出站事件（emit 方法）', () => {
    it('joinRoom 应 emit join_room 事件并携带 nickname', () => {
      const { joinRoom } = connectSocket()

      joinRoom('Alice')

      expect(mockSocket.emit).toHaveBeenCalledWith('join_room', { nickname: 'Alice' })
    })

    it('startGame 应 emit start_game 事件', () => {
      const { startGame } = connectSocket()

      startGame()

      expect(mockSocket.emit).toHaveBeenCalledWith('start_game')
    })

    it('murdererSelect 应 emit murderer_select 并携带卡牌 ID', () => {
      const { murdererSelect } = connectSocket()

      murdererSelect('M001', 'C001')

      expect(mockSocket.emit).toHaveBeenCalledWith('murderer_select', {
        meansCardId: 'M001',
        clueCardId: 'C001',
      })
    })

    it('witnessSetMarker 应 emit witness_set_marker 并携带正确参数', () => {
      const { witnessSetMarker } = connectSocket()

      witnessSetMarker('board-1', 2, 3)

      expect(mockSocket.emit).toHaveBeenCalledWith('witness_set_marker', {
        boardId: 'board-1',
        optionIndex: 2,
        markerNumber: 3,
      })
    })

    it('witnessConfirm 应 emit witness_confirm 事件', () => {
      const { witnessConfirm } = connectSocket()

      witnessConfirm()

      expect(mockSocket.emit).toHaveBeenCalledWith('witness_confirm')
    })

    it('witnessReplaceBoard 应 emit witness_replace_board 并携带替换参数', () => {
      const { witnessReplaceBoard } = connectSocket()

      witnessReplaceBoard('old-board', 'new-board', 1, 4)

      expect(mockSocket.emit).toHaveBeenCalledWith('witness_replace_board', {
        oldBoardId: 'old-board',
        newBoardId: 'new-board',
        optionIndex: 1,
        markerNumber: 4,
      })
    })

    it('endDiscussion 应 emit end_discussion 事件', () => {
      const { endDiscussion } = connectSocket()

      endDiscussion()

      expect(mockSocket.emit).toHaveBeenCalledWith('end_discussion')
    })

    it('accompliceChoose 应 emit accomplice_choose 并携带选择参数', () => {
      const { accompliceChoose } = connectSocket()

      accompliceChoose(true, 'C002')

      expect(mockSocket.emit).toHaveBeenCalledWith('accomplice_choose', {
        replaceClue: true,
        newClueCardId: 'C002',
      })
    })

    it('accompliceChoose 不替换时 newClueCardId 应为 undefined', () => {
      const { accompliceChoose } = connectSocket()

      accompliceChoose(false)

      expect(mockSocket.emit).toHaveBeenCalledWith('accomplice_choose', {
        replaceClue: false,
        newClueCardId: undefined,
      })
    })

    it('attemptSolve 应 emit attempt_solve 并携带破案参数', () => {
      const { attemptSolve } = connectSocket()

      attemptSolve('suspect-1', 'M001', 'C001')

      expect(mockSocket.emit).toHaveBeenCalledWith('attempt_solve', {
        suspectId: 'suspect-1',
        meansCardId: 'M001',
        clueCardId: 'C001',
      })
    })

    it('witnessConfirmMurder 应 emit witness_confirm_murder 事件', () => {
      const { witnessConfirmMurder } = connectSocket()

      witnessConfirmMurder()

      expect(mockSocket.emit).toHaveBeenCalledWith('witness_confirm_murder')
    })

    it('effectAction 应 emit effect_action 并携带效果 ID 和数据', () => {
      const { effectAction } = connectSocket()

      effectAction('E01', { targetId: 'p2' })

      expect(mockSocket.emit).toHaveBeenCalledWith('effect_action', {
        effectId: 'E01',
        data: { targetId: 'p2' },
      })
    })

    it('witnessFinishAdvance 应 emit witness_finish_advance 事件', () => {
      const { witnessFinishAdvance } = connectSocket()

      witnessFinishAdvance()

      expect(mockSocket.emit).toHaveBeenCalledWith('witness_finish_advance')
    })

    it('resetGame 应 emit reset_game 事件', () => {
      const { resetGame } = connectSocket()

      resetGame()

      expect(mockSocket.emit).toHaveBeenCalledWith('reset_game')
    })
  })

  // ===== 入站事件 — 房间管理 =====
  describe('入站事件 - 房间管理', () => {
    it('room_state 事件应调用 gameStore.setRoomState', () => {
      connectSocket()
      const roomData = {
        players: [{ id: 'p1', nickname: 'Alice', color: '#ff0000', isHost: true }],
        status: 'waiting' as const,
        hostId: 'p1',
      }

      fireEvent('room_state', roomData)

      expect(gameStore.roomPlayers).toHaveLength(1)
      expect(gameStore.roomPlayers[0].nickname).toBe('Alice')
      expect(gameStore.hostId).toBe('p1')
    })

    it('player_joined 事件应添加玩家到房间列表', () => {
      connectSocket()

      fireEvent('player_joined', {
        player: { id: 'p1', nickname: 'Alice', color: '#ff0000', isHost: false },
      })

      expect(gameStore.roomPlayers).toHaveLength(1)
      expect(gameStore.roomPlayers[0].id).toBe('p1')
    })

    it('player_left 事件应从房间列表移除玩家', () => {
      connectSocket()
      gameStore.addRoomPlayer({ id: 'p1', nickname: 'Alice', color: '#ff0000', isHost: false })

      fireEvent('player_left', { playerId: 'p1' })

      expect(gameStore.roomPlayers).toHaveLength(0)
    })

    it('full_state 事件含完整数据时应同步所有字段', () => {
      connectSocket()
      const syncData = {
        phase: 'discussion-1' as const,
        round: 2,
        players: [makePlayer({ id: 'p1' })],
        boards: [makeBoard({ id: 'b1' })],
        myRole: 'detective' as const,
        murdererSelection: { meansCardId: 'M001', clueCardId: 'C001' },
      }

      fireEvent('full_state', syncData)

      expect(gameStore.phase).toBe('discussion-1')
      expect(gameStore.round).toBe(2)
      expect(gameStore.players).toHaveLength(1)
      expect(gameStore.boards).toHaveLength(1)
      expect(gameStore.myRole).toBe('detective')
      expect(gameStore.murdererSelection).toEqual({ meansCardId: 'M001', clueCardId: 'C001' })
    })

    it('full_state 事件缺少 round 时应默认为 1', () => {
      connectSocket()

      fireEvent('full_state', {
        phase: 'waiting' as const,
        players: [],
        boards: [],
      })

      expect(gameStore.round).toBe(1)
    })
  })

  // ===== 入站事件 — 推进阶段 =====
  describe('入站事件 - 推进阶段', () => {
    it('accomplice_prompt 事件应设置帮凶提示状态', () => {
      connectSocket()

      fireEvent('accomplice_prompt', {})

      expect(gameStore.accomplicePrompted).toBe(true)
    })

    it('murderer_selection_update 事件应更新凶手选牌（帮凶实时查看）', () => {
      connectSocket()

      fireEvent('murderer_selection_update', {
        selectedMeansId: 'M003',
        selectedClueId: 'C005',
        confirmed: false,
      })

      expect(gameStore.murdererSelection).toEqual({
        meansCardId: 'M003',
        clueCardId: 'C005',
      })
    })
  })

  // ===== 入站事件 — 游戏生命周期 =====
  describe('入站事件 - 游戏生命周期', () => {
    it('game_started 事件应设置角色、构建玩家列表并设置 phase', () => {
      // Set up auth userId via a properly formed JWT
      // JWT payload: {"id":"p1"} → base64: eyJpZCI6InAxIn0
      authStore.$patch({ token: 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InAxIn0.fake' })

      // Pre-populate room players
      gameStore.setRoomState({
        players: [
          { id: 'p1', nickname: 'Alice', color: '#ff0000', isHost: true },
          { id: 'p2', nickname: 'Bob', color: '#00ff00', isHost: false },
        ],
        status: 'waiting',
        hostId: 'p1',
      })

      connectSocket()
      fireEvent('game_started', {
        role: 'detective',
        cards: null,
        allPlayerCards: [
          { playerId: 'p1', meansCards: [{ id: 'M001', name: '手枪' }], clueCards: [] },
          { playerId: 'p2', meansCards: [], clueCards: [{ id: 'C001', name: '血迹' }] },
        ],
      })

      expect(gameStore.phase).toBe('role-reveal')
      expect(gameStore.myRole).toBe('detective')
      expect(gameStore.players).toHaveLength(2)
      expect(gameStore.players[0].meansCards).toHaveLength(1)
      expect(gameStore.players[0].status).toBe('alive')
      expect(gameStore.players[0].hasSolveRight).toBe(true)
    })

    it('night_phase 事件应将 phase 设为 night-murder', () => {
      connectSocket()

      fireEvent('night_phase', {})

      expect(gameStore.phase).toBe('night-murder')
    })

    it('murderer_selected 事件应设置凶手选牌', () => {
      connectSocket()

      fireEvent('murderer_selected', { meansCardId: 'M001', clueCardId: 'C001' })

      expect(gameStore.murdererSelection).toEqual({ meansCardId: 'M001', clueCardId: 'C001' })
    })

    it('phase_change 事件应更新 phase 及可选的 players 和 boards', () => {
      connectSocket()
      const players = [makePlayer({ id: 'p1' })]
      const boards = [makeBoard({ id: 'b1' })]

      fireEvent('phase_change', { phase: 'witness-accuse', players, boards })

      expect(gameStore.phase).toBe('witness-accuse')
      expect(gameStore.players).toHaveLength(1)
      expect(gameStore.boards).toHaveLength(1)
    })

    it('phase_change 不含 players/boards 时不应覆盖已有数据', () => {
      connectSocket()
      gameStore.updatePlayers([makePlayer({ id: 'existing' })])

      fireEvent('phase_change', { phase: 'discussion-1' })

      expect(gameStore.phase).toBe('discussion-1')
      expect(gameStore.players).toHaveLength(1)
      expect(gameStore.players[0].id).toBe('existing')
    })
  })

  // ===== 入站事件 — 场景板与标记 =====
  describe('入站事件 - 场景板与标记', () => {
    it('boards_revealed 事件应更新场景板列表', () => {
      connectSocket()
      const boards = [makeBoard({ id: 'b1' }), makeBoard({ id: 'b2' })]

      fireEvent('boards_revealed', { boards })

      expect(gameStore.boards).toHaveLength(2)
    })

    it('marker_placed 事件应更新对应场景板的标记', () => {
      connectSocket()
      gameStore.updateBoards([makeBoard({ id: 'b1' })])

      fireEvent('marker_placed', { boardId: 'b1', optionIndex: 1, markerNumber: 3 })

      expect(gameStore.boards[0].marker).toEqual({ optionIndex: 1, markerNumber: 3 })
    })

    it('board_replaced 事件应替换旧场景板（含 marker）', () => {
      connectSocket()
      gameStore.updateBoards([makeBoard({ id: 'b1' })])

      const newBoard = makeBoard({ id: 'b2', title: '新场景板' })
      fireEvent('board_replaced', {
        oldBoardId: 'b1',
        newBoard,
        optionIndex: 0,
        markerNumber: 2,
      })

      expect(gameStore.boards[0].id).toBe('b2')
      expect(gameStore.boards[0].marker).toEqual({ optionIndex: 0, markerNumber: 2 })
    })

    it('board_replaced 事件不含 marker 参数时不应设置 marker', () => {
      connectSocket()
      gameStore.updateBoards([makeBoard({ id: 'b1' })])

      const newBoard = makeBoard({ id: 'b2' })
      fireEvent('board_replaced', { oldBoardId: 'b1', newBoard })

      expect(gameStore.boards[0].id).toBe('b2')
      expect(gameStore.boards[0].marker).toBeUndefined()
    })

    it('new_boards 事件应设置新场景板列表', () => {
      connectSocket()
      const boards = [makeBoard({ id: 'nb1' })]

      fireEvent('new_boards', { boards })

      expect(gameStore.newBoards).toHaveLength(1)
      expect(gameStore.newBoards[0].id).toBe('nb1')
    })
  })

  // ===== 入站事件 — 效果牌 =====
  describe('入站事件 - 效果牌', () => {
    it('effect_card 事件应设置效果牌', () => {
      connectSocket()
      const card = { id: 'E01', name: '暗杀', effect: '暗杀一名玩家' }

      fireEvent('effect_card', { card })

      expect(gameStore.effectCard).toEqual(card)
    })

    it('effect_card 事件含 result.message 时应设置系统消息', () => {
      connectSocket()

      fireEvent('effect_card', {
        card: { id: 'E01', name: '暗杀', effect: '' },
        result: { message: '玩家被暗杀' },
      })

      expect(gameStore.systemMessage).toEqual({ content: '玩家被暗杀', type: 'info' })
    })

    it('effect_card 事件含 result.players 时应更新玩家列表', () => {
      connectSocket()
      const updatedPlayers = [makePlayer({ id: 'p1', status: 'dead' })]

      fireEvent('effect_card', {
        card: { id: 'E01', name: '暗杀', effect: '' },
        result: { players: updatedPlayers },
      })

      expect(gameStore.players[0].status).toBe('dead')
    })

    it('effect_card 事件含 result.blackout 时应设置停电状态', () => {
      connectSocket()

      fireEvent('effect_card', {
        card: { id: 'E07', name: '停电', effect: '' },
        result: { blackout: true },
      })

      expect(gameStore.blackout).toBe(true)
    })

    it('blackout_end 事件应解除停电状态', () => {
      connectSocket()
      gameStore.setBlackout(true)

      fireEvent('blackout_end')

      expect(gameStore.blackout).toBe(false)
    })
  })

  // ===== 入站事件 — 破案与线索 =====
  describe('入站事件 - 破案与线索', () => {
    it('clue_replaced 事件应更新 murdererSelection 的 clueCardId', () => {
      connectSocket()
      gameStore.setMurdererSelection({ meansCardId: 'M001', clueCardId: 'C001' })

      fireEvent('clue_replaced', { newClueCardId: 'C002' })

      expect(gameStore.murdererSelection).toEqual({ meansCardId: 'M001', clueCardId: 'C002' })
    })

    it('clue_replaced 事件在无已有选择时不应报错', () => {
      connectSocket()

      fireEvent('clue_replaced', { newClueCardId: 'C002' })

      expect(gameStore.murdererSelection).toBeUndefined()
    })

    it('solve_result 成功事件应设置结果并显示成功消息', () => {
      connectSocket()
      gameStore.updatePlayers([makePlayer({ id: 'p1', nickname: 'Alice' })])

      fireEvent('solve_result', { playerId: 'p1', success: true })

      expect(gameStore.lastSolveResult).toEqual({ playerId: 'p1', success: true })
      expect(gameStore.systemMessage!.content).toBe('破案成功！')
      expect(gameStore.systemMessage!.type).toBe('success')
    })

    it('solve_result 失败事件应设置结果、移除破案权并显示失败消息', () => {
      connectSocket()
      gameStore.updatePlayers([makePlayer({ id: 'p1', nickname: 'Alice', hasSolveRight: true })])

      fireEvent('solve_result', { playerId: 'p1', success: false })

      expect(gameStore.lastSolveResult).toEqual({ playerId: 'p1', success: false })
      expect(gameStore.players[0].hasSolveRight).toBe(false)
      expect(gameStore.systemMessage!.content).toContain('Alice')
      expect(gameStore.systemMessage!.content).toContain('破案失败')
      expect(gameStore.systemMessage!.type).toBe('error')
    })

    it('force_solve_turn 事件应设置当前强制破案玩家', () => {
      connectSocket()

      fireEvent('force_solve_turn', { playerId: 'p3' })

      expect(gameStore.forceSolveTurnPlayerId).toBe('p3')
    })
  })

  // ===== 入站事件 — 游戏结束 =====
  describe('入站事件 - 游戏结束', () => {
    it('game_over 事件应设置角色、选牌、winner 和 scores', () => {
      connectSocket()
      gameStore.updatePlayers([
        makePlayer({ id: 'p1', nickname: 'Alice' }),
        makePlayer({ id: 'p2', nickname: 'Bob' }),
      ])

      fireEvent('game_over', {
        winner: 'detective',
        roles: { p1: 'detective', p2: 'murderer' },
        solution: { meansCardId: 'M001', clueCardId: 'C001' },
        scores: { p1: 3, p2: 0 },
      })

      expect(gameStore.winner).toBe('detective')
      expect(gameStore.phase).toBe('game-over')
      expect(gameStore.scores).toEqual({ p1: 3, p2: 0 })
      expect(gameStore.murdererSelection).toEqual({ meansCardId: 'M001', clueCardId: 'C001' })
      expect(gameStore.players[0].role).toBe('detective')
      expect(gameStore.players[1].role).toBe('murderer')
    })
  })

  // ===== 入站事件 — 系统消息与状态同步 =====
  describe('入站事件 - 系统消息与状态同步', () => {
    it('system_message 事件应设置系统消息', () => {
      connectSocket()

      fireEvent('system_message', { content: '有玩家断线', type: 'error' })

      expect(gameStore.systemMessage).toEqual({ content: '有玩家断线', type: 'error' })
    })

    it('system_message 事件无 type 时应默认为 info', () => {
      connectSocket()

      fireEvent('system_message', { content: '提示信息' })

      expect(gameStore.systemMessage!.type).toBe('info')
    })

    it('full_state 事件应调用 syncFullState 同步完整状态', () => {
      connectSocket()
      const fullState: GameState = {
        phase: 'discussion-3',
        round: 3,
        players: [makePlayer({ id: 'p1' })],
        boards: [makeBoard({ id: 'b1' })],
        myRole: 'witness',
        blackout: false,
      }

      fireEvent('full_state', fullState)

      expect(gameStore.phase).toBe('discussion-3')
      expect(gameStore.round).toBe(3)
      expect(gameStore.myRole).toBe('witness')
    })
  })
})
