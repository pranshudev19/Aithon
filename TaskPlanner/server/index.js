const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const subtaskRoutes = require('./routes/subtasks');
const meRoutes = require('./routes/me');
const { aithonProxy } = require('./routes/proxy');

const app = express();
const server = http.createServer(app);

const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    credentials: true,
  },
});

app.set('io', io);

app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
  })
);
app.use(cookieParser());

// ─── Aithon module proxy (FastAPI on port 8000) ───────────────────────────
// All /api/aithon/* requests are forwarded to FastAPI.
// The proxy middleware must be mounted BEFORE express.json to avoid body-parser interference.
app.use('/api/aithon', aithonProxy);

app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'aithon-unified-gateway' });
});

// ─── Task Planner routes (Node.js / PostgreSQL) ───────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/subtasks', subtaskRoutes);
app.use('/api/me', meRoutes);

// ─── Socket.IO auth middleware ────────────────────────────────────────────
io.use((socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie || '';
    const tokenCookie = cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('token='));

    if (!tokenCookie) {
      return next(new Error('Unauthorized socket: missing token'));
    }

    const token = decodeURIComponent(tokenCookie.split('=')[1]);
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'taskplanner-secret-key');
    socket.user = payload;
    next();
  } catch (error) {
    next(new Error('Unauthorized socket: invalid token'));
  }
});

io.on('connection', (socket) => {
  const room = `user:${socket.user.id}`;
  socket.join(room);
  socket.emit('connected', { userId: socket.user.id, role: socket.user.role });
});

// ─── Global error handler ─────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = Number(process.env.PORT || 4000);
server.listen(port, () => {
  console.log(`✅ Aithon Unified Gateway listening on port ${port}`);
  console.log(`   Task Planner API : http://localhost:${port}/api`);
  console.log(`   Aithon Proxy     : http://localhost:${port}/api/aithon → http://localhost:8000`);
});
