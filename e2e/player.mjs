/**
 * Multiplayer game simulation - single player script.
 *
 * Usage: node e2e/player.mjs --index <0-3> --name <nickname>
 *
 * Player at index 0 is the host and will start the game once all players join.
 * Each player reacts to game phases based on their assigned role.
 */
import { chromium } from 'playwright';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FLAGS_DIR = resolve(__dirname, 'flags');
const BASE_URL = 'http://localhost:8030';
const PASSWORD = 'crime123';
const TOTAL_PLAYERS = 4;

// Parse args
const args = process.argv.slice(2);
const indexArg = args.indexOf('--index');
const nameArg = args.indexOf('--name');
if (indexArg === -1 || nameArg === -1) {
  console.error('Usage: node player.mjs --index <0-3> --name <nickname>');
  process.exit(1);
}
const PLAYER_INDEX = parseInt(args[indexArg + 1]);
const NICKNAME = args[nameArg + 1];

function log(msg) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}] [P${PLAYER_INDEX}:${NICKNAME}] ${msg}`);
}

function writeFlag(name, data = '') {
  if (!existsSync(FLAGS_DIR)) mkdirSync(FLAGS_DIR, { recursive: true });
  writeFileSync(resolve(FLAGS_DIR, name), data || 'ok');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ==================== Pinia Helpers ====================

function getPiniaState(page) {
  return page.evaluate(() => {
    const app = document.querySelector('#app')?.__vue_app__;
    if (!app) return null;
    const pinia = app.config.globalProperties.$pinia;
    if (!pinia) return null;
    return {
      game: pinia.state.value.game,
      auth: pinia.state.value.auth,
    };
  });
}

async function getGameField(page, field) {
  return page.evaluate((f) => {
    const app = document.querySelector('#app')?.__vue_app__;
    const pinia = app?.config.globalProperties.$pinia;
    return pinia?.state.value.game?.[f] ?? null;
  }, field);
}

async function getPhase(page) {
  return getGameField(page, 'phase');
}

async function getMyRole(page) {
  return getGameField(page, 'myRole');
}

async function waitForPhase(page, targetPhase) {
  log(`Waiting for phase: ${targetPhase}...`);
  while (true) {
    const phase = await getPhase(page);
    if (phase === targetPhase) return phase;
    await sleep(500);
  }
}

async function waitForPhaseNot(page, currentPhase) {
  log(`Waiting for phase to change from: ${currentPhase}...`);
  while (true) {
    const phase = await getPhase(page);
    if (phase && phase !== currentPhase) {
      log(`Phase changed to: ${phase}`);
      return phase;
    }
    await sleep(500);
  }
}

async function waitForSocketConnected(page) {
  log('Waiting for socket connection...');
  while (true) {
    // Check if join button would be enabled (requires nickname filled)
    // Instead, check if the socket connected ref is true
    const connected = await page.evaluate(() => {
      // Access the module-level connected ref from useSocket
      // We check indirectly by testing if the button disabled state changes
      const app = document.querySelector('#app')?.__vue_app__;
      if (!app) return false;
      // Try to find the connected state through Vue component internals
      // Alternative: check if there's an active socket.io connection via network
      const btn = document.querySelector('button[type="submit"]');
      if (!btn) return false;
      // If button exists, check if ONLY nickname prevents enabling
      // Temporarily check the socket connection via io manager
      return !btn.disabled || btn.textContent?.includes('加入');
    });

    // Better approach: try to detect socket.io polling in the page
    const hasSocket = await page.evaluate(() => {
      // socket.io adds a socket to the global scope or we can check performance entries
      const entries = performance.getEntriesByType('resource');
      return entries.some(e => e.name.includes('socket.io'));
    });

    if (hasSocket) {
      log('Socket.IO connection detected');
      return;
    }
    await sleep(500);
  }
}

// ==================== Main Flow ====================

async function main() {
  log('Starting browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  // Remove all default timeouts (user requested no time limits)
  page.setDefaultTimeout(0);
  page.setDefaultNavigationTimeout(0);

  page.on('console', msg => {
    if (msg.type() === 'error') log(`[CONSOLE ERROR] ${msg.text()}`);
  });

  try {
    // Step 1: Authenticate
    log('Authenticating...');
    await page.goto(BASE_URL, { waitUntil: 'load' });

    const token = await page.evaluate(async (pwd) => {
      const res = await fetch('/api/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd }),
      });
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem('csi_token', data.token);
        return data.token;
      }
      throw new Error('Auth failed: ' + JSON.stringify(data));
    }, PASSWORD);
    log(`Authenticated (token length: ${token.length})`);

    // Step 2: Navigate to lobby (use 'load' not 'networkidle' to avoid socket.io polling block)
    await page.goto(`${BASE_URL}/lobby`, { waitUntil: 'load' });
    log('On lobby page');

    // Step 3: Wait for socket connection
    await waitForSocketConnected(page);

    // Step 4: Fill nickname and click join
    const nicknameInput = await page.waitForSelector('input[type="text"]');
    await nicknameInput.fill(NICKNAME);
    log(`Filled nickname: ${NICKNAME}`);

    // Wait for button to become enabled
    while (true) {
      const disabled = await page.evaluate(() => {
        const btn = document.querySelector('button[type="submit"]');
        return btn?.disabled ?? true;
      });
      if (!disabled) break;
      await sleep(200);
    }

    await page.click('button[type="submit"]');
    log('Clicked join button');

    // Wait for post-join state (header element appears)
    await page.waitForSelector('header');
    await sleep(500);

    // Verify join by checking roomPlayers
    let retries = 0;
    let roomPlayers;
    while (true) {
      roomPlayers = await getGameField(page, 'roomPlayers');
      if (roomPlayers && roomPlayers.length > 0) break;
      retries++;
      if (retries > 20) {
        log(`WARNING: roomPlayers still empty after ${retries} checks`);
      }
      await sleep(500);
    }
    log(`Joined lobby! Players: ${roomPlayers.map(p => p.nickname).join(', ')} (${roomPlayers.length}/${TOTAL_PLAYERS})`);
    writeFlag(`player-${PLAYER_INDEX}-joined`);

    // Step 5: Dynamically determine if I am the host, then either start or wait
    const amIHost = await page.evaluate(() => {
      const app = document.querySelector('#app')?.__vue_app__;
      const pinia = app?.config.globalProperties.$pinia;
      const gs = pinia?.state.value.game;
      const as = pinia?.state.value.auth;
      // Decode userId from token
      if (!as?.token) return false;
      try {
        const payload = JSON.parse(atob(as.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return gs?.hostId === payload.id;
      } catch { return false; }
    });

    if (amIHost) {
      log('I am the HOST! Waiting for all players...');
      while (true) {
        const players = await getGameField(page, 'roomPlayers');
        const count = players?.length ?? 0;
        if (count >= TOTAL_PLAYERS) {
          log(`All ${count} players joined!`);
          break;
        }
        log(`Players: ${count}/${TOTAL_PLAYERS}...`);
        await sleep(2000);
      }

      await sleep(1000);
      log('Starting game...');

      // Wait for start button to become enabled
      while (true) {
        const btnReady = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const startBtn = buttons.find(b => b.textContent?.includes('开始调查'));
          return startBtn ? { found: true, disabled: startBtn.disabled } : { found: false };
        });
        if (btnReady.found && !btnReady.disabled) break;
        await sleep(500);
      }

      const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const startBtn = buttons.find(b => b.textContent?.includes('开始调查') && !b.disabled);
        if (startBtn) { startBtn.click(); return true; }
        return false;
      });
      log(`Start button clicked: ${clicked}`);
    } else {
      log('I am NOT the host. Waiting for game to start...');
    }

    // Step 6: Wait for role-reveal phase
    await waitForPhase(page, 'role-reveal');
    log('Game started! Role reveal phase');

    const myRole = await getMyRole(page);
    log(`My role: ${myRole}`);
    writeFlag(`player-${PLAYER_INDEX}-role`, myRole || 'unknown');

    // Step 7: Wait for night phase
    await waitForPhase(page, 'night-murder');
    log('Night phase started');

    // Step 8: Play role
    await playRole(page, myRole);

    log('=== Game simulation complete! ===');

    const finalState = await page.evaluate(() => {
      const app = document.querySelector('#app')?.__vue_app__;
      const pinia = app?.config.globalProperties.$pinia;
      const gs = pinia?.state.value.game;
      return { phase: gs?.phase, winner: gs?.winner, myRole: gs?.myRole };
    });
    log(`Final state: ${JSON.stringify(finalState)}`);
    writeFlag(`player-${PLAYER_INDEX}-done`, JSON.stringify(finalState));

  } catch (err) {
    log(`ERROR: ${err.message}`);
    try {
      await page.screenshot({ path: resolve(__dirname, `error-player-${PLAYER_INDEX}.png`) });
      log('Error screenshot saved');
    } catch {}
    writeFlag(`player-${PLAYER_INDEX}-error`, err.message);
  } finally {
    await browser.close();
    log('Browser closed');
  }
}

// ==================== Role Gameplay ====================

async function playRole(page, role) {
  switch (role) {
    case 'murderer': return await playMurderer(page);
    case 'witness': return await playWitness(page);
    case 'accomplice': return await playAccomplice(page);
    case 'detective': return await playDetective(page);
    default: log(`Unknown role: ${role}`); return await waitForGameOver(page);
  }
}

async function playMurderer(page) {
  log('[MURDERER] Selecting murder weapons...');
  await sleep(2000);

  // Get my cards from the store
  const cards = await page.evaluate(() => {
    const app = document.querySelector('#app')?.__vue_app__;
    const pinia = app?.config.globalProperties.$pinia;
    const gs = pinia?.state.value.game;
    const me = gs?.players?.find(p => p.id === gs?.myPlayerId);
    return { meansCards: me?.meansCards || [], clueCards: me?.clueCards || [] };
  });

  log(`[MURDERER] Means: ${cards.meansCards.map(c => c.name).join(', ')}`);
  log(`[MURDERER] Clues: ${cards.clueCards.map(c => c.name).join(', ')}`);

  // Select cards via socket emit (most reliable approach)
  if (cards.meansCards[0] && cards.clueCards[0]) {
    const result = await emitViaSocket(page, 'murderer_select', {
      meansCardId: cards.meansCards[0].id,
      clueCardId: cards.clueCards[0].id,
    });
    log(`[MURDERER] Socket emit murderer_select: ${JSON.stringify(result)}`);
  } else {
    log('[MURDERER] ERROR: No cards available!');
  }

  // Wait for next phase
  await waitForPhaseNot(page, 'night-murder');
  await playPassivePhases(page);
}

async function playWitness(page) {
  log('[WITNESS] Waiting for murderer selection...');

  // Wait for the murderer_selected event (solution appears in store)
  while (true) {
    const selection = await getGameField(page, 'murdererSelection');
    if (selection?.meansCardId) {
      log(`[WITNESS] Murderer selected means: ${selection.meansCardId}, clue: ${selection.clueCardId}`);
      break;
    }
    await sleep(500);
  }

  await sleep(1000);

  // Confirm murder selection via socket
  const result = await emitViaSocket(page, 'witness_confirm_murder', {});
  log(`[WITNESS] Confirm murder: ${JSON.stringify(result)}`);

  // Wait for witness-accuse phase
  await waitForPhase(page, 'witness-accuse');
  log('[WITNESS] Placing markers...');
  await sleep(2000);

  // Place markers on all boards via socket (more reliable than UI clicking)
  const boards = await getGameField(page, 'boards');
  if (boards && boards.length > 0) {
    for (let i = 0; i < boards.length; i++) {
      const board = boards[i];
      // Place marker on first option, with markerNumber = position+1
      await emitViaSocket(page, 'witness_set_marker', {
        boardId: board.id,
        optionIndex: 0,
        markerNumber: i + 1,
      });
      log(`[WITNESS] Placed marker ${i+1} on board "${board.title}"`);
      await sleep(300);
    }
  }

  await sleep(1000);

  // Confirm accusation
  await emitViaSocket(page, 'witness_confirm', {});
  log('[WITNESS] Confirmed accusation setup');

  // Play through discussion + advance phases
  await playWitnessPhases(page);
}

async function playWitnessPhases(page) {
  const phases = [
    { discussion: 'discussion-1', advance: 'advance-1' },
    { discussion: 'discussion-2', advance: 'advance-2' },
    { discussion: 'discussion-3', advance: null },
  ];

  for (const { discussion, advance } of phases) {
    await waitForPhase(page, discussion);
    log(`[WITNESS] In ${discussion}`);
    await sleep(3000);

    // End discussion
    await emitViaSocket(page, 'end_discussion', {});
    log(`[WITNESS] Ended ${discussion}`);

    if (advance) {
      await waitForPhase(page, advance);
      log(`[WITNESS] In ${advance}`);
      await sleep(2000);

      // Finish advance without replacing boards
      await emitViaSocket(page, 'witness_finish_advance', {});
      log(`[WITNESS] Finished ${advance}`);
    }
  }

  // Wait for force-solve or game-over
  const nextPhase = await waitForPhaseNot(page, 'discussion-3');
  if (nextPhase === 'game-over') {
    log('[WITNESS] Game over!');
    return;
  }

  log(`[WITNESS] Now in ${nextPhase}, waiting for game over...`);
  await waitForGameOver(page);
}

async function playAccomplice(page) {
  log('[ACCOMPLICE] Watching murderer...');

  // Wait through night phase
  await waitForPhaseNot(page, 'night-murder');
  log('[ACCOMPLICE] Night phase ended');

  // During advance-1, need to make a choice
  await playPassivePhases(page);
}

async function playDetective(page) {
  log('[DETECTIVE] Waiting...');
  await waitForPhaseNot(page, 'night-murder');
  await playPassivePhases(page);
}

async function playPassivePhases(page) {
  while (true) {
    const phase = await getPhase(page);
    log(`[PASSIVE] Current phase: ${phase}`);

    if (phase === 'game-over') {
      log('[PASSIVE] Game over!');
      return;
    }

    // Accomplice action during advance-1
    const myRole = await getMyRole(page);
    if (myRole === 'accomplice' && phase === 'advance-1') {
      log('[ACCOMPLICE] Declining to replace clue');
      await sleep(1000);
      await emitViaSocket(page, 'accomplice_choose', { replaceClue: false });
    }

    // Force solve - attempt with wrong answer (will fail)
    if (phase === 'force-solve' && myRole !== 'witness') {
      const myId = await getGameField(page, 'myPlayerId');
      const turnId = await getGameField(page, 'forceSolveTurnPlayerId');
      if (turnId === myId) {
        log(`[${myRole?.toUpperCase()}] My turn to force-solve!`);
        await sleep(1000);
        // Pick first non-witness player as suspect, first available cards
        const players = await getGameField(page, 'players');
        const me = players?.find(p => p.id === myId);
        const suspect = players?.find(p => p.id !== myId && p.role !== 'witness');
        if (suspect && me?.meansCards?.[0] && me?.clueCards?.[0]) {
          await emitViaSocket(page, 'attempt_solve', {
            suspectId: suspect.id,
            meansCardId: me.meansCards[0].id,
            clueCardId: me.clueCards[0].id,
          });
          log(`[${myRole?.toUpperCase()}] Attempted solve (likely wrong)`);
        }
      }
    }

    await sleep(2000);
  }
}

async function waitForGameOver(page) {
  await waitForPhase(page, 'game-over');
  log('Game over reached!');
}

// ==================== Socket Emit Helper ====================

async function emitViaSocket(page, event, data) {
  const result = await page.evaluate(({ event, data }) => {
    const socket = window.__socket;
    if (socket?.connected) {
      socket.emit(event, data);
      return { sent: true };
    }
    return { sent: false, error: 'Socket not connected or not found on window.__socket' };
  }, { event, data });
  if (!result.sent) {
    log(`WARNING: emitViaSocket failed for "${event}": ${result.error}`);
  }
  return result;
}

// ==================== Run ====================
main().catch(err => {
  log(`FATAL: ${err.message}`);
  process.exit(1);
});
