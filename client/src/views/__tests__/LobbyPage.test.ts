import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, ref, type App } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import LobbyPage from '../LobbyPage.vue'
import { useGameStore } from '../../stores/game'
import { useAuthStore } from '../../stores/auth'
import type { RoomState } from '../../types'

const socketApi = {
  connected: ref(true),
  connectionError: ref<string | null>(null),
  roomPending: ref<string | null>(null),
  roomError: ref<string | null>(null),
  sessionReplaced: ref(false),
  connect: vi.fn(),
  createRoom: vi.fn(),
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
  resumeRoom: vi.fn(),
  updateNickname: vi.fn(),
  startGame: vi.fn(),
}

vi.mock('../../composables/useSocket', () => ({ useSocket: () => socketApi }))

let app: App | undefined
let container: HTMLDivElement
let game: ReturnType<typeof useGameStore>

function roomState(overrides: Partial<RoomState> = {}): RoomState {
  return {
    code: 'ABC123',
    minPlayers: 4,
    maxPlayers: 10,
    status: 'waiting',
    hostId: 'p1',
    players: [{ id: 'p1', nickname: 'Alice', isHost: true, color: '#f00', connected: true }],
    ...overrides,
  }
}

async function mountPage(path = '/lobby') {
  const pinia = createPinia()
  setActivePinia(pinia)
  game = useGameStore()
  useAuthStore().token = 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InAxIn0.fake'
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/lobby', component: { template: '<div />' } },
      { path: '/game', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  app = createApp(LobbyPage)
  app.use(pinia)
  app.use(router)
  app.mount(container)
  await nextTick()
  return router
}

async function enterInput(selector: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(selector)!
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
}

beforeEach(() => {
  vi.clearAllMocks()
  socketApi.connected.value = true
  socketApi.connectionError.value = null
  socketApi.roomPending.value = null
  socketApi.roomError.value = null
  socketApi.sessionReplaced.value = false
  socketApi.createRoom.mockResolvedValue({ ok: false })
  socketApi.joinRoom.mockResolvedValue({ ok: false })
  localStorage.setItem('csi_pwa_dismissed', '1')
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(() => ({ matches: false })),
  })
  container = document.createElement('div')
  document.body.append(container)
})

afterEach(() => {
  app?.unmount()
  app = undefined
  container.remove()
})

describe('Lobby room entry', () => {
  it('saved nickname prefills the form without joining a global room', async () => {
    localStorage.setItem('csi_nickname', 'Alice')
    await mountPage()
    expect(container.querySelector<HTMLInputElement>('#nickname')!.value).toBe('Alice')
    expect(container.querySelector('form')).not.toBeNull()
    expect(socketApi.connect).toHaveBeenCalledOnce()
    expect(socketApi.joinRoom).not.toHaveBeenCalled()
    expect(socketApi.createRoom).not.toHaveBeenCalled()
  })

  it('shows pending and failed create requests without entering the lobby', async () => {
    await mountPage()
    await enterInput('#nickname', 'Alice')
    socketApi.createRoom.mockImplementation(async () => {
      socketApi.roomPending.value = 'create'
      return { ok: false }
    })
    container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true }))
    await nextTick()
    expect(socketApi.createRoom).toHaveBeenCalledWith('Alice')
    expect(container.querySelector('form')).not.toBeNull()
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true)
    socketApi.roomPending.value = null
    socketApi.roomError.value = '创建失败，请重试'
    await nextTick()
    expect(container.querySelector('[role="alert"]')!.textContent).toContain('创建失败')
    expect(container.querySelector('form')).not.toBeNull()
  })

  it('prefills an invitation code and normalizes typed codes', async () => {
    await mountPage('/lobby?room=abc123')
    expect(container.querySelector<HTMLInputElement>('#room-code')!.value).toBe('ABC123')
    await enterInput('#nickname', 'Alice')
    await enterInput('#room-code', 'zx98ab')
    container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true }))
    await nextTick()
    expect(socketApi.joinRoom).toHaveBeenCalledWith('Alice', 'ZX98AB')
  })

  it('requires six characters and disables entry while offline or restoring', async () => {
    await mountPage('/lobby?room=AB')
    await enterInput('#nickname', 'Alice')
    const submit = () => container.querySelector<HTMLButtonElement>('button[type="submit"]')!
    expect(submit().disabled).toBe(true)
    await enterInput('#room-code', 'ABC123')
    expect(submit().disabled).toBe(false)
    socketApi.connected.value = false
    await nextTick()
    expect(submit().disabled).toBe(true)
    socketApi.connected.value = true
    socketApi.roomPending.value = 'resume'
    await nextTick()
    expect(submit().disabled).toBe(true)
    expect(container.textContent).toContain('正在恢复上次的房间')
  })

  it('displays authoritative membership and blocks start while a seat is offline', async () => {
    await mountPage()
    const players = Array.from({ length: 4 }, (_, index) => ({
      id: `p${index + 1}`,
      nickname: `Player ${index + 1}`,
      color: '#f00',
      isHost: index === 0,
      connected: index !== 3,
    }))
    game.setRoomState(roomState({ players }))
    await nextTick()
    expect(container.querySelector('form')).toBeNull()
    expect(container.textContent).toContain('ABC123')
    expect(container.textContent).toContain('暂时离线')
    const startButton = container.querySelector<HTMLButtonElement>('footer button')!
    expect(startButton.disabled).toBe(true)
    game.setRoomState(
      roomState({ players: players.map((player) => ({ ...player, connected: true })) }),
    )
    await nextTick()
    expect(startButton.disabled).toBe(false)
    startButton.click()
    expect(socketApi.startGame).toHaveBeenCalledOnce()
  })

  it('copies an invitation with the actual code and join URL', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    await mountPage()
    game.setRoomState(roomState())
    await nextTick()
    container.querySelector<HTMLButtonElement>('[aria-label="复制邀请"]')!.click()
    await nextTick()
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/lobby?room=ABC123'))
    await nextTick()
    expect(container.textContent).toContain('邀请已复制')
  })

  it('leaves only on confirmed state and shows a replaced-session explanation', async () => {
    await mountPage()
    game.setRoomState(roomState())
    await nextTick()
    container.querySelector<HTMLButtonElement>('.room-controls__leave')!.click()
    expect(socketApi.leaveRoom).toHaveBeenCalledOnce()
    expect(container.querySelector('form')).toBeNull()
    game.clearRoom()
    socketApi.sessionReplaced.value = true
    socketApi.roomError.value = '已在其他窗口连接'
    await nextTick()
    expect(container.textContent).toContain('已在其他窗口连接')
    expect(container.querySelector('form')).toBeNull()
    expect(container.textContent).toContain('刷新页面重新连接')
  })

  it('only navigates into a game after both membership and game state are restored', async () => {
    const router = await mountPage()
    game.setRoomState(roomState({ status: 'playing' }))
    await nextTick()
    expect(router.currentRoute.value.path).toBe('/lobby')
    game.setPhase('night-murder')
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(router.currentRoute.value.path).toBe('/game')
  })
})
