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
  MurdererSelection,
  RoomState,
  EffectActionData,
} from '../types'

// === Room event payload types ===
interface RoomStatePayload extends RoomState {}

interface PlayerJoinedPayload {
  player: RoomState['players'][number]
}

interface PlayerLeftPayload {
  playerId: string
}

interface AccomplicePromptPayload {}

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
  result?: {
    message?: string
    players?: Player[]
    blackout?: boolean
  }
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

export function useSocket() {
  function connect() {
    if (socket?.connected) return

    const authStore = useAuthStore()
    socket = io({
      auth: { token: authStore.token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    // Expose for E2E testing
    ;(window as any).__socket = socket

    setupConnectionHandlers(socket)
    setupGameEventHandlers(socket)
  }

  function disconnect() {
    socket?.disconnect()
    socket = null
    connected.value = false
  }

  function joinRoom(nickname: string) {
    socket?.emit('join_room', { nickname })
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
    socket?.emit('effect_action', { effectId, data })
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
    connect,
    disconnect,
    joinRoom,
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
    connected.value = true
    connectionError.value = null
  })

  sock.on('disconnect', () => {
    connected.value = false
  })

  sock.on('connect_error', (err: Error) => {
    connectionError.value = err.message
  })

  sock.on('reconnect', () => {
    socket?.emit('request_state')
  })
}

function setupGameEventHandlers(sock: Socket) {
  const authStore = useAuthStore()
  const gameStore = useGameStore()

  // === Room management events ===

  sock.on('room_state', (data: RoomStatePayload) => {
    gameStore.setRoomState(data)
  })

  sock.on('player_joined', (data: PlayerJoinedPayload) => {
    gameStore.addRoomPlayer(data.player)
  })

  sock.on('player_left', (data: PlayerLeftPayload) => {
    gameStore.removeRoomPlayer(data.playerId)
  })

  // === Advance phase events ===

  sock.on('accomplice_prompt', (_data: AccomplicePromptPayload) => {
    gameStore.setAccomplicePrompted(true)
  })

  // Accomplice sees murderer's card selection in real-time
  sock.on('murderer_selection_update', (data: MurdererSelectionUpdatePayload) => {
    gameStore.setMurdererSelection({
      meansCard: data.meansCard,
      clueCard: data.clueCard,
    })
  })

  // === Game lifecycle events ===

  sock.on('game_started', (data: GameStartedPayload) => {
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
        status: 'alive' as const,
        hasSolveRight: true,
        meansCards: cards?.meansCards ?? [],
        clueCards: cards?.clueCards ?? [],
      }
    })
    gameStore.updatePlayers(players)
    gameStore.setPhase('role-reveal')
  })

  sock.on('night_phase', (_data: NightPhasePayload) => {
    gameStore.setPhase('night-murder')
    // murdererId in payload is for accomplice; the view reads murderer from player list
  })

  sock.on('murderer_selected', (data: MurdererSelectedPayload) => {
    gameStore.setMurdererSelection({
      meansCard: data.meansCard,
      clueCard: data.clueCard,
    })
  })

  sock.on('phase_change', (data: PhaseChangePayload) => {
    gameStore.setPhase(data.phase)
    if (data.players) gameStore.updatePlayers(data.players)
    if (data.boards) gameStore.updateBoards(data.boards)
  })

  sock.on('boards_revealed', (data: BoardsRevealedPayload) => {
    gameStore.updateBoards(data.boards)
  })

  sock.on('marker_placed', (data: MarkerPlacedPayload) => {
    gameStore.updateMarker(data.boardId, data.optionIndex, data.markerNumber)
  })

  sock.on('board_replaced', (data: BoardReplacedPayload) => {
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

  sock.on('effect_card', (data: EffectCardPayload) => {
    gameStore.setEffectCard(data.card)
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

  sock.on('clue_replaced', (data: ClueReplacedPayload) => {
    const current = gameStore.murdererSelection
    if (!current) return
    gameStore.setMurdererSelection({
      meansCard: current.meansCard,
      clueCard: data.newClueCard,
    })
  })

  sock.on('solve_result', (data: SolveResultPayload) => {
    gameStore.setSolveResult(data)
    if (data.success) {
      gameStore.setSystemMessage('破案成功！', 'success')
    } else {
      const player = gameStore.players.find((p) => p.id === data.playerId)
      const name = player?.nickname || '未知'
      gameStore.setSystemMessage(`${name} 破案失败，失去破案权`, 'error')
    }
  })

  sock.on('force_solve_turn', (data: ForceSolveTurnPayload) => {
    gameStore.setForceSolveTurn(data.playerId)
  })

  sock.on('game_over', (data: GameOverPayload) => {
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

  sock.on('system_message', (data: SystemMessagePayload) => {
    gameStore.setSystemMessage(data.content, data.type || 'info')
  })

  sock.on('new_boards', (data: NewBoardsPayload) => {
    gameStore.setNewBoards(data.boards)
  })

  sock.on('blackout_end', () => {
    gameStore.setBlackout(false)
  })

  sock.on(
    'full_state',
    (data: Partial<GameState> & Pick<GameState, 'phase' | 'players' | 'boards'>) => {
      gameStore.syncFullState({
        ...data,
        round: data.round ?? 1,
      })
    },
  )
}
