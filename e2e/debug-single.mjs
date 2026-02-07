/**
 * Minimal debug script: authenticate + join lobby + check room state
 */
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:8030';

async function main() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  // Log all console messages from the page
  page.on('console', msg => console.log(`  [PAGE ${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => console.log(`  [PAGE ERROR] ${err.message}`));

  try {
    // Step 1: Go to homepage
    console.log('1. Navigating to homepage...');
    await page.goto(BASE_URL);
    console.log(`   URL: ${page.url()}`);

    // Step 2: Authenticate via API
    console.log('2. Authenticating...');
    const authResult = await page.evaluate(async () => {
      const res = await fetch('/api/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'crime123' }),
      });
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem('csi_token', data.token);
        return { ok: true, tokenLen: data.token.length };
      }
      return { ok: false, data };
    });
    console.log(`   Auth result:`, authResult);

    // Step 3: Navigate to lobby
    console.log('3. Navigating to /lobby...');
    await page.goto(`${BASE_URL}/lobby`, { waitUntil: 'load' });
    console.log(`   URL: ${page.url()}`);

    // Step 4: Wait for socket connection
    console.log('4. Waiting for socket connection...');
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const state = await page.evaluate(() => {
        const app = document.querySelector('#app')?.__vue_app__;
        if (!app) return { error: 'no vue app' };
        const pinia = app.config.globalProperties.$pinia;
        if (!pinia) return { error: 'no pinia' };
        const auth = pinia.state.value.auth;
        const game = pinia.state.value.game;
        return {
          authenticated: !!auth?.token,
          roomPlayers: game?.roomPlayers?.length ?? 'N/A',
          phase: game?.phase,
        };
      });
      console.log(`   [${i+1}s] State:`, state);
    }

    // Step 5: Check if join button is enabled
    const btnState = await page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]');
      return btn ? { text: btn.textContent?.trim(), disabled: btn.disabled } : null;
    });
    console.log('5. Join button state:', btnState);

    // Step 6: Fill nickname and click join
    console.log('6. Filling nickname...');
    const input = await page.waitForSelector('input[type="text"]', { timeout: 5000 });
    await input.fill('调试员');

    // Check button state again after filling nickname
    const btnState2 = await page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]');
      return btn ? { text: btn.textContent?.trim(), disabled: btn.disabled } : null;
    });
    console.log('   Button after filling:', btnState2);

    if (btnState2?.disabled) {
      console.log('   WARNING: Button still disabled! Socket may not be connected.');
      console.log('   Checking network...');

      // Check socket.io connection directly
      const socketCheck = await page.evaluate(() => {
        // Try to find socket.io client
        const scripts = Array.from(document.querySelectorAll('script'));
        return {
          scriptCount: scripts.length,
          socketExists: typeof window.io !== 'undefined',
        };
      });
      console.log('   Socket check:', socketCheck);
    } else {
      console.log('7. Clicking join...');
      await page.click('button[type="submit"]');
      await new Promise(r => setTimeout(r, 2000));

      // Check post-join state
      const postJoinState = await page.evaluate(() => {
        const app = document.querySelector('#app')?.__vue_app__;
        const pinia = app?.config.globalProperties.$pinia;
        const game = pinia?.state.value.game;
        return {
          roomPlayers: game?.roomPlayers,
          hostId: game?.hostId,
          phase: game?.phase,
        };
      });
      console.log('8. Post-join state:', JSON.stringify(postJoinState, null, 2));

      // Check DOM for player cards
      const domState = await page.evaluate(() => {
        const cards = document.querySelectorAll('.player-card');
        const header = document.querySelector('header');
        return {
          playerCardCount: cards.length,
          headerExists: !!header,
          headerText: header?.textContent?.trim(),
        };
      });
      console.log('9. DOM state:', domState);
    }

  } catch (err) {
    console.error('ERROR:', err.message);
    await page.screenshot({ path: '/root/apps/crime-scene-investigation/e2e/debug-error.png' });
  } finally {
    await browser.close();
    console.log('Done.');
  }
}

main();
