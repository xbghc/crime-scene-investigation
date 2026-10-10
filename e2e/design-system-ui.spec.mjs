import { test, expect, create, join, roster, state } from './helpers/multiplayer.mjs'
import { startCase } from './helpers/effect-game.mjs'

// The separate baseline CI job copies this spec onto the PR's base commit.
// Only that evidence-only run omits NEW appearance checks. Every actual PR UI
// run requires them; existing gameplay/browser suites are entirely unchanged.
const baselineEvidence = process.env.UI_EVIDENCE_ONLY === '1'
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'narrow', width: 320, height: 812 },
]

async function screenshot(page, name) {
  const path = test.info().outputPath(`${name}.png`)
  await page.screenshot({ path, fullPage: true, animations: 'disabled' })
  await test.info().attach(name, { path, contentType: 'image/png' })
}

async function noHorizontalOverflow(page) {
  const layout = await page.evaluate(() => {
    const root = document.documentElement
    // Bounding checks also catch content clipped by body overflow-x:hidden.
    // Intentionally scrollable card rows are not treated as page overflow.
    const clipped = [
      ...document.querySelectorAll('form, main, .room-controls, .discussion, .solve'),
    ]
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1)
      })
      .map((element) => ({ tag: element.tagName, className: element.className }))
    return { viewport: root.clientWidth, content: root.scrollWidth, clipped }
  })
  expect(layout.content, JSON.stringify(layout)).toBeLessThanOrEqual(layout.viewport + 1)
  expect(layout.clipped, 'Main content must not be clipped outside the viewport').toEqual([])
}

async function responsiveEvidence(page, name) {
  const originalViewport = page.viewportSize()
  try {
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      if (!baselineEvidence) await noHorizontalOverflow(page)
      await screenshot(page, `${name}-${viewport.name}`)
    }
    // CSS zoom is a separate reflow stress check, not a claim of OS/browser zoom.
    await page.setViewportSize({ width: 1280, height: 1000 })
    await page.evaluate(() => (document.documentElement.style.zoom = '2'))
    if (!baselineEvidence) await noHorizontalOverflow(page)
    await screenshot(page, `${name}-css-zoom-200`)
  } finally {
    await page.evaluate(() => document.documentElement.style.removeProperty('zoom'))
    if (originalViewport) await page.setViewportSize(originalViewport)
  }
}

async function touchTargets(locator) {
  const targets = await locator.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect()
      return {
        label: element.getAttribute('aria-label') || element.textContent,
        width: rect.width,
        height: rect.height,
      }
    }),
  )
  expect(targets.length).toBeGreaterThan(0)
  for (const target of targets) {
    expect(target.width, JSON.stringify(target)).toBeGreaterThanOrEqual(44)
    expect(target.height, JSON.stringify(target)).toBeGreaterThanOrEqual(44)
  }
}

async function keyboardFocus(page, locator) {
  // Reach the control through actual sequential keyboard navigation.
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab')
    if (await locator.evaluate((element) => element === document.activeElement)) break
  }
  await expect(locator).toBeFocused()
  // Inputs animate the shadow; wait for the actual focus ring, not an arbitrary delay.
  await expect
    .poll(
      () =>
        locator.evaluate((element) => {
          const style = getComputedStyle(element)
          const outline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 3
          const shadow = /0px 0px 0px 3px/.test(style.boxShadow)
          return element.matches(':focus-visible') && (outline || shadow)
        }),
      { message: 'Keyboard focus must have a visible 3px ring' },
    )
    .toBe(true)
}

test('password screen: responsive entry, error recovery and keyboard focus', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  const cells = page.locator('.pin-cell')
  await expect(cells).toHaveCount(6)
  await responsiveEvidence(page, '01-password')
  if (!baselineEvidence) {
    await touchTargets(cells)
    await keyboardFocus(page, cells.first())
    await screenshot(page, '01-password-keyboard-focus')
  }
  for (let i = 0; i < 6; i++) await cells.nth(i).fill('0')
  await expect(page.getByText(/^密码(?:错误|不正确，请重新输入。)$/)).toBeVisible()
  await responsiveEvidence(page, '02-password-error')
  for (let i = 0; i < 6; i++) await cells.nth(i).fill('123456'[i])
  await expect(page).toHaveURL(/\/lobby/)
  await page.getByRole('button', { name: '以后再说', exact: true }).click()
  await expect(page.getByLabel('你的代号')).toBeVisible()
  expect(errors).toEqual([])
})

test('lobby and room: real create/join flow, responsive controls and nickname dialog', async ({
  players,
}) => {
  const host = await players('界面房主')
  const friend = await players('界面朋友')
  await responsiveEvidence(host.page, '03-lobby-create')
  if (!baselineEvidence) {
    await touchTargets(
      host.page.locator('.entry-tabs button, form input, form button[type="submit"]'),
    )
    await keyboardFocus(host.page, host.page.getByLabel('你的代号'))
    await screenshot(host.page, '03-lobby-keyboard-focus')
  }
  await friend.page.getByRole('button', { name: '加入房间', exact: true }).click()
  await responsiveEvidence(friend.page, '04-lobby-join')
  const code = await create(host)
  await join(friend, code)
  await roster(host, [host.name, friend.name])
  await roster(friend, [host.name, friend.name])
  await responsiveEvidence(host.page, '05-room-host')
  await responsiveEvidence(friend.page, '06-room-member')
  if (!baselineEvidence) {
    await touchTargets(
      host.page.locator('.room-controls button, .edit-nickname-btn, footer button'),
    )
    await keyboardFocus(host.page, host.page.getByRole('button', { name: '复制邀请', exact: true }))
    await screenshot(host.page, '05-room-keyboard-focus')
  }
  await host.page.getByTitle('修改昵称', { exact: true }).click()
  const nicknameInput = host.page.locator('.pwa-dialog input, .modal-card input')
  await expect(nicknameInput).toBeVisible()
  await responsiveEvidence(host.page, '07-nickname-dialog')
  await host.page.getByRole('button', { name: '取消', exact: true }).click()
  await expect(nicknameInput).toHaveCount(0)
  await roster(host, [host.name, friend.name])
  expect((await state(host)).roomCode).toBe(code)
})

test('game: four real players reach discussion, inspect cards and reopen the solve dialog', async ({
  players,
}) => {
  const game = await startCase(players, 4, '界面')
  const detective = game.detectives[0]
  await expect(detective.page.locator('.discussion__boards .scene-board')).toHaveCount(6)
  await responsiveEvidence(detective.page, '08-game-discussion')
  if (!baselineEvidence) {
    await touchTargets(detective.page.locator('.discussion__tab, .discussion__btn--solve'))
    await keyboardFocus(detective.page, detective.page.locator('.discussion__btn--solve'))
    await screenshot(detective.page, '08-game-keyboard-focus')
  }
  await detective.page.locator('.discussion__tab').filter({ hasText: '玩家卡牌' }).click()
  await expect(detective.page.locator('.discussion__cards')).toBeVisible()
  await responsiveEvidence(detective.page, '09-game-player-cards')
  await detective.page.locator('.discussion__btn--solve').click()
  await expect(detective.page.locator('.solve')).toBeVisible()
  await responsiveEvidence(detective.page, '10-solve-dialog')
  if (!baselineEvidence) await touchTargets(detective.page.locator('.solve__back, .solve__suspect'))
  await detective.page.locator('.solve__back').click()
  await expect(detective.page.locator('.solve')).toHaveCount(0)
  await detective.page.locator('.discussion__btn--solve').click()
  await expect(detective.page.locator('.solve')).toBeVisible()
  await detective.page.locator('.solve__back').click()
  const view = await state(detective)
  expect(view.phase).toBe('discussion-1')
  expect(view.murdererSelection).toBeUndefined()
  expect(view.players.filter((player) => player.role && player.role !== 'witness')).toEqual([])
})
