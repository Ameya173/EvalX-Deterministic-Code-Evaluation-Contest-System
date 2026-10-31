import { Server } from 'socket.io';
import { subscribeEvents } from '@judgebox/shared';
import { verifyAccess } from './middleware/auth.js';
import { invalidateScoreboard } from './routes/contests.js';
import { config } from './config.js';

/** Socket.io gateway: users get their own submission updates; contest viewers get scoreboard pings. */
export function attachRealtime(httpServer) {
  const io = new Server(httpServer, { cors: { origin: config.clientOrigin, credentials: true } });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      socket.data.user = token ? verifyAccess(token) : null;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    if (socket.data.user) socket.join(`user:${socket.data.user.id}`);
    socket.on('contest:watch', (id) => {
      if (typeof id === 'string' && /^[a-f0-9]{24}$/.test(id)) socket.join(`contest:${id}`);
    });
    socket.on('contest:unwatch', (id) => socket.leave(`contest:${id}`));
  });

  // Workers publish events on Redis; the API fans them out to the right rooms.
  const sub = subscribeEvents(config.redisUrl, (evt) => {
    if (evt.type === 'submission' || evt.type === 'analysis') {
      io.to(`user:${evt.userId}`).emit('submission:update', evt);
    } else if (evt.type === 'scoreboard') {
      invalidateScoreboard(evt.contestId);
      io.to(`contest:${evt.contestId}`).emit('scoreboard:update', { contestId: evt.contestId });
    }
  });
  return { io, sub };
}
