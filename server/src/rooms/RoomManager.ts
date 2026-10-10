import { randomInt } from 'node:crypto'
import type { Server, Socket } from 'socket.io'
import { GameEngine } from '../engine/GameEngine.js'
import { RECONNECT_TIMEOUT_MS, type OpResult } from '../types.js'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const ROOM_IDLE_TIMEOUT_MS = 60 * 60 * 1000
const MAX_ROOMS = 100
export interface RoomResult extends OpResult {
  code?: string
}
interface Room {
  code: string
  engine: GameEngine
  offlineSince: number | null
}

/** Single-process registry. Room codes locate rooms; authenticated membership grants access. */
export class RoomManager {
  private rooms = new Map<string, Room>()
  private membership = new Map<string, string>()
  private timer: ReturnType<typeof setInterval>

  constructor(private io: Server) {
    this.timer = setInterval(() => this.sweep(), 30_000)
    this.timer.unref()
  }

  private error(error: string): RoomResult {
    return { ok: false, error }
  }
  private normalizeCode(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const code = value.trim().toUpperCase()
    return /^[A-HJ-NP-Z2-9]{6}$/.test(code) ? code : null
  }
  private nickname(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const name = value.trim()
    return name.length > 0 && name.length <= 10 ? name : null
  }

  create(socket: Socket, name: unknown): RoomResult {
    const nickname = this.nickname(name)
    if (!nickname) return this.error('昵称长度必须在1-10个字符之间')
    if (this.membership.has(socket.data.userId)) return this.error('请先退出当前房间')
    this.sweep()
    if (this.rooms.size >= MAX_ROOMS) return this.error('房间数量已达上限，请稍后重试')
    let code: string
    do {
      code = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join(
        '',
      )
    } while (this.rooms.has(code))
    const room: Room = { code, engine: new GameEngine(this.io, code), offlineSince: null }
    this.rooms.set(code, room)
    return this.enter(socket, room, nickname)
  }

  join(socket: Socket, rawCode: unknown, name: unknown, resume = false): RoomResult {
    // An interrupted create/join may have committed before its response reached the browser.
    // Discover that same authenticated identity's membership even without a saved room code.
    if (resume && rawCode === undefined) {
      rawCode = this.membership.get(socket.data.userId)
      if (!rawCode) return { ok: true }
    }
    const code = this.normalizeCode(rawCode)
    if (!code) return this.error('请输入6位有效房间码')
    const room = this.rooms.get(code)
    if (!room) return this.error('房间不存在或已过期')
    const current = this.membership.get(socket.data.userId)
    if (current && current !== code) return this.error('请先退出当前房间')
    if (resume && current !== code) return this.error('当前身份无法恢复该房间，请重新加入')
    const existing = room.engine.getPlayerById(socket.data.userId)
    const nickname = existing?.nickname ?? this.nickname(name)
    if (!nickname) return this.error('昵称长度必须在1-10个字符之间')
    return this.enter(socket, room, nickname)
  }

  private enter(socket: Socket, room: Room, nickname: string): RoomResult {
    const userId = socket.data.userId as string
    const oldSocketId = room.engine.getPlayerById(userId)?.socketId
    const player = room.engine.addPlayer(userId, nickname, socket.id)
    if (!player) return this.error('无法加入房间（房间已满或游戏已在进行中）')
    if (oldSocketId && oldSocketId !== socket.id) {
      const oldSocket = this.io.sockets.sockets.get(oldSocketId)
      if (oldSocket) {
        oldSocket.leave(room.code)
        delete oldSocket.data.roomCode
        oldSocket.emit('session_replaced', { message: '此身份已在另一个页面连接' })
      }
    }
    this.membership.set(userId, room.code)
    socket.data.roomCode = room.code
    // This registry uses Socket.IO's synchronous in-memory adapter, not a distributed adapter.
    socket.join(room.code)
    room.offlineSince = null
    room.engine.broadcastRoomState()
    if (room.engine.isPlaying())
      socket.emit('full_state', room.engine.getGameStateForPlayer(userId))
    return { ok: true, code: room.code }
  }

  engineFor(socket: Socket): GameEngine | null {
    const code = socket.data.roomCode as string | undefined
    if (!code || this.membership.get(socket.data.userId) !== code) return null
    const engine = this.rooms.get(code)?.engine
    return engine?.getPlayerById(socket.data.userId)?.socketId === socket.id ? engine : null
  }

  leave(socket: Socket): RoomResult {
    const engine = this.engineFor(socket)
    if (!engine) return this.error('你尚未加入房间或连接已失效')
    const userId = socket.data.userId as string
    if (engine.isPlaying() && engine.getGameStateForPlayer(userId).phase !== 'game-over') {
      return this.error('游戏进行中，请先由房主重置游戏再退出')
    }
    const code = socket.data.roomCode as string
    socket.leave(code)
    delete socket.data.roomCode
    this.membership.delete(userId)
    engine.removePlayer(userId)
    socket.emit('room_left')
    engine.broadcastRoomState()
    if (engine.getRoomState().players.length === 0) this.destroy(code)
    return { ok: true }
  }

  disconnect(socket: Socket): void {
    const engine = this.engineFor(socket)
    if (!engine) return
    engine.handleDisconnect(socket.data.userId)
    engine.broadcastRoomState()
    const room = this.rooms.get(socket.data.roomCode)!
    if (!engine.getRoomState().players.some((p) => engine.getPlayerById(p.id)?.socketId)) {
      room.offlineSince = Date.now()
    }
    delete socket.data.roomCode
  }

  /** Public for deterministic lifecycle tests; production runs every 30 seconds. */
  sweep(now = Date.now()): void {
    for (const room of this.rooms.values()) {
      if (!room.engine.isPlaying()) {
        for (const p of room.engine.getRoomState().players) {
          const player = room.engine.getPlayerById(p.id)!
          if (
            player.socketId === null &&
            player.disconnectedAt !== null &&
            now - player.disconnectedAt >= RECONNECT_TIMEOUT_MS
          ) {
            room.engine.removePlayer(p.id)
            this.membership.delete(p.id)
          }
        }
        room.engine.broadcastRoomState()
      }
      if (
        room.engine.getRoomState().players.length === 0 ||
        (room.offlineSince !== null && now - room.offlineSince >= ROOM_IDLE_TIMEOUT_MS)
      )
        this.destroy(room.code)
    }
  }

  private destroy(code: string): void {
    const room = this.rooms.get(code)
    if (!room) return
    room.engine.dispose()
    for (const p of room.engine.getRoomState().players) this.membership.delete(p.id)
    this.io.to(code).emit('room_closed', { message: '房间已关闭或过期' })
    this.io.in(code).socketsLeave(code)
    this.rooms.delete(code)
  }

  dispose(): void {
    clearInterval(this.timer)
    for (const code of this.rooms.keys()) this.destroy(code)
  }
}
