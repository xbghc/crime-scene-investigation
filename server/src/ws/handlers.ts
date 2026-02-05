import type { Server, Socket } from 'socket.io';

export function registerHandlers(io: Server, socket: Socket): void {
  console.log(`Client connected: ${socket.id} (user: ${socket.data.userId})`);

  socket.on('join_room', ({ nickname }: { nickname: string }) => {
    console.log(`${nickname} joining room`);
    socket.emit('room_state', {
      players: [],
      status: 'waiting',
      host: null,
    });
  });

  socket.on('disconnect', (reason: string) => {
    console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
  });
}
