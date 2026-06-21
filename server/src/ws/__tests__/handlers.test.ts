import { describe, it, expect, beforeEach, vi } from 'vitest'

// === Mock Socket.IO Server & Socket ===

function createMockSocket(userId?: string) {
  return {
    id: `socket-${Math.random().toString(36).slice(2, 8)}`,
    data: { userId },
    emit: vi.fn(),
    on: vi.fn(),
    disconnect: vi.fn(),
  }
}

function createMockIO() {
  const sockets = new Map<string, ReturnType<typeof createMockSocket>>()
  return {
    emit: vi.fn(),
    sockets: { sockets },
  }
}

type MockSocket = ReturnType<typeof createMockSocket>
type MockIO = ReturnType<typeof createMockIO>

/**
 * Get the handler function registered for a specific event on the socket.
 * registerHandlers calls socket.on(eventName, handler) -- we can retrieve
 * the handler from the mock's recorded calls.
 */
function getHandler(socket: MockSocket, eventName: string): ((...args: any[]) => void) | undefined {
  const call = socket.on.mock.calls.find((c: any[]) => c[0] === eventName)
  return call ? call[1] : undefined
}

// The handlers module caches `let engine: GameEngine | null = null` at module scope.
// We must use dynamic imports with vi.resetModules() to get a fresh engine per test group.

describe('WebSocket Handlers', () => {
  let io: MockIO
  let socket: MockSocket
  let registerHandlers: (io: any, socket: any) => void

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('../handlers.js')
    registerHandlers = mod.registerHandlers
    io = createMockIO()
    socket = createMockSocket('test-user')
    io.sockets.sockets.set(socket.id, socket as any)
  })

  describe('userId 缺失时断开连接', () => {
    it('should disconnect socket when userId is missing', () => {
      const noUserSocket = createMockSocket(undefined)
      registerHandlers(io as any, noUserSocket as any)

      expect(noUserSocket.emit).toHaveBeenCalledWith(
        'system_message',
        expect.objectContaining({ type: 'error' }),
      )
      expect(noUserSocket.disconnect).toHaveBeenCalledWith(true)
    })

    it('should not register any event handlers when userId is missing', () => {
      const noUserSocket = createMockSocket(undefined)
      registerHandlers(io as any, noUserSocket as any)

      // on() should not have been called for game events
      expect(noUserSocket.on).not.toHaveBeenCalled()
    })
  })

  describe('join_room 事件路由', () => {
    it('should register join_room event handler', () => {
      registerHandlers(io as any, socket as any)
      const handler = getHandler(socket, 'join_room')
      expect(handler).toBeDefined()
    })

    it('should call engine.addPlayer when join_room fires', () => {
      registerHandlers(io as any, socket as any)
      const handler = getHandler(socket, 'join_room')
      expect(handler).toBeDefined()

      // Invoke the handler -- since this is the first player in a fresh engine,
      // addPlayer should succeed and io.emit should broadcast events
      handler!({ nickname: 'Alice' })

      // Should have broadcast room_state (from broadcastRoomState)
      const roomStateCalls = io.emit.mock.calls.filter((c: any[]) => c[0] === 'room_state')
      expect(roomStateCalls.length).toBeGreaterThanOrEqual(1)

      // Should have broadcast player_joined
      const playerJoinedCalls = io.emit.mock.calls.filter((c: any[]) => c[0] === 'player_joined')
      expect(playerJoinedCalls.length).toBe(1)
      expect(playerJoinedCalls[0][1].player.nickname).toBe('Alice')
    })

    it('should emit error when room is full', () => {
      registerHandlers(io as any, socket as any)

      // Add 10 players through the first socket's engine
      const joinHandler = getHandler(socket, 'join_room')
      expect(joinHandler).toBeDefined()
      joinHandler!({ nickname: 'Player0' })

      // Add 9 more players via separate sockets
      for (let i = 1; i < 10; i++) {
        const s = createMockSocket(`user-${i}`)
        io.sockets.sockets.set(s.id, s as any)
        registerHandlers(io as any, s as any)
        const h = getHandler(s, 'join_room')
        h!({ nickname: `Player${i}` })
      }

      // Now try to add an 11th player
      const extraSocket = createMockSocket('user-extra')
      io.sockets.sockets.set(extraSocket.id, extraSocket as any)
      registerHandlers(io as any, extraSocket as any)
      const extraHandler = getHandler(extraSocket, 'join_room')
      expect(extraHandler).toBeDefined()
      extraHandler!({ nickname: 'Extra' })

      // Should emit error to the extra socket
      const errorCalls = extraSocket.emit.mock.calls.filter(
        (c: any[]) => c[0] === 'system_message' && c[1]?.type === 'error',
      )
      expect(errorCalls.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('start_game 权限检查', () => {
    it('should register start_game event handler', () => {
      registerHandlers(io as any, socket as any)
      const handler = getHandler(socket, 'start_game')
      expect(handler).toBeDefined()
    })

    it('should emit error when non-host tries to start', () => {
      // First player (host)
      registerHandlers(io as any, socket as any)
      const joinHandler = getHandler(socket, 'join_room')
      joinHandler!({ nickname: 'Host' })

      // Second player (non-host)
      const socket2 = createMockSocket('user-2')
      io.sockets.sockets.set(socket2.id, socket2 as any)
      registerHandlers(io as any, socket2 as any)
      const joinHandler2 = getHandler(socket2, 'join_room')
      joinHandler2!({ nickname: 'NotHost' })

      // Non-host tries to start
      const startHandler = getHandler(socket2, 'start_game')
      expect(startHandler).toBeDefined()
      startHandler!()

      // Should emit error to socket2
      const errorCalls = socket2.emit.mock.calls.filter(
        (c: any[]) => c[0] === 'system_message' && c[1]?.type === 'error',
      )
      expect(errorCalls.length).toBeGreaterThanOrEqual(1)
    })

    it('should emit error when starting with too few players', () => {
      registerHandlers(io as any, socket as any)

      // Join as host
      const joinHandler = getHandler(socket, 'join_room')
      joinHandler!({ nickname: 'Host' })

      // Try to start with just 1 player
      const startHandler = getHandler(socket, 'start_game')
      expect(startHandler).toBeDefined()
      startHandler!()

      // Should emit error about minimum players to the socket
      const errorCalls = socket.emit.mock.calls.filter(
        (c: any[]) => c[0] === 'system_message' && c[1]?.type === 'error',
      )
      expect(errorCalls.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('error callback 格式', () => {
    it('should emit system_message with error type when operation fails', () => {
      registerHandlers(io as any, socket as any)

      // Try murderer_select without joining or starting -- should fail
      const murdererSelectHandler = getHandler(socket, 'murderer_select')
      expect(murdererSelectHandler).toBeDefined()
      murdererSelectHandler!({ meansCardId: 'M001', clueCardId: 'C001' })

      // Should emit error
      const errorCalls = socket.emit.mock.calls.filter(
        (c: any[]) => c[0] === 'system_message' && c[1]?.type === 'error',
      )
      expect(errorCalls.length).toBeGreaterThanOrEqual(1)
      // Verify the format has content and type
      const errorMsg = errorCalls[0][1]
      expect(errorMsg).toHaveProperty('content')
      expect(errorMsg).toHaveProperty('type', 'error')
    })

    it('should emit system_message with string content for errors', () => {
      registerHandlers(io as any, socket as any)

      // Join room
      const joinHandler = getHandler(socket, 'join_room')
      joinHandler!({ nickname: 'Alice' })

      // Try to end discussion without being in discussion phase
      const endDiscussionHandler = getHandler(socket, 'end_discussion')
      expect(endDiscussionHandler).toBeDefined()
      endDiscussionHandler!()

      // Filter for error messages after join
      const errorCalls = socket.emit.mock.calls.filter(
        (c: any[]) => c[0] === 'system_message' && c[1]?.type === 'error',
      )
      expect(errorCalls.length).toBeGreaterThanOrEqual(1)
      expect(typeof errorCalls[0][1].content).toBe('string')
    })
  })

  describe('disconnect 事件', () => {
    it('should register disconnect event handler', () => {
      registerHandlers(io as any, socket as any)
      const handler = getHandler(socket, 'disconnect')
      expect(handler).toBeDefined()
    })

    it('should broadcast room_state after disconnect', () => {
      registerHandlers(io as any, socket as any)
      const joinHandler = getHandler(socket, 'join_room')
      joinHandler!({ nickname: 'Alice' })

      io.emit.mockClear()

      const disconnectHandler = getHandler(socket, 'disconnect')
      expect(disconnectHandler).toBeDefined()
      disconnectHandler!('transport close')

      const roomStateCalls = io.emit.mock.calls.filter((c: any[]) => c[0] === 'room_state')
      expect(roomStateCalls.length).toBeGreaterThanOrEqual(1)
    })
  })
})
