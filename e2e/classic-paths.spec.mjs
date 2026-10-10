import { test, expect, state, phase, create, join, dismissPhase } from './helpers/multiplayer.mjs'

// Test coordinator knows which scripted answer to choose. Each browser retains
// only the same private information that its own normal player would receive.
async function startCase(players, count = 4) {
  const group = []
  for (let i = 0; i < count; i++) group.push(await players(`经典玩家${i + 1}`))
  const code = await create(group[0])
  for (const player of group.slice(1)) await join(player, code)
  await group[0].page.getByRole('button', { name: '开始调查', exact: false }).click()
  for (const player of group) await phase(player, 'night-murder')
  const views = await Promise.all(group.map(state))
  const byRole = (role) => group.filter((_, i) => views[i].myRole === role)
  const murderer = byRole('murderer')[0]
  const witness = byRole('witness')[0]
  const detectives = byRole('detective')
  const accomplice = byRole('accomplice')[0]
  expect(detectives).toHaveLength(count === 4 ? 2 : 3)
  expect(Boolean(accomplice)).toBe(count === 6)
  const murdererView = await state(murderer)
  const murdererId = murdererView.myPlayerId
  const hand = murdererView.players.find((p) => p.id === murdererId)
  const answer = {
    suspect: murderer.name,
    means: hand.meansCards[0].name,
    clue: hand.clueCards[0].name,
  }
  const grids = murderer.page.locator('.murder-view__grid')
  await grids.nth(0).locator('.murder-card').first().click()
  await grids.nth(1).locator('.murder-card').first().click()
  await murderer.page.getByRole('button', { name: 'Confirm Crime' }).click()
  await witness.page.getByRole('button', { name: '我记住了，继续' }).click()
  await phase(witness, 'witness-accuse')
  await dismissPhase(witness)
  const boards = witness.page.locator('.witness-accuse__board-row')
  await expect(boards).toHaveCount(6)
  for (let i = 0; i < 6; i++) await boards.nth(i).locator('.scene-board__cell').first().click()
  await witness.page.getByRole('button', { name: '确认布置' }).click()
  for (const player of group) {
    await phase(player, 'discussion-1')
    await dismissPhase(player)
  }
  const game = { group, murderer, witness, detectives, accomplice, answer, hand, murdererId }
  await assertPrivate(game)
  return game
}
async function assertPrivate(game) {
  for (const player of game.detectives) {
    const view = await state(player)
    expect(view.murdererSelection).toBeUndefined()
    expect(view.players.filter((p) => p.role && p.role !== 'witness')).toEqual([])
    expect(view.newBoards).toEqual([])
  }
}
async function dismissResults(game, solver) {
  const solverId = (await state(solver)).myPlayerId
  for (const player of game.group) {
    await expect
      .poll(async () => (await state(player)).lastSolveResult)
      .toEqual({ playerId: solverId, success: false })
    const dialog = player.page
      .getByRole('dialog')
      .filter({ has: player.page.getByRole('heading', { name: '破案失败', exact: true }) })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: '知道了', exact: true }).click()
    await expect(dialog).toHaveCount(0)
  }
}
async function solve(player, answer, forced = false) {
  await player.page.locator(forced ? '.force-solve__btn' : '.discussion__btn--solve').click()
  await player.page.locator('.solve__suspect').filter({ hasText: answer.suspect }).click()
  await player.page
    .locator('.solve__card-grid .game-card')
    .filter({ has: player.page.getByText(answer.means, { exact: true }) })
    .click()
  await player.page
    .locator('.solve__card-grid .game-card')
    .filter({ has: player.page.getByText(answer.clue, { exact: true }) })
    .click()
  await player.page.getByRole('button', { name: '确认破案' }).click()
}
async function winner(game, side) {
  for (const player of game.group) {
    await phase(player, 'game-over')
    const final = await state(player)
    expect(final.winner).toBe(side)
    // Team scoring, including a detective who used up their solve right.
    const bonus = 7 - game.group.length
    for (const participant of final.players) {
      const expected =
        side === 'murderer'
          ? ['murderer', 'accomplice'].includes(participant.role)
            ? 3
            : 0
          : participant.role === 'witness'
            ? 3 + bonus
            : participant.role === 'detective'
              ? 2 + bonus
              : 0
      expect(final.scores[participant.id]).toBe(expected)
    }
    await expect(
      player.page.getByRole('heading', {
        name: side === 'detective' ? '侦探方获胜' : '凶手方获胜',
      }),
    ).toBeVisible()
    await expect(player.page.locator('.game-over__player')).toHaveCount(game.group.length)
  }
}
async function advance(game, round, replacementClue) {
  await game.witness.page.locator('.discussion__btn--end').click()
  for (const player of game.group) await phase(player, `advance-${round}`)
  if (round === 1 && game.accomplice) {
    if (replacementClue) {
      await game.accomplice.page.getByRole('button', { name: '更换线索牌', exact: true }).click()
      await game.accomplice.page.getByRole('button', { name: replacementClue, exact: true }).click()
      await game.accomplice.page.getByRole('button', { name: '确认更换', exact: true }).click()
    } else await game.accomplice.page.getByRole('button', { name: '不更换', exact: true }).click()
  }
  const boardCount = replacementClue ? 2 : 1
  await expect.poll(async () => (await state(game.witness)).newBoards.length).toBe(boardCount)
  // E07 remains active throughout the next discussion, as the card requires.
  for (const player of game.group) {
    await expect.poll(async () => (await state(player)).blackout).toBe(true)
    await expect(
      player.page.getByRole('dialog').getByRole('heading', { name: '效果牌' }),
    ).toBeVisible()
    await expect(player.page.getByRole('dialog')).toContainText('停电')
    await player.page
      .getByRole('dialog')
      .getByRole('button', { name: '知道了', exact: true })
      .click()
  }
  await assertPrivate(game)
  for (let i = 0; i < boardCount; i++) {
    // The heading exists even if E07 hides current boards. If no old boards
    // remain in the witness UI, this intentionally fails rather than bypassing it.
    await game.witness.page.locator('.advance__board-wrap .scene-board__header').first().click()
    await game.witness.page
      .locator('.advance__boards')
      .nth(1)
      .locator('.scene-board__cell')
      .first()
      .click()
    await game.witness.page.getByRole('button', { name: /确认替换/ }).click()
    await expect
      .poll(async () => (await state(game.witness)).newBoards.length)
      .toBe(boardCount - i - 1)
  }
  await game.witness.page
    .locator('.advance')
    .getByRole('button', { name: '继续', exact: true })
    .click()
  for (const player of game.group) {
    await phase(player, `discussion-${round + 1}`)
    await dismissPhase(player)
    expect((await state(player)).blackout).toBe(true)
    await expect(player.page.locator('.discussion .scene-board__blackout-text')).toHaveCount(6)
  }
}

test('经典01：首轮正确指认，侦探方获胜', async ({ players }) => {
  const game = await startCase(players)
  await solve(game.detectives[0], game.answer)
  await winner(game, 'detective')
})

test('经典02：误判仅消耗本人破案权，另一侦探仍可获胜', async ({ players }) => {
  const game = await startCase(players)
  const mistaken = game.detectives[0]
  await solve(mistaken, { ...game.answer, means: game.hand.meansCards[1].name })
  await expect.poll(async () => (await state(mistaken)).lastSolveResult?.success).toBe(false)
  for (const player of game.group) await phase(player, 'discussion-1')
  const view = await state(mistaken)
  expect(view.players.find((p) => p.id === view.myPlayerId).hasSolveRight).toBe(false)
  await dismissResults(game, mistaken)
  await expect(mistaken.page.locator('.discussion__btn--solve')).toHaveCount(0)
  await expect(mistaken.page.getByText('已用破案权', { exact: true })).toBeVisible()
  await assertPrivate(game)
  await solve(game.detectives[1], game.answer)
  await winner(game, 'detective')
})

test('经典03：三轮推进与停电；强制破案全部失败，凶手方获胜', async ({ players }) => {
  const game = await startCase(players)
  await advance(game, 1)
  await advance(game, 2)
  await game.witness.page.locator('.discussion__btn--end').click()
  for (const player of game.group) {
    await phase(player, 'force-solve')
    await dismissPhase(player)
  }
  const seen = new Set()
  for (let attempt = 0; attempt < 3; attempt++) {
    const view = await state(game.witness)
    const turnId = view.forceSolveTurnPlayerId
    expect(seen.has(turnId)).toBe(false)
    seen.add(turnId)
    const views = await Promise.all(game.group.map(state))
    const current = game.group.find((_, i) => views[i].myPlayerId === turnId)
    expect(current).toBeTruthy()
    for (const player of game.group.filter((p) => p !== current)) {
      await expect(player.page.locator('.force-solve__btn')).toHaveCount(0)
    }
    await solve(current, { ...game.answer, means: game.hand.meansCards[1].name }, true)
    await expect.poll(async () => (await state(current)).lastSolveResult?.success).toBe(false)
    await dismissResults(game, current)
    if (attempt < 2)
      await expect
        .poll(async () => (await state(game.witness)).forceSolveTurnPlayerId)
        .not.toBe(turnId)
  }
  await winner(game, 'murderer')
})

test('经典04：六人帮凶换线索；旧答案失败，新答案获胜', async ({ players }) => {
  const game = await startCase(players, 6)
  const newClue = game.hand.clueCards[1].name
  await advance(game, 1, newClue)
  await expect
    .poll(async () => (await state(game.witness)).murdererSelection?.clueCard.name)
    .toBe(newClue)
  await assertPrivate(game)
  await solve(game.detectives[0], game.answer)
  await expect
    .poll(async () => (await state(game.detectives[0])).lastSolveResult?.success)
    .toBe(false)
  await dismissResults(game, game.detectives[0])
  await solve(game.detectives[1], { ...game.answer, clue: newClue })
  await winner(game, 'detective')
})

test('回归05：停电中目击者刷新，仍应能选择旧板继续推进', async ({ players }) => {
  const game = await startCase(players)
  await game.witness.page.locator('.discussion__btn--end').click()
  await phase(game.witness, 'advance-1')
  await expect.poll(async () => (await state(game.witness)).blackout).toBe(true)
  await game.witness.page.reload()
  await phase(game.witness, 'advance-1')
  await expect.poll(async () => (await state(game.witness)).newBoards.length).toBe(1)
  // A witness needs actionable old-board controls even when public boards hide.
  await expect(game.witness.page.locator('.advance__board-wrap')).toHaveCount(5)
  const detective = game.detectives[0]
  await detective.page.reload()
  await phase(detective, 'advance-1')
  expect((await state(detective)).boards).toEqual([])
  expect((await state(detective)).newBoards).toEqual([])
  await game.witness.page.locator('.advance__board-wrap').first().click()
  await game.witness.page.locator('.advance__boards').nth(1).locator('.scene-board__cell').first().click()
  await game.witness.page.getByRole('button', { name: /确认替换/ }).click()
  await expect.poll(async () => (await state(game.witness)).newBoards.length).toBe(0)
  await game.witness.page.reload()
  await phase(game.witness, 'advance-1')
  await game.witness.page.locator('.advance').getByRole('button', { name: '继续', exact: true }).click()
  await phase(game.witness, 'discussion-2')
  await dismissPhase(game.witness)
  expect((await state(game.witness)).blackout).toBe(true)
  await game.witness.page.locator('.discussion__btn--end').click()
  await phase(game.witness, 'advance-2')
  // This deterministic deck has E07 again: restoration precedes the next blackout.
  await expect.poll(async () => (await state(detective)).boards.length).toBe(6)

})

test('回归06：六人等待帮凶决策时，目击者不能提前结束推进', async ({ players }) => {
  const game = await startCase(players, 6)
  await game.witness.page.locator('.discussion__btn--end').click()
  await phase(game.witness, 'advance-1')
  await expect(
    game.accomplice.page.getByRole('button', { name: '不更换', exact: true }),
  ).toBeVisible()
  await game.witness.page.reload()
  await phase(game.witness, 'advance-1')
  // Either hide the premature continuation control or disable it, even on reload.
  await expect(
    game.witness.page.locator('.advance button:enabled').filter({ hasText: /^\s*继续\s*$/ }),
  ).toHaveCount(0)
})
