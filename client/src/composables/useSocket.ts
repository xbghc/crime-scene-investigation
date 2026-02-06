import { ref } from 'vue'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../stores/auth'
import { useGameStore } from '../stores/game'
import type { GamePhase, GameState, Player, Role, SceneBoard, EffectCard, MurdererSelection } from '../types'

// === Socket event payload types ===
interface GameStartedPayload {
  playerId: string
  role: Role
  allPlayerCards: Player[]
}

interface NightPhasePayload {
  murdererId?: string
}

interface MurdererSelectedPayload {
  meansCardId: string
  clueCardId: string
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
  newClueCardId: string
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

  function witnessReplaceBoard(oldBoardId: string, newBoardId: string, optionIndex: number, markerNumber: number) {
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

  return {
    connected,
    connectionError,
    connect,
    disconnect,
    joinRoom,
    getSocket,
    startGame,
    murdererSelect,
    witnessSetMarker,
    witnessConfirm,
    witnessReplaceBoard,
    endDiscussion,
    accompliceChoose,
    attemptSolve,
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
  const gameStore = useGameStore()

  sock.on('game_started', (data: GameStartedPayload) => {
    gameStore.setMyInfo(data.playerId, data.role)
    gameStore.updatePlayers(data.allPlayerCards)
    gameStore.setPhase('role-reveal')
  })

  sock.on('night_phase', (_data: NightPhasePayload) => {
    gameStore.setPhase('night-murder')
    // murdererId in payload is for accomplice; the view reads murderer from player list
  })

  sock.on('murderer_selected', (data: MurdererSelectedPayload) => {
    gameStore.setMurdererSelection({
      meansCardId: data.meansCardId,
      clueCardId: data.clueCardId,
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
      marker: data.optionIndex != null && data.markerNumber != null
        ? { optionIndex: data.optionIndex, markerNumber: data.markerNumber }
        : undefined,
    })
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
    const currentMeansId = gameStore.murdererSelection?.meansCardId
    if (!currentMeansId) return // Cannot replace clue if no prior selection exists
    gameStore.setMurdererSelection({
      meansCardId: currentMeansId,
      clueCardId: data.newClueCardId,
    })
  })

  sock.on('solve_result', (data: SolveResultPayload) => {
    gameStore.setSolveResult(data)
    if (data.success) {
      gameStore.setSystemMessage('破案成功！', 'success')
    } else {
      const player = gameStore.players.find(p => p.id === data.playerId)
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

  sock.on('full_state', (data: GameState) => {
    gameStore.syncFullState(data)
  })
}
