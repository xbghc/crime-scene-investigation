/** Test-only entry point. Not imported by production src/index.ts.
 * Only randomness control: effect sequence selected by test host nickname.
 * Roles, hands, choices and all game transitions remain normal gameplay.
 * No control HTTP route, no role/hand override, no phase/score/winner shortcut.
 */
import express from 'express'
import { createServer } from 'node:http'
import { Server, type Socket } from 'socket.io'
import { verifyPassword, socketAuthMiddleware } from '../src/auth.js'
import { RoomManager } from '../src/rooms/RoomManager.js'
import { registerHandlers } from '../src/ws/handlers.js'
import { ALL_EFFECT_CARDS } from '../src/data/cards.js'
import type { GameEngine } from '../src/engine/GameEngine.js'

if (process.env.NODE_ENV !== 'test') throw new Error('Scenario server requires NODE_ENV=test')
if (!process.env.JWT_SECRET || !process.env.GAME_PASSWORD)
  throw new Error('Explicit test credentials required')

class ScenarioRooms extends RoomManager {
  private configured = new WeakSet<GameEngine>()
  override engineFor(socket: Socket): GameEngine | null {
    const engine = super.engineFor(socket)
    if (engine && !this.configured.has(engine)) {
      this.configured.add(engine)
      const originalStart = engine.startGame.bind(engine)
      engine.startGame = () => {
        originalStart()
        const hostName =
          engine.getRoomState().players.find((player) => player.isHost)?.nickname ?? ''
        const ids = hostName.match(/^E(?:01|03|05|08)/)?.[0]
        if (!ids) throw new Error('Effect fixture requires a supported effect prefix')
        const card = ALL_EFFECT_CARDS.find((candidate) => candidate.id === ids)!
        engine.setEffectDeckForTest([{ ...card }, { ...card }])
      }
    }
    return engine
  }
}

const app = express()
app.use(express.json())
const httpServer = createServer(app)
const io = new Server(httpServer)
const rooms = new ScenarioRooms(io)
io.use(socketAuthMiddleware)
io.on('connection', (socket) => registerHandlers(io, socket, rooms))
app.post('/api/verify-password', (req, res) => {
  const result = verifyPassword(req.body.password)
  res
    .status(result.valid ? 200 : 401)
    .json(
      result.valid
        ? { success: true, token: result.token }
        : { success: false, message: '密码错误' },
    )
})
app.get('/api/health', (_req, res) => res.json({ status: 'ok', fixture: 'interactive-effects' }))
httpServer.listen(8040, '127.0.0.1', () =>
  console.log('Interactive effect fixture ready on loopback:8040'),
)
