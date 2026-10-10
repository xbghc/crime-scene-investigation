import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createServer, type Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import { io as connectClient, type Socket } from 'socket.io-client'
import { signToken, socketAuthMiddleware } from '../../auth.js'
import { RoomManager, ROOM_IDLE_TIMEOUT_MS, type RoomResult } from '../../rooms/RoomManager.js'
import { registerHandlers } from '../handlers.js'
import { RECONNECT_TIMEOUT_MS, ROLE_REVEAL_DELAY_MS } from '../../types.js'

const settle = () => new Promise((resolve) => setTimeout(resolve, 35))
function next(socket: Socket, event: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), 2500)
    socket.once(event, (data) => {
      clearTimeout(timer)
      resolve(data)
    })
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

describe('room protocol over real authenticated Socket.IO connections', () => {
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
    for (const client of clients) client.disconnect()
    await new Promise<void>((resolve) => io.close(() => resolve()))
  })
  async function client(id = `player-${++sequence}`, token = signToken({ id })) {
    const socket = connectClient(url, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    })
    clients.push(socket)
    await next(socket, 'connect')
    return socket
  }
  function engine(socket: Socket) {
    const serverSocket = io.sockets.sockets.get(socket.id!)!
    return rooms.engineFor(serverSocket)!
  }
  async function room(count = 1) {
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

  it('creates independent rooms and scopes every public/private state to members', async () => {
    const a = await room(4)
    const b = await room(4)
    const observer = await client()
    expect(a.code).not.toBe(b.code)
    const otherEvents: string[] = []
    for (const s of [...b.members, observer]) s.onAny((event) => otherEvents.push(event))
    const started = a.members.map((s) => next(s, 'game_started'))
    a.host.emit('start_game')
    const roles = await Promise.all(started)
    expect(new Set(roles.map((r) => r.role))).toEqual(new Set(['witness', 'murderer', 'detective']))
    expect(engine(b.host).isPlaying()).toBe(false)
    for (const s of a.members) {
      const full = next(s, 'full_state')
      s.emit('request_state')
      const data = await full
      expect(data.players).toHaveLength(4)
      expect(data.players.map((p: any) => p.id)).not.toEqual(
        engine(b.host)
          .getRoomState()
          .players.map((p) => p.id),
      )
    }
    const ge = engine(a.host)
    ge.triggerNightMurder()
    const murderer = ge
      .getRoomState()
      .players.map((p) => ge.getPlayerById(p.id)!)
      .find((p) => p.role === 'murderer')!
    const selected = next(a.host, 'system_message')
    const murdererSocket = a.members.find((s) => s.id === murderer.socketId)!
    murdererSocket.emit('murderer_select', {
      meansCardId: murderer.meansCards[0]!.id,
      clueCardId: murderer.clueCards[0]!.id,
    })
    await selected
    await settle()
    expect(ge.getSolution()).not.toBeNull()
    for (const s of a.members) {
      const full = next(s, 'full_state')
      s.emit('request_state')
      const state = await full
      if (state.myRole === 'detective') {
        expect(state.murdererSelection).toBeUndefined()
        expect(state.players.some((p: any) => p.role === 'murderer')).toBe(false)
      } else expect(state.murdererSelection).toEqual(ge.getSolution())
    }
    const witness = ge
      .getRoomState()
      .players.map((p) => ge.getPlayerById(p.id)!)
      .find((p) => p.role === 'witness')!
    expect(ge.handleWitnessConfirmMurder(witness.id)).toMatchObject({ ok: true })
    ge.getActiveBoards().forEach((board, index) => {
      expect(ge.handleWitnessSetMarker(witness.id, board.id, 0, index + 1)).toMatchObject({
        ok: true,
      })
    })
    expect(ge.handleWitnessConfirmAccuse(witness.id)).toMatchObject({ ok: true })
    ge.setEffectDeckForTest([{ id: 'E07', name: '停电', effect: '停电' }])
    const effect = next(a.host, 'effect_card')
    expect(ge.handleEndDiscussion(witness.id)).toMatchObject({ ok: true })
    expect((await effect).card.id).toBe('E07')
    // Completed solution/roles must remain in this room as well.
    const over = next(a.host, 'game_over')
    ge.triggerEndGame('detective')
    expect((await over).solution).toEqual(ge.getSolution())
    ge.broadcastGameState()
    a.host.emit('reset_game')
    await settle()
    expect(otherEvents).toEqual([])
    const denied = next(observer, 'system_message')
    observer.emit('request_state')
    expect(await denied).toMatchObject({ type: 'error' })
    expect(rooms.engineFor(io.sockets.sockets.get(observer.id!)!)).toBeNull()
  })

  it('rejects premature and replayed advance completion over authenticated sockets', async () => {
    const a = await room(6)
    const ge = engine(a.host)
    ge.startGame()
    ge.triggerNightMurder()
    const players = ge.getRoomState().players.map((p) => ge.getPlayerById(p.id)!)
    const witness = players.find((p) => p.role === 'witness')!
    const accomplice = players.find((p) => p.role === 'accomplice')!
    const murderer = players.find((p) => p.role === 'murderer')!
    const witnessSocket = a.members.find((s) => s.id === witness.socketId)!
    const accompliceSocket = a.members.find((s) => s.id === accomplice.socketId)!
    ge.handleMurdererSelect(murderer.id, murderer.meansCards[0]!.id, murderer.clueCards[0]!.id)
    ge.handleWitnessConfirmMurder(witness.id)
    ge.getActiveBoards().forEach((board, index) =>
      ge.handleWitnessSetMarker(witness.id, board.id, 0, index + 1),
    )
    ge.handleWitnessConfirmAccuse(witness.id)
    ge.setEffectDeckForTest([{ id: 'E07', name: '停电', effect: '' }])
    ge.handleEndDiscussion(witness.id)
    await settle()
    async function rejectedFinish() {
      const denied = next(witnessSocket, 'system_message')
      witnessSocket.emit('witness_finish_advance')
      expect(await denied).toMatchObject({ type: 'error' })
      expect(ge.getPhase()).toBe('advance-1')
    }
    const effectDenied = next(witnessSocket, 'system_message')
    witnessSocket.emit('effect_action', { effectId: 'E01', data: { targetId: accomplice.id } })
    expect(await effectDenied).toMatchObject({ type: 'error' })
    expect(ge.getPlayerById(accomplice.id)?.status).toBe('alive')
    await rejectedFinish()
    const boards = next(witnessSocket, 'new_boards')
    accompliceSocket.emit('accomplice_choose', { replaceClue: false })
    const pending = (await boards).boards
    await rejectedFinish()
    for (const socket of a.members) {
      const snapshot = next(socket, 'full_state')
      socket.emit('request_state')
      const view = await snapshot
      expect(view.boards).toHaveLength(socket === witnessSocket ? 6 : 0)
      if (socket !== witnessSocket) {
        expect(view.newBoards).toBeUndefined()
        expect(view.advanceReady).toBeUndefined()
      }
    }
    const leakedBoardEvents: string[] = []
    for (const socket of a.members.filter((s) => s !== witnessSocket)) {
      for (const event of ['board_replaced', 'marker_placed', 'boards_revealed', 'advance_ready'])
        socket.on(event, () => leakedBoardEvents.push(event))
    }
    const ready = next(witnessSocket, 'advance_ready')
    witnessSocket.emit('witness_replace_board', {
      oldBoardId: ge.getActiveBoards().find((b) => b.type !== 'cause')!.id,
      newBoardId: pending[0].id,
      optionIndex: 0,
      markerNumber: 2,
    })
    expect(await ready).toEqual({ ready: true })
    const changed = next(witnessSocket, 'phase_change')
    witnessSocket.emit('witness_finish_advance')
    expect(await changed).toMatchObject({
      phase: 'discussion-2',
      data: { boards: [], blackout: true },
    })
    await settle()
    const duplicate = next(witnessSocket, 'system_message')
    witnessSocket.emit('witness_finish_advance')
    expect(await duplicate).toMatchObject({ type: 'error' })
    await settle()
    expect(ge.getPhase()).toBe('discussion-2')
    expect(ge.getBlackout()).toBe(true)
    expect(leakedBoardEvents).toEqual([])
  })

  it('runs two matches simultaneously without cross-room phase, result, or reset changes', async () => {
    const a = await room(4)
    const b = await room(4)
    const startA = next(a.host, 'game_started')
    const startB = next(b.host, 'game_started')
    a.host.emit('start_game')
    b.host.emit('start_game')
    await Promise.all([startA, startB])
    const bEvents: string[] = []
    b.host.onAny((event) => bEvents.push(event))
    const geA = engine(a.host)
    const geB = engine(b.host)
    geA.triggerNightMurder()
    geA.triggerEndGame('murderer')
    a.host.emit('reset_game')
    await settle()
    expect(geA.getPhase()).toBe('waiting')
    expect(geB.getPhase()).toBe('role-reveal')
    expect(geB.isPlaying()).toBe(true)
    expect(geB.getWinner()).toBeNull()
    expect(bEvents).toEqual([])
  })

  it('rejects missing, invalid, or non-string authenticated identities', async () => {
    for (const token of [undefined, 'invalid', signToken({ id: 42 })]) {
      const socket = connectClient(url, {
        auth: { token },
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
      })
      clients.push(socket)
      expect(await next(socket, 'connect_error')).toBeInstanceOf(Error)
      expect(socket.connected).toBe(false)
    }
  })

  it('validates codes/nicknames, capacity, and rejects mid-game strangers', async () => {
    const a = await room(10)
    const stranger = await client()
    for (const code of [undefined, '', 'ABC', '!!!!!!', { bad: true }]) {
      expect(await command(stranger, 'join_room', { code, nickname: '新人' })).toMatchObject({
        ok: false,
      })
    }
    expect(
      await command(stranger, 'join_room', { code: 'ZZZZZZ', nickname: '新人' }),
    ).toMatchObject({ ok: false })
    expect(await command(stranger, 'create_room', { nickname: ' '.repeat(20) })).toMatchObject({
      ok: false,
    })
    expect(await command(stranger, 'join_room', { code: a.code, nickname: '新人' })).toMatchObject({
      ok: false,
    })
    const started = next(a.host, 'game_started')
    a.host.emit('start_game')
    await started
    expect(await command(stranger, 'join_room', { code: a.code, nickname: '新人' })).toMatchObject({
      ok: false,
    })
    expect(await command(stranger, 'resume_room', { code: a.code })).toMatchObject({ ok: false })
  })

  it('restores waiting membership after disconnect without creating another player', async () => {
    const identity = 'reconnecting-host'
    const host = await client(identity)
    const created = await command(host, 'create_room', { nickname: '保留代号' })
    const ge = engine(host)
    host.disconnect()
    await settle()
    expect(ge.getRoomState().players).toHaveLength(1)
    const replacement = await client(identity)
    const state = next(replacement, 'room_state')
    expect(await command(replacement, 'resume_room', { code: created.code })).toMatchObject({
      ok: true,
    })
    expect(await state).toMatchObject({
      code: created.code,
      players: [{ id: identity, nickname: '保留代号', connected: true }],
    })
  })

  it('recovers server-accepted membership when create or join response was lost', async () => {
    const host = await client('interrupted-create')
    const created = await command(host, 'create_room', { nickname: '断线创建' })
    // Model a browser that never persisted the response, then opens a fresh connection.
    host.disconnect()
    await settle()
    const back = await client('interrupted-create')
    const state = next(back, 'room_state')
    expect(await command(back, 'resume_room', {})).toMatchObject({ ok: true, code: created.code })
    expect((await state).players).toHaveLength(1)
    const outsider = await client()
    expect(await command(outsider, 'resume_room', {})).toEqual({ ok: true })
    expect(rooms.engineFor(io.sockets.sockets.get(outsider.id!)!)).toBeNull()
  })

  it('same-token takeover revokes old socket actions, broadcasts and late disconnect', async () => {
    const old = await client('same-identity')
    const created = await command(old, 'create_room', { nickname: '房主' })
    const replacement = await client('same-identity')
    const replaced = next(old, 'session_replaced')
    expect(await command(replacement, 'resume_room', { code: created.code })).toMatchObject({
      ok: true,
    })
    await replaced
    const ge = engine(replacement)
    const oldState: unknown[] = []
    old.on('room_state', (data) => oldState.push(data))
    const error = next(old, 'system_message')
    old.emit('update_nickname', { nickname: '窃取' })
    expect(await error).toMatchObject({ type: 'error' })
    expect(await command(old, 'leave_room')).toMatchObject({ ok: false })
    old.disconnect()
    await settle()
    expect(ge.getPlayerById('same-identity')?.socketId).toBe(replacement.id)
    expect(ge.getPlayerById('same-identity')?.nickname).toBe('房主')
    replacement.emit('update_nickname', { nickname: '新代号' })
    await settle()
    expect(oldState).toEqual([])
    expect(ge.getPlayerById('same-identity')?.nickname).toBe('新代号')
  })

  it('leaving a lobby transfers host, revokes membership, and destroys empty rooms', async () => {
    const a = await room(2)
    const ge = engine(a.host)
    expect(await command(a.host, 'leave_room')).toMatchObject({ ok: true })
    expect(ge.getRoomState().players).toHaveLength(1)
    expect(ge.getRoomState().players[0]?.isHost).toBe(true)
    const denied = next(a.host, 'system_message')
    a.host.emit('request_state')
    expect(await denied).toMatchObject({ type: 'error' })
    expect(await command(a.members[1]!, 'leave_room')).toMatchObject({ ok: true })
    expect(await command(a.host, 'join_room', { code: a.code, nickname: '回来' })).toMatchObject({
      ok: false,
    })
  })

  it('rejects cross-room actions and membership switching during a match', async () => {
    const a = await room(4)
    const b = await room(1)
    const begun = next(a.host, 'game_started')
    a.host.emit('start_game')
    await begun
    expect(await command(a.host, 'leave_room')).toMatchObject({ ok: false })
    expect(await command(a.host, 'create_room', { nickname: '逃离' })).toMatchObject({ ok: false })
    expect(await command(a.host, 'join_room', { code: b.code, nickname: '闯入' })).toMatchObject({
      ok: false,
    })
    const denied = next(a.host, 'system_message')
    a.host.emit('reset_game', { code: b.code })
    expect(await denied).toMatchObject({ type: 'error' })
    expect(engine(a.host).isPlaying()).toBe(true)
    expect(engine(b.host).getRoomState().players).toHaveLength(1)
    const malformed = next(a.host, 'system_message')
    a.host.emit('murderer_select', null)
    expect(await malformed).toMatchObject({ type: 'error' })
  })

  it('reconnects a playing identity to the same role and does not expose its solution to another identity', async () => {
    const host = await client('stable-host')
    const created = await command(host, 'create_room', { nickname: '固定' })
    const members = [host]
    for (let i = 0; i < 3; i++) {
      const s = await client()
      await command(s, 'join_room', { code: created.code, nickname: `同伴${i}` })
      members.push(s)
    }
    const begun = next(host, 'game_started')
    host.emit('start_game')
    const role = (await begun).role
    host.disconnect()
    await settle()
    const back = await client('stable-host')
    const full = next(back, 'full_state')
    expect(await command(back, 'resume_room', { code: created.code })).toMatchObject({ ok: true })
    expect((await full).myRole).toBe(role)
    const stranger = await client()
    expect(await command(stranger, 'resume_room', { code: created.code })).toMatchObject({
      ok: false,
    })
  })

  it('expires offline lobby seats and completely abandoned matches, cancelling timers', async () => {
    const lobby = await room()
    lobby.host.disconnect()
    await settle()
    rooms.sweep(Date.now() + RECONNECT_TIMEOUT_MS + 1)
    const outsider = await client()
    expect(
      await command(outsider, 'join_room', { code: lobby.code, nickname: '新人' }),
    ).toMatchObject({ ok: false })
    const active = await room(4)
    const begun = next(active.host, 'game_started')
    active.host.emit('start_game')
    await begun
    for (const s of active.members) s.disconnect()
    await settle()
    rooms.sweep(Date.now() + ROOM_IDLE_TIMEOUT_MS + 1)
    expect(
      await command(outsider, 'join_room', { code: active.code, nickname: '新人' }),
    ).toMatchObject({ ok: false })
  })

  it('reset during role reveal cancels the delayed night transition', async () => {
    const a = await room(4)
    const begun = next(a.host, 'game_started')
    a.host.emit('start_game')
    await begun
    a.host.emit('reset_game')
    await settle()
    expect(engine(a.host).isPlaying()).toBe(false)
    await new Promise((resolve) => setTimeout(resolve, ROLE_REVEAL_DELAY_MS + 25))
    expect(
      engine(a.host).getGameStateForPlayer(io.sockets.sockets.get(a.host.id!)!.data.userId).phase,
    ).toBe('waiting')
  }, 6000)
})
