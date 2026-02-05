import { ref } from 'vue'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../stores/auth'

let socket: Socket | null = null

const connected = ref(false)
const connectionError = ref<string | null>(null)

export function useSocket() {
  function connect() {
    if (socket?.connected) return

    const authStore = useAuthStore()
    socket = io({
      auth: { token: authStore.token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    socket.on('connect', () => {
      connected.value = true
      connectionError.value = null
    })

    socket.on('disconnect', () => {
      connected.value = false
    })

    socket.on('connect_error', (err) => {
      connectionError.value = err.message
    })
  }

  function disconnect() {
    socket?.disconnect()
    socket = null
    connected.value = false
  }

  function joinRoom(nickname: string) {
    socket?.emit('join_room', { nickname })
  }

  function getSocket(): Socket | null {
    return socket
  }

  return {
    connected,
    connectionError,
    connect,
    disconnect,
    joinRoom,
    getSocket,
  }
}
