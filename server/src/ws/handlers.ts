import type { Server, Socket } from 'socket.io'
import type { GameEngine } from '../engine/GameEngine.js'
import { RoomManager, type RoomResult } from '../rooms/RoomManager.js'
import type { EffectActionData, OpResult } from '../types.js'

const managers = new WeakMap<Server, RoomManager>()
export function getRoomManager(io: Server): RoomManager {
  let manager = managers.get(io)
  if (!manager) {
    manager = new RoomManager(io)
    managers.set(io, manager)
  }
  return manager
}

type Payload = Record<string, unknown>
type Ack = (result: RoomResult) => void
function object(value: unknown): Payload {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Payload)
    : {}
}
function strings(data: Payload, ...keys: string[]): boolean {
  return keys.every((key) => typeof data[key] === 'string' && (data[key] as string).length <= 100)
}
function emitError(socket: Socket, result: OpResult): void {
  socket.emit('system_message', { content: result.error ?? '操作失败', type: 'error' })
}

export function registerHandlers(io: Server, socket: Socket, rooms = getRoomManager(io)): void {
  const userId = socket.data.userId as string | undefined
  if (typeof userId !== 'string' || !userId) {
    emitError(socket, { ok: false, error: '身份验证失败' })
    socket.disconnect(true)
    return
  }

  const reply = (result: RoomResult, ack: unknown) => {
    if (!result.ok) emitError(socket, result)
    if (typeof ack === 'function') (ack as Ack)(result)
  }
  socket.on('create_room', (raw: unknown, ack?: Ack) => {
    reply(rooms.create(socket, object(raw).nickname), ack)
  })
  socket.on('join_room', (raw: unknown, ack?: Ack) => {
    const data = object(raw)
    reply(rooms.join(socket, data.code, data.nickname), ack)
  })
  socket.on('resume_room', (raw: unknown, ack?: Ack) => {
    reply(rooms.join(socket, object(raw).code, undefined, true), ack)
  })
  socket.on('leave_room', (ack?: Ack) => reply(rooms.leave(socket), ack))

  // Never select a room or identity from an action payload. Verify current socket ownership
  // for every operation, including read-only state, to invalidate replaced connections.
  function action(
    event: string,
    run: (engine: GameEngine, data: Payload) => OpResult | void,
    valid: (data: Payload) => boolean = () => true,
  ) {
    socket.on(event, (raw?: unknown) => {
      const engine = rooms.engineFor(socket)
      if (!engine) {
        emitError(socket, { ok: false, error: '请先加入房间，或重新连接当前房间' })
        return
      }
      const data = object(raw)
      if ((data.code !== undefined && data.code !== socket.data.roomCode) || !valid(data)) {
        emitError(socket, { ok: false, error: '无效的操作参数或房间' })
        return
      }
      const result = run(engine, data)
      if (result && !result.ok) emitError(socket, result)
    })
  }

  action('start_game', (engine) => {
    const result = engine.canStartGame(userId)
    if (result.ok) engine.startGame()
    return result
  })
  action('request_state', (engine) => {
    socket.emit('room_state', engine.getRoomState())
    if (engine.isPlaying()) socket.emit('full_state', engine.getGameStateForPlayer(userId))
  })
  action(
    'murderer_select',
    (e, d) => e.handleMurdererSelect(userId, d.meansCardId as string, d.clueCardId as string),
    (d) => strings(d, 'meansCardId', 'clueCardId'),
  )
  action('witness_confirm_murder', (e) => e.handleWitnessConfirmMurder(userId))
  action(
    'witness_set_marker',
    (e, d) =>
      e.handleWitnessSetMarker(
        userId,
        d.boardId as string,
        d.optionIndex as number,
        d.markerNumber as number,
      ),
    (d) =>
      strings(d, 'boardId') && Number.isInteger(d.optionIndex) && Number.isInteger(d.markerNumber),
  )
  action('witness_confirm', (e) => e.handleWitnessConfirmAccuse(userId))
  action(
    'witness_replace_board',
    (e, d) =>
      e.handleWitnessReplaceBoard(
        userId,
        d.oldBoardId as string,
        d.newBoardId as string,
        d.optionIndex as number,
        d.markerNumber as number,
      ),
    (d) =>
      strings(d, 'oldBoardId', 'newBoardId') &&
      Number.isInteger(d.optionIndex) &&
      Number.isInteger(d.markerNumber),
  )
  action('witness_finish_advance', (e) => e.handleWitnessFinishAdvance(userId))
  action('end_discussion', (e) => e.handleEndDiscussion(userId))
  action(
    'accomplice_choose',
    (e, d) =>
      e.handleAccompliceChoose(
        userId,
        d.replaceClue as boolean,
        d.newClueCardId as string | undefined,
      ),
    (d) =>
      typeof d.replaceClue === 'boolean' &&
      (d.newClueCardId === undefined || strings(d, 'newClueCardId')),
  )
  action(
    'attempt_solve',
    (e, d) =>
      e.handleAttemptSolve(userId, {
        suspectId: d.suspectId as string,
        meansCardId: d.meansCardId as string,
        clueCardId: d.clueCardId as string,
      }),
    (d) => strings(d, 'suspectId', 'meansCardId', 'clueCardId'),
  )
  action(
    'effect_action',
    (e, d) => {
      const phase = e.getGameStateForPlayer(userId).phase
      if (phase !== 'advance-1' && phase !== 'advance-2')
        return { ok: false, error: '当前不在推进阶段' }
      return e.handleEffectAction(userId, d.effectId as string, object(d.data) as EffectActionData)
    },
    (d) =>
      strings(d, 'effectId') &&
      d.data !== null &&
      typeof d.data === 'object' &&
      !Array.isArray(d.data) &&
      (object(d.data).skip === undefined || typeof object(d.data).skip === 'boolean') &&
      ['targetId', 'boardId', 'cardId'].every(
        (key) => object(d.data)[key] === undefined || strings(object(d.data), key),
      ),
  )
  action('reset_game', (engine) => {
    if (!engine.getPlayerById(userId)?.isHost) return { ok: false, error: '只有房主可以重新开始' }
    engine.resetGame()
    io.to(socket.data.roomCode).emit('system_message', {
      content: '游戏已重置，等待房主开始新一局',
      type: 'info',
    })
  })
  action(
    'update_nickname',
    (engine, data) => {
      const name = (data.nickname as string).trim()
      if (!name || name.length > 10) return { ok: false, error: '昵称长度必须在1-10个字符之间' }
      const result = engine.updatePlayerNickname(userId, name)
      if (result.ok) engine.broadcastRoomState()
      return result
    },
    (d) => strings(d, 'nickname'),
  )
  socket.on('disconnect', () => rooms.disconnect(socket))
}
