// === 角色与玩家 ===

export type Role = 'witness' | 'murderer' | 'accomplice' | 'detective'

export type PlayerStatus = 'alive' | 'dead' | 'disconnected'

export interface Player {
  id: string
  nickname: string
  color: string
  isHost: boolean
  role?: Role
  status: PlayerStatus
  hasSolveRight: boolean
  meansCards: MeansCard[]
  clueCards: ClueCard[]
}

// === 卡牌 ===

export interface MeansCard {
  id: string
  name: string
}

export interface ClueCard {
  id: string
  name: string
}

export interface EffectCard {
  id: string
  name: string
  effect: string
}

// === 场景板 ===

export type BoardType = 'cause' | 'location' | 'scene'

export interface MarkerPlacement {
  optionIndex: number
  markerNumber: number // 1-6
}

export interface SceneBoard {
  id: string
  type: BoardType
  title: string
  options: string[]
  marker?: MarkerPlacement
}

// === 游戏阶段 ===

export type GamePhase =
  | 'waiting'
  | 'role-reveal'
  | 'night-murder'
  | 'witness-accuse'
  | 'discussion-1'
  | 'advance-1'
  | 'discussion-2'
  | 'advance-2'
  | 'discussion-3'
  | 'force-solve'
  | 'game-over'

// === 破案 ===

export interface SolveAttempt {
  suspectId: string
  meansCardId: string
  clueCardId: string
}

export interface SolveResult {
  playerId: string
  success: boolean
}

// === 完整游戏状态 ===

export interface MurdererSelection {
  meansCard: MeansCard
  clueCard: ClueCard
}

export interface GameState {
  phase: GamePhase
  round: number
  players: Player[]
  boards: SceneBoard[]
  myRole?: Role
  murdererSelection?: MurdererSelection
  currentSolverId?: string
  effectCard?: EffectCard
  winner?: 'detective' | 'murderer'
  scores?: Record<string, number>
  blackout?: boolean // 停电效果
}

// === 效果牌操作 ===

export interface EffectActionData {
  targetId?: string
  boardId?: string
  cardId?: string
}

// === 房间 ===

export type RoomStatus = 'waiting' | 'playing'

export interface RoomState {
  players: Pick<Player, 'id' | 'nickname' | 'color' | 'isHost'>[]
  status: RoomStatus
  hostId: string | null
}
