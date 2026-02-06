import type { Server, Socket } from 'socket.io';
import {
  ALL_MEANS_CARDS,
  ALL_CLUE_CARDS,
  ALL_EFFECT_CARDS,
  ALL_SCENE_BOARDS,
} from '../data/cards.js';
import type { SceneBoardData } from '../data/cards.js';
import {
  type GameInternalState,
  type PlayerState,
  type CardRef,
  type EffectCardRef,
  type SceneBoardState,
  type SolveAttempt,
  type GamePhase,
  type DiscussionPhase,
  type AdvancePhase,
  type Role,
  type PublicBoard,
  type OpResult,
  type SolveOpResult,
  type EffectActionData,
  PLAYER_COLORS,
  MIN_PLAYERS,
  MAX_PLAYERS,
  CARDS_PER_PLAYER,
  ACTIVE_BOARD_COUNT,
  MARKER_MIN,
  MARKER_MAX,
  ROLE_REVEAL_DELAY_MS,
  RECONNECT_TIMEOUT_MS,
  getScores,
  getRoleAssignment,
} from '../types.js';

const DISCUSSION_PHASES: readonly GamePhase[] = ['discussion-1', 'discussion-2', 'discussion-3'];

const INITIAL_SCENE_BOARD_COUNT = 4; // blue scene boards drawn at game start

// Fisher-Yates shuffle - returns a new shuffled array without mutating input
function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class GameEngine {
  private state: GameInternalState;
  private io: Server;
  private disconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(io: Server) {
    this.io = io;
    this.state = this.createInitialState();
  }

  private createInitialState(): GameInternalState {
    return {
      phase: 'waiting',
      players: [],
      roomStatus: 'waiting',
      hostId: null,
      meansDeck: [],
      clueDeck: [],
      effectDeck: [],
      sceneBoardPool: [],
      activeBoards: [],
      solution: null,
      accompliceHasChosen: false,
      blackout: false,
      blackoutClearsAfterPhase: null,
      forceSolveOrder: [],
      forceSolveIndex: 0,
      solveResults: [],
      winner: null,
      scores: null,
    };
  }

  // === Player Lookup Helpers ===

  private findPlayer(userId: string): PlayerState | undefined {
    return this.state.players.find(p => p.id === userId);
  }

  private findPlayerByRole(role: Role): PlayerState | undefined {
    return this.state.players.find(p => p.role === role);
  }

  private getWitness(): PlayerState {
    return this.findPlayerByRole('witness')!;
  }

  private getMurderer(): PlayerState {
    return this.findPlayerByRole('murderer')!;
  }

  private getAccomplice(): PlayerState | undefined {
    return this.state.players.find(p => p.role === 'accomplice' && p.status === 'alive');
  }

  private getSocket(socketId: string | null): Socket | undefined {
    if (!socketId) return undefined;
    return this.io.sockets.sockets.get(socketId);
  }

  private emitToPlayer(player: PlayerState, event: string, data: unknown): void {
    const socket = this.getSocket(player.socketId);
    socket?.emit(event, data);
  }

  // === Phase Helpers ===

  private isDiscussionPhase(): boolean {
    return DISCUSSION_PHASES.includes(this.state.phase);
  }

  private isAdvancePhase(): boolean {
    return this.state.phase === 'advance-1' || this.state.phase === 'advance-2';
  }

  // === Player Management ===

  addPlayer(userId: string, nickname: string, socketId: string): PlayerState | null {
    const existing = this.findPlayer(userId);
    if (existing) {
      return this.reconnectPlayer(existing, socketId);
    }

    if (this.state.roomStatus === 'playing') return null;
    if (this.state.players.length >= MAX_PLAYERS) return null;

    const color = PLAYER_COLORS[this.state.players.length] || '#999999';
    const isHost = this.state.players.length === 0;

    const player: PlayerState = {
      id: userId,
      nickname,
      color,
      socketId,
      isHost,
      role: null,
      status: 'alive',
      hasSolveRight: true,
      meansCards: [],
      clueCards: [],
      disconnectedAt: null,
    };

    this.state.players.push(player);
    if (isHost) this.state.hostId = userId;

    return player;
  }

  private reconnectPlayer(player: PlayerState, socketId: string): PlayerState {
    player.socketId = socketId;
    player.status = player.status === 'disconnected' ? 'alive' : player.status;
    player.disconnectedAt = null;

    const timer = this.disconnectTimers.get(player.id);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(player.id);
    }

    return player;
  }

  removePlayer(userId: string): void {
    const idx = this.state.players.findIndex(p => p.id === userId);
    if (idx === -1) return;

    if (this.state.roomStatus === 'waiting') {
      this.state.players.splice(idx, 1);
      this.transferHostIfNeeded(userId);
    }
  }

  private transferHostIfNeeded(departedId: string): void {
    if (this.state.hostId !== departedId) return;

    if (this.state.players.length > 0) {
      this.state.players[0].isHost = true;
      this.state.hostId = this.state.players[0].id;
    } else {
      this.state.hostId = null;
    }
  }

  handleDisconnect(userId: string): void {
    const player = this.findPlayer(userId);
    if (!player) return;

    player.socketId = null;

    if (this.state.roomStatus === 'playing') {
      player.status = 'disconnected';
      player.disconnectedAt = Date.now();
      this.startDisconnectTimer(userId, player);
    } else {
      this.removePlayer(userId);
    }
  }

  private startDisconnectTimer(userId: string, player: PlayerState): void {
    const timer = setTimeout(() => {
      this.disconnectTimers.delete(userId);
      player.status = 'dead';
      player.hasSolveRight = false;

      const activePlayers = this.state.players.filter(
        p => p.status !== 'dead' && p.status !== 'disconnected'
      );
      if (activePlayers.length < MIN_PLAYERS) {
        this.endGameEarly();
      }

      this.broadcastRoomState();
    }, RECONNECT_TIMEOUT_MS);

    this.disconnectTimers.set(userId, timer);
  }

  // === Game Initialization ===

  canStartGame(userId: string): OpResult {
    if (this.state.hostId !== userId) return { ok: false, error: '只有房主可以开始游戏' };
    if (this.state.roomStatus === 'playing') return { ok: false, error: '游戏已在进行中' };
    const count = this.state.players.length;
    if (count < MIN_PLAYERS) return { ok: false, error: `至少需要${MIN_PLAYERS}人才能开始游戏` };
    if (count > MAX_PLAYERS) return { ok: false, error: `最多支持${MAX_PLAYERS}人` };
    return { ok: true };
  }

  startGame(): void {
    this.state.roomStatus = 'playing';
    this.assignRoles();
    this.initDecks();
    this.dealCards();
    this.setupBoards();
    this.state.phase = 'role-reveal';
    this.emitGameStarted();

    setTimeout(() => this.transitionToNightMurder(), ROLE_REVEAL_DELAY_MS);
  }

  private assignRoles(): void {
    const count = this.state.players.length;
    const assignment = getRoleAssignment(count);
    const indices = shuffle([...Array(count).keys()]);
    let idx = 0;

    this.state.players[indices[idx++]].role = 'witness';
    this.state.players[indices[idx++]].role = 'murderer';
    for (let i = 0; i < assignment.accomplice; i++) {
      this.state.players[indices[idx++]].role = 'accomplice';
    }
    for (let i = 0; i < assignment.detective; i++) {
      this.state.players[indices[idx++]].role = 'detective';
    }

    // Witness can't solve
    this.getWitness().hasSolveRight = false;
  }

  private initDecks(): void {
    this.state.meansDeck = shuffle(ALL_MEANS_CARDS.map(c => ({ id: c.id, name: c.name })));
    this.state.clueDeck = shuffle(ALL_CLUE_CARDS.map(c => ({ id: c.id, name: c.name })));
    this.state.effectDeck = shuffle(
      ALL_EFFECT_CARDS.map(c => ({ id: c.id, name: c.name, effect: c.effect }))
    );
  }

  private dealCards(): void {
    for (const player of this.state.players) {
      if (player.role === 'witness') continue;
      player.meansCards = this.state.meansDeck.splice(0, CARDS_PER_PLAYER);
      player.clueCards = this.state.clueDeck.splice(0, CARDS_PER_PLAYER);
    }
  }

  private setupBoards(): void {
    const causeBoard = this.toBoardState(ALL_SCENE_BOARDS.find(b => b.type === 'cause')!);
    const locationBoards = shuffle(ALL_SCENE_BOARDS.filter(b => b.type === 'location'));
    const sceneBoards = shuffle(ALL_SCENE_BOARDS.filter(b => b.type === 'scene'));

    const selectedLocation = this.toBoardState(locationBoards[0]);
    const selectedScenes = sceneBoards.slice(0, INITIAL_SCENE_BOARD_COUNT).map(b => this.toBoardState(b));

    this.state.activeBoards = [causeBoard, selectedLocation, ...selectedScenes];

    const usedIds = new Set(this.state.activeBoards.map(b => b.id));
    this.state.sceneBoardPool = shuffle(
      ALL_SCENE_BOARDS
        .filter(b => !usedIds.has(b.id) && b.type !== 'cause')
        .map(b => this.toBoardState(b))
    );
  }

  private emitGameStarted(): void {
    const allPlayerCards = this.state.players
      .filter(p => p.role !== 'witness')
      .map(p => ({
        playerId: p.id,
        meansCards: p.meansCards,
        clueCards: p.clueCards,
      }));

    for (const player of this.state.players) {
      this.emitToPlayer(player, 'game_started', {
        role: player.role,
        cards: player.role !== 'witness'
          ? { meansCards: player.meansCards, clueCards: player.clueCards }
          : null,
        allPlayerCards,
      });
    }
  }

  // === Night Murder Phase ===

  private transitionToNightMurder(): void {
    this.state.phase = 'night-murder';

    this.io.emit('phase_change', { phase: 'night-murder' });
    this.io.emit('system_message', { content: '夜晚降临，请闭眼...', type: 'phase' });

    const murderer = this.getMurderer();
    const accomplice = this.getAccomplice();

    // Accomplice sees murderer identity
    if (accomplice) {
      this.emitToPlayer(accomplice, 'night_phase', { murdererId: murderer.id });
    }

    this.emitToPlayer(murderer, 'night_phase', { isMurderer: true });
    this.emitToPlayer(this.getWitness(), 'night_phase', { isWitness: true });

    for (const p of this.state.players) {
      if (p.role === 'detective') {
        this.emitToPlayer(p, 'night_phase', {});
      }
    }
  }

  handleMurdererSelect(userId: string, meansCardId: string, clueCardId: string): OpResult {
    if (this.state.phase !== 'night-murder') return { ok: false, error: '当前阶段不允许此操作' };

    const player = this.findPlayer(userId);
    if (!player || player.role !== 'murderer') return { ok: false, error: '只有凶手可以执行此操作' };

    const hasMeans = player.meansCards.some(c => c.id === meansCardId);
    const hasClue = player.clueCards.some(c => c.id === clueCardId);
    if (!hasMeans || !hasClue) return { ok: false, error: '无效的卡牌选择' };

    this.state.solution = { meansCardId, clueCardId };

    this.emitToPlayer(this.getWitness(), 'murderer_selected', {
      meansCardId,
      clueCardId,
      murdererId: player.id,
    });

    this.io.emit('system_message', { content: '凶手已完成选择，等待目击者确认...', type: 'info' });

    return { ok: true };
  }

  handleWitnessConfirmMurder(userId: string): OpResult {
    if (this.state.phase !== 'night-murder') return { ok: false, error: '当前阶段不允许此操作' };
    const player = this.findPlayer(userId);
    if (!player || player.role !== 'witness') return { ok: false, error: '只有目击者可以执行此操作' };
    if (!this.state.solution) return { ok: false, error: '凶手尚未选择' };

    this.transitionToWitnessAccuse();
    return { ok: true };
  }

  // === Witness Accusation Phase ===

  private transitionToWitnessAccuse(): void {
    this.state.phase = 'witness-accuse';
    this.io.emit('phase_change', { phase: 'witness-accuse' });
    this.io.emit('boards_revealed', { boards: this.getPublicBoards() });
    this.io.emit('system_message', { content: '天亮了！目击者正在布置场景板线索...', type: 'phase' });
  }

  handleWitnessSetMarker(
    userId: string,
    boardId: string,
    optionIndex: number,
    markerNumber: number
  ): OpResult {
    if (this.state.phase !== 'witness-accuse' && !this.isAdvancePhase()) {
      return { ok: false, error: '当前阶段不允许放置选项物' };
    }

    const player = this.findPlayer(userId);
    if (!player || player.role !== 'witness') return { ok: false, error: '只有目击者可以放置选项物' };

    const board = this.state.activeBoards.find(b => b.id === boardId);
    if (!board) return { ok: false, error: '无效的场景板' };

    if (optionIndex < 0 || optionIndex >= board.options.length) {
      return { ok: false, error: '无效的选项索引' };
    }
    if (markerNumber < MARKER_MIN || markerNumber > MARKER_MAX) {
      return { ok: false, error: `选项物编号必须在${MARKER_MIN}-${MARKER_MAX}之间` };
    }

    // Remove this marker from any other board it was on
    for (const b of this.state.activeBoards) {
      if (b.id !== boardId && b.marker?.markerNumber === markerNumber) {
        b.marker = undefined;
      }
    }

    board.marker = { optionIndex, markerNumber };
    this.io.emit('marker_placed', { boardId, optionIndex, markerNumber });

    return { ok: true };
  }

  handleWitnessConfirmAccuse(userId: string): OpResult {
    if (this.state.phase !== 'witness-accuse') return { ok: false, error: '当前阶段不允许此操作' };

    const player = this.findPlayer(userId);
    if (!player || player.role !== 'witness') return { ok: false, error: '只有目击者可以确认' };

    const placedMarkers = this.state.activeBoards.filter(b => b.marker).length;
    if (placedMarkers < ACTIVE_BOARD_COUNT) {
      return { ok: false, error: `请在所有${ACTIVE_BOARD_COUNT}张场景板上放置选项物` };
    }

    this.transitionToDiscussion('discussion-1');
    return { ok: true };
  }

  // === Discussion Phases ===

  private transitionToDiscussion(phase: DiscussionPhase): void {
    if (this.state.blackout && this.state.blackoutClearsAfterPhase === phase) {
      this.state.blackout = false;
      this.state.blackoutClearsAfterPhase = null;
      this.io.emit('system_message', { content: '电力恢复，场景板重新显示', type: 'info' });
    }

    this.state.phase = phase;

    const roundNum = phase === 'discussion-1' ? 1 : phase === 'discussion-2' ? 2 : 3;
    this.io.emit('phase_change', {
      phase,
      data: {
        boards: this.getPublicBoards(),
        blackout: this.state.blackout,
      },
    });
    this.io.emit('system_message', { content: `进入第${roundNum}轮发言，请面对面讨论`, type: 'phase' });
  }

  handleEndDiscussion(userId: string): OpResult {
    const player = this.findPlayer(userId);
    if (!player || player.role !== 'witness') return { ok: false, error: '只有目击者可以结束发言' };

    if (this.state.phase === 'discussion-1') {
      this.transitionToAdvance('advance-1');
    } else if (this.state.phase === 'discussion-2') {
      this.transitionToAdvance('advance-2');
    } else if (this.state.phase === 'discussion-3') {
      this.transitionToForceSolve();
    } else {
      return { ok: false, error: '当前阶段不允许此操作' };
    }

    return { ok: true };
  }

  // === Advance Phases ===

  private transitionToAdvance(phase: AdvancePhase): void {
    this.state.phase = phase;
    this.state.accompliceHasChosen = false;

    this.io.emit('phase_change', { phase });
    this.io.emit('system_message', { content: '推进阶段开始...', type: 'phase' });

    const accomplice = this.getAccomplice();

    if (phase === 'advance-1' && accomplice) {
      this.emitToPlayer(accomplice, 'accomplice_prompt', {});
    } else {
      this.executeAdvanceEffects(false);
    }
  }

  handleAccompliceChoose(userId: string, replaceClue: boolean, newClueCardId?: string): OpResult {
    if (this.state.phase !== 'advance-1') return { ok: false, error: '当前阶段不允许此操作' };

    const player = this.findPlayer(userId);
    if (!player || player.role !== 'accomplice') return { ok: false, error: '只有帮凶可以执行此操作' };
    if (this.state.accompliceHasChosen) return { ok: false, error: '帮凶已做出选择' };

    this.state.accompliceHasChosen = true;

    if (replaceClue && newClueCardId) {
      const murderer = this.getMurderer();
      const hasCard = murderer.clueCards.some(c => c.id === newClueCardId);
      if (!hasCard) return { ok: false, error: '无效的线索牌选择' };

      const oldClueCardId = this.state.solution!.clueCardId;
      this.state.solution!.clueCardId = newClueCardId;

      this.emitToPlayer(this.getWitness(), 'clue_replaced', { oldClueCardId, newClueCardId });

      // Accomplice replaced: 1 effect + 2 boards
      this.executeAdvanceEffects(true);
    } else {
      // Accomplice declined: 1 effect + 1 board
      this.executeAdvanceEffects(false);
    }

    return { ok: true };
  }

  private executeAdvanceEffects(accompliceReplaced: boolean): void {
    const effectCard = this.drawEffectCard();
    if (effectCard) {
      const result = this.applyEffectCard(effectCard);
      this.io.emit('effect_card', { card: effectCard, result });
    }

    const boardCount = accompliceReplaced ? 2 : 1;
    const newBoards: SceneBoardState[] = [];
    for (let i = 0; i < boardCount; i++) {
      const board = this.state.sceneBoardPool.shift();
      if (board) newBoards.push(board);
    }

    const witness = this.getWitness();

    if (newBoards.length > 0) {
      this.emitToPlayer(witness, 'advance_boards', {
        newBoards,
        replaceCount: newBoards.length,
      });
    } else {
      this.finishAdvancePhase();
    }
  }

  handleWitnessReplaceBoard(
    userId: string,
    oldBoardId: string,
    newBoardId: string,
    optionIndex: number,
    markerNumber: number
  ): OpResult {
    if (!this.isAdvancePhase() && this.state.phase !== 'witness-accuse') {
      return { ok: false, error: '当前阶段不允许替换场景板' };
    }

    const player = this.findPlayer(userId);
    if (!player || player.role !== 'witness') return { ok: false, error: '只有目击者可以替换场景板' };

    const oldBoard = this.state.activeBoards.find(b => b.id === oldBoardId);
    if (!oldBoard) return { ok: false, error: '无效的旧场景板' };
    if (oldBoard.type === 'cause') return { ok: false, error: '不能替换死亡原因场景板' };

    const newBoard = this.resolveNewBoard(newBoardId);
    if (!newBoard) return { ok: false, error: '无效的新场景板' };

    newBoard.marker = { optionIndex, markerNumber };

    const activeIdx = this.state.activeBoards.findIndex(b => b.id === oldBoardId);
    if (activeIdx >= 0) {
      oldBoard.marker = undefined;
      this.state.sceneBoardPool.push(oldBoard);
      this.state.activeBoards[activeIdx] = newBoard;
    }

    this.io.emit('board_replaced', {
      oldBoardId,
      newBoard: this.boardToPublic(newBoard),
      optionIndex,
      markerNumber,
    });

    return { ok: true };
  }

  private resolveNewBoard(newBoardId: string): SceneBoardState | undefined {
    const poolIdx = this.state.sceneBoardPool.findIndex(b => b.id === newBoardId);
    if (poolIdx >= 0) {
      return this.state.sceneBoardPool.splice(poolIdx, 1)[0];
    }
    // Fallback: board may have been sent via advance_boards and removed from pool
    const boardData = ALL_SCENE_BOARDS.find(b => b.id === newBoardId);
    return boardData ? this.toBoardState(boardData) : undefined;
  }

  finishAdvancePhase(): void {
    if (this.state.phase === 'advance-1') {
      this.transitionToDiscussion('discussion-2');
    } else if (this.state.phase === 'advance-2') {
      this.transitionToDiscussion('discussion-3');
    }
  }

  // === Solve ===

  handleAttemptSolve(userId: string, attempt: SolveAttempt): SolveOpResult {
    if (!this.isDiscussionPhase() && this.state.phase !== 'force-solve') {
      return { ok: false, error: '当前阶段不允许破案' };
    }

    const player = this.findPlayer(userId);
    if (!player) return { ok: false, error: '玩家不存在' };
    if (player.role === 'witness') return { ok: false, error: '目击者不能破案' };
    if (!player.hasSolveRight) return { ok: false, error: '你已失去破案权' };

    if (this.state.phase === 'force-solve') {
      const currentTurnId = this.state.forceSolveOrder[this.state.forceSolveIndex];
      if (currentTurnId !== userId) return { ok: false, error: '还没有轮到你' };
    }

    const suspect = this.findPlayer(attempt.suspectId);
    if (!suspect) return { ok: false, error: '无效的嫌疑人' };

    const solution = this.state.solution!;
    const murderer = this.getMurderer();

    const success =
      attempt.suspectId === murderer.id &&
      attempt.meansCardId === solution.meansCardId &&
      attempt.clueCardId === solution.clueCardId;

    player.hasSolveRight = false;

    const result = { playerId: userId, success };
    this.state.solveResults.push(result);

    this.io.emit('solve_result', result);
    this.io.emit('system_message', {
      content: success ? `${player.nickname} 破案成功！` : `${player.nickname} 破案失败`,
      type: success ? 'success' : 'warning',
    });

    if (success) {
      this.endGame('detective');
      return { ok: true, success: true };
    }

    if (this.state.phase === 'force-solve') {
      this.advanceForceSolve();
    }

    return { ok: true, success: false };
  }

  // === Force Solve ===

  private transitionToForceSolve(): void {
    this.state.phase = 'force-solve';

    this.state.forceSolveOrder = this.state.players
      .filter(p => p.hasSolveRight && p.role !== 'witness' && p.status === 'alive')
      .map(p => p.id);
    this.state.forceSolveIndex = 0;

    this.io.emit('phase_change', { phase: 'force-solve' });
    this.io.emit('system_message', { content: '进入强制破案阶段，按顺序破案', type: 'phase' });

    if (this.state.forceSolveOrder.length === 0) {
      this.endGame('murderer');
      return;
    }

    this.promptForceSolve();
  }

  private promptForceSolve(): void {
    const currentId = this.state.forceSolveOrder[this.state.forceSolveIndex];
    if (!currentId) {
      this.endGame('murderer');
      return;
    }

    this.io.emit('force_solve_turn', { playerId: currentId });
    const player = this.findPlayer(currentId);
    this.io.emit('system_message', {
      content: `等待 ${player?.nickname ?? '未知玩家'} 破案中...`,
      type: 'info',
    });
  }

  private advanceForceSolve(): void {
    this.state.forceSolveIndex++;
    if (this.state.forceSolveIndex >= this.state.forceSolveOrder.length) {
      this.endGame('murderer');
    } else {
      this.promptForceSolve();
    }
  }

  // === Game End ===

  private endGame(winner: 'detective' | 'murderer'): void {
    this.state.phase = 'game-over';
    this.state.winner = winner;

    const scoring = getScores(this.state.players.length);
    const scores: Record<string, number> = {};

    for (const player of this.state.players) {
      scores[player.id] = this.calculatePlayerScore(player, winner, scoring);
    }

    this.state.scores = scores;

    const roles: Record<string, Role> = {};
    for (const p of this.state.players) {
      if (p.role) roles[p.id] = p.role;
    }

    this.io.emit('game_over', {
      winner,
      roles,
      solution: this.state.solution,
      scores,
    });

    this.io.emit('system_message', {
      content: winner === 'detective' ? '侦探方获胜！' : '凶手方获胜！',
      type: 'success',
    });
  }

  private calculatePlayerScore(
    player: PlayerState,
    winner: 'detective' | 'murderer',
    scoring: ReturnType<typeof getScores>
  ): number {
    if (player.role === 'witness') {
      return winner === 'detective' ? scoring.witnessWin : 0;
    }
    if (player.role === 'murderer' || player.role === 'accomplice') {
      return winner === 'murderer' ? scoring.murdererWin : 0;
    }
    return winner === 'detective' ? scoring.detectiveWin : 0;
  }

  private endGameEarly(): void {
    this.io.emit('system_message', {
      content: '由于玩家人数不足，游戏提前结束',
      type: 'warning',
    });
    this.endGame('murderer');
  }

  // === Reset ===

  resetGame(): void {
    const players = this.state.players.map(p => ({
      ...p,
      role: null as Role | null,
      status: 'alive' as const,
      hasSolveRight: true,
      meansCards: [] as CardRef[],
      clueCards: [] as CardRef[],
    }));

    this.state = this.createInitialState();
    this.state.players = players;

    if (players.length > 0) {
      this.state.hostId = players[0].id;
      players[0].isHost = true;
      for (let i = 1; i < players.length; i++) {
        players[i].isHost = false;
      }
    }

    this.broadcastRoomState();
  }

  // === Effect Cards ===

  private drawEffectCard(): EffectCardRef | null {
    if (this.state.effectDeck.length === 0) return null;
    return this.state.effectDeck.shift()!;
  }

  private applyEffectCard(card: EffectCardRef): Record<string, unknown> {
    switch (card.id) {
      case 'E02': return this.applyRandomKill();
      case 'E07': return this.applyBlackout();
      case 'E09': return this.applyShuffleMeans();
      // E01, E03, E04, E05, E06, E08, E10 require witness interaction
      default:
        return { applied: false, requiresWitnessAction: true, effectId: card.id };
    }
  }

  private applyRandomKill(): Record<string, unknown> {
    const candidates = this.state.players.filter(
      p => p.role !== 'witness' && p.status === 'alive' && p.hasSolveRight
    );
    if (candidates.length === 0) return { applied: false };

    const victim = candidates[Math.floor(Math.random() * candidates.length)];
    victim.hasSolveRight = false;
    victim.status = 'dead';
    return { applied: true, victimId: victim.id, victimName: victim.nickname };
  }

  private applyBlackout(): Record<string, unknown> {
    this.state.blackout = true;
    this.state.blackoutClearsAfterPhase =
      this.state.phase === 'advance-1' ? 'discussion-2' : 'discussion-3';
    return { applied: true, blackout: true };
  }

  private applyShuffleMeans(): Record<string, unknown> {
    const participatingPlayers = this.state.players.filter(p => p.role !== 'witness');
    const flatMeans = shuffle(participatingPlayers.flatMap(p => p.meansCards));
    let idx = 0;
    for (const p of participatingPlayers) {
      p.meansCards = flatMeans.slice(idx, idx + CARDS_PER_PLAYER);
      idx += CARDS_PER_PLAYER;
    }
    return { applied: true, shuffledMeans: true };
  }

  // === Effect Card - Witness Actions ===

  handleEffectAction(userId: string, effectId: string, data: EffectActionData): OpResult {
    const player = this.findPlayer(userId);
    if (!player || player.role !== 'witness') return { ok: false, error: '只有目击者可以执行此操作' };

    switch (effectId) {
      case 'E01': return this.applyAssassination(data);
      case 'E03': return this.applyClearSuspicion(data);
      case 'E05': return this.applyEvidenceLost(data);
      case 'E08': return this.applyInfoLeak(data);
      default: return { ok: false, error: '未知效果' };
    }
  }

  private applyAssassination(data: EffectActionData): OpResult {
    const target = data.targetId ? this.findPlayer(data.targetId) : undefined;
    if (!target || target.role === 'witness') return { ok: false, error: '无效的目标' };
    target.hasSolveRight = false;
    target.status = 'dead';
    this.io.emit('system_message', {
      content: `${target.nickname} 被暗杀，失去破案权`,
      type: 'warning',
    });
    return { ok: true };
  }

  private applyClearSuspicion(data: EffectActionData): OpResult {
    const cleared = data.targetId ? this.findPlayer(data.targetId) : undefined;
    if (!cleared) return { ok: false, error: '无效的目标' };
    this.io.emit('system_message', {
      content: `目击者宣布：${cleared.nickname} 不是凶手`,
      type: 'info',
    });
    return { ok: true };
  }

  private applyEvidenceLost(data: EffectActionData): OpResult {
    const board = data.boardId
      ? this.state.activeBoards.find(b => b.id === data.boardId)
      : undefined;
    if (!board || !board.marker) return { ok: false, error: '无效的场景板' };
    board.marker = undefined;
    this.io.emit('system_message', { content: '一张场景板上的选项物被移除', type: 'warning' });
    this.io.emit('boards_revealed', { boards: this.getPublicBoards() });
    return { ok: true };
  }

  private applyInfoLeak(data: EffectActionData): OpResult {
    this.io.emit('system_message', { content: '目击者指向了凶手的一张牌', type: 'info' });
    this.io.emit('effect_card', {
      card: { id: 'E08', name: '信息泄露' },
      result: { applied: true, pointedCardId: data.cardId },
    });
    return { ok: true };
  }

  // === Public State Getters ===

  getRoomState(): {
    players: Array<{ id: string; nickname: string; color: string; isHost: boolean }>;
    status: string;
    hostId: string | null;
  } {
    return {
      players: this.state.players.map(p => ({
        id: p.id,
        nickname: p.nickname,
        color: p.color,
        isHost: p.isHost,
      })),
      status: this.state.roomStatus,
      hostId: this.state.hostId,
    };
  }

  getGameStateForPlayer(userId: string): Record<string, unknown> {
    const player = this.findPlayer(userId);
    const result: Record<string, unknown> = {
      phase: this.state.phase,
      players: this.buildPublicPlayerList(),
      boards: this.state.blackout ? [] : this.getPublicBoards(),
      blackout: this.state.blackout,
    };

    if (player) {
      result.myRole = player.role;
      this.attachPrivateInfo(result, player);
    }

    this.attachPhaseSpecificInfo(result);

    return result;
  }

  private buildPublicPlayerList(): Array<Record<string, unknown>> {
    return this.state.players.map(p => ({
      id: p.id,
      nickname: p.nickname,
      color: p.color,
      isHost: p.isHost,
      role: p.role === 'witness' ? 'witness' : undefined,
      status: p.status,
      hasSolveRight: p.hasSolveRight,
      meansCards: p.role !== 'witness' ? p.meansCards : [],
      clueCards: p.role !== 'witness' ? p.clueCards : [],
    }));
  }

  private attachPrivateInfo(result: Record<string, unknown>, player: PlayerState): void {
    const canSeeSolution = player.role === 'witness'
      || player.role === 'murderer'
      || player.role === 'accomplice';

    if (this.state.solution && canSeeSolution) {
      result.murdererSelection = this.state.solution;
    }
  }

  private attachPhaseSpecificInfo(result: Record<string, unknown>): void {
    if (this.state.phase === 'force-solve') {
      result.currentSolverId = this.state.forceSolveOrder[this.state.forceSolveIndex];
    }

    if (this.state.phase === 'game-over') {
      result.winner = this.state.winner;
      result.scores = this.state.scores;
      result.murdererSelection = this.state.solution;

      const roles: Record<string, string> = {};
      for (const p of this.state.players) {
        if (p.role) roles[p.id] = p.role;
      }
      result.roles = roles;
    }
  }

  broadcastRoomState(): void {
    this.io.emit('room_state', this.getRoomState());
  }

  broadcastGameState(): void {
    for (const player of this.state.players) {
      const socket = this.getSocket(player.socketId);
      if (socket) {
        socket.emit('game_state_sync', this.getGameStateForPlayer(player.id));
      }
    }
  }

  // === Test Accessors (内部使用，仅供测试) ===

  /** @internal - 获取活跃场景板列表 */
  getActiveBoards(): readonly SceneBoardState[] { return this.state.activeBoards; }

  /** @internal - 获取凶手答案 */
  getSolution(): Readonly<{ meansCardId: string; clueCardId: string }> | null { return this.state.solution; }

  /** @internal - 获取强制破案顺序 */
  getForceSolveOrder(): readonly string[] { return this.state.forceSolveOrder; }

  /** @internal - 获取强制破案当前索引 */
  getForceSolveIndex(): number { return this.state.forceSolveIndex; }

  /** @internal - 获取获胜方 */
  getWinner(): 'detective' | 'murderer' | null { return this.state.winner; }

  /** @internal - 获取得分表 */
  getScoresMap(): Record<string, number> | null { return this.state.scores; }

  /** @internal - 获取停电状态 */
  getBlackout(): boolean { return this.state.blackout; }

  /** @internal - 获取场景板池 */
  getSceneBoardPool(): readonly SceneBoardState[] { return this.state.sceneBoardPool; }

  /** @internal - 设置效果牌牌堆(测试用) */
  setEffectDeckForTest(deck: EffectCardRef[]): void { this.state.effectDeck = deck; }

  /** @internal - 触发夜晚阶段转换(绕过 setTimeout) */
  triggerNightMurder(): void { this.transitionToNightMurder(); }

  /** @internal - 触发游戏结束 */
  triggerEndGame(winner: 'detective' | 'murderer'): void { this.endGame(winner); }

  /** @internal - 测试效果牌 */
  testApplyEffectCard(card: EffectCardRef): Record<string, unknown> { return this.applyEffectCard(card); }

  // === Public Accessors ===

  getPhase(): GamePhase {
    return this.state.phase;
  }

  isPlaying(): boolean {
    return this.state.roomStatus === 'playing';
  }

  getPlayerBySocketId(socketId: string): PlayerState | undefined {
    return this.state.players.find(p => p.socketId === socketId);
  }

  getPlayerById(userId: string): PlayerState | undefined {
    return this.findPlayer(userId);
  }

  // === Board Helpers ===

  private getPublicBoards(): PublicBoard[] {
    return this.state.activeBoards.map(b => this.boardToPublic(b));
  }

  private boardToPublic(b: SceneBoardState): PublicBoard {
    return {
      id: b.id,
      type: b.type,
      title: b.title,
      options: b.options,
      marker: b.marker
        ? { optionIndex: b.marker.optionIndex, markerNumber: b.marker.markerNumber }
        : undefined,
    };
  }

  private toBoardState(data: SceneBoardData): SceneBoardState {
    return {
      id: data.id,
      type: data.type,
      title: data.title,
      options: [...data.options],
      marker: undefined,
    };
  }
}
