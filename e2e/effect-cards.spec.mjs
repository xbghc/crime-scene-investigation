import { test, expect, state, phase, dismissPhase } from './helpers/multiplayer.mjs'
import { startCase } from './helpers/effect-game.mjs'

// Add visual evidence without changing the existing scenarios or assertions.
// Restore presentation state before gameplay continues.
async function responsiveEffectEvidence(player, name) {
  const page = player.page
  const originalViewport = page.viewportSize()
  const originalScroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }))
  try {
    for (const viewport of [
      { name: 'mobile', width: 390, height: 844 },
      { name: 'desktop', width: 1440, height: 1000 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      const path = test.info().outputPath(`${name}-${viewport.name}.png`)
      await page.screenshot({ path, fullPage: true, animations: 'disabled' })
      await test.info().attach(`${name}-${viewport.name}`, { path, contentType: 'image/png' })
    }
  } finally {
    if (originalViewport) await page.setViewportSize(originalViewport)
    await page.evaluate(({ x, y }) => window.scrollTo(x, y), originalScroll)
  }
}

// Deterministic effect draws only. Every action below uses the visible UI;
// Pinia snapshots are assertion-only and each browser has its own session.
async function begin(players, effectId, count = 4, changeClue = false) {
  const game = await startCase(players, count, effectId)
  await game.witness.page.locator('.discussion__btn--end').click()
  for (const player of game.group) await phase(player, 'advance-1')
  if (game.accomplice) {
    await expect(game.witness.page.getByTestId('effect-action')).toHaveCount(0)
    if (changeClue) {
      const clue = game.hand.clueCards[1]
      await game.accomplice.page.getByRole('button', { name: '更换线索牌', exact: true }).click()
      await game.accomplice.page.getByRole('button', { name: clue.name, exact: true }).click()
      await game.accomplice.page.getByRole('button', { name: '确认更换', exact: true }).click()
      game.newClue = clue
    } else {
      await game.accomplice.page.getByRole('button', { name: '不更换', exact: true }).click()
    }
  }
  for (const player of game.group) {
    const dialog = player.page.getByRole('dialog').filter({
      has: player.page.getByRole('heading', { name: '效果牌', exact: true }),
    })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: '知道了', exact: true }).click()
    await dismissPhase(player)
  }
  await expect(game.witness.page.getByTestId('effect-action')).toBeVisible()
  expect((await state(game.witness)).pendingEffect.effectId).toBe(effectId)
  await assertPrivate(game)
  return game
}

async function assertPrivate(game) {
  for (const player of game.group.filter((player) => player !== game.witness)) {
    const view = await state(player)
    expect(view.pendingEffect == null).toBe(true)
    expect(view.newBoards).toEqual([])
    await expect(player.page.getByTestId('effect-action')).toHaveCount(0)
  }
  for (const player of game.detectives) {
    const view = await state(player)
    expect(view.murdererSelection).toBeUndefined()
    expect(view.players.filter((entry) => entry.role && entry.role !== 'witness')).toEqual([])
  }
}

async function refreshPending(game) {
  const before = (await state(game.witness)).pendingEffect
  await game.witness.page.reload()
  await phase(game.witness, 'advance-1')
  await dismissPhase(game.witness)
  await expect(game.witness.page.getByTestId('effect-action')).toBeVisible()
  expect((await state(game.witness)).pendingEffect).toEqual(before)
  await expect(game.witness.page.getByTestId('effect-confirm')).toBeDisabled()
  await expect(
    game.witness.page.locator('.advance').getByRole('button', { name: '继续', exact: true }),
  ).toHaveCount(0)
  await assertPrivate(game)
  const screenshot = test.info().outputPath('witness-effect-choices.png')
  await game.witness.page.locator('.effect-panel').screenshot({ path: screenshot })
  await test.info().attach('目击者私有效果选择', { path: screenshot, contentType: 'image/png' })
  await responsiveEffectEvidence(game.witness, '11-effect-private-choices')
}

function choice(game, id) {
  return game.witness.page
    .getByTestId('effect-choice')
    .and(game.witness.page.locator(`[data-choice-id="${id}"]`))
}

async function applyChoice(game, id) {
  await choice(game, id).click()
  await expect(game.witness.page.getByTestId('effect-confirm')).toBeEnabled()
  await game.witness.page.getByTestId('effect-cancel').click()
  await expect(game.witness.page.getByTestId('effect-confirm')).toBeDisabled()
  expect((await state(game.witness)).pendingEffect).toBeTruthy()
  await choice(game, id).click()
  await game.witness.page.getByTestId('effect-confirm').click()
  await resolved(game, false)
}

async function resolved(game, skipped) {
  await expect.poll(async () => (await state(game.witness)).pendingEffect ?? null).toBeNull()
  await expect(game.witness.page.getByTestId('effect-action')).toHaveCount(0)
  for (const player of game.group) {
    await expect
      .poll(async () =>
        Boolean((await state(player)).effectResult?.[skipped ? 'skipped' : 'applied']),
      )
      .toBe(true)
    await expect(player.page.getByTestId('effect-result')).toBeVisible()
  }
  // Both the private consumption and the public outcome survive real reloads.
  const result = (await state(game.witness)).effectResult
  for (const player of [game.witness, game.detectives[0]]) {
    await player.page.reload()
    await phase(player, 'advance-1')
    await dismissPhase(player)
    expect((await state(player)).effectResult).toEqual(result)
    expect((await state(player)).pendingEffect == null).toBe(true)
    await expect(player.page.getByTestId('effect-action')).toHaveCount(0)
    await expect(player.page.getByTestId('effect-result')).toBeVisible()
  }
  await assertPrivate(game)
  const screenshot = test.info().outputPath('detective-public-effect-result.png')
  await game.detectives[0].page.locator('.effect-panel').screenshot({ path: screenshot })
  await test.info().attach('侦探看到的公开效果结果', { path: screenshot, contentType: 'image/png' })
  await responsiveEffectEvidence(game.detectives[0], '12-effect-public-result')
}

async function finish(game) {
  const count = (await state(game.witness)).newBoards.length
  for (let i = 0; i < count; i++) {
    await game.witness.page.locator('.advance__board-wrap .scene-board__header').first().click()
    await game.witness.page
      .locator('.advance__boards')
      .nth(1)
      .locator('.scene-board__cell')
      .first()
      .click()
    await game.witness.page.getByRole('button', { name: /确认替换/ }).click()
    await expect.poll(async () => (await state(game.witness)).newBoards.length).toBe(count - i - 1)
  }
  await game.witness.page
    .locator('.advance')
    .getByRole('button', { name: '继续', exact: true })
    .click()
  for (const player of game.group) {
    await phase(player, 'discussion-2')
    await dismissPhase(player)
    await expect(player.page.getByTestId('effect-result')).toBeVisible()
  }
  await assertPrivate(game)
}

test('效果01：暗杀必须选择目标，取消/刷新后可继续，死亡与权限公开同步', async ({ players }) => {
  const game = await begin(players, 'E01')
  await refreshPending(game)
  const victim = game.detectives[0]
  const victimId = (await state(victim)).myPlayerId
  await applyChoice(game, victimId)
  for (const player of game.group) {
    const target = (await state(player)).players.find((entry) => entry.id === victimId)
    expect(target.status).toBe('dead')
    expect(target.hasSolveRight).toBe(false)
    await expect(player.page.getByTestId('effect-result')).toContainText(victim.name)
  }
  await finish(game)
  await expect(victim.page.locator('.discussion__btn--solve')).toHaveCount(0)
})

test('效果03：排除嫌疑只提供合法人选，公开结果刷新保留', async ({ players }) => {
  const game = await begin(players, 'E03')
  await refreshPending(game)
  const pending = (await state(game.witness)).pendingEffect
  expect(pending.targetIds).not.toContain(game.murdererId)
  expect(pending.targetIds).not.toContain((await state(game.witness)).myPlayerId)
  await expect(choice(game, game.murdererId)).toHaveCount(0)
  const cleared = game.detectives[0]
  await applyChoice(game, (await state(cleared)).myPlayerId)
  for (const player of game.group) {
    await expect(player.page.getByTestId('effect-result')).toContainText(cleared.name)
    await expect(player.page.getByTestId('effect-result')).toContainText('不是凶手')
  }
  await finish(game)
})

test('效果05：必须先移除选项物，再完成正常替换，无第二次执行入口', async ({ players }) => {
  const game = await begin(players, 'E05')
  await refreshPending(game)
  const board = (await state(game.witness)).boards.find((entry) => entry.type === 'cause')
  await applyChoice(game, board.id)
  for (const player of game.group) {
    expect(
      (await state(player)).boards.find((entry) => entry.id === board.id).marker,
    ).toBeUndefined()
  }
  await finish(game)
  for (const player of game.group) {
    expect(
      (await state(player)).boards.find((entry) => entry.id === board.id).marker,
    ).toBeUndefined()
  }
})

test('效果08：公开所指手段牌名称，刷新和继续讨论均保留结果', async ({ players }) => {
  const game = await begin(players, 'E08')
  await refreshPending(game)
  const selected = (await state(game.witness)).murdererSelection.meansCard
  await applyChoice(game, selected.id)
  for (const player of game.group) {
    expect((await state(player)).effectResult.pointedCardId).toBe(selected.id)
    await expect(player.page.getByTestId('effect-result')).toContainText(selected.name)
  }
  await finish(game)
})

test('效果08：可明确放弃，刷新不会重新授权或泄露答案', async ({ players }) => {
  const game = await begin(players, 'E08')
  await refreshPending(game)
  await game.witness.page.getByTestId('effect-skip').click()
  await resolved(game, true)
  for (const player of game.group)
    expect((await state(player)).effectResult.pointedCardId).toBeUndefined()
  await finish(game)
})

test('效果08：六人帮凶更换线索后仅能指向最新答案，完成两张换板', async ({ players }) => {
  const game = await begin(players, 'E08', 6, true)
  await refreshPending(game)
  const pending = (await state(game.witness)).pendingEffect
  expect(pending.cardIds).toContain(game.newClue.id)
  expect(pending.cardIds).not.toContain(game.hand.clueCards[0].id)
  await expect(choice(game, game.hand.clueCards[0].id)).toHaveCount(0)
  expect((await state(game.witness)).newBoards).toHaveLength(2)
  await applyChoice(game, game.newClue.id)
  for (const player of game.group)
    await expect(player.page.getByTestId('effect-result')).toContainText(game.newClue.name)
  await finish(game)
})
