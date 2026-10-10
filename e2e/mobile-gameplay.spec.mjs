import { test as base, expect } from 'playwright/test'
import { state, phase, roster, dismissPhase } from './helpers/multiplayer.mjs'

// Genuine isolated sessions, mobile/touch emulation, UI-only game mutations.
// State reads below are assertions/test coordination, never socket/store writes.
// Viewport resizing models a reduced visible area; it does NOT open an OS keyboard
// or prove physical-device safe-area, browser-chrome, or keyboard behavior.
const phoneSizes = [
  { width: 320, height: 740 },
  { width: 360, height: 780 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]
const stressSizes = [...phoneSizes, { width: 844, height: 390 }, { width: 390, height: 320 }]

const test = base.extend({
  mobilePlayers: async ({ browser, baseURL }, use, testInfo) => {
    const sessions = []
    const makePlayer = async (name, viewport = phoneSizes[sessions.length % phoneSizes.length]) => {
      const context = await browser.newContext({
        baseURL,
        viewport,
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 1,
        userAgent: testInfo.project.use.userAgent,
        reducedMotion: 'reduce',
      })
      await context.tracing.start({ screenshots: true, snapshots: true, sources: true })
      const session = { name, context, page: await context.newPage(), errors: [], diagnostics: [] }
      sessions.push(session)
      watchPage(session)
      await session.page.goto('/')
      await login(session.page)
      await session.page.getByLabel('你的代号').fill(name)
      return session
    }
    try {
      await use(makePlayer)
      for (const session of sessions) expect(session.errors, session.name).toEqual([])
    } finally {
      for (const session of sessions) {
        if (!session.page.isClosed()) {
          const screenshot = await session.page.screenshot({ fullPage: false }).catch(() => null)
          if (screenshot) await testInfo.attach(`${session.name}-final`, {
            body: screenshot, contentType: 'image/png',
          })
        }
        await testInfo.attach(`${session.name}-diagnostics`, {
          body: JSON.stringify({ pageErrors: session.errors, diagnostics: session.diagnostics }),
          contentType: 'application/json',
        })
        if (testInfo.status !== testInfo.expectedStatus) {
          const trace = testInfo.outputPath(`${session.name}-trace.zip`)
          await session.context.tracing.stop({ path: trace })
          await testInfo.attach(`${session.name}-trace`, { path: trace, contentType: 'application/zip' })
        } else await session.context.tracing.stop()
        await session.context.close()
      }
    }
  },
})

function watchPage(session) {
  session.page.on('pageerror', (error) => session.errors.push(error.message))
  session.page.on('console', (message) => {
    if (message.type() === 'error') session.diagnostics.push({ type: 'console.error', text: message.text() })
  })
  session.page.on('requestfailed', (request) => session.diagnostics.push({
    type: 'requestfailed', url: request.url(), error: request.failure()?.errorText,
  }))
  session.page.on('response', (response) => {
    if (response.status() >= 400) session.diagnostics.push({
      type: 'http', status: response.status(), url: response.url(),
    })
  })
}

async function tap(locator) {
  await locator.scrollIntoViewIfNeeded()
  await locator.tap()
}

async function login(page) {
  const cells = page.locator('.pin-cell')
  await expect(cells).toHaveCount(6)
  for (let i = 0; i < 6; i++) await cells.nth(i).fill('123456'[i])
  await expect(page).toHaveURL(/\/lobby/)
  await tap(page.getByRole('button', { name: '以后再说', exact: true }))
  await expect(page.locator('.modal-overlay')).toHaveCount(0)
}

async function createRoom(player) {
  await tap(player.page.locator('form button[type="submit"]'))
  await expect(player.page.locator('.room-controls__code')).toHaveText(/^[A-Z0-9]{6}$/)
  return (await player.page.locator('.room-controls__code').textContent()).trim()
}

async function joinRoom(player, code) {
  await tap(player.page.getByRole('button', { name: '加入房间', exact: true }))
  await player.page.getByLabel('房间码', { exact: true }).fill(code)
  await tap(player.page.getByRole('button', { name: '加入调查', exact: true }))
  await expect(player.page.locator('.room-controls__code')).toHaveText(code)
}

async function mobileLayout(page) {
  const result = await page.evaluate(() => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden'
    }
    const describe = (element) => ({
      className: element.className,
      label: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 60),
    })
    // Check the boxes themselves too: overflow-x:hidden must not conceal a defect.
    // Card rows may deliberately scroll internally, but their viewport must fit.
    const clipped = [...document.querySelectorAll([
      'form', 'main', '.room-controls', '.room-controls__actions', '.game-layout__header',
      '.murder-view__grid', '.witness-night__cards', '.accomplice-view__grid', '.role-flip', '.scene-board', '.discussion__tabs',
      '.player-card-row', '.player-card-row__row', '.effect-panel', '.advance__actions',
      '.solve__header', '.solve__body', '.solve__grid', '.solve__card-grid',
      '.game-over__player', '.game-over__solution-cards', '.modal-card',
    ].join(','))].filter(visible).flatMap((element) => {
      const rect = element.getBoundingClientRect()
      return rect.left < -1 || rect.right > innerWidth + 1 ? [describe(element)] : []
    })
    const smallTargets = [...document.querySelectorAll(
      'button:enabled, input:not([type="hidden"]):enabled, select:enabled, [role="button"]:not([aria-disabled="true"])',
    )].filter(visible).flatMap((element) => {
      const rect = element.getBoundingClientRect()
      return rect.width < 43.5 || rect.height < 43.5
        ? [{ ...describe(element), width: rect.width, height: rect.height }] : []
    })
    const smallInputs = [...document.querySelectorAll('input:not([type="hidden"]), textarea, select')]
      .filter(visible).flatMap((element) => {
        const fontSize = parseFloat(getComputedStyle(element).fontSize)
        return fontSize < 16 ? [{ ...describe(element), fontSize }] : []
      })
    return {
      viewport: document.documentElement.clientWidth,
      width: document.documentElement.scrollWidth,
      clipped, smallTargets, smallInputs,
    }
  })
  expect(result.width, JSON.stringify(result)).toBeLessThanOrEqual(result.viewport + 1)
  expect(result.clipped, 'Content must fit without being clipped').toEqual([])
  expect(result.smallTargets, 'Actionable controls must be at least 44×44 CSS pixels').toEqual([])
  expect(result.smallInputs, 'Editable text must be at least 16px on phones').toEqual([])
}

async function evidence(page, name) {
  await mobileLayout(page)
  const path = test.info().outputPath(`${name}.png`)
  await page.screenshot({ path, fullPage: false, animations: 'disabled' })
  await test.info().attach(name, { path, contentType: 'image/png' })
}

async function sweep(page, name, sizes = stressSizes) {
  const initial = page.viewportSize()
  try {
    for (const size of sizes) {
      await page.setViewportSize(size)
      await evidence(page, `${name}-${size.width}x${size.height}`)
    }
  } finally {
    await page.setViewportSize(initial)
  }
}

async function simulatedSafeArea(page, selector, name, horizontalOnly = false) {
  const viewport = page.viewportSize()
  const previous = await page.evaluate(() => {
    const style = document.documentElement.style
    const names = ['top', 'right', 'bottom', 'left'].map((side) => `--safe-area-${side}`)
    const saved = names.map((name) => [name, style.getPropertyValue(name), style.getPropertyPriority(name)])
    for (const side of ['top', 'bottom']) style.setProperty(`--safe-area-${side}`, '20px')
    for (const side of ['left', 'right']) style.setProperty(`--safe-area-${side}`, '44px')
    return saved
  })
  try {
    // Synthetic CSS insets are a layout regression test, not physical notch or
    // browser-chrome validation. Real hardware remains a separate manual check.
    await page.setViewportSize({ width: 844, height: 390 })
    const targets = page.locator(selector)
    expect(await targets.count(), selector).toBeGreaterThan(0)
    await expect.poll(() => targets.evaluateAll((elements, onlyHorizontal) => elements.flatMap((element) => {
      const rect = element.getBoundingClientRect()
      return rect.left < 43.5 || rect.right > 800.5 || (!onlyHorizontal && (rect.top < 19.5 || rect.bottom > 370.5))
        ? [{ className: element.className, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }]
        : []
    }), horizontalOnly), { message: 'Controls/dialog must remain inside simulated CSS safe insets' }).toEqual([])
    await evidence(page, name)
  } finally {
    await page.evaluate((saved) => {
      for (const [name, value, priority] of saved) {
        if (value) document.documentElement.style.setProperty(name, value, priority)
        else document.documentElement.style.removeProperty(name)
      }
    }, previous)
    await page.setViewportSize(viewport)
  }
}

async function dialogFitsAndTrapsFocus(page, dialog) {
  await expect(dialog).toBeVisible()
  await mobileLayout(page)
  const bounds = await dialog.boundingBox()
  expect(bounds.y).toBeGreaterThanOrEqual(-1)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(page.viewportSize().height + 1)
  const controls = dialog.locator('button:enabled, input:enabled, [tabindex="0"]')
  const first = controls.first()
  const last = controls.last()
  await last.focus()
  await page.keyboard.press('Tab')
  await expect(first).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(last).toBeFocused()
}

async function inspectCard(page, row, name) {
  const thumb = row.locator('.player-card-row__thumb').first()
  const cardNames = await row.locator('.player-card-row__card-name').allTextContents()
  // Give the opener keyboard focus first; touch taps in WebKit do not reliably
  // change document.activeElement. The preview itself is opened with a real tap.
  await thumb.focus()
  await tap(thumb)
  const dialog = page.getByRole('dialog', { name: '卡牌详情', exact: true })
  await expect(dialog.locator('.card-detail__name')).toHaveText(cardNames[0].trim())
  await expect(dialog.getByRole('button', { name: '上一张', exact: true })).toBeDisabled()
  await tap(dialog.getByRole('button', { name: '下一张', exact: true }))
  await expect(dialog.locator('.card-detail__name')).toHaveText(cardNames[1].trim())
  await page.setViewportSize({ width: 390, height: 320 })
  await dialogFitsAndTrapsFocus(page, dialog)
  await expect.poll(() => dialog.locator('.modal-body').evaluate(
    (element) => element.scrollHeight > element.clientHeight,
  )).toBe(true)
  await dialog.locator('.card-detail__name').scrollIntoViewIfNeeded()
  await expect(dialog.locator('.card-detail__name')).toBeInViewport()
  await evidence(page, name)
  await tap(dialog.getByRole('button', { name: '关闭', exact: true }))
  await expect(dialog).toHaveCount(0)
  await expect(thumb).toBeFocused()
}

async function room(mobilePlayers, count) {
  const group = []
  for (let i = 0; i < count; i++) {
    // Exactly ten characters, including a deterministic E03 host prefix.
    const name = i === 0 ? 'E03手机房主长名号' : `手机调查员超长代号${i}`
    group.push(await mobilePlayers(name))
  }
  const code = await createRoom(group[0])
  for (const player of group.slice(1)) await joinRoom(player, code)
  for (const player of group) await roster(player, group.map((entry) => entry.name))
  const views = await Promise.all(group.map(state))
  expect(new Set(views[0].roomPlayers.map((player) => player.id)).size).toBe(count)
  for (const view of views) expect(view.roomPlayers.map((player) => player.id)).toEqual(
    views[0].roomPlayers.map((player) => player.id),
  )
  expect(new Set(group.map((player) => player.context)).size).toBe(count)
  return { group, host: group[0], code }
}

async function privacy(game) {
  for (const detective of game.detectives) {
    const view = await state(detective)
    expect(view.myRole).toBe('detective')
    expect(view.murdererSelection).toBeUndefined()
    expect(view.players.filter((entry) => entry.role && entry.role !== 'witness')).toEqual([])
    expect(view.newBoards).toEqual([])
    expect(view.pendingEffect == null).toBe(true)
    await expect(detective.page.locator('.witness-night__cards, .witness-accuse__hint, .accomplice-view')).toHaveCount(0)
    await expect(detective.page.getByTestId('effect-action')).toHaveCount(0)
  }
}

async function beginGame(game) {
  await tap(game.host.page.getByRole('button', { name: /开始调查/ }))
  for (const player of game.group) await phase(player, 'night-murder')
  const views = await Promise.all(game.group.map(state))
  expect(new Set(views.map((view) => view.myPlayerId)).size).toBe(game.group.length)
  const byRole = (role) => game.group.filter((_, index) => views[index].myRole === role)
  game.murderer = byRole('murderer')[0]
  game.witness = byRole('witness')[0]
  game.detectives = byRole('detective')
  game.accomplice = byRole('accomplice')[0]
  expect(game.detectives).toHaveLength(game.group.length - (game.group.length >= 6 ? 3 : 2))
  await privacy(game)
  for (const player of game.group) await mobileLayout(player.page)
  const roleFlip = game.detectives[0].page.locator('.role-flip')
  await tap(roleFlip)
  await expect(roleFlip).toHaveAttribute('aria-label', '侦探，隐藏身份')
  await expect(roleFlip).toHaveAttribute('aria-pressed', 'true')
  await tap(roleFlip)
  await expect(roleFlip).toHaveAttribute('aria-pressed', 'false')
  await simulatedSafeArea(game.detectives[0].page, '.role-flip', `${game.group.length}-detective-synthetic-safe-area`, true)
  if (game.accomplice) await sweep(game.accomplice.page, `${game.group.length}-night-accomplice`)
  const murdererView = await state(game.murderer)
  game.hand = murdererView.players.find((player) => player.id === murdererView.myPlayerId)
  game.selection = { meansCard: game.hand.meansCards[0], clueCard: game.hand.clueCards[0] }
  await sweep(game.murderer.page, `${game.group.length}-night-murder`)
  await simulatedSafeArea(game.murderer.page, '.murder-view__footer button', `${game.group.length}-murder-synthetic-safe-area`)
  const grids = game.murderer.page.locator('.murder-view__grid')
  await tap(grids.nth(0).locator('.murder-card').first())
  await tap(grids.nth(1).locator('.murder-card').first())
  await tap(game.murderer.page.getByRole('button', { name: 'Confirm Crime' }))
  await expect.poll(async () => (await state(game.witness)).murdererSelection).toEqual(game.selection)
  await sweep(game.witness.page, `${game.group.length}-night-witness`)
  await tap(game.witness.page.getByRole('button', { name: '我记住了，继续' }))
  await phase(game.witness, 'witness-accuse')
  await dismissPhase(game.witness)
  await sweep(game.witness.page, `${game.group.length}-witness-boards`)
  const boards = game.witness.page.locator('.witness-accuse__board-row')
  await expect(boards).toHaveCount(6)
  for (let index = 0; index < 6; index++) await tap(boards.nth(index).locator('.scene-board__cell').first())
  await tap(game.witness.page.getByRole('button', { name: '确认布置' }))
  for (const player of game.group) {
    await phase(player, 'discussion-1')
    await dismissPhase(player)
  }
  await privacy(game)
}

async function reconnect(player, peer, expectedPhase) {
  const before = await state(player)
  // A real page close disconnects its socket. The same context preserves only
  // normal browser storage; no synthetic identity injection or socket call.
  await player.page.close()
  await expect.poll(async () => (await state(peer)).roomPlayers.find(
    (entry) => entry.id === before.myPlayerId,
  )?.connected).toBe(false)
  player.page = await player.context.newPage()
  watchPage(player)
  await player.page.goto('/lobby')
  await phase(player, expectedPhase)
  await dismissPhase(player)
  const after = await state(player)
  expect(after.myPlayerId).toBe(before.myPlayerId)
  expect(after.myRole).toBe(before.myRole)
  expect(after.roomCode).toBe(before.roomCode)
  expect(after.roomPlayers.map((entry) => entry.id)).toEqual(before.roomPlayers.map((entry) => entry.id))
  await expect.poll(async () => (await state(peer)).roomPlayers.find(
    (entry) => entry.id === before.myPlayerId,
  )?.connected).toBe(true)
}

async function prepareSolve(player, game) {
  await tap(player.page.locator('.discussion__btn--solve'))
  await tap(player.page.locator('.solve__suspect').filter({ hasText: game.murderer.name }))
  for (const card of [game.selection.meansCard, game.selection.clueCard]) {
    await tap(player.page.locator('.solve__card-grid .game-card').filter({
      has: player.page.getByText(card.name, { exact: true }),
    }))
  }
}

async function win(game, solver) {
  await tap(solver.page.getByRole('button', { name: '确认破案', exact: true }))
  for (const player of game.group) {
    await phase(player, 'game-over')
    expect((await state(player)).winner).toBe('detective')
    const result = player.page.getByRole('dialog', { name: '破案成功！', exact: true })
    await expect(result).toBeVisible()
    await tap(result.getByRole('button', { name: '知道了', exact: true }))
    await expect(result).toHaveCount(0)
    await expect(player.page.locator('.game-over__player')).toHaveCount(game.group.length)
    await expect(player.page.getByRole('heading', { name: '侦探方获胜' })).toBeVisible()
    await expect(player.page.locator('.game-over__solution')).toContainText(game.selection.meansCard.name)
    await mobileLayout(player.page)
  }
  await sweep(game.host.page, `${game.group.length}-results`)
}

test('phone entry and nickname dialogs survive reduced height, Cancel, Close and Escape @phone-smoke', async ({ page, mobilePlayers }) => {
  await page.goto('/')
  await sweep(page, 'entry')
  await login(page)
  await sweep(page, 'lobby-input')
  await tap(page.getByRole('button', { name: '加入房间', exact: true }))
  await sweep(page, 'join-input')

  const host = await mobilePlayers('E03手机长昵称测试')
  await createRoom(host)
  const opener = host.page.getByRole('button', { name: '修改昵称', exact: true })
  for (const dismiss of ['取消', '关闭', 'Escape']) {
    await host.page.setViewportSize({ width: 390, height: 240 })
    // Keyboard accessibility is separate from the touch flow. This does not
    // emulate an operating-system virtual keyboard.
    await opener.focus()
    await host.page.keyboard.press('Enter')
    const dialog = host.page.getByRole('dialog', { name: '修改昵称', exact: true })
    const input = dialog.getByLabel('你的代号')
    await expect(input).toBeFocused()
    await input.fill('取消后不能保存')
    await dialogFitsAndTrapsFocus(host.page, dialog)
    await expect.poll(() => dialog.locator('.modal-body').evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    )).toBe(true)
    await input.scrollIntoViewIfNeeded()
    await expect(input).toBeInViewport()
    await evidence(host.page, `nickname-${dismiss}`)
    if (dismiss === 'Escape') await host.page.keyboard.press('Escape')
    else await tap(dialog.getByRole('button', { name: dismiss, exact: true }))
    await expect(dialog).toHaveCount(0)
    await expect(opener).toBeFocused()
    await roster(host, [host.name])
    expect((await state(host)).phase).toBe('waiting')
  }
})

test('four touch sessions complete private night, effect, accusation, result, replay and reconnect @phone-smoke', async ({ mobilePlayers }) => {
  const game = await room(mobilePlayers, 4)
  await beginGame(game)
  const detective = game.detectives.find((player) => player !== game.host) || game.detectives[0]
  await reconnect(detective, game.witness, 'discussion-1')
  await privacy(game)
  await sweep(detective.page, '4-discussion')
  await simulatedSafeArea(detective.page, '.discussion__footer button', '4-discussion-synthetic-safe-area')
  await tap(detective.page.locator('.discussion__tab').filter({ hasText: '玩家卡牌' }))
  await expect(detective.page.locator('.player-card-row')).toHaveCount(3)
  await sweep(detective.page, '4-player-cards')
  await inspectCard(detective.page, detective.page.locator('.player-card-row').first(), '4-card-preview')

  // Closing host confirmation is harmless and restores focus to its opener.
  const reset = game.host.page.getByRole('button', { name: '重置游戏', exact: true })
  await reset.focus()
  await game.host.page.keyboard.press('Enter')
  const resetDialog = game.host.page.getByRole('dialog', { name: '重置游戏', exact: true })
  await tap(resetDialog.getByRole('button', { name: '取消', exact: true }))
  await expect(resetDialog).toHaveCount(0)
  await expect(reset).toBeFocused()
  for (const player of game.group) await phase(player, 'discussion-1')

  await tap(game.witness.page.locator('.discussion__btn--end'))
  for (const player of game.group) {
    await phase(player, 'advance-1')
    const announcement = player.page.getByRole('dialog', { name: '效果牌', exact: true })
    await tap(announcement.getByRole('button', { name: '知道了', exact: true }))
    await expect(announcement).toHaveCount(0)
  }
  await expect(game.witness.page.getByTestId('effect-action')).toBeVisible()
  const pending = (await state(game.witness)).pendingEffect
  expect(pending.effectId).toBe('E03')
  await privacy(game)
  await sweep(game.witness.page, '4-private-effect')
  const choice = game.witness.page.getByTestId('effect-choice').first()
  await tap(choice)
  await expect(game.witness.page.getByTestId('effect-confirm')).toBeEnabled()
  await tap(game.witness.page.getByTestId('effect-cancel'))
  await expect(game.witness.page.getByTestId('effect-confirm')).toBeDisabled()
  await game.witness.page.reload()
  await phase(game.witness, 'advance-1')
  expect((await state(game.witness)).pendingEffect).toEqual(pending)
  await privacy(game)
  await tap(choice)
  await tap(game.witness.page.getByTestId('effect-confirm'))
  for (const player of game.group) {
    await expect(player.page.getByTestId('effect-result')).toBeVisible()
    await expect.poll(async () => Boolean((await state(player)).effectResult?.applied)).toBe(true)
    expect((await state(player)).pendingEffect == null).toBe(true)
  }
  await sweep(detective.page, '4-public-effect')
  await expect.poll(async () => (await state(game.witness)).newBoards.length).toBe(1)
  await tap(game.witness.page.locator('.advance__board-wrap .scene-board__header').first())
  await tap(game.witness.page.locator('.advance__boards').nth(1).locator('.scene-board__cell').first())
  await tap(game.witness.page.getByRole('button', { name: /确认替换/ }))
  await expect.poll(async () => (await state(game.witness)).newBoards.length).toBe(0)
  await tap(game.witness.page.locator('.advance').getByRole('button', { name: '继续', exact: true }))
  for (const player of game.group) {
    await phase(player, 'discussion-2')
    await dismissPhase(player)
  }
  await privacy(game)

  await detective.page.locator('.discussion__btn--solve').focus()
  await detective.page.keyboard.press('Enter')
  const solve = detective.page.getByRole('dialog', { name: '破案', exact: true })
  await detective.page.setViewportSize({ width: 390, height: 320 })
  await dialogFitsAndTrapsFocus(detective.page, solve)
  await simulatedSafeArea(detective.page, '.modal-card--fullscreen', '4-solve-synthetic-safe-area')
  await tap(detective.page.getByRole('button', { name: '取消破案', exact: true }))
  await expect(solve).toHaveCount(0)
  await expect(detective.page.locator('.discussion__btn--solve')).toBeFocused()
  expect((await state(detective)).lastSolveResult).toBeNull()
  await prepareSolve(detective, game)
  await sweep(detective.page, '4-solve-confirmation')
  await tap(detective.page.getByRole('button', { name: '返回修改', exact: true }))
  await tap(detective.page.locator('.solve__card-grid .game-card').filter({
    has: detective.page.getByText(game.selection.clueCard.name, { exact: true }),
  }))
  await win(game, detective)
  await tap(game.host.page.getByRole('button', { name: '再来一局', exact: true }))
  for (const player of game.group) {
    await phase(player, 'waiting')
    await roster(player, game.group.map((entry) => entry.name))
    expect((await state(player)).myRole).toBeUndefined()
    expect((await state(player)).murdererSelection).toBeUndefined()
    await mobileLayout(player.page)
  }
  await tap(game.host.page.getByRole('button', { name: /开始调查/ }))
  for (const player of game.group) await phase(player, 'night-murder')
  expect((await state(game.host)).roomCode).toBe(game.code)
})

test('ten isolated phones retain long names, readable cards, scrollable accusation and complete results', async ({ mobilePlayers }) => {
  const game = await room(mobilePlayers, 10)
  await sweep(game.host.page, '10-lobby')
  await beginGame(game)
  const detective = game.detectives[0]
  await sweep(detective.page, '10-discussion')
  await tap(detective.page.locator('.discussion__tab').filter({ hasText: '玩家卡牌' }))
  await expect(detective.page.locator('.player-card-row')).toHaveCount(9)
  await sweep(detective.page, '10-player-cards')
  const view = await state(detective)
  const lastPlayer = view.players.filter((entry) => entry.role !== 'witness').at(-1)
  await detective.page.getByLabel('快速查找玩家', { exact: true }).selectOption(lastPlayer.id)
  const lastRow = detective.page.locator('.player-card-row').last()
  await expect(lastRow).toBeInViewport()
  await expect(lastRow).toContainText(lastPlayer.nickname)
  await expect(lastRow).toBeFocused()
  await inspectCard(detective.page, lastRow, '10-last-player-preview')
  await tap(detective.page.locator('.discussion__btn--solve'))
  const dialog = detective.page.getByRole('dialog', { name: '破案', exact: true })
  await expect(dialog.locator('.solve__suspect')).toHaveCount(9)
  await sweep(detective.page, '10-suspects')
  await detective.page.setViewportSize({ width: 390, height: 320 })
  await dialogFitsAndTrapsFocus(detective.page, dialog)
  const last = dialog.locator('.solve__suspect').last()
  await last.scrollIntoViewIfNeeded()
  await expect(last).toBeInViewport()
  await expect.poll(() => dialog.locator('.modal-body').evaluate(
    (element) => element.scrollHeight > element.clientHeight && element.scrollTop > 0,
  )).toBe(true)
  // Cancel after scrolling, reopen with a clean wizard, then finish a real game.
  await tap(dialog.getByRole('button', { name: '取消破案', exact: true }))
  await expect(dialog).toHaveCount(0)
  await prepareSolve(detective, game)
  await win(game, detective)
})
