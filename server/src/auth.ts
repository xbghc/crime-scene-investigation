import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import type { Socket } from 'socket.io';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const GAME_PASSWORD = process.env.GAME_PASSWORD || 'crime123';

export function verifyPassword(password: string): { valid: boolean; token?: string } {
  if (password !== GAME_PASSWORD) {
    return { valid: false };
  }
  const token = signToken({ id: randomUUID() });
  return { valid: true, token };
}

export function signToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): jwt.JwtPayload {
  return jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
}

export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void): void {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    return next(new Error('Authentication required'));
  }
  try {
    const decoded = verifyToken(token);
    socket.data.userId = decoded.id;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
}
