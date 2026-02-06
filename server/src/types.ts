// === Server-side type definitions ===

// Game constants
export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 10;
export const CARDS_PER_PLAYER = 4;
export const ACTIVE_BOARD_COUNT = 6;
export const MARKER_MIN = 1;
export const MARKER_MAX = 6;
export const ROLE_REVEAL_DELAY_MS = 3000;
export const RECONNECT_TIMEOUT_MS = 120_000;
export const ACCOMPLICE_THRESHOLD = 6; // min players for accomplice role
export const SCORE_BASE_PLAYER_COUNT = 7;

export type Role = 'witness' | 'murderer' | 'accomplice' | 'detective';

export type PlayerStatus = 'alive' | 'dead' | 'disconnected';

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
  | 'game-over';

export type DiscussionPhase = 'discussion-1' | 'discussion-2' | 'discussion-3';
export type AdvancePhase = 'advance-1' | 'advance-2';

export type RoomStatus = 'waiting' | 'playing';

export interface CardRef {
  id: string;
  name: string;
}

export interface EffectCardRef extends CardRef {
  effect: string;
}

export interface MarkerPlacement {
  optionIndex: number;
  markerNumber: number; // 1-6
}

export interface SceneBoardState {
  id: string;
  type: 'cause' | 'location' | 'scene';
  title: string;
  options: string[];
  marker?: MarkerPlacement;
}

export interface PlayerState {
  id: string;           // matches socket.data.userId
  nickname: string;
  color: string;
  socketId: string | null;
  isHost: boolean;
  role: Role | null;
  status: PlayerStatus;
  hasSolveRight: boolean;
  meansCards: CardRef[];
  clueCards: CardRef[];
  disconnectedAt: number | null; // timestamp when disconnected
}

export interface MurdererSelection {
  meansCardId: string;
  clueCardId: string;
}

export interface SolveAttempt {
  suspectId: string;
  meansCardId: string;
  clueCardId: string;
}

export interface GameInternalState {
  phase: GamePhase;
  players: PlayerState[];
  roomStatus: RoomStatus;
  hostId: string | null;

  // Card decks (remaining, shuffled)
  meansDeck: CardRef[];
  clueDeck: CardRef[];
  effectDeck: EffectCardRef[];
  sceneBoardPool: SceneBoardState[]; // unused scene boards

  // Active boards on table
  activeBoards: SceneBoardState[];

  // Murder solution (secret)
  solution: MurdererSelection | null;

  // Phase tracking
  accompliceHasChosen: boolean; // for advance-1
  blackout: boolean;            // E07 effect
  blackoutClearsAfterPhase: GamePhase | null;

  // Force-solve tracking
  forceSolveOrder: string[];    // player IDs in order
  forceSolveIndex: number;

  // Solve results
  solveResults: Array<{ playerId: string; success: boolean }>;

  // Winner
  winner: 'detective' | 'murderer' | null;
  scores: Record<string, number> | null;
}

// Public board shape sent to clients
export interface PublicBoard {
  id: string;
  type: string;
  title: string;
  options: string[];
  marker?: MarkerPlacement;
}

// Standard operation result
export interface OpResult {
  ok: boolean;
  error?: string;
}

// Solve operation result extends OpResult
export interface SolveOpResult extends OpResult {
  success?: boolean;
}

// Effect action data from witness
export interface EffectActionData {
  targetId?: string;
  boardId?: string;
  cardId?: string;
}

// Colors for player avatars
export const PLAYER_COLORS = [
  '#E53935', // red
  '#1E88E5', // blue
  '#43A047', // green
  '#FB8C00', // orange
  '#8E24AA', // purple
  '#00ACC1', // cyan
  '#FFB300', // amber
  '#6D4C41', // brown
  '#546E7A', // blue-grey
  '#D81B60', // pink
];

export interface ScoreTable {
  witnessWin: number;
  detectiveWin: number;
  murdererWin: number;
}

const BASE_WITNESS_SCORE = 3;
const BASE_DETECTIVE_SCORE = 2;
const BASE_MURDERER_SCORE = 3;

// Scoring scales with distance from base player count.
// Fewer players = harder for detectives, so detective side scores increase.
// More players = harder for murderer, so murderer side scores increase.
export function getScores(playerCount: number): ScoreTable {
  const diff = playerCount - SCORE_BASE_PLAYER_COUNT;

  if (diff < 0) {
    const bonus = Math.abs(diff);
    return {
      witnessWin: BASE_WITNESS_SCORE + bonus,
      detectiveWin: BASE_DETECTIVE_SCORE + bonus,
      murdererWin: BASE_MURDERER_SCORE,
    };
  } else if (diff > 0) {
    return {
      witnessWin: BASE_WITNESS_SCORE,
      detectiveWin: BASE_DETECTIVE_SCORE,
      murdererWin: BASE_MURDERER_SCORE + diff,
    };
  }
  return {
    witnessWin: BASE_WITNESS_SCORE,
    detectiveWin: BASE_DETECTIVE_SCORE,
    murdererWin: BASE_MURDERER_SCORE,
  };
}

export interface RoleAssignment {
  witness: number;
  murderer: number;
  accomplice: number;
  detective: number;
}

export function getRoleAssignment(playerCount: number): RoleAssignment {
  const hasAccomplice = playerCount >= ACCOMPLICE_THRESHOLD;
  return {
    witness: 1,
    murderer: 1,
    accomplice: hasAccomplice ? 1 : 0,
    detective: playerCount - 2 - (hasAccomplice ? 1 : 0),
  };
}
