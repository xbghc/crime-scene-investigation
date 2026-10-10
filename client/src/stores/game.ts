import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'
import type {
  GameState,
  GamePhase,
  Role,
  Player,
  SceneBoard,
  MurdererSelection,
  EffectCard,
  SolveResult,
  RoomState,
} from '../types'

type SystemMessageType = 'info' | 'success' | 'error'
type Winner = 'detective' | 'murderer'

interface SystemMessage {
  content: string
  type: SystemMessageType
}

const DISCUSSION_PHASES: ReadonlySet<GamePhase> = new Set([
  'discussion-1',
  'discussion-2',
  'discussion-3',
])
const ADVANCE_PHASES: ReadonlySet<GamePhase> = new Set(['advance-1', 'advance-2'])
const SOLVABLE_PHASES: ReadonlySet<GamePhase> = new Set([...DISCUSSION_PHASES, 'force-solve'])

const PHASE_LABELS: Record<GamePhase, string> = {
  waiting: '等待中',
  'role-reveal': '身份揭示',
  'night-murder': '夜晚',
  'witness-accuse': '指证阶段',
  'discussion-1': '第一轮发言',
  'advance-1': '推进阶段',
  'discussion-2': '第二轮发言',
  'advance-2': '推进阶段',
  'discussion-3': '第三轮发言',
  'force-solve': '强制破案',
  'game-over': '游戏结束',
}

const PHASE_ICONS: Record<GamePhase, string> = {
  waiting: 'info',
  'role-reveal': 'badge',
  'night-murder': 'dark_mode',
  'witness-accuse': 'search',
  'discussion-1': 'forum',
  'advance-1': 'fast_forward',
  'discussion-2': 'forum',
  'advance-2': 'fast_forward',
  'discussion-3': 'forum',
  'force-solve': 'gavel',
  'game-over': 'emoji_events',
}

const DISCUSSION_ROUND_MAP: Partial<Record<GamePhase, number>> = {
  'discussion-1': 1,
  'discussion-2': 2,
  'discussion-3': 3,
}

export const useGameStore = defineStore('game', () => {
  // === Core state ===
  const phase = ref<GamePhase>('waiting')
  const round = ref(1)
  const players = ref<Player[]>([])
  const boards = ref<SceneBoard[]>([])
  const myRole = ref<Role | undefined>()
  const myPlayerId = ref<string | undefined>()
  const murdererSelection = ref<MurdererSelection | undefined>()
  const currentSolverId = ref<string | undefined>()
  const effectCard = ref<EffectCard | undefined>()
  const winner = ref<Winner | undefined>()
  const scores = ref<Record<string, number> | undefined>()
  const blackout = ref(false)
  const systemMessage = ref<SystemMessage | null>(null)
  const lastSolveResult = ref<SolveResult | null>(null)
  // Witness picks from these during advance phase
  const newBoards = ref<SceneBoard[]>([])
  const forceSolveTurnPlayerId = ref<string | undefined>()

  // Room membership is only set by confirmed server state.
  const roomCode = ref<string | null>(null)
  const minPlayers = ref(4)
  const maxPlayers = ref(10)
  const roomPlayers = ref<RoomState['players']>([])
  const roomStatus = ref<RoomState['status']>('waiting')
  const hostId = ref<string | null>(null)
  const accomplicePrompted = ref(false)

  // === Computed ===
  const me = computed(() => players.value.find((p) => p.id === myPlayerId.value))

  const isWitness = computed(() => myRole.value === 'witness')
  const isMurderer = computed(() => myRole.value === 'murderer')
  const isAccomplice = computed(() => myRole.value === 'accomplice')
  const isDetective = computed(() => myRole.value === 'detective')

  const myCards = computed(() => {
    const player = me.value
    if (!player) return { meansCards: [], clueCards: [] }
    return { meansCards: player.meansCards, clueCards: player.clueCards }
  })

  const hasSolveRight = computed(() => me.value?.hasSolveRight ?? false)

  const canSolve = computed(() => {
    if (isWitness.value) return false
    if (!hasSolveRight.value) return false
    return SOLVABLE_PHASES.has(phase.value)
  })

  const isNightPhase = computed(() => phase.value === 'night-murder')
  const isDiscussionPhase = computed(() => DISCUSSION_PHASES.has(phase.value))
  const isAdvancePhase = computed(() => ADVANCE_PHASES.has(phase.value))

  const murderer = computed(() => players.value.find((p) => p.role === 'murderer'))

  const nonWitnessPlayers = computed(() => players.value.filter((p) => p.role !== 'witness'))

  const isMyForceSolveTurn = computed(
    () => phase.value === 'force-solve' && forceSolveTurnPlayerId.value === myPlayerId.value,
  )

  const discussionRound = computed(() => DISCUSSION_ROUND_MAP[phase.value] ?? 0)

  const phaseLabel = computed(() => PHASE_LABELS[phase.value] || phase.value)

  const phaseIcon = computed(() => PHASE_ICONS[phase.value] || 'info')

  // === Actions ===
  function syncFullState(state: GameState) {
    phase.value = state.phase
    round.value = state.round
    players.value = state.players
    boards.value = state.boards
    // Full snapshots replace private state as well as public state. Omitted secrets
    // must never survive a reset, room switch, or a change in role.
    myRole.value = state.myRole
    myPlayerId.value = state.myRole ? (useAuthStore().userId ?? undefined) : undefined
    murdererSelection.value = state.murdererSelection
    currentSolverId.value = state.currentSolverId
    forceSolveTurnPlayerId.value = state.currentSolverId
    effectCard.value = state.effectCard
    winner.value = state.winner
    scores.value = state.scores
    blackout.value = state.blackout ?? false
    newBoards.value = state.newBoards ?? []
    accomplicePrompted.value = state.accomplicePrompted ?? false
    if (state.roles) {
      for (const player of players.value) player.role = state.roles[player.id]
    }
    if (state.phase === 'waiting') reset()
  }

  function setPhase(newPhase: GamePhase) {
    phase.value = newPhase
  }

  function setMyInfo(playerId: string, role: Role) {
    myPlayerId.value = playerId
    myRole.value = role
  }

  function updatePlayers(newPlayers: Player[]) {
    players.value = newPlayers
  }

  function updateBoards(newBoardsList: SceneBoard[]) {
    boards.value = newBoardsList
  }

  function setMurdererSelection(selection: MurdererSelection) {
    murdererSelection.value = selection
  }

  function setEffectCard(card: EffectCard | undefined) {
    effectCard.value = card
  }

  function setSolveResult(result: SolveResult) {
    lastSolveResult.value = result
    // Update player solve right
    if (!result.success) {
      const p = players.value.find((pl) => pl.id === result.playerId)
      if (p) p.hasSolveRight = false
    }
  }

  function setForceSolveTurn(playerId: string) {
    forceSolveTurnPlayerId.value = playerId
  }

  function setGameOver(winnerSide: Winner, finalScores: Record<string, number>) {
    winner.value = winnerSide
    scores.value = finalScores
    phase.value = 'game-over'
  }

  function setNewBoards(boardsList: SceneBoard[]) {
    newBoards.value = boardsList
  }

  function setSystemMessage(content: string, type: SystemMessageType = 'info') {
    systemMessage.value = { content, type }
  }

  function clearSystemMessage() {
    systemMessage.value = null
  }

  function updateMarker(boardId: string, optionIndex: number, markerNumber: number) {
    const board = boards.value.find((b) => b.id === boardId)
    if (board) {
      board.marker = { optionIndex, markerNumber }
    }
  }

  function reorderBoards(boardIds: string[]) {
    const boardMap = new Map(boards.value.map((b) => [b.id, b]))
    boards.value = boardIds.map((id) => boardMap.get(id)).filter((b): b is SceneBoard => !!b)
  }

  function replaceBoard(oldBoardId: string, newBoard: SceneBoard) {
    const idx = boards.value.findIndex((b) => b.id === oldBoardId)
    if (idx !== -1) {
      boards.value[idx] = newBoard
    }
  }

  function setBlackout(val: boolean) {
    blackout.value = val
  }

  function setRoomState(state: RoomState) {
    if (roomCode.value !== state.code || state.status === 'waiting') reset()
    roomCode.value = state.code
    minPlayers.value = state.minPlayers
    maxPlayers.value = state.maxPlayers
    roomPlayers.value = state.players
    roomStatus.value = state.status
    hostId.value = state.hostId
    // Host changes also matter in a running game (reset/play-again controls).
    for (const player of players.value) {
      player.isHost = player.id === state.hostId
      const roomPlayer = state.players.find((p) => p.id === player.id)
      if (roomPlayer) {
        player.nickname = roomPlayer.nickname
        if (roomPlayer.connected !== undefined) {
          player.connected = roomPlayer.connected
          // Presence changes cannot revive a player killed during the game.
          if (player.status !== 'dead') {
            player.status = roomPlayer.connected ? 'alive' : 'disconnected'
          }
        }
      }
    }
  }

  function addRoomPlayer(player: RoomState['players'][number]) {
    const exists = roomPlayers.value.some((p) => p.id === player.id)
    if (!exists) {
      roomPlayers.value.push(player)
    }
  }

  function removeRoomPlayer(playerId: string) {
    roomPlayers.value = roomPlayers.value.filter((p) => p.id !== playerId)
  }

  function setAccomplicePrompted(val: boolean) {
    accomplicePrompted.value = val
  }

  function reset() {
    phase.value = 'waiting'
    round.value = 1
    players.value = []
    boards.value = []
    myRole.value = undefined
    myPlayerId.value = undefined
    murdererSelection.value = undefined
    currentSolverId.value = undefined
    effectCard.value = undefined
    winner.value = undefined
    scores.value = undefined
    blackout.value = false
    systemMessage.value = null
    lastSolveResult.value = null
    newBoards.value = []
    forceSolveTurnPlayerId.value = undefined
    accomplicePrompted.value = false
  }

  function clearRoom() {
    reset()
    roomCode.value = null
    roomPlayers.value = []
    roomStatus.value = 'waiting'
    hostId.value = null
    minPlayers.value = 4
    maxPlayers.value = 10
  }

  return {
    // State
    phase,
    round,
    players,
    boards,
    myRole,
    myPlayerId,
    murdererSelection,
    currentSolverId,
    effectCard,
    winner,
    scores,
    blackout,
    systemMessage,
    lastSolveResult,
    newBoards,
    forceSolveTurnPlayerId,
    roomCode,
    minPlayers,
    maxPlayers,
    roomPlayers,
    roomStatus,
    hostId,
    accomplicePrompted,

    // Computed
    me,
    isWitness,
    isMurderer,
    isAccomplice,
    isDetective,
    myCards,
    hasSolveRight,
    canSolve,
    isNightPhase,
    isDiscussionPhase,
    isAdvancePhase,
    murderer,
    nonWitnessPlayers,
    isMyForceSolveTurn,
    discussionRound,
    phaseLabel,
    phaseIcon,

    // Actions
    syncFullState,
    setPhase,
    setMyInfo,
    updatePlayers,
    updateBoards,
    setMurdererSelection,
    setEffectCard,
    setSolveResult,
    setForceSolveTurn,
    setGameOver,
    setNewBoards,
    setSystemMessage,
    clearSystemMessage,
    updateMarker,
    reorderBoards,
    replaceBoard,
    setBlackout,
    setRoomState,
    addRoomPlayer,
    removeRoomPlayer,
    setAccomplicePrompted,
    reset,
    clearRoom,
  }
})
