import { test, expect, state, phase, create, join, roster } from './helpers/multiplayer.mjs'

// These are real UI scenarios, not protocol-in-browser attacks. Socket listeners below
// only count observed events: no emit(), store mutation, fake clock, or server test hook.
test.setTimeout(120_000)

async function observeEvents(player) {
  await player.page.evaluate(() => {
    const socket = window.__socket
    if (!socket) throw new Error('Expected the UI to establish its Socket.IO connection')
    window.__roomEdgeEvents = { incoming: [], outgoing: [] }
    socket.onAny((event) => window.__roomEdgeEvents.incoming.push(event))
    socket.onAnyOutgoing((event) => window.__roomEdgeEvents.outgoing.push(event))
  })
}

async function eventCount(player, direction, event) {
  return player.page.evaluate(
    ({ direction, event }) => window.__roomEdgeEvents[direction].filter((e) => e === event).length,
    { direction, event },
  )
}

async function fourPlayers(players, prefix) {
  const group = []
  for (let i = 1; i <= 4; i++) group.push(await players(`${prefix}${i}`))
  const code = await create(group[0])
  for (const player of group.slice(1)) await join(player, code)
  await roster(
    group[0],
    group.map((p) => p.name),
  )
  return { group, host: group[0], code }
}

function ids(snapshot) {
  return snapshot.roomPlayers.map((p) => p.id).sort()
}

test('UI capacity: minimum four, maximum ten, and an eleventh player is rejected', async ({
  players,
}) => {
  const host = await players('容量房主')
  const code = await create(host)
  const members = [host]
  const start = host.page.getByRole('button', { name: /开始调查/ })
  await expect(start).toBeDisabled()
  await expect(start).toContainText('至少4人')
  for (let number = 2; number <= 10; number++) {
    const player = await players(`容量成员${number}`)
    await join(player, code)
    members.push(player)
    await roster(
      host,
      members.map((p) => p.name),
    )
    if (number < 4) await expect(start).toBeDisabled()
    else await expect(start).toBeEnabled()
  }
  const before = await state(host)
  expect(new Set(ids(before)).size).toBe(10)
  const extra = await players('容量额外成员')
  await extra.page.getByRole('button', { name: '加入房间', exact: true }).click()
  await extra.page.getByLabel('房间码', { exact: true }).fill(code)
  await extra.page.getByRole('button', { name: '加入调查' }).click()
  await expect(extra.page.locator('.entry-message[role="alert"]')).toContainText('房间已满')
  await expect(extra.page.locator('.room-controls__code')).toHaveCount(0)
  expect((await state(extra)).roomCode).toBeNull()
  for (const member of members) {
    await roster(
      member,
      members.map((p) => p.name),
    )
    expect(ids(await state(member))).toEqual(ids(before))
  }
  await start.click()
  for (const member of members) {
    await phase(member, 'night-murder')
    expect((await state(member)).players).toHaveLength(10)
  }
  await phase(extra, 'waiting')
  expect((await state(extra)).players).toEqual([])
  expect((await state(extra)).myRole).toBeUndefined()
})

test('UI repeated create, join, and start clicks preserve one membership and one game start', async ({
  players,
}) => {
  const host = await players('连点房主')
  await observeEvents(host)
  // One real browser input sequence sends three clicks without retries against a removed button.
  await host.page.locator('form button[type="submit"]').click({ clickCount: 3 })
  await expect(host.page.locator('.room-controls__code')).toHaveText(/^[A-Z0-9]{6}$/)
  const code = (await host.page.locator('.room-controls__code').textContent()).trim()
  await roster(host, [host.name])
  expect(await eventCount(host, 'outgoing', 'create_room')).toBe(1)
  const originalHostId = (await state(host)).hostId
  const group = [host]
  for (let i = 2; i <= 4; i++) {
    const player = await players(`连点成员${i}`)
    await observeEvents(player)
    await player.page.getByRole('button', { name: '加入房间', exact: true }).click()
    await player.page.getByLabel('房间码', { exact: true }).fill(code)
    await player.page.getByRole('button', { name: '加入调查' }).click({ clickCount: 3 })
    group.push(player)
    await roster(
      player,
      group.map((p) => p.name),
    )
    expect(await eventCount(player, 'outgoing', 'join_room')).toBe(1)
  }
  await roster(
    host,
    group.map((p) => p.name),
  )
  const before = await state(host)
  expect(ids(before)).toHaveLength(4)
  expect(new Set(ids(before)).size).toBe(4)
  await host.page.getByRole('button', { name: '开始调查', exact: false }).click({ clickCount: 3 })
  for (const player of group) {
    await phase(player, 'night-murder')
    const current = await state(player)
    expect(current.roomCode).toBe(code)
    expect(current.hostId).toBe(originalHostId)
    expect(ids(current)).toEqual(ids(before))
    expect(current.players.map((p) => p.id).sort()).toEqual(ids(before))
    expect(await eventCount(player, 'incoming', 'game_started')).toBe(1)
  }
  // Reopening the document must find the same room/game, not an extra room or seat.
  const hostBeforeReload = await state(host)
  await host.page.reload()
  await phase(host, 'night-murder')
  const restored = await state(host)
  expect(restored.roomCode).toBe(code)
  expect(ids(restored)).toEqual(ids(before))
  expect(restored.myPlayerId).toBe(hostBeforeReload.myPlayerId)
  expect(restored.myRole).toBe(hostBeforeReload.myRole)
})

test('UI same-identity second tab takes over while the stale tab stays locked out', async ({
  players,
}, testInfo) => {
  const { group, host, code } = await fourPlayers(players, '接管成员')
  await host.page.getByRole('button', { name: '开始调查', exact: false }).click()
  await phase(host, 'night-murder')
  const before = await state(host)
  // Same BrowserContext deliberately shares the real UI-issued identity and room cache.
  const replacementPage = await host.context.newPage()
  replacementPage.on('pageerror', (error) => host.errors.push(error.message))
  const replacement = { ...host, page: replacementPage }
  try {
    await replacementPage.goto('/lobby')
    await phase(replacement, 'night-murder')
    const resumed = await state(replacement)
    expect(resumed.roomCode).toBe(code)
    expect(resumed.myPlayerId).toBe(before.myPlayerId)
    expect(resumed.myRole).toBe(before.myRole)
    expect(ids(resumed)).toEqual(ids(before))
    await expect(host.page).toHaveURL(/\/lobby/)
    await expect(host.page.locator('.entry-message[role="alert"]')).toContainText('另一个页面')
    await expect(host.page.getByText('如需回到此窗口，请刷新页面重新连接。')).toBeVisible()
    await expect(host.page.locator('form')).toHaveCount(0)
    await expect(host.page.locator('.room-controls__code')).toHaveCount(0)
    await expect(host.page.getByRole('button', { name: /开始调查|创建房间|加入调查/ })).toHaveCount(
      0,
    )
    const stale = await state(host)
    expect(stale.roomCode).toBeNull()
    expect(stale.players).toEqual([])
    expect(stale.roomPlayers).toEqual([])
    expect(stale.myRole).toBeUndefined()
    expect(stale.murdererSelection).toBeUndefined()
    // Ordinary tab focus must not reclaim the connection or rehydrate cleared secrets.
    await host.page.bringToFront()
    await expect.poll(() => host.page.evaluate(() => window.__socket.connected)).toBe(false)
    for (const peer of group.slice(1)) {
      await phase(peer, 'night-murder')
      await expect
        .poll(
          async () =>
            (await state(peer)).roomPlayers.find((p) => p.id === before.myPlayerId)?.connected,
        )
        .toBe(true)
      expect(ids(await state(peer))).toEqual(ids(before))
    }
    const active = await state(replacement)
    expect(active.hostId).toBe(before.hostId)
    expect(active.roomPlayers.find((p) => p.id === before.myPlayerId)?.isHost).toBe(true)
    expect((await state(host)).myRole).toBeUndefined()
  } finally {
    await testInfo.attach('same-identity-active-tab', {
      body: await replacementPage.screenshot({ fullPage: true }),
      contentType: 'image/png',
    })
    // Keep both pages open for the shared context trace; the fixture captures the stale tab.
  }
})

test('UI host closes and reopens within grace without losing identity, host status, or a seat', async ({
  players,
}) => {
  const { group, host, code } = await fourPlayers(players, '重开成员')
  const peer = group[1]
  const before = await state(host)
  const hostId = before.hostId
  // Actual production bounds: GameEngine.HOST_TRANSFER_DELAY_MS=30_000;
  // types.RECONNECT_TIMEOUT_MS=120_000. No timers are shortened or mocked.
  const closedAt = Date.now()
  await host.page.close()
  await expect(peer.page.locator('.player-card--host')).toContainText('暂时离线', {
    timeout: 10_000,
  })
  expect((await state(peer)).hostId).toBe(hostId)
  host.page = await host.context.newPage()
  host.page.on('pageerror', (error) => host.errors.push(error.message))
  await host.page.goto('/lobby')
  await roster(
    host,
    group.map((p) => p.name),
  )
  await expect(host.page.locator('.player-card--host')).toContainText('已就绪')
  expect(
    Date.now() - closedAt,
    'resume must finish before the real 30-second host grace',
  ).toBeLessThan(30_000)
  for (const member of group) {
    await expect
      .poll(async () => (await state(member)).roomPlayers.find((p) => p.id === hostId)?.connected)
      .toBe(true)
    const current = await state(member)
    expect(current.roomCode).toBe(code)
    expect(current.hostId).toBe(hostId)
    expect(ids(current)).toEqual(ids(before))
  }
  // Cross the original transfer deadline in real time to detect an uncancelled timer.
  await host.page.waitForTimeout(Math.max(0, 31_000 - (Date.now() - closedAt)))
  for (const member of group) {
    await roster(
      member,
      group.map((p) => p.name),
    )
    expect((await state(member)).hostId).toBe(hostId)
  }
  await expect(host.page.getByRole('button', { name: /开始调查/ })).toBeEnabled()
  await host.page.getByRole('button', { name: /开始调查/ }).click()
  for (const member of group) await phase(member, 'night-murder')
  expect((await state(host)).myPlayerId).toBe(hostId)
})
