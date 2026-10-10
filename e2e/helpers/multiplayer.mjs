// All gameplay mutations use visible UI. Pinia reads are assertion-only.
// No hidden socket emissions, direct store writes, API login, or forced timer advances.
import { test as base, expect } from 'playwright/test'

const test = base.extend({
  players: async ({ browser, baseURL }, use, testInfo) => {
    const sessions = []
    const makePlayer = async (name) => {
      const context = await browser.newContext({
        baseURL,
        viewport: { width: 390, height: 844 },
      })
      await context.tracing.start({ screenshots: true, snapshots: true, sources: true })
      const page = await context.newPage()
      const errors = []
      const diagnostics = []
      page.on('console', (message) => {
        if (message.type() === 'error')
          diagnostics.push({ type: 'console.error', text: message.text() })
      })
      page.on('requestfailed', (request) =>
        diagnostics.push({
          type: 'requestfailed',
          url: request.url(),
          error: request.failure()?.errorText,
        }),
      )
      page.on('response', (response) => {
        if (response.status() >= 400)
          diagnostics.push({ type: 'http', status: response.status(), url: response.url() })
      })
      page.on('pageerror', (error) => errors.push(error.message))
      const session = { name, page, context, errors, diagnostics }
      sessions.push(session)
      await page.goto('/')
      const cells = page.locator('.pin-cell')
      await expect(cells).toHaveCount(6)
      for (let i = 0; i < 6; i++) await cells.nth(i).fill('123456'[i])
      await expect(page).toHaveURL(/\/lobby/)
      await page.getByRole('button', { name: '以后再说', exact: true }).click()
      await page.getByLabel('你的代号').fill(name)
      return session
    }
    try {
      await use(makePlayer)
      for (const session of sessions) expect(session.errors, session.name).toEqual([])
    } finally {
      for (const session of sessions) {
        const screenshot = testInfo.outputPath(`${session.name}.png`)
        await session.page
          .screenshot({ path: screenshot, fullPage: true })
          .then(() =>
            testInfo.attach(`${session.name}-screenshot`, {
              path: screenshot,
              contentType: 'image/png',
            }),
          )
          .catch(() => {})
        await testInfo.attach(`${session.name}-diagnostics`, {
          body: JSON.stringify({ pageErrors: session.errors, diagnostics: session.diagnostics }),
          contentType: 'application/json',
        })
        await session.context.tracing.stop({
          path: testInfo.outputPath(`${session.name}-trace.zip`),
        })
        await testInfo.attach(`${session.name}-trace`, {
          path: testInfo.outputPath(`${session.name}-trace.zip`),
          contentType: 'application/zip',
        })
        await session.context.close()
      }
    }
  },
})

async function state(player) {
  return player.page.evaluate(() => {
    const app = document.querySelector('#app')?.__vue_app__
    const game = app?.config.globalProperties.$pinia?.state.value.game
    if (!game) throw new Error('Vue game store unavailable in development build')
    return JSON.parse(JSON.stringify(game))
  })
}
async function phase(player, expected) {
  await expect.poll(async () => (await state(player)).phase).toBe(expected)
}
async function create(player) {
  await player.page.locator('form button[type="submit"]').click()
  const code = player.page.locator('.room-controls__code')
  await expect(code).toHaveText(/^[A-Z0-9]{6}$/)
  return (await code.textContent()).trim()
}
async function join(player, code) {
  await player.page.getByRole('button', { name: '加入房间', exact: true }).click()
  await player.page.getByLabel('房间码', { exact: true }).fill(code)
  await player.page.getByRole('button', { name: '加入调查' }).click()
  await expect(player.page.locator('.room-controls__code')).toHaveText(code)
}
async function roster(player, names) {
  await expect(player.page.locator('.player-card')).toHaveCount(names.length)
  for (const name of names)
    await expect(player.page.locator('.player-card').filter({ hasText: name })).toHaveCount(1)
}
async function dismissPhase(player) {
  // Phase announcements auto-close after 3 seconds. Waiting for the overlay to
  // disappear avoids racing its animation and never clicks through it.
  await expect(player.page.locator('.modal-overlay')).toHaveCount(0)
}

export { test, expect, state, phase, create, join, roster, dismissPhase }
