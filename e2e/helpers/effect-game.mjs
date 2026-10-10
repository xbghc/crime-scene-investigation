import { expect, state, phase, create, join, dismissPhase } from './multiplayer.mjs'

async function startCase(players, count = 4, prefix = '效果') {
  const group = []
  for (let i = 0; i < count; i++) group.push(await players(`${prefix}玩家${i + 1}`))
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
  return game
}

export { startCase }
