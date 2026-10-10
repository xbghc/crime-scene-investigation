import { ref } from 'vue'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../stores/auth'
import { useGameStore } from '../stores/game'
import type {
  GamePhase,
  GameState,
  Player,
  Role,
  SceneBoard,
  EffectCard,
  EffectResult,
  PendingEffect,
  MurdererSelection,
  RoomState,
  EffectActionData,
} from '../types'

// === Room event payload types ===
type RoomStatePayload = RoomState

interface PlayerJoinedPayload {
  player: RoomState['players'][number]
}

interface PlayerLeftPayload {
  playerId: string
}

type AccomplicePromptPayload = Record<string, never>

interface AdvanceReadyPayload {
  ready: boolean
}

interface MurdererSelectionUpdatePayload {
  meansCard: { id: string; name: string }
  clueCard: { id: string; name: string }
  confirmed: boolean
}

// === Socket event payload types ===
interface GameStartedPayload {
  role: Role
  cards: {
    meansCards: { id: string; name: string }[]
    clueCards: { id: string; name: string }[]
  } | null
  allPlayerCards: Array<{
    playerId: string
    meansCards: { id: string; name: string }[]
    clueCards: { id: string; name: string }[]
  }>
}

interface NightPhasePayload {
  murdererId?: string
}

interface MurdererSelectedPayload {
  meansCard: { id: string; name: string }
  clueCard: { id: string; name: string }
}

interface PhaseChangePayload {
  phase: GamePhase
  players?: Player[]
  boards?: SceneBoard[]
}

interface BoardsRevealedPayload {
  boards: SceneBoard[]
}

interface MarkerPlacedPayload {
  boardId: string
  optionIndex: number
  markerNumber: number
}

interface BoardReplacedPayload {
  oldBoardId: string
  newBoard: SceneBoard
  optionIndex?: number
  markerNumber?: number
}

interface EffectCardPayload {
  card: EffectCard
  result?: EffectResult
}

interface ClueReplacedPayload {
  oldClueCardId: string
  newClueCard: { id: string; name: string }
}

interface SolveResultPayload {
  playerId: string
  success: boolean
}

interface ForceSolveTurnPayload {
  playerId: string
}

interface GameOverPayload {
  winner: 'detective' | 'murderer'
  roles: Record<string, Role>
  solution: MurdererSelection
  scores: Record<string, number>
}

interface SystemMessagePayload {
  content: string
  type?: 'info' | 'success' | 'error'
}

interface NewBoardsPayload {
  boards: SceneBoard[]
}

// === Singleton socket state ===
let socket: Socket | null = null

const connected = ref(false)
const connectionError = ref<string | null>(null)
export const ROOM_CODE_KEY = 'csi_room_code'
const ROOM_REQUEST_TIMEOUT = 8000

type RoomAction = 'create' | 'join' | 'leave' | 'resume'
export interface RoomActionResult {
  ok: boolean
  error?: string
  code?: string
}

const roomPending = ref<RoomAction | null>(null)
const roomError = ref<string | null>(null)
const sessionReplaced = ref(false)
let finishRoomRequest: ((result: RoomActionResult, authoritative?: boolean) => void) | null = null
let finishEffectRequest: ((error?: string) => void) | null = null

function clearMembership() {
  finishEffectRequest?.()
  useGameStore().clearRoom()
  localStorage.removeItem(ROOM_CODE_KEY)
}

function requestRoomAction(
  action: RoomAction,
  payload?: { nickname?: string; code?: string },
): Promise<RoomActionResult> {
  if (!socket || !connected.value || sessionReplaced.value) {
    roomError.value = '尚未连接服务器，请稍后重试'
    return Promise.resolve({ ok: false, error: roomError.value })
  }
  if (roomPending.value) return Promise.resolve({ ok: false, error: '正在处理，请稍候' })

  const sock = socket
  roomPending.value = action
  roomError.value = null
  return new Promise((resolve) => {
    const finish = (result: RoomActionResult, authoritative = true) => {
      if (finishRoomRequest !== finish) return
      clearTimeout(timer)
      finishRoomRequest = null
      roomPending.value = null
      if (result.ok) {
        if (action === 'leave' || (action === 'resume' && !result.code)) clearMembership()
        else if (result.code) localStorage.setItem(ROOM_CODE_KEY, result.code)
      } else {
        // A timeout/disconnection is inconclusive: retain the saved identity so
        // the next successful connection can recover a server-accepted request.
        if (action === 'resume' && authoritative) clearMembership()
        roomError.value = result.error || '操作失败，请重试'
      }
      resolve(result)
    }
    const timer = setTimeout(
      () => finish({ ok: false, error: '服务器响应超时，请重试' }, false),
      ROOM_REQUEST_TIMEOUT,
    )
    finishRoomRequest = finish
    const acknowledge = (result: RoomActionResult) => finish(result)
    if (payload) sock.emit(`${action}_room`, payload, acknowledge)
    else sock.emit(`${action}_room`, acknowledge)
  })
}

export function useSocket() {
  function connect() {
    if (socket || sessionReplaced.value) return

    const authStore = useAuthStore()
    socket = io({
      auth: { token: authStore.token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    // Expose for E2E testing
    ;(window as Window & { __socket?: Socket }).__socket = socket

    setupConnectionHandlers(socket)
    setupGameEventHandlers(socket)
  }

  function disconnect() {
    finishEffectRequest?.()
    socket?.disconnect()
    socket = null
    connected.value = false
    finishRoomRequest?.({ ok: false, error: '连接已断开，请重试' }, false)
    roomError.value = null
    connectionError.value = null
    sessionReplaced.value = false
  }

  function createRoom(nickname: string) {
    return requestRoomAction('create', { nickname: nickname.trim() })
  }

  function joinRoom(nickname: string, code: string) {
    return requestRoomAction('join', { nickname: nickname.trim(), code: code.trim().toUpperCase() })
  }

  function leaveRoom() {
    return requestRoomAction('leave')
  }

  function resumeRoom() {
    const code = localStorage.getItem(ROOM_CODE_KEY)
    return requestRoomAction('resume', code ? { code } : {})
  }

  function updateNickname(nickname: string) {
    socket?.emit('update_nickname', { nickname })
  }

  function getSocket(): Socket | null {
    return socket
  }

  // === Game action emitters ===
  function startGame() {
    socket?.emit('start_game')
  }

  function murdererSelect(meansCardId: string, clueCardId: string) {
    socket?.emit('murderer_select', { meansCardId, clueCardId })
  }

  function witnessSetMarker(boardId: string, optionIndex: number, markerNumber: number) {
    socket?.emit('witness_set_marker', { boardId, optionIndex, markerNumber })
  }

  function witnessConfirm() {
    socket?.emit('witness_confirm')
  }

  function witnessReplaceBoard(
    oldBoardId: string,
    newBoardId: string,
    optionIndex: number,
    markerNumber: number,
  ) {
    socket?.emit('witness_replace_board', { oldBoardId, newBoardId, optionIndex, markerNumber })
  }

  function endDiscussion() {
    socket?.emit('end_discussion')
  }

  function accompliceChoose(replaceClue: boolean, newClueCardId?: string) {
    socket?.emit('accomplice_choose', { replaceClue, newClueCardId })
  }

  function attemptSolve(suspectId: string, meansCardId: string, clueCardId: string) {
    socket?.emit('attempt_solve', { suspectId, meansCardId, clueCardId })
  }

  function witnessConfirmMurder() {
    socket?.emit('witness_confirm_murder')
  }

  function effectAction(effectId: string, data: EffectActionData) {
    const game = useGameStore()
    if (!socket || !connected.value || roomPending.value || sessionReplaced.value) {
      game.finishEffectAction('尚未连接服务器，请等待重连后重试')
      return
    }
    if (finishEffectRequest || !game.beginEffectAction(effectId)) return
    const finish = (error?: string) => {
      if (finishEffectRequest !== finish) return
      clearTimeout(timer)
      finishEffectRequest = null
      game.finishEffectAction(error)
    }
    const timer = setTimeout(
      () => finish('服务器响应超时，可重试；已完成的效果不会重复执行'),
      ROOM_REQUEST_TIMEOUT,
    )
    finishEffectRequest = finish
    // Never buffer actions offline; only the server's result consumes a choice.
    socket.emit('effect_action', { effectId, data })
  }

  function witnessFinishAdvance() {
    socket?.emit('witness_finish_advance')
  }

  function resetGame() {
    socket?.emit('reset_game')
  }

  return {
    connected,
    connectionError,
    roomPending,
    roomError,
    sessionReplaced,
    connect,
    disconnect,
    createRoom,
    joinRoom,
    leaveRoom,
    resumeRoom,
    updateNickname,
    getSocket,
    startGame,
    murdererSelect,
    witnessSetMarker,
    witnessConfirm,
    witnessReplaceBoard,
    endDiscussion,
    accompliceChoose,
    attemptSolve,
    witnessConfirmMurder,
    effectAction,
    witnessFinishAdvance,
    resetGame,
  }
}

// === Internal handler setup (separated from connect for readability) ===

function setupConnectionHandlers(sock: Socket) {
  sock.on('connect', () => {
    if (sessionReplaced.value) return
    connected.value = true
    connectionError.value = null
    const code = localStorage.getItem(ROOM_CODE_KEY)
    if (!sessionReplaced.value) void requestRoomAction('resume', code ? { code } : {})
  })

  sock.on('disconnect', () => {
    connected.value = false
    finishEffectRequest?.('连接已断开，重连后将恢复效果牌选择')
    finishRoomRequest?.({ ok: false, error: '连接已断开，恢复后将自动重试' }, false)
  })

  sock.on('connect_error', (err: Error) => {
    connectionError.value = err.message
  })
}

function setupGameEventHandlers(sock: Socket) {
  // A replaced tab must not rehydrate secrets from any already-queued event.
  function on<Args extends unknown[]>(event: string, handler: (...args: Args) => void) {
    sock.on(event, (...args: Args) => {
      if (!sessionReplaced.value) handler(...args)
    })
  }

  const authStore = useAuthStore()
  const gameStore = useGameStore()

  // === Room management events ===

  on('room_state', (data: RoomStatePayload) => {
    if (sessionReplaced.value) return
    gameStore.setRoomState(data)
    localStorage.setItem(ROOM_CODE_KEY, data.code)
    roomError.value = null
    if (roomPending.value && roomPending.value !== 'leave') {
      finishRoomRequest?.({ ok: true, code: data.code })
    }
  })

  on('room_left', () => {
    clearMembership()
    finishRoomRequest?.({ ok: true })
  })

  on('room_closed', (data?: { message?: string }) => {
    clearMembership()
    const error = data?.message || '房间已关闭，请创建或加入新的房间'
    finishRoomRequest?.({ ok: false, error })
    roomError.value = error
  })

  on('session_replaced', (data?: { message?: string }) => {
    finishEffectRequest?.()
    sessionReplaced.value = true
    gameStore.clearRoom()
    const error = data?.message || '已在其他窗口连接，请在该窗口继续游戏'
    finishRoomRequest?.({ ok: false, error }, false)
    roomError.value = error
    // Do not delete the shared saved code: the new tab still needs it.
    connected.value = false
    sock.disconnect()
  })

  on('player_joined', (data: PlayerJoinedPayload) => {
    gameStore.addRoomPlayer(data.player)
  })

  on('player_left', (data: PlayerLeftPayload) => {
    gameStore.removeRoomPlayer(data.playerId)
  })

  // === Advance phase events ===

  on('accomplice_prompt', (_data: AccomplicePromptPayload) => {
    gameStore.setAccomplicePrompted(true)
  })

  on('advance_ready', (data: AdvanceReadyPayload) => {
    gameStore.setAdvanceReady(data.ready)
  })

  // Accomplice sees murderer's card selection in real-time
  on('murderer_selection_update', (data: MurdererSelectionUpdatePayload) => {
    gameStore.setMurdererSelection({
      meansCard: data.meansCard,
      clueCard: data.clueCard,
    })
  })

  // === Game lifecycle events ===

  on('game_started', (data: GameStartedPayload) => {
    finishEffectRequest?.()
    gameStore.reset()
    const myId = authStore.userId
    if (myId) {
      gameStore.setMyInfo(myId, data.role)
    }

    // Build player list from allPlayerCards merged with room players
    const cardMap = new Map(data.allPlayerCards.map((p) => [p.playerId, p]))
    const players: Player[] = gameStore.roomPlayers.map((rp) => {
      const cards = cardMap.get(rp.id)
      return {
        id: rp.id,
        nickname: rp.nickname,
        color: rp.color,
        isHost: rp.isHost,
        connected: rp.connected,
        status: 'alive' as const,
        hasSolveRight: true,
        meansCards: cards?.meansCards ?? [],
        clueCards: cards?.clueCards ?? [],
      }
    })
    gameStore.updatePlayers(players)
    gameStore.setPhase('role-reveal')
  })

  on('night_phase', (_data: NightPhasePayload) => {
    gameStore.setPhase('night-murder')
    // murdererId in payload is for accomplice; the view reads murderer from player list
  })

  on('murderer_selected', (data: MurdererSelectedPayload) => {
    gameStore.setMurdererSelection({
      meansCard: data.meansCard,
      clueCard: data.clueCard,
    })
  })

  on('phase_change', (data: PhaseChangePayload) => {
    finishEffectRequest?.()
    gameStore.setPhase(data.phase)
    if (data.players) gameStore.updatePlayers(data.players)
    if (data.boards) gameStore.updateBoards(data.boards)
  })

  on('boards_revealed', (data: BoardsRevealedPayload) => {
    gameStore.updateBoards(data.boards)
  })

  on('marker_placed', (data: MarkerPlacedPayload) => {
    gameStore.updateMarker(data.boardId, data.optionIndex, data.markerNumber)
  })

  on('board_replaced', (data: BoardReplacedPayload) => {
    gameStore.replaceBoard(data.oldBoardId, {
      ...data.newBoard,
      marker:
        data.optionIndex != null && data.markerNumber != null
          ? { optionIndex: data.optionIndex, markerNumber: data.markerNumber }
          : undefined,
    })
    // Remove used board from newBoards
    gameStore.setNewBoards(gameStore.newBoards.filter((b) => b.id !== data.newBoard.id))
  })

  on('effect_pending', (data: { pendingEffect: PendingEffect | null }) => {
    finishEffectRequest?.()
    gameStore.setPendingEffect(data.pendingEffect)
  })

  on('effect_card', (data: EffectCardPayload) => {
    if (data.result?.applied || data.result?.skipped) finishEffectRequest?.()
    gameStore.setEffectCard(data.card, data.result)
    if (data.result?.message) {
      gameStore.setSystemMessage(data.result.message, 'info')
    }
    if (data.result?.players) {
      gameStore.updatePlayers(data.result.players)
    }
    if (data.result?.blackout) {
      gameStore.setBlackout(true)
    }
  })

  on('clue_replaced', (data: ClueReplacedPayload) => {
    const current = gameStore.murdererSelection
    if (!current) return
    gameStore.setMurdererSelection({
      meansCard: current.meansCard,
      clueCard: data.newClueCard,
    })
  })

  on('solve_result', (data: SolveResultPayload) => {
    gameStore.setSolveResult(data)
    if (data.success) {
      gameStore.setSystemMessage('破案成功！', 'success')
    } else {
      const player = gameStore.players.find((p) => p.id === data.playerId)
      const name = player?.nickname || '未知'
      gameStore.setSystemMessage(`${name} 破案失败，失去破案权`, 'error')
    }
  })

  on('force_solve_turn', (data: ForceSolveTurnPayload) => {
    gameStore.setForceSolveTurn(data.playerId)
  })

  on('game_over', (data: GameOverPayload) => {
    finishEffectRequest?.()
    if (data.roles) {
      for (const player of gameStore.players) {
        if (data.roles[player.id]) {
          player.role = data.roles[player.id]
        }
      }
    }
    gameStore.setMurdererSelection(data.solution)
    gameStore.setGameOver(data.winner, data.scores)
  })

  on('system_message', (data: SystemMessagePayload) => {
    if (data.type === 'error') finishEffectRequest?.(data.content)
    gameStore.setSystemMessage(data.content, data.type || 'info')
  })

  on('new_boards', (data: NewBoardsPayload) => {
    gameStore.setNewBoards(data.boards)
  })

  on('blackout_end', () => {
    gameStore.setBlackout(false)
  })

  on('full_state', (data: Partial<GameState> & Pick<GameState, 'phase' | 'players' | 'boards'>) => {
    finishEffectRequest?.()
    gameStore.syncFullState({
      ...data,
      round: data.round ?? 1,
    })
  })
}
