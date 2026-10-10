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
    emit: vi.fn((event: string, data?: unknown, ack?: (result: unknown) => void) => {
      // A brand-new identity has no membership to resume; the server still
      // acknowledges the discovery request so entry actions can proceed.
      if (event === 'resume_room' && JSON.stringify(data) === '{}') ack?.({ ok: true })
    }),
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
import { ROOM_CODE_KEY, useSocket } from '../useSocket'

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
    useSocket().disconnect()
    vi.useRealTimers()
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
      expect(registeredEvents).toContain('advance_ready')
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

    it('重连使用 connect 事件恢复已保存房间，不依赖 Socket 上不存在的 reconnect 事件', () => {
      localStorage.setItem(ROOM_CODE_KEY, 'ABC123')
      connectSocket()
      fireEvent('connect')
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'resume_room',
        { code: 'ABC123' },
        expect.any(Function),
      )
      fireEvent('disconnect')
      fireEvent('connect')
      expect(mockSocket.emit.mock.calls.filter((call) => call[0] === 'resume_room')).toHaveLength(2)
    })

    it('连接中或断线重试时也不应重复创建 socket', () => {
      connectSocket()
      const count = mockSocket.on.mock.calls.length
      useSocket().connect()
      expect(mockSocket.on.mock.calls.length).toBe(count)
    })

    it('只有昵称缓存时仅按身份查询，不应自动加入房间', () => {
      localStorage.setItem('csi_nickname', 'Alice')
      connectSocket()
      fireEvent('connect')
      expect(mockSocket.emit).toHaveBeenCalledWith('resume_room', {}, expect.any(Function))
      expect(mockSocket.emit.mock.calls.some((call) => call[0] === 'join_room')).toBe(false)
    })
  })

  describe('房间操作与恢复', () => {
    function acknowledge(event: string, result: unknown) {
      const call = [...mockSocket.emit.mock.calls]
        .reverse()
        .find((args: unknown[]) => args[0] === event)
      expect(call).toBeDefined()
      const callback = call![call!.length - 1] as (result: unknown) => void
      callback(result)
    }

    function roomState(code = 'ABC123', status: 'waiting' | 'playing' = 'waiting') {
      return {
        code,
        minPlayers: 4,
        maxPlayers: 10,
        status,
        hostId: 'p1',
        players: [{ id: 'p1', nickname: 'Alice', color: '#f00', isHost: true, connected: true }],
      }
    }

    function populatePrivateState() {
      gameStore.setMyInfo('p1', 'murderer')
      gameStore.setPhase('discussion-2')
      gameStore.setMurdererSelection({
        meansCard: { id: 'M001', name: '刀' },
        clueCard: { id: 'C001', name: '脚印' },
      })
      gameStore.setNewBoards([makeBoard()])
      gameStore.setEffectCard({ id: 'E01', name: '效果', effect: '测试' })
      gameStore.setForceSolveTurn('p1')
      gameStore.setBlackout(true)
      gameStore.setSolveResult({ playerId: 'p1', success: false })
      gameStore.setAccomplicePrompted(true)
    }

    function expectCleared() {
      expect(gameStore.roomCode).toBeNull()
      expect(gameStore.roomPlayers).toEqual([])
      expect(gameStore.hostId).toBeNull()
      expect(gameStore.phase).toBe('waiting')
      expect(gameStore.myRole).toBeUndefined()
      expect(gameStore.myPlayerId).toBeUndefined()
      expect(gameStore.murdererSelection).toBeUndefined()
      expect(gameStore.players).toEqual([])
      expect(gameStore.boards).toEqual([])
      expect(gameStore.effectCard).toBeUndefined()
      expect(gameStore.newBoards).toEqual([])
      expect(gameStore.forceSolveTurnPlayerId).toBeUndefined()
      expect(gameStore.blackout).toBe(false)
      expect(gameStore.lastSolveResult).toBeNull()
      expect(gameStore.accomplicePrompted).toBe(false)
    }

    it('等待服务端确认时保持入口，失败不会写入房间', async () => {
      const api = connectSocket()
      fireEvent('connect')
      const result = api.joinRoom('Alice', 'ABC123')
      expect(api.roomPending.value).toBe('join')
      expect(gameStore.roomCode).toBeNull()
      expect(localStorage.getItem(ROOM_CODE_KEY)).toBeNull()
      acknowledge('join_room', { ok: false, error: '房间已满' })
      expect(await result).toEqual({ ok: false, error: '房间已满' })
      expect(api.roomPending.value).toBeNull()
      expect(api.roomError.value).toBe('房间已满')
      expect(gameStore.roomCode).toBeNull()
    })

    it('创建成功状态在 ack 前也可确认会员并保存房间码', async () => {
      const api = connectSocket()
      fireEvent('connect')
      const result = api.createRoom(' Alice ')
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'create_room',
        { nickname: 'Alice' },
        expect.any(Function),
      )
      fireEvent('room_state', roomState())
      expect(await result).toEqual({ ok: true, code: 'ABC123' })
      expect(gameStore.roomCode).toBe('ABC123')
      expect(localStorage.getItem(ROOM_CODE_KEY)).toBe('ABC123')
      expect(api.roomPending.value).toBeNull()
    })

    it('成功 ack 可保存代码但不会伪造房间状态', async () => {
      const api = connectSocket()
      fireEvent('connect')
      const result = api.createRoom('Alice')
      acknowledge('create_room', { ok: true, code: 'ABC123' })
      await result
      expect(localStorage.getItem(ROOM_CODE_KEY)).toBe('ABC123')
      expect(gameStore.roomCode).toBeNull()
    })

    it('离线请求与重复请求不排队发送', async () => {
      const api = connectSocket()
      expect((await api.createRoom('Alice')).ok).toBe(false)
      expect(mockSocket.emit).not.toHaveBeenCalled()
      fireEvent('connect')
      void api.createRoom('Alice')
      expect((await api.joinRoom('Alice', 'ABC123')).ok).toBe(false)
      expect(mockSocket.emit.mock.calls.filter((call) => call[0] !== 'resume_room')).toHaveLength(1)
    })

    it('已过期或不属于当前身份的恢复请求清除旧状态', () => {
      localStorage.setItem(ROOM_CODE_KEY, 'ABC123')
      const api = connectSocket()
      gameStore.setRoomState(roomState())
      populatePrivateState()
      fireEvent('connect')
      acknowledge('resume_room', { ok: false, error: '房间不存在或已过期' })
      expectCleared()
      expect(localStorage.getItem(ROOM_CODE_KEY)).toBeNull()
      expect(api.roomError.value).toBe('房间不存在或已过期')
    })

    it('恢复超时保留缓存并结束 busy，允许重试', async () => {
      vi.useFakeTimers()
      localStorage.setItem(ROOM_CODE_KEY, 'ABC123')
      const api = connectSocket()
      fireEvent('connect')
      await vi.advanceTimersByTimeAsync(8000)
      expect(api.roomPending.value).toBeNull()
      expect(api.roomError.value).toContain('超时')
      expect(localStorage.getItem(ROOM_CODE_KEY)).toBe('ABC123')
      void api.resumeRoom()
      expect(api.roomPending.value).toBe('resume')
    })

    it('失败的退出保持原房间及私有状态', async () => {
      const api = connectSocket()
      fireEvent('connect')
      fireEvent('room_state', roomState())
      populatePrivateState()
      const result = api.leaveRoom()
      expect(gameStore.roomCode).toBe('ABC123')
      acknowledge('leave_room', { ok: false, error: '游戏进行中' })
      expect((await result).ok).toBe(false)
      expect(gameStore.roomCode).toBe('ABC123')
      expect(gameStore.myRole).toBe('murderer')
    })

    it.each(['room_left', 'room_closed'])('%s 清除房间、缓存和全部私有状态', (event) => {
      connectSocket()
      fireEvent('room_state', roomState())
      populatePrivateState()
      fireEvent(event)
      expectCleared()
      expect(localStorage.getItem(ROOM_CODE_KEY)).toBeNull()
    })

    it('退出成功 ack 即使没有 room_left 也会清理状态', async () => {
      const api = connectSocket()
      fireEvent('connect')
      fireEvent('room_state', roomState())
      populatePrivateState()
      const result = api.leaveRoom()
      acknowledge('leave_room', { ok: true })
      expect((await result).ok).toBe(true)
      expectCleared()
    })

    it('session_replaced 清除当前窗口、保留共享缓存且阻止自动抢回连接', () => {
      const api = connectSocket()
      fireEvent('connect')
      fireEvent('room_state', roomState())
      populatePrivateState()
      fireEvent('session_replaced')
      expectCleared()
      expect(api.sessionReplaced.value).toBe(true)
      expect(localStorage.getItem(ROOM_CODE_KEY)).toBe('ABC123')
      expect(mockSocket.disconnect).toHaveBeenCalled()
      const calls = mockSocket.on.mock.calls.length
      api.connect()
      expect(mockSocket.on.mock.calls.length).toBe(calls)
      fireEvent('room_state', roomState())
      fireEvent('full_state', {
        phase: 'night-murder',
        players: [],
        boards: [],
        myRole: 'murderer',
      })
      expect(gameStore.roomCode).toBeNull()
      expect(gameStore.myRole).toBeUndefined()
      expect(gameStore.phase).toBe('waiting')
    })

    it('游戏重置保留房间并清空上一局身份与线索', () => {
      connectSocket()
      fireEvent('room_state', roomState())
      populatePrivateState()
      fireEvent('room_state', roomState())
      expect(gameStore.roomCode).toBe('ABC123')
      expect(gameStore.roomPlayers).toHaveLength(1)
      expect(gameStore.phase).toBe('waiting')
      expect(gameStore.myRole).toBeUndefined()
      expect(gameStore.murdererSelection).toBeUndefined()
      expect(gameStore.effectCard).toBeUndefined()
      expect(gameStore.newBoards).toEqual([])
    })
  })

  // ===== 出站事件 =====
  describe('出站事件（emit 方法）', () => {
    it('joinRoom 应 emit join_room 事件并携带 nickname 和房间码', () => {
      const { joinRoom } = connectSocket()

      fireEvent('connect')
      void joinRoom(' Alice ', 'abc123')

      expect(mockSocket.emit).toHaveBeenCalledWith(
        'join_room',
        { nickname: 'Alice', code: 'ABC123' },
        expect.any(Function),
      )
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
        code: 'ABC123',
        minPlayers: 4,
        maxPlayers: 10,
        players: [{ id: 'p1', nickname: 'Alice', color: '#ff0000', isHost: true }],
        status: 'waiting' as const,
        hostId: 'p1',
      }

      fireEvent('room_state', roomData)

      expect(gameStore.roomPlayers).toHaveLength(1)
      expect(gameStore.roomPlayers[0]!.nickname).toBe('Alice')
      expect(gameStore.hostId).toBe('p1')
    })

    it('player_joined 事件应添加玩家到房间列表', () => {
      connectSocket()

      fireEvent('player_joined', {
        player: { id: 'p1', nickname: 'Alice', color: '#ff0000', isHost: false },
      })

      expect(gameStore.roomPlayers).toHaveLength(1)
      expect(gameStore.roomPlayers[0]!.id).toBe('p1')
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
        meansCard: { id: 'M003', name: '手枪' },
        clueCard: { id: 'C005', name: '脚印' },
        confirmed: false,
      })

      expect(gameStore.murdererSelection).toEqual({
        meansCard: { id: 'M003', name: '手枪' },
        clueCard: { id: 'C005', name: '脚印' },
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
        code: 'ABC123',
        minPlayers: 4,
        maxPlayers: 10,
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
      expect(gameStore.players[0]!.meansCards).toHaveLength(1)
      expect(gameStore.players[0]!.status).toBe('alive')
      expect(gameStore.players[0]!.hasSolveRight).toBe(true)
    })

    it('night_phase 事件应将 phase 设为 night-murder', () => {
      connectSocket()

      fireEvent('night_phase', {})

      expect(gameStore.phase).toBe('night-murder')
    })

    it('murderer_selected 事件应设置凶手选牌', () => {
      connectSocket()

      fireEvent('murderer_selected', {
        meansCard: { id: 'M001', name: '手枪' },
        clueCard: { id: 'C001', name: '血迹' },
      })

      expect(gameStore.murdererSelection).toEqual({
        meansCard: { id: 'M001', name: '手枪' },
        clueCard: { id: 'C001', name: '血迹' },
      })
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
      expect(gameStore.players[0]!.id).toBe('existing')
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

      expect(gameStore.boards[0]!.marker).toEqual({ optionIndex: 1, markerNumber: 3 })
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

      expect(gameStore.boards[0]!.id).toBe('b2')
      expect(gameStore.boards[0]!.marker).toEqual({ optionIndex: 0, markerNumber: 2 })
    })

    it('board_replaced 事件不含 marker 参数时不应设置 marker', () => {
      connectSocket()
      gameStore.updateBoards([makeBoard({ id: 'b1' })])

      const newBoard = makeBoard({ id: 'b2' })
      fireEvent('board_replaced', { oldBoardId: 'b1', newBoard })

      expect(gameStore.boards[0]!.id).toBe('b2')
      expect(gameStore.boards[0]!.marker).toBeUndefined()
    })

    it('new_boards 事件应设置新场景板列表', () => {
      connectSocket()
      const boards = [makeBoard({ id: 'nb1' })]

      fireEvent('new_boards', { boards })

      expect(gameStore.newBoards).toHaveLength(1)
      expect(gameStore.newBoards[0]!.id).toBe('nb1')
    })
  })

  describe('witness advance readiness events', () => {
    it('waits for server readiness while the accomplice chooses and effects are drawn', () => {
      connectSocket()
      gameStore.setMyInfo('p1', 'witness')
      fireEvent('phase_change', { phase: 'advance-1' })
      fireEvent('advance_ready', { ready: false })
      expect(gameStore.newBoards).toEqual([])
      expect(gameStore.advanceReady).toBe(false)

      fireEvent('effect_card', { card: { id: 'E01', name: '测试效果', effect: '' } })
      fireEvent('new_boards', { boards: [] })
      expect(gameStore.advanceReady).toBe(false)
      fireEvent('advance_ready', { ready: true })
      expect(gameStore.advanceReady).toBe(true)
    })

    it.each([1, 2])(
      'requires the final readiness event after %i board acknowledgements',
      (count) => {
        const { witnessReplaceBoard } = connectSocket()
        gameStore.setMyInfo('p1', 'witness')
        gameStore.updateBoards([makeBoard({ id: 'old-0' }), makeBoard({ id: 'old-1' })])
        fireEvent('phase_change', { phase: 'advance-1' })
        const newBoards = Array.from({ length: count }, (_, i) => makeBoard({ id: `new-${i}` }))
        fireEvent('new_boards', { boards: newBoards })
        fireEvent('advance_ready', { ready: false })

        for (let i = 0; i < count; i++) {
          witnessReplaceBoard(`old-${i}`, newBoards[i]!.id, 0, i + 1)
          // Sending a replacement cannot optimistically clear a pending board.
          expect(gameStore.newBoards).toHaveLength(count - i)
          expect(gameStore.advanceReady).toBe(false)
          fireEvent('board_replaced', {
            oldBoardId: `old-${i}`,
            newBoard: newBoards[i],
            optionIndex: 0,
            markerNumber: i + 1,
          })
          expect(gameStore.newBoards).toHaveLength(count - i - 1)
          expect(gameStore.advanceReady).toBe(false)
          fireEvent('advance_ready', { ready: i === count - 1 })
          expect(gameStore.advanceReady).toBe(i === count - 1)
        }
      },
    )

    it('restores readiness on reconnect and clears it for a new advance or reset', () => {
      connectSocket()
      const snapshot: GameState = {
        phase: 'advance-1',
        round: 1,
        players: [],
        boards: [],
        myRole: 'witness',
        newBoards: [],
        advanceReady: true,
      }
      fireEvent('full_state', snapshot)
      expect(gameStore.advanceReady).toBe(true)
      fireEvent('phase_change', { phase: 'discussion-2' })
      expect(gameStore.advanceReady).toBe(false)
      fireEvent('phase_change', { phase: 'advance-2' })
      expect(gameStore.advanceReady).toBe(false)

      fireEvent('full_state', { ...snapshot, advanceReady: false, newBoards: [makeBoard()] })
      expect(gameStore.advanceReady).toBe(false)
      expect(gameStore.newBoards).toHaveLength(1)
      fireEvent('full_state', snapshot)
      expect(gameStore.advanceReady).toBe(true)
      fireEvent('full_state', { phase: 'waiting', players: [], boards: [] })
      expect(gameStore.advanceReady).toBe(false)
      expect(gameStore.newBoards).toHaveLength(0)
      fireEvent('advance_ready', { ready: true })
      expect(gameStore.advanceReady).toBe(false)
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

      expect(gameStore.players[0]!.status).toBe('dead')
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
      gameStore.setMurdererSelection({
        meansCard: { id: 'M001', name: '手枪' },
        clueCard: { id: 'C001', name: '血迹' },
      })

      fireEvent('clue_replaced', {
        oldClueCardId: 'C001',
        newClueCard: { id: 'C002', name: '脚印' },
      })

      expect(gameStore.murdererSelection).toEqual({
        meansCard: { id: 'M001', name: '手枪' },
        clueCard: { id: 'C002', name: '脚印' },
      })
    })

    it('clue_replaced 事件在无已有选择时不应报错', () => {
      connectSocket()

      fireEvent('clue_replaced', {
        oldClueCardId: 'C001',
        newClueCard: { id: 'C002', name: '脚印' },
      })

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
      expect(gameStore.players[0]!.hasSolveRight).toBe(false)
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
      expect(gameStore.players[0]!.role).toBe('detective')
      expect(gameStore.players[1]!.role).toBe('murderer')
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
