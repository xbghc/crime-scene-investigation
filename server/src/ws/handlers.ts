import type { Server, Socket } from 'socket.io';
import { GameEngine } from '../engine/GameEngine.js';
import type { EffectActionData, OpResult } from '../types.js';
import { logger } from '../utils/logger.js';

let engine: GameEngine | null = null;

function getEngine(io: Server): GameEngine {
  if (!engine) {
    engine = new GameEngine(io);
    // Reset engine state on server restart to avoid stale 'playing' status
    engine.resetToInitial();
  }
  return engine;
}

/** Send error result back to the client */
function emitError(socket: Socket, result: OpResult): void {
  socket.emit('system_message', { content: result.error ?? '操作失败', type: 'error' });
}

export function registerHandlers(io: Server, socket: Socket): void {
  const ge = getEngine(io);
  const userId = socket.data.userId as string | undefined;

  if (!userId) {
    socket.emit('system_message', { content: '身份验证失败', type: 'error' });
    socket.disconnect(true);
    return;
  }

  console.log(`Client connected: ${socket.id} (user: ${userId})`);

  // === Room Management ===

  socket.on('join_room', ({ nickname }: { nickname: string }) => {
    console.log(`${nickname} joining room (user: ${userId})`);
    logger.game('PLAYER', `Player joining room`, { userId, nickname, socketId: socket.id });

    const player = ge.addPlayer(userId, nickname, socket.id);
    if (!player) {
      logger.warn('PLAYER', `Failed to join room`, { userId, nickname, reason: 'room_full_or_playing' });
      socket.emit('system_message', {
        content: '无法加入房间（房间已满或游戏已在进行中）',
        type: 'error',
      });
      return;
    }

    logger.game('PLAYER', `Player joined successfully`, { userId, nickname, isReconnect: ge.isPlaying() });

    // If reconnecting during a game, send full game state
    if (ge.isPlaying()) {
      socket.emit('full_state', ge.getGameStateForPlayer(userId));
      // Also send room state to ensure hostId and other room metadata are synced
      socket.emit('room_state', ge.getRoomState());
      io.emit('system_message', {
        content: `${player.nickname} 已重新连接`,
        type: 'info',
      });
    } else {
      io.emit('player_joined', {
        player: {
          id: player.id,
          nickname: player.nickname,
          color: player.color,
          isHost: player.isHost,
        },
      });
    }

    ge.broadcastRoomState();
  });

  socket.on('leave_room', () => {
    ge.removePlayer(userId);
    io.emit('player_left', { playerId: userId });
    ge.broadcastRoomState();
  });

  // === Game Start ===

  socket.on('start_game', () => {
    logger.game('GAME', `Start game requested`, { userId, playerCount: ge.getRoomState().players.length });
    const check = ge.canStartGame(userId);
    if (!check.ok) {
      logger.warn('GAME', `Start game failed`, { userId, reason: check.error });
      emitError(socket, check);
      return;
    }
    logger.game('GAME', `Starting game...`, { userId });
    ge.startGame();
  });

  // === Night Phase - Murderer ===

  socket.on('murderer_select', ({ meansCardId, clueCardId }: { meansCardId: string; clueCardId: string }) => {
    logger.game('MURDERER', `Murderer selecting cards`, { userId, meansCardId, clueCardId });
    const result = ge.handleMurdererSelect(userId, meansCardId, clueCardId);
    if (!result.ok) {
      logger.warn('MURDERER', `Murderer select failed`, { userId, reason: result.error });
      emitError(socket, result);
    } else {
      logger.game('MURDERER', `Murderer selection complete`, { userId, meansCardId, clueCardId });
    }
  });

  // === Night Phase - Witness confirms murder selection ===

  socket.on('witness_confirm_murder', () => {
    logger.game('WITNESS', `Witness confirming murder`, { userId });
    const result = ge.handleWitnessConfirmMurder(userId);
    if (!result.ok) {
      logger.warn('WITNESS', `Witness confirm failed`, { userId, reason: result.error });
      emitError(socket, result);
    } else {
      logger.game('WITNESS', `Witness confirmed murder, transitioning to witness-accuse`, { userId });
    }
  });

  // === Witness Marker Placement ===

  socket.on('witness_set_marker', ({ boardId, optionIndex, markerNumber }: {
    boardId: string;
    optionIndex: number;
    markerNumber: number;
  }) => {
    const result = ge.handleWitnessSetMarker(userId, boardId, optionIndex, markerNumber);
    if (!result.ok) emitError(socket, result);
  });

  // === Witness Confirms Accusation Setup ===

  socket.on('witness_confirm', () => {
    const result = ge.handleWitnessConfirmAccuse(userId);
    if (!result.ok) emitError(socket, result);
  });

  // === Witness Replace Board ===

  socket.on('witness_replace_board', ({ oldBoardId, newBoardId, optionIndex, markerNumber }: {
    oldBoardId: string;
    newBoardId: string;
    optionIndex: number;
    markerNumber: number;
  }) => {
    const result = ge.handleWitnessReplaceBoard(userId, oldBoardId, newBoardId, optionIndex, markerNumber);
    if (!result.ok) emitError(socket, result);
  });

  // === Witness finishes advance phase board replacement ===

  socket.on('witness_finish_advance', () => {
    const player = ge.getPlayerById(userId);
    if (!player || player.role !== 'witness') {
      socket.emit('system_message', { content: '只有目击者可以执行此操作', type: 'error' });
      return;
    }
    ge.finishAdvancePhase();
  });

  // === End Discussion ===

  socket.on('end_discussion', () => {
    const result = ge.handleEndDiscussion(userId);
    if (!result.ok) emitError(socket, result);
  });

  // === Accomplice Choice ===

  socket.on('accomplice_choose', ({ replaceClue, newClueCardId }: {
    replaceClue: boolean;
    newClueCardId?: string;
  }) => {
    const result = ge.handleAccompliceChoose(userId, replaceClue, newClueCardId);
    if (!result.ok) emitError(socket, result);
  });

  // === Solve ===

  socket.on('attempt_solve', ({ suspectId, meansCardId, clueCardId }: {
    suspectId: string;
    meansCardId: string;
    clueCardId: string;
  }) => {
    logger.game('SOLVE', `Player attempting to solve`, { userId, suspectId, meansCardId, clueCardId });
    const result = ge.handleAttemptSolve(userId, { suspectId, meansCardId, clueCardId });
    if (!result.ok) {
      logger.warn('SOLVE', `Solve attempt failed`, { userId, reason: result.error });
      emitError(socket, result);
    } else if ('success' in result) {
      logger.game('SOLVE', `Solve attempt result`, { userId, success: result.success, suspectId, meansCardId, clueCardId });
    }
  });

  // === Effect Card Actions (witness) ===

  socket.on('effect_action', ({ effectId, data }: { effectId: string; data: EffectActionData }) => {
    const result = ge.handleEffectAction(userId, effectId, data);
    if (!result.ok) emitError(socket, result);
  });

  // === Reset Game ===

  socket.on('reset_game', () => {
    const player = ge.getPlayerById(userId);
    if (!player || !player.isHost) {
      socket.emit('system_message', { content: '只有房主可以重新开始', type: 'error' });
      return;
    }
    ge.resetGame();
    io.emit('system_message', { content: '游戏已重置，等待房主开始新一局', type: 'info' });
  });

  // === Update Nickname ===

  socket.on('update_nickname', (data: { nickname: string }) => {
    const { nickname } = data;
    if (!nickname || typeof nickname !== 'string') {
      socket.emit('system_message', { content: '昵称不能为空', type: 'error' });
      return;
    }
    const trimmed = nickname.trim();
    if (trimmed.length === 0 || trimmed.length > 10) {
      socket.emit('system_message', { content: '昵称长度必须在1-10个字符之间', type: 'error' });
      return;
    }
    const result = ge.updatePlayerNickname(userId, trimmed);
    if (result.ok) {
      io.emit('system_message', { content: `${trimmed} 更新了昵称`, type: 'info' });
      ge.broadcastRoomState();
    } else {
      socket.emit('system_message', { content: result.error || '更新昵称失败', type: 'error' });
    }
  });

  // === Request State (reconnection) ===

  socket.on('request_state', () => {
    if (ge.isPlaying()) {
      socket.emit('full_state', ge.getGameStateForPlayer(userId));
    } else {
      socket.emit('room_state', ge.getRoomState());
    }
  });

  // === Disconnect ===

  socket.on('disconnect', (reason: string) => {
    console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
    ge.handleDisconnect(userId);

    const player = ge.getPlayerById(userId);
    if (player) {
      io.emit('system_message', {
        content: `${player.nickname} 已断开连接`,
        type: 'warning',
      });
    }

    ge.broadcastRoomState();
  });
}
