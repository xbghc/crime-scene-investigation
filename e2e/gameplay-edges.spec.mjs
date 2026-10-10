import { test, expect, state, phase, create, join, dismissPhase } from './helpers/multiplayer.mjs'

// Production entrypoint, random roles/cards, real UI setup. These cases stop at
// discussion-1 so they never depend on a particular randomly drawn effect.
async function startNight(players, count = 4) {
  const group = []
  for (let i = 0; i < count; i++) group.push(await players(`边界玩家${i + 1}`))
  const code = await create(group[0])
  for (const player of group.slice(1)) await join(player, code)
  await group[0].page.getByRole('button', { name: '开始调查', exact: false }).click()
  for (const player of group) await phase(player, 'night-murder')
  const views = await Promise.all(group.map(state))
  const byRole = (role) => group.filter((_, index) => views[index].myRole === role)
  const murderer = byRole('murderer')[0]
  const witness = byRole('witness')[0]
  const detectives = byRole('detective')
  const accomplice = byRole('accomplice')[0]
  expect(detectives).toHaveLength(count === 6 ? 3 : 2)
  expect(Boolean(accomplice)).toBe(count === 6)
  const view = await state(murderer)
  const hand = view.players.find((player) => player.id === view.myPlayerId)
  const selection = { meansCard: hand.meansCards[0], clueCard: hand.clueCards[0] }
  const game = { group, code, murderer, witness, detectives, accomplice, hand, selection }
  const grids = murderer.page.locator('.murder-view__grid')
  await grids.nth(0).locator('.murder-card').first().click()
  await grids.nth(1).locator('.murder-card').first().click()
  await murderer.page.getByRole('button', { name: 'Confirm Crime' }).click()
  await expect.poll(async () => (await state(witness)).murdererSelection).toEqual(selection)
  return game
}

async function beginAccusation(game) {
  await game.witness.page.getByRole('button', { name: '我记住了，继续' }).click()
  for (const player of game.group) await phase(player, 'witness-accuse')
  await dismissPhase(game.witness)
}

async function beginDiscussion(game) {
  const boards = game.witness.page.locator('.witness-accuse__board-row')
  await expect(boards).toHaveCount(6)
  const view = await state(game.witness)
  for (let i = 0; i < 6; i++) {
    if (!view.boards[i].marker) await boards.nth(i).locator('.scene-board__cell').first().click()
  }
  await game.witness.page.getByRole('button', { name: '确认布置' }).click()
  for (const player of game.group) {
    await phase(player, 'discussion-1')
    await dismissPhase(player)
  }
}

async function prepareSolve(player, game, meansCard = game.selection.meansCard) {
  await player.page.locator('.discussion__btn--solve').click()
  await player.page.locator('.solve__suspect').filter({ hasText: game.murderer.name }).click()
  for (const card of [meansCard, game.selection.clueCard]) {
    await player.page
      .locator('.solve__card-grid .game-card')
      .filter({ has: player.page.getByText(card.name, { exact: true }) })
      .click()
  }
}

async function assertDetectivePrivacy(game) {
  for (const detective of game.detectives) {
    const view = await state(detective)
    expect(view.myRole).toBe('detective')
    expect(view.murdererSelection).toBeUndefined()
    expect(view.players.filter((player) => player.role && player.role !== 'witness')).toEqual([])
    expect(view.newBoards).toEqual([])
    await expect(
      detective.page.locator('.witness-night__cards, .witness-accuse__hint, .accomplice-view'),
    ).toHaveCount(0)
  }
}

async function assertDetectiveWin(game, solver) {
  const solverId = (await state(solver)).myPlayerId
  for (const player of game.group) {
    await phase(player, 'game-over')
    const view = await state(player)
    // Match this solver as well as success; never accept a previous result.
    expect(view.lastSolveResult).toEqual({ playerId: solverId, success: true })
    expect(view.winner).toBe('detective')
    await expect(player.page.getByRole('heading', { name: '侦探方获胜' })).toBeVisible()
  }
}

test('边界：连续点击确认破案只结算一次、只消耗本人破案权', async ({ players }) => {
  const game = await startNight(players)
  await beginAccusation(game)
  await beginDiscussion(game)
  const [solver, nextSolver] = game.detectives
  const initial = await state(solver)
  const solverId = initial.myPlayerId
  expect(initial.lastSolveResult).toBeNull()
  // Passive receive-side instrumentation only: counting broadcasts proves that
  // the double click did not settle the same solve twice. No socket mutations.
  await game.witness.page.evaluate(() => {
    window.__edgeSolveResults = []
    window.__socket.on('solve_result', (result) => window.__edgeSolveResults.push(result))
  })
  await prepareSolve(solver, game, game.hand.meansCards[1])
  await solver.page.locator('.solve__confirm-btn').dblclick()
  for (const player of game.group) {
    await expect
      .poll(async () => (await state(player)).lastSolveResult)
      .toEqual({
        playerId: solverId,
        success: false,
      })
    const view = await state(player)
    expect(view.phase).toBe('discussion-1')
    expect(view.players.map((participant) => [participant.id, participant.hasSolveRight])).toEqual(
      initial.players.map((participant) => [
        participant.id,
        participant.id === solverId ? false : participant.hasSolveRight,
      ]),
    )
    const result = player.page
      .getByRole('dialog')
      .filter({ has: player.page.getByRole('heading', { name: '破案失败', exact: true }) })
    await expect(result).toContainText(`${solver.name} 推理失败`)
    await result.getByRole('button', { name: '知道了', exact: true }).click()
    await expect(result).toHaveCount(0)
  }
  await expect(solver.page.locator('.discussion__btn--solve')).toHaveCount(0)
  await expect(solver.page.getByText('已用破案权', { exact: true })).toBeVisible()
  await assertDetectivePrivacy(game)
  await prepareSolve(nextSolver, game)
  await nextSolver.page.locator('.solve__confirm-btn').click()
  await assertDetectiveWin(game, nextSolver)
  // The later successful solve is an ordered protocol boundary, rather than an
  // arbitrary sleep, after which the earlier result count must still be one.
  const nextId = (await state(nextSolver)).myPlayerId
  expect(await game.witness.page.evaluate(() => window.__edgeSolveResults)).toEqual([
    { playerId: solverId, success: false },
    { playerId: nextId, success: true },
  ])
})

test('边界：夜晚、指证、讨论刷新恢复各自身份与秘密，侦探仍看不到答案', async ({ players }) => {
  const game = await startNight(players, 6)
  const identities = await Promise.all(
    game.group.map(async (player) => {
      const view = await state(player)
      const self = view.players.find((participant) => participant.id === view.myPlayerId)
      return { id: self.id, role: view.myRole, means: self.meansCards, clues: self.clueCards }
    }),
  )
  async function refreshEveryone(expectedPhase) {
    const boardsBefore = (await state(game.witness)).boards
    await Promise.all(game.group.map((player) => player.page.reload()))
    await Promise.all(game.group.map((player) => phase(player, expectedPhase)))
    for (const [index, player] of game.group.entries()) {
      await phase(player, expectedPhase)
      await dismissPhase(player)
      const view = await state(player)
      const self = view.players.find((participant) => participant.id === view.myPlayerId)
      expect(view.roomCode).toBe(game.code)
      expect({
        id: self.id,
        role: view.myRole,
        means: self.meansCards,
        clues: self.clueCards,
      }).toEqual(identities[index])
      expect(view.boards).toEqual(boardsBefore)
      if (view.myRole !== 'detective') expect(view.murdererSelection).toEqual(game.selection)
      if (['witness', 'accomplice'].includes(view.myRole)) {
        expect(view.players.find((participant) => participant.role === 'murderer')?.id).toBe(
          (await state(game.murderer)).myPlayerId,
        )
      }
    }
    await assertDetectivePrivacy(game)
  }
  await refreshEveryone('night-murder')
  await expect(game.witness.page.locator('.witness-night__cards')).toContainText(
    game.selection.meansCard.name,
  )
  await expect(game.accomplice.page.locator('.accomplice-view__murderer')).toContainText(
    game.murderer.name,
  )
  await beginAccusation(game)
  // Keep partial progress so reload must restore placed markers, not just phase.
  const rows = game.witness.page.locator('.witness-accuse__board-row')
  for (let i = 0; i < 2; i++) await rows.nth(i).locator('.scene-board__cell').first().click()
  await expect
    .poll(async () => (await state(game.witness)).boards.filter((b) => b.marker).length)
    .toBe(2)
  await refreshEveryone('witness-accuse')
  await expect(game.witness.page.locator('.witness-accuse__progress')).toHaveText('2/6')
  await expect(game.witness.page.locator('.witness-accuse__hint-means')).toHaveText(
    game.selection.meansCard.name,
  )
  await beginDiscussion(game)
  await refreshEveryone('discussion-1')
  for (const player of game.group)
    await expect(player.page.locator('.discussion .scene-board')).toHaveCount(6)
  await prepareSolve(game.detectives[0], game)
  await game.detectives[0].page.locator('.solve__confirm-btn').click()
  await assertDetectiveWin(game, game.detectives[0])
})

test('协议攻击（浏览器）：跨房间代码与伪造目击者身份不能推进游戏', async ({ players }) => {
  const game = await startNight(players)
  await beginAccusation(game)
  await beginDiscussion(game)
  const outsider = await players('隔离房玩家')
  const otherCode = await create(outsider)
  const witnessId = (await state(game.witness)).myPlayerId
  const before = await Promise.all([...game.group, outsider].map(state))

  // The ONLY hidden emits in this file are explicitly adversarial requests.
  // Listen before emitting and require an actual server rejection, not silence.
  async function rejected(player, event, payload, error) {
    const response = await player.page.evaluate(
      ({ event, payload }) =>
        new Promise((resolve, reject) => {
          const socket = window.__socket
          const listener = (message) => {
            clearTimeout(timer)
            socket.off('system_message', listener)
            resolve(message)
          }
          const timer = setTimeout(() => {
            socket.off('system_message', listener)
            reject(new Error(`No server rejection for ${event}`))
          }, 5000)
          socket.on('system_message', listener)
          socket.emit(event, payload)
        }),
      { event, payload },
    )
    expect(response).toEqual({ content: error, type: 'error' })
  }
  // A legitimate witness cannot select a different room through a payload.
  await rejected(game.witness, 'end_discussion', { code: otherCode }, '无效的操作参数或房间')
  // An outsider cannot target this game's authenticated witness/room.
  await rejected(
    outsider,
    'end_discussion',
    { code: game.code, userId: witnessId, playerId: witnessId },
    '无效的操作参数或房间',
  )
  // Within the right room, identity fields cannot impersonate the witness.
  await rejected(
    game.detectives[0],
    'end_discussion',
    { code: game.code, userId: witnessId, playerId: witnessId },
    '只有目击者可以结束发言',
  )
  for (const [index, player] of [...game.group, outsider].entries()) {
    const view = await state(player)
    for (const key of [
      'roomCode',
      'phase',
      'boards',
      'players',
      'myRole',
      'murdererSelection',
      'lastSolveResult',
    ]) {
      expect(view[key], `${player.name}: ${key}`).toEqual(before[index][key])
    }
  }
  await assertDetectivePrivacy(game)
  await expect(outsider.page.locator('.room-controls__code')).toHaveText(otherCode)
  await prepareSolve(game.detectives[0], game)
  await game.detectives[0].page.locator('.solve__confirm-btn').click()
  await assertDetectiveWin(game, game.detectives[0])
  expect((await state(outsider)).phase).toBe('waiting')
  expect((await state(outsider)).lastSolveResult).toBeNull()
})
