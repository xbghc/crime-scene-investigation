import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { verifyPassword, socketAuthMiddleware } from './auth.js';
import { registerHandlers } from './ws/handlers.js';

const app = express();
const httpServer = createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:8030', 'http://localhost:4173'],
    methods: ['GET', 'POST'],
  },
});

io.use(socketAuthMiddleware);

app.post('/api/verify-password', (req, res) => {
  const { password } = req.body as { password: string };
  const result = verifyPassword(password);
  if (result.valid) {
    res.json({ success: true, token: result.token });
  } else {
    res.status(401).json({ success: false, message: '密码错误' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

io.on('connection', (socket) => {
  registerHandlers(io, socket);
});

const PORT = process.env.PORT || 8040;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
