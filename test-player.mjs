#!/usr/bin/env node

/**
 * Socket.IO Crime Scene Game Player
 *
 * Usage: node test-player.mjs <player-number>
 * Example: node test-player.mjs 1
 */

import { io } from 'socket.io-client';
import jwt from 'jsonwebtoken';

const PLAYER_NUM = process.argv[2] || '1';
const NICKNAME = `玩家${PLAYER_NUM}`;
const PASSWORD = '123456';
const SERVER_URL = 'http://localhost:8040';

let socket = null;
let myUserId = null;
let myRole = null;
let isHost = false;
let gamePhase = null;

// === Utility Functions ===

function log(category, message, data = null) {
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
  console.log(`[${timestamp}] [${NICKNAME}] [${category}] ${message}${dataStr}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyPassword() {
  log('AUTH', 'Verifying password...');
  const response = await fetch(`${SERVER_URL}/api/verify-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  });

  if (!response.ok) {
    throw new Error(`Password verification failed: ${response.status}`);
  }

  const data = await response.json();
  const token = data.token;
  const payload = jwt.decode(token);
  myUserId = payload.id;

  log('AUTH', 'Password verified', { userId: myUserId });
  return token;
}

function connectSocket(token) {
  log('SOCKET', 'Connecting to server...');

  socket = io(SERVER_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
  });

  setupSocketListeners();
}

// === Socket Event Listeners ===

function setupSocketListeners() {
  socket.on('connect', () => {
    log('SOCKET', 'Connected', { socketId: socket.id });
    socket.emit('join_room', { nickname: NICKNAME });
  });

  socket.on('disconnect', (reason) => {
    log('SOCKET', 'Disconnected', { reason });
  });

  socket.on('room_state', (data) => {
    log('ROOM', 'Room state updated', {
      playerCount: data.players.length,
      status: data.status,
      hostId: data.hostId,
    });

    isHost = data.hostId === myUserId;

    if (isHost) {
      log('ROOM', '🎖️ I am the host!');

      // Auto-start game if we have enough players and still waiting
      if (data.status === 'waiting' && data.players.length >= 4) {
        log('ROOM', `Starting game with ${data.players.length} players...`);
        setTimeout(() => {
          socket.emit('start_game');
        }, 2000); // Wait 2 seconds before starting
      }
    }
  });

  socket.on('game_started', (data) => {
    myRole = data.role;
    log('GAME', '=== GAME STARTED ===', { role: myRole });

    if (myRole !== 'witness') {
      log('CARDS', 'My cards', {
        meansCards: data.cards.meansCards.map(c => c.name),
        clueCards: data.cards.clueCards.map(c => c.name),
      });
    }
  });

  socket.on('phase_change', (data) => {
    gamePhase = data.phase;
    log('PHASE', `Phase changed to: ${data.phase}`);
    handlePhaseChange(data);
  });

  socket.on('night_phase', (data) => {
    log('NIGHT', 'Night phase info', data);

    if (data.isMurderer) {
      log('ROLE', 'I am the MURDERER!');
      setTimeout(() => performMurdererAction(), 3000);
    } else if (data.isWitness) {
      log('ROLE', 'I am the WITNESS!');
    } else if (data.murdererId) {
      log('ROLE', `I am the ACCOMPLICE. Murderer is: ${data.murdererId}`);
    } else {
      log('ROLE', 'I am a DETECTIVE');
    }
  });

  socket.on('murderer_selected', (data) => {
    log('WITNESS', 'Murderer has selected cards', {
      meansCard: data.meansCard.name,
      clueCard: data.clueCard.name,
    });

    if (myRole === 'witness') {
      setTimeout(() => {
        log('WITNESS', 'Confirming murder...');
        socket.emit('witness_confirm_murder');
      }, 2000);
    }
  });

  socket.on('boards_revealed', (data) => {
    log('BOARDS', 'Boards revealed', {
      boardCount: data.boards.length,
      boards: data.boards.map(b => b.title),
    });

    if (myRole === 'witness' && gamePhase === 'witness-accuse') {
      setTimeout(() => performWitnessAccuse(data.boards), 3000);
    }
  });

  socket.on('marker_placed', (data) => {
    log('WITNESS', 'Marker placed', data);
  });

  socket.on('new_boards', (data) => {
    log('ADVANCE', 'New boards available', {
      count: data.boards.length,
      boards: data.boards.map(b => b.title),
    });

    if (myRole === 'witness') {
      setTimeout(() => {
        log('WITNESS', 'Finishing advance phase...');
        socket.emit('witness_finish_advance');
      }, 2000);
    }
  });

  socket.on('accomplice_prompt', () => {
    log('ACCOMPLICE', 'Accomplice decision time');

    if (myRole === 'accomplice') {
      setTimeout(() => {
        log('ACCOMPLICE', 'Declining to replace clue');
        socket.emit('accomplice_choose', { replaceClue: false });
      }, 2000);
    }
  });

  socket.on('effect_card', (data) => {
    log('EFFECT', 'Effect card drawn', {
      card: data.card.name,
      result: data.result,
    });
  });

  socket.on('solve_result', (data) => {
    log('SOLVE', 'Solve result', data);
  });

  socket.on('force_solve_turn', (data) => {
    log('SOLVE', 'Force solve turn', { playerId: data.playerId });

    if (data.playerId === myUserId && myRole !== 'witness') {
      setTimeout(() => performSolve(), 3000);
    }
  });

  socket.on('game_over', (data) => {
    log('GAME', '=== GAME OVER ===', {
      winner: data.winner,
      myScore: data.scores[myUserId],
      solution: data.solution,
    });

    // Exit after game over
    setTimeout(() => {
      log('EXIT', 'Exiting...');
      process.exit(0);
    }, 5000);
  });

  socket.on('system_message', (data) => {
    log('SYSTEM', data.content, { type: data.type });
  });

  socket.on('error', (error) => {
    log('ERROR', 'Socket error', { error: error.message || error });
  });
}

// === Game Actions ===

async function performMurdererAction() {
  await sleep(1000);

  log('MURDERER', 'Requesting full state to get cards...');
  socket.emit('request_state');

  await sleep(1000);

  socket.once('full_state', (state) => {
    const myPlayer = state.players?.find(p => p.id === myUserId);
    if (myPlayer && myPlayer.meansCards && myPlayer.clueCards) {
      const meansCard = myPlayer.meansCards[0];
      const clueCard = myPlayer.clueCards[0];

      log('MURDERER', 'Selecting cards', {
        means: meansCard.name,
        clue: clueCard.name,
      });

      socket.emit('murderer_select', {
        meansCardId: meansCard.id,
        clueCardId: clueCard.id,
      });
    }
  });

  socket.emit('request_state');
}

async function performWitnessAccuse(boards) {
  await sleep(2000);

  // Place markers on all boards
  let markerNum = 1;
  for (const board of boards) {
    if (board.options && board.options.length > 0) {
      const optionIndex = Math.floor(Math.random() * board.options.length);

      log('WITNESS', 'Placing marker', {
        board: board.title,
        optionIndex,
        markerNum,
      });

      socket.emit('witness_set_marker', {
        boardId: board.id,
        optionIndex,
        markerNumber: markerNum,
      });

      markerNum++;
      await sleep(500);
    }
  }

  await sleep(2000);
  log('WITNESS', 'Confirming accusation setup...');
  socket.emit('witness_confirm');
}

async function performSolve() {
  await sleep(1000);

  log('SOLVE', 'Requesting state for solve...');
  socket.once('full_state', (state) => {
    const players = state.players || [];
    const randomPlayer = players[Math.floor(Math.random() * players.length)];

    // Get random cards from any player
    const allMeansCards = players.flatMap(p => p.meansCards || []);
    const allClueCards = players.flatMap(p => p.clueCards || []);

    if (allMeansCards.length > 0 && allClueCards.length > 0) {
      const meansCard = allMeansCards[Math.floor(Math.random() * allMeansCards.length)];
      const clueCard = allClueCards[Math.floor(Math.random() * allClueCards.length)];

      log('SOLVE', 'Attempting to solve', {
        suspect: randomPlayer.nickname,
        means: meansCard.name,
        clue: clueCard.name,
      });

      socket.emit('attempt_solve', {
        suspectId: randomPlayer.id,
        meansCardId: meansCard.id,
        clueCardId: clueCard.id,
      });
    }
  });

  socket.emit('request_state');
}

async function handlePhaseChange(data) {
  switch (data.phase) {
    case 'discussion-1':
    case 'discussion-2':
    case 'discussion-3':
      if (myRole === 'witness') {
        // End discussion after 5 seconds
        setTimeout(() => {
          log('WITNESS', 'Ending discussion...');
          socket.emit('end_discussion');
        }, 5000);
      }
      break;

    case 'advance-1':
    case 'advance-2':
      // Handled by accomplice_prompt or new_boards events
      break;
  }
}

// === Main ===

async function main() {
  try {
    log('INIT', `Starting player ${PLAYER_NUM}...`);

    const token = await verifyPassword();
    connectSocket(token);

    // Keep process alive
    process.on('SIGINT', () => {
      log('EXIT', 'Received SIGINT, exiting...');
      socket?.disconnect();
      process.exit(0);
    });

  } catch (error) {
    log('ERROR', 'Fatal error', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

main();
