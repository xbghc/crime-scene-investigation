import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer, type Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import { io as connectClient, type Socket } from 'socket.io-client'
import { signToken, socketAuthMiddleware } from '../../auth.js'
import type { GameEngine } from '../../engine/GameEngine.js'
import { RoomManager, type RoomResult } from '../../rooms/RoomManager.js'
import type { EffectActionData, PlayerState, PublicBoard } from '../../types.js'
import { registerHandlers } from '../handlers.js'

const INTERACTIVE_EFFECTS = ['E01', 'E03', 'E05', 'E08'] as const
const ALL_EFFECTS = ['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08', 'E09', 'E10']
type InteractiveEffect = (typeof INTERACTIVE_EFFECTS)[number]
type Event = { name: string; data: any }
type Members = { host: Socket; code: string; members: Socket[] }
type Round = Members & {
  ge: GameEngine
  witness: PlayerState
  witnessSocket: Socket
  murderer: PlayerState
  detectives: PlayerState[]
  accomplice: PlayerState | undefined
}

function next<T = any>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const receive = (data: T) => {
      clearTimeout(timer)
      resolve(data)
    }
    const timer = setTimeout(() => {
      socket.off(event, receive)
      reject(new Error(`Timed out waiting for ${event}`))
    }, 2500)
    socket.once(event, receive)
  })
}

function command(socket: Socket, event: string, data?: unknown): Promise<RoomResult> {
  return new Promise((resolve, reject) => {
    const ack = (error: Error | null, result: RoomResult) =>
      error ? reject(error) : resolve(result)
    if (data === undefined) socket.timeout(2000).emit(event, ack)
    else socket.timeout(2000).emit(event, data, ack)
  })
}

describe('effect authorization over real authenticated Socket.IO connections', () => {
  let http: HttpServer
  let io: Server
  let rooms: RoomManager
  let url: string
  let clients: Socket[]
  let sequence = 0

  beforeEach(async () => {
    clients = []
    http = createServer()
    io = new Server(http)
    rooms = new RoomManager(io)
    io.use(socketAuthMiddleware)
    io.on('connection', (socket) => registerHandlers(io, socket, rooms))
    await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve))
    const address = http.address()
    if (!address || typeof address === 'string') throw new Error('No server port')
    url = `http://127.0.0.1:${address.port}`
  })

  afterEach(async () => {
    rooms.dispose()
    for (const socket of clients) socket.disconnect()
    await new Promise<void>((resolve) => io.close(() => resolve()))
  })

  async function client(id = `effect-player-${++sequence}`) {
    const socket = connectClient(url, {
      auth: { token: signToken({ id }) },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    })
    clients.push(socket)
    await next(socket, 'connect')
    return socket
  }

  function engine(socket: Socket) {
    return rooms.engineFor(io.sockets.sockets.get(socket.id!)!)!
  }

  async function room(count = 4): Promise<Members> {
    const host = await client()
    const result = await command(host, 'create_room', { nickname: '房主' })
    expect(result.ok).toBe(true)
    const members = [host]
    for (let i = 1; i < count; i++) {
      const player = await client()
      expect(
        await command(player, 'join_room', { code: result.code, nickname: `玩家${i}` }),
      ).toMatchObject({ ok: true })
      members.push(player)
    }
    return { host, code: result.code!, members }
  }

  // Socket.IO preserves packet order. A request_state response is a transport barrier
  // after the preceding synchronous action, avoiding arbitrary sleeps or fake timers.
  async function sync(socket: Socket) {
    const response = next(socket, 'room_state')
    socket.emit('request_state')
    await response
  }

  async function act(socket: Socket, event: string, data?: unknown): Promise<Event[]> {
    // Drain broadcasts from earlier actions on other clients before observing this one.
    await sync(socket)
    const events: Event[] = []
    const record = (name: string, data: unknown) => {
      if (name !== 'room_state' && name !== 'full_state') events.push({ name, data })
    }
    socket.onAny(record)
    try {
      socket.emit(event, data)
      await sync(socket)
      return events
    } finally {
      socket.offAny(record)
    }
  }

  async function startRound(members: Members): Promise<Round> {
    const ge = engine(members.host)
    // Trusted test hooks only build the deterministic fixture. Every effect action
    // under test, and all advance/reset/reconnect operations, use real socket input.
    ge.startGame()
    ge.triggerNightMurder()
    const players = ge.getRoomState().players.map((p) => ge.getPlayerById(p.id)!)
    const witness = players.find((p) => p.role === 'witness')!
    const murderer = players.find((p) => p.role === 'murderer')!
    const detectives = players.filter((p) => p.role === 'detective')
    const accomplice = players.find((p) => p.role === 'accomplice')
    const witnessSocket = members.members.find((s) => s.id === witness.socketId)!
    expect(
      ge.handleMurdererSelect(murderer.id, murderer.meansCards[0]!.id, murderer.clueCards[0]!.id),
    ).toEqual({ ok: true })
    expect(ge.handleWitnessConfirmMurder(witness.id)).toEqual({ ok: true })
    ge.getActiveBoards().forEach((b, i) => {
      expect(ge.handleWitnessSetMarker(witness.id, b.id, 0, i + 1)).toEqual({ ok: true })
    })
    expect(ge.handleWitnessConfirmAccuse(witness.id)).toEqual({ ok: true })
    await sync(witnessSocket)
    return { ...members, ge, witness, witnessSocket, murderer, detectives, accomplice }
  }

  async function draw(round: Round, effectId: string | null) {
    round.ge.setEffectDeckForTest(effectId ? [{ id: effectId, name: effectId, effect: '' }] : [])
    const events = await act(round.witnessSocket, 'end_discussion')
    expect(round.ge.getPhase()).toMatch(/^advance-[12]$/)
    return events
  }

  async function setup(effectId: string | null, playerCount = 4) {
    const round = await startRound(await room(playerCount))
    const events = await draw(round, effectId)
    if (playerCount < 6 && effectId) {
      expect(events.find((e) => e.name === 'effect_card')?.data.card.id).toBe(effectId)
    }
    return { ...round, drawEvents: events }
  }

  function snapshot(round: Round) {
    return structuredClone(round.ge.getGameStateForPlayer(round.witness.id))
  }

  function validData(round: Round, effectId: InteractiveEffect): EffectActionData {
    switch (effectId) {
      case 'E01':
      case 'E03':
        return { targetId: round.detectives.find((p) => p.status === 'alive')!.id }
      case 'E05':
        return { boardId: round.ge.getActiveBoards().find((b) => b.marker)!.id }
      case 'E08':
        return { cardId: round.ge.getSolution()!.meansCard.id }
    }
  }

  async function deny(round: Round, effectId: string, data: unknown, socket = round.witnessSocket) {
    const before = snapshot(round)
    const events = await act(socket, 'effect_action', { effectId, data })
    expect(events).toEqual([
      { name: 'system_message', data: expect.objectContaining({ type: 'error' }) },
    ])
    expect(snapshot(round)).toEqual(before)
  }

  async function succeed(round: Round, effectId: InteractiveEffect, data: EffectActionData) {
    const events = await act(round.witnessSocket, 'effect_action', { effectId, data })
    expect(events.some((e) => e.name === 'system_message' && e.data.type === 'error')).toBe(false)
    expect(events.some((e) => e.name === 'system_message' && e.data.type !== 'error')).toBe(true)
    switch (effectId) {
      case 'E01':
        expect(round.ge.getPlayerById(data.targetId!)!).toMatchObject({
          status: 'dead',
          hasSolveRight: false,
        })
        break
      case 'E03':
        expect(events).toContainEqual({
          name: 'system_message',
          data: {
            content: `目击者宣布：${round.ge.getPlayerById(data.targetId!)!.nickname} 不是凶手`,
            type: 'info',
          },
        })
        break
      case 'E05':
        expect(
          round.ge.getActiveBoards().find((b) => b.id === data.boardId)!.marker,
        ).toBeUndefined()
        expect(events.some((e) => e.name === 'boards_revealed')).toBe(true)
        break
      case 'E08':
        expect(events).toContainEqual({
          name: 'effect_card',
          data: {
            card: { id: 'E08', name: '信息泄露' },
            result: { applied: true, pointedCardId: data.cardId },
          },
        })
        break
    }
  }

  async function finishAdvance(round: Round) {
    const state = round.ge.getGameStateForPlayer(round.witness.id)
    for (const board of state.newBoards as PublicBoard[]) {
      const old = round.ge.getActiveBoards().find((b) => b.type !== 'cause')!
      const events = await act(round.witnessSocket, 'witness_replace_board', {
        oldBoardId: old.id,
        newBoardId: board.id,
        optionIndex: 0,
        markerNumber: old.marker?.markerNumber ?? 2,
      })
      expect(events.some((e) => e.name === 'board_replaced')).toBe(true)
    }
    await act(round.witnessSocket, 'witness_finish_advance')
    expect(round.ge.getPhase()).toMatch(/^discussion-[23]$/)
  }

  it.each(ALL_EFFECTS)('%s draw cannot authorize any other supported effect', async (effectId) => {
    const round = await setup(effectId)
    const drawn = round.drawEvents.find((e) => e.name === 'effect_card')!.data
    if (['E02', 'E07', 'E09'].includes(effectId)) expect(drawn.result.applied).toBe(true)
    if (effectId === 'E02') {
      expect(
        round.ge
          .getRoomState()
          .players.filter((p) => round.ge.getPlayerById(p.id)!.status === 'dead'),
      ).toHaveLength(1)
    }
    if (effectId === 'E07') expect(round.ge.getBlackout()).toBe(true)
    for (const forgedId of INTERACTIVE_EFFECTS) {
      if (forgedId !== effectId) await deny(round, forgedId, validData(round, forgedId))
    }
    if (!INTERACTIVE_EFFECTS.includes(effectId as InteractiveEffect)) {
      // Automatic and unsupported cards cannot be explicitly replayed either.
      await deny(round, effectId, {})
    } else {
      // Forged IDs must not consume the actual authorization.
      await succeed(
        round,
        effectId as InteractiveEffect,
        validData(round, effectId as InteractiveEffect),
      )
    }
  })

  it('an empty effect deck grants no witness action', async () => {
    const round = await setup(null)
    expect(round.drawEvents.some((e) => e.name === 'effect_card')).toBe(false)
    for (const effectId of INTERACTIVE_EFFECTS)
      await deny(round, effectId, validData(round, effectId))
  })

  it('E01 rejects missing, unknown, witness, and dead targets without consuming its one action', async () => {
    const round = await setup('E01')
    const dead = round.detectives[0]!
    dead.status = 'dead'
    dead.hasSolveRight = false
    for (const data of [
      {},
      { targetId: 'not-a-player' },
      { targetId: round.witness.id },
      { targetId: dead.id },
    ]) {
      await deny(round, 'E01', data)
    }
    const target = round.detectives[1]!
    await succeed(round, 'E01', { targetId: target.id })
    await deny(round, 'E01', { targetId: round.murderer.id })
    expect(round.murderer.status).toBe('alive')
  })

  it('E03 rejects missing, unknown, murderer, and witness targets before one valid announcement', async () => {
    const round = await setup('E03')
    for (const data of [
      {},
      { targetId: 'not-a-player' },
      { targetId: round.murderer.id },
      { targetId: round.witness.id },
    ]) {
      await deny(round, 'E03', data)
    }
    await succeed(round, 'E03', { targetId: round.detectives[0]!.id })
    await deny(round, 'E03', { targetId: round.detectives[1]!.id })
  })

  it('E05 requires an active marked board, then rejects removal of another marker', async () => {
    const round = await setup('E05')
    const unmarked = round.ge.getActiveBoards()[0]!
    unmarked.marker = undefined
    for (const data of [
      {},
      { boardId: 'not-a-board' },
      { boardId: round.ge.getSceneBoardPool()[0]!.id },
      { boardId: unmarked.id },
    ]) {
      await deny(round, 'E05', data)
    }
    await succeed(round, 'E05', validData(round, 'E05'))
    await deny(round, 'E05', validData(round, 'E05'))
    expect(round.ge.getActiveBoards().filter((b) => b.marker)).toHaveLength(4)
  })

  it.each(['meansCard', 'clueCard'] as const)(
    'E08 only reveals the solution %s once',
    async (kind) => {
      const round = await setup('E08')
      const solution = round.ge.getSolution()!
      const nonSolution = [...round.murderer.meansCards, ...round.murderer.clueCards].filter(
        (card) => card.id !== solution.meansCard.id && card.id !== solution.clueCard.id,
      )
      for (const data of [
        {},
        { cardId: '' },
        { cardId: 'not-a-card' },
        { cardId: round.detectives[0]!.meansCards[0]!.id },
        ...nonSolution.map((card) => ({ cardId: card.id })),
      ]) {
        await deny(round, 'E08', data)
      }
      await succeed(round, 'E08', { cardId: solution[kind].id })
      await deny(round, 'E08', {
        cardId: solution[kind === 'meansCard' ? 'clueCard' : 'meansCard'].id,
      })
    },
  )

  it.each(INTERACTIVE_EFFECTS)(
    '%s cannot be executed by another role or a forged witness ID',
    async (effectId) => {
      const round = await setup(effectId)
      const data = validData(round, effectId)
      for (const player of [round.murderer, round.detectives[0]!]) {
        const socket = round.members.find((s) => s.id === player.socketId)!
        const before = snapshot(round)
        const events = await act(socket, 'effect_action', {
          effectId,
          data,
          userId: round.witness.id,
        })
        expect(events).toEqual([
          { name: 'system_message', data: expect.objectContaining({ type: 'error' }) },
        ])
        expect(snapshot(round)).toEqual(before)
      }
      await succeed(round, effectId, data)
    },
  )

  it('does not authorize effects before the accomplice decision, or let the accomplice execute one', async () => {
    const round = await setup('E01', 6)
    expect(round.drawEvents.some((e) => e.name === 'effect_card')).toBe(false)
    await deny(round, 'E01', validData(round, 'E01'))
    const accompliceSocket = round.members.find((s) => s.id === round.accomplice!.socketId)!
    const events = await act(accompliceSocket, 'accomplice_choose', { replaceClue: false })
    expect(events.find((e) => e.name === 'effect_card')?.data.card.id).toBe('E01')
    await sync(round.witnessSocket)
    await deny(round, 'E01', validData(round, 'E01'), accompliceSocket)
    await succeed(round, 'E01', validData(round, 'E01'))
  })

  it('back-to-back E01 packets kill only the first target', async () => {
    const round = await setup('E01')
    const messages: any[] = []
    const record = (message: unknown) => messages.push(message)
    round.witnessSocket.on('system_message', record)
    for (const target of round.detectives) {
      round.witnessSocket.emit('effect_action', { effectId: 'E01', data: { targetId: target.id } })
    }
    await sync(round.witnessSocket)
    round.witnessSocket.off('system_message', record)
    expect(messages.map((message) => message.type)).toEqual(['warning', 'error'])
    expect(round.detectives[0]!).toMatchObject({ status: 'dead', hasSolveRight: false })
    expect(round.detectives[1]!).toMatchObject({ status: 'alive', hasSolveRight: true })
  })

  it.each([null, 'E03', 'E07'])(
    'clears unused E01 authorization on advance exit, including the next %s draw',
    async (nextEffect) => {
      const round = await setup('E01')
      await finishAdvance(round)
      await deny(round, 'E01', validData(round, 'E01'))
      await draw(round, nextEffect)
      expect(round.ge.getPhase()).toBe('advance-2')
      await deny(round, 'E01', validData(round, 'E01'))
      if (nextEffect === 'E03') await succeed(round, 'E03', validData(round, 'E03'))
    },
  )

  it('a new draw of the same effect grants exactly one new action', async () => {
    const round = await setup('E01')
    await succeed(round, 'E01', { targetId: round.detectives[0]!.id })
    await finishAdvance(round)
    await draw(round, 'E01')
    await succeed(round, 'E01', { targetId: round.detectives[1]!.id })
    await deny(round, 'E01', { targetId: round.murderer.id })
  })

  it('reset removes pending authorization before a new game with an empty deck', async () => {
    const round = await setup('E01')
    await act(round.host, 'reset_game')
    expect(round.ge.getPhase()).toBe('waiting')
    await sync(round.witnessSocket)
    await deny(round, 'E01', { targetId: round.detectives[0]!.id })
    const restarted = await startRound(round)
    await draw(restarted, null)
    await deny(restarted, 'E01', validData(restarted, 'E01'))
  })

  it('game over rejects an otherwise valid pending action', async () => {
    const round = await setup('E01')
    round.ge.triggerEndGame('murderer')
    await sync(round.witnessSocket)
    await deny(round, 'E01', validData(round, 'E01'))
  })

  it('a replacement witness connection retains one pending action and invalidates the old socket', async () => {
    const round = await setup('E01')
    const replacement = await client(round.witness.id)
    expect(await command(replacement, 'resume_room', { code: round.code })).toMatchObject({
      ok: true,
    })
    await sync(replacement)
    const before = snapshot(round)
    const rejected = next(round.witnessSocket, 'system_message')
    round.witnessSocket.emit('effect_action', { effectId: 'E01', data: validData(round, 'E01') })
    expect(await rejected).toMatchObject({ type: 'error' })
    expect(snapshot(round)).toEqual(before)
    round.witnessSocket = replacement
    await succeed(round, 'E01', { targetId: round.detectives[0]!.id })
    await deny(round, 'E01', { targetId: round.detectives[1]!.id })
  })

  it('reconnecting a witness does not replenish consumed authorization', async () => {
    const round = await setup('E01')
    await succeed(round, 'E01', { targetId: round.detectives[0]!.id })
    const serverSocket = io.sockets.sockets.get(round.witnessSocket.id!)!
    const disconnected = new Promise<void>((resolve) =>
      serverSocket.once('disconnect', () => resolve()),
    )
    round.witnessSocket.disconnect()
    await disconnected
    expect(round.witness.socketId).toBeNull()
    const replacement = await client(round.witness.id)
    expect(await command(replacement, 'resume_room', { code: round.code })).toMatchObject({
      ok: true,
    })
    round.witnessSocket = replacement
    await sync(replacement)
    await deny(round, 'E01', { targetId: round.detectives[1]!.id })
  })

  it('malformed action payloads cannot consume a valid pending draw', async () => {
    const round = await setup('E01')
    for (const payload of [
      null,
      [],
      {},
      { effectId: 'E01', data: null },
      { effectId: 'E01', data: [] },
      { effectId: 'E01', data: { targetId: 123 } },
    ]) {
      const before = snapshot(round)
      const events = await act(round.witnessSocket, 'effect_action', payload)
      expect(events).toEqual([
        { name: 'system_message', data: expect.objectContaining({ type: 'error' }) },
      ])
      expect(snapshot(round)).toEqual(before)
    }
    await succeed(round, 'E01', validData(round, 'E01'))
  })
})
