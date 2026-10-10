import {
  test,
  expect,
  state,
  phase,
  create,
  join,
  roster,
  dismissPhase,
} from './helpers/multiplayer.mjs'

test('invalid room, two independent rooms, host transfer and lobby reload/rejoin', async ({
  players,
}) => {
  const a = await players('房间甲房主')
  const b = await players('房间甲朋友')
  const c = await players('房间乙房主')
  const d = await players('房间乙朋友')
  await d.page.getByRole('button', { name: '加入房间', exact: true }).click()
  await d.page.getByLabel('房间码', { exact: true }).fill('000000')
  await d.page.getByRole('button', { name: '加入调查' }).click()
  await expect(d.page.locator('.entry-message[role="alert"]')).toContainText('房间')
  await expect(d.page.locator('.room-controls__code')).toHaveCount(0)
  // A created-then-emptied room gives a valid code that is definitely absent.
  const expiredCode = await create(a)
  await a.page.getByRole('button', { name: '退出', exact: true }).click()
  await expect(a.page.getByLabel('你的代号')).toBeVisible()
  await d.page.getByLabel('房间码', { exact: true }).fill(expiredCode)
  await d.page.getByRole('button', { name: '加入调查' }).click()
  await expect(d.page.locator('.entry-message[role="alert"]')).toHaveText('房间不存在或已过期')
  const codeA = await create(a)
  const codeB = await create(c)
  expect(codeA).not.toBe(codeB)
  await join(b, codeA)
  await join(d, codeB)
  await roster(a, [a.name, b.name])
  await roster(c, [c.name, d.name])
  const before = await state(b)
  await b.page.reload()
  await roster(b, [a.name, b.name])
  expect((await state(b)).roomCode).toBe(codeA)
  expect((await state(b)).roomPlayers.map((p) => p.id)).toEqual(before.roomPlayers.map((p) => p.id))
  await a.page.getByRole('button', { name: '退出', exact: true }).click()
  await expect(b.page.locator('.player-card--host')).toContainText(b.name)
  await expect(a.page.getByLabel('你的代号')).toBeVisible()
  await join(a, codeA)
  await roster(a, [a.name, b.name])
  await expect(a.page.getByRole('button', { name: /开始调查/ })).toHaveCount(0)
  await expect(b.page.getByRole('button', { name: /开始调查/ })).toBeDisabled()
  await roster(c, [c.name, d.name])
})

test('four isolated players complete a game through UI; private roles, reload and non-host controls', async ({
  players,
}) => {
  const group = []
  for (let i = 0; i < 4; i++) group.push(await players(`调查员${i + 1}`))
  const host = group[0]
  const code = await create(host)
  for (const player of group.slice(1)) await join(player, code)
  for (const player of group)
    await roster(
      player,
      group.map((p) => p.name),
    )
  for (const player of group.slice(1)) {
    await expect(player.page.getByRole('button', { name: /开始调查/ })).toHaveCount(0)
  }
  await host.page.getByRole('button', { name: '开始调查', exact: false }).click()
  // The server automatically exits role-reveal after its configured three-second reveal delay.
  for (const player of group) await phase(player, 'night-murder')
  const roles = new Map()
  for (const player of group) roles.set((await state(player)).myRole, player)
  expect([...roles.keys()].sort()).toEqual(['detective', 'murderer', 'witness'])
  expect(
    (await Promise.all(group.map(state))).filter((s) => s.myRole === 'detective'),
  ).toHaveLength(2)
  const murderer = roles.get('murderer')
  const witness = roles.get('witness')
  const detective = roles.get('detective')
  const detectiveBefore = await state(detective)
  expect(detectiveBefore.murdererSelection).toBeUndefined()
  expect(detectiveBefore.players.filter((p) => p.role && p.role !== 'witness')).toEqual([])
  await expect(detective.page.locator('.murder-view')).toHaveCount(0)
  await expect(detective.page.getByRole('button', { name: '退出', exact: true })).toBeDisabled()

  // A real document reload tears down and restores the Socket.IO session.
  await detective.page.reload()
  await phase(detective, 'night-murder')
  expect((await state(detective)).myPlayerId).toBe(detectiveBefore.myPlayerId)
  expect((await state(detective)).myRole).toBe('detective')
  expect((await state(detective)).murdererSelection).toBeUndefined()

  const grids = murderer.page.locator('.murder-view__grid')
  const meansName = await grids.nth(0).locator('.murder-card__name').first().textContent()
  const clueName = await grids.nth(1).locator('.murder-card__name').first().textContent()
  await grids.nth(0).locator('.murder-card').first().click()
  await grids.nth(1).locator('.murder-card').first().click()
  await murderer.page.getByRole('button', { name: 'Confirm Crime' }).click()
  await expect(witness.page.getByRole('button', { name: '我记住了，继续' })).toBeVisible()
  expect((await state(detective)).murdererSelection).toBeUndefined()
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
  for (const player of group.slice(1)) {
    await expect(player.page.getByTitle('重置游戏', { exact: true })).toHaveCount(0)
  }
  // Test the solve wizard's cancel/reopen/back path before a winning solve.
  await detective.page.getByRole('button', { name: '破案', exact: false }).click()
  await detective.page.locator('.solve__back').click()
  await expect(detective.page.locator('.solve')).toHaveCount(0)
  await detective.page.getByRole('button', { name: '破案', exact: false }).click()
  await detective.page.locator('.solve__suspect').filter({ hasText: murderer.name }).click()
  await detective.page
    .locator('.solve__card-grid .game-card')
    .filter({ has: detective.page.getByText(meansName.trim(), { exact: true }) })
    .click()
  await detective.page
    .locator('.solve__card-grid .game-card')
    .filter({ has: detective.page.getByText(clueName.trim(), { exact: true }) })
    .click()
  await detective.page.getByRole('button', { name: '返回修改' }).click()
  await detective.page
    .locator('.solve__card-grid .game-card')
    .filter({ has: detective.page.getByText(clueName.trim(), { exact: true }) })
    .click()
  await detective.page.getByRole('button', { name: '确认破案' }).click()
  for (const player of group) {
    await phase(player, 'game-over')
    await expect(player.page.getByRole('heading', { name: '侦探方获胜' })).toBeVisible()
    expect((await state(player)).winner).toBe('detective')
    await expect(player.page.locator('.game-over__player')).toHaveCount(4)
    await expect(player.page.locator('.game-over__solution')).toContainText(meansName.trim())
    await expect(player.page.locator('.game-over__solution')).toContainText(clueName.trim())
  }
  // Any success-result modal may still cover the host's replay button.
  const close = host.page.getByRole('button', { name: '知道了', exact: true })
  if (await close.isVisible()) await close.click()
  await host.page.getByRole('button', { name: '再来一局' }).click()
  for (const player of group) {
    await phase(player, 'waiting')
    await roster(
      player,
      group.map((p) => p.name),
    )
  }
})

test('two four-player rooms progress independently without cross-room state', async ({
  players,
}) => {
  const roomA = []
  const roomB = []
  for (let i = 0; i < 4; i++) {
    roomA.push(await players(`甲组${i + 1}`))
    roomB.push(await players(`乙组${i + 1}`))
  }
  const codeA = await create(roomA[0])
  const codeB = await create(roomB[0])
  for (const player of roomA.slice(1)) await join(player, codeA)
  for (const player of roomB.slice(1)) await join(player, codeB)
  await roomA[0].page.getByRole('button', { name: '开始调查', exact: false }).click()
  for (const player of roomA) await phase(player, 'night-murder')
  for (const player of roomB) {
    await phase(player, 'waiting')
    await roster(
      player,
      roomB.map((p) => p.name),
    )
    expect((await state(player)).myRole).toBeUndefined()
  }
  await roomB[0].page.getByRole('button', { name: '开始调查', exact: false }).click()
  for (const player of roomB) await phase(player, 'night-murder')
  for (const group of [roomA, roomB]) {
    for (const player of group) {
      const current = await state(player)
      expect(current.players.map((p) => p.nickname).sort()).toEqual(group.map((p) => p.name).sort())
      expect(current.roomCode).toBe(group === roomA ? codeA : codeB)
    }
  }
})
