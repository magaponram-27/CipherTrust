require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const Message = require('./models/Message');
const User = require('./models/User');
const normalizeMongoUri = require('./lib/mongoUri');

if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
  throw new Error('MONGO_URI and JWT_SECRET must be set');
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 10 * 1024 * 1024
});
const onlineUsers = new Map();

async function usersHaveBlockedEachOther(first, second) {
  return Boolean(await User.exists({
    $or: [
      { username: first, blockedUsers: second },
      { username: second, blockedUsers: first }
    ]
  }));
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.get('/', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/messages', require('./routes/messages'));
app.use((error, _req, res, _next) => {
  console.error('Request failed:', error.message);
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request is too large' });
  return res.status(500).json({ error: 'Internal server error' });
});

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    const claims = jwt.verify(token, process.env.JWT_SECRET);
    if (!claims.username) return next(new Error('Invalid token'));
    socket.data.username = claims.username;
    return next();
  } catch {
    return next(new Error('Invalid or expired token'));
  }
});

io.on('connection', (socket) => {
  const username = socket.data.username;
  socket.on('register', (requestedUsername) => {
    if (typeof requestedUsername !== 'string' || requestedUsername.toLowerCase() !== username) {
      socket.emit('message-error', { error: 'Socket identity does not match the session' });
      return socket.disconnect(true);
    }
    let userSockets = onlineUsers.get(username);
    const isFirstConnection = !userSockets;
    if (!userSockets) {
      userSockets = new Set();
      onlineUsers.set(username, userSockets);
    }
    userSockets.add(socket.id);
    socket.emit('online-users', [...onlineUsers.keys()]);
    if (isFirstConnection) socket.broadcast.emit('user-online', username);
  });

  socket.on('send-message', async (payload) => {
    try {
      if (!payload || typeof payload.to !== 'string' ||
          typeof payload.ciphertext !== 'string' || !payload.ciphertext ||
          typeof payload.iv !== 'string' || !payload.iv ||
          payload.ciphertext.length > 9_500_000 || payload.iv.length > 64) {
        socket.emit('message-error', { error: 'Invalid or oversized encrypted message' });
        return;
      }
      const recipient = payload.to.trim().toLowerCase();
      if (await usersHaveBlockedEachOther(username, recipient)) {
        socket.emit('message-error', { error: 'This conversation is unavailable.' });
        return;
      }
      const type = ['text', 'image', 'voice', 'sticker'].includes(payload.type) ? payload.type : 'text';
      const aiConfidence = Number.isFinite(payload.aiConfidence)
        ? Math.min(1, Math.max(0, payload.aiConfidence))
        : null;
      const message = await Message.create({
        from: username,
        to: recipient,
        ciphertext: payload.ciphertext,
        iv: payload.iv,
        type,
        aiVerdict: typeof payload.aiVerdict === 'string' ? payload.aiVerdict.slice(0, 40) : null,
        aiConfidence,
        timestamp: Date.now()
      });
      const response = message.toObject();
      const clientId = typeof payload.clientId === 'string' ? payload.clientId.slice(0, 64) : null;
      for (const socketId of onlineUsers.get(recipient) || []) {
        io.to(socketId).emit('new-message', response);
      }
      socket.emit('message-sent', { ...response, clientId });
    } catch (error) {
      console.error('Could not relay encrypted message:', error.message);
      socket.emit('message-error', { error: 'Message could not be delivered' });
    }
  });

  socket.on('unsend-message', async (payload, acknowledge) => {
    const respond = typeof acknowledge === 'function' ? acknowledge : () => {};
    try {
      if (typeof payload?.messageId !== 'string' || !mongoose.isValidObjectId(payload.messageId)) {
        return respond({ ok: false, error: 'Invalid message.' });
      }
      const message = await Message.findOneAndDelete({
        _id: payload.messageId,
        from: username
      }).select('_id from to').lean();
      if (!message) return respond({ ok: false, error: 'This message could not be unsent.' });

      for (const socketId of [
        ...(onlineUsers.get(message.from) || []),
        ...(onlineUsers.get(message.to) || [])
      ]) {
        io.to(socketId).emit('message-deleted', { _id: message._id });
      }
      return respond({ ok: true });
    } catch (error) {
      console.error('Could not unsend message:', error.message);
      return respond({ ok: false, error: 'Message could not be unsent.' });
    }
  });

  socket.on('typing', async (payload) => {
    if (!payload || typeof payload.to !== 'string') return;
    try {
      const recipient = payload.to.toLowerCase();
      if (await usersHaveBlockedEachOther(username, recipient)) return;
      for (const socketId of onlineUsers.get(recipient) || []) {
        io.to(socketId).emit('typing', { from: username });
      }
    } catch (error) {
      console.error('Could not relay typing indicator:', error.message);
      socket.emit('message-error', { error: 'Typing indicator could not be delivered.' });
    }
  });

  socket.on('disconnect', () => {
    const userSockets = onlineUsers.get(username);
    if (!userSockets) return;
    userSockets.delete(socket.id);
    if (userSockets.size === 0) {
      onlineUsers.delete(username);
      socket.broadcast.emit('user-offline', username);
    }
  });
});

async function start() {
  await mongoose.connect(normalizeMongoUri(process.env.MONGO_URI));
  const port = Number(process.env.PORT) || 5000;
  server.listen(port, () => console.log(`CipherTrust API listening on port ${port}`));
}

start().catch((error) => {
  console.error('Could not start server:', error.message);
  process.exitCode = 1;
});
