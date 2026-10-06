require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const chatRoutes = require('./routes/chatRoutes');
const socketHandler = require('./socket/socketHandler');

const app = express();
const server = http.createServer(app);

// Server Instance Identification
const CHAT_SERVER_ID = process.env.CHAT_SERVER_ID || 'server-1';

// 1. Structured Logging (excluding sensitive data)
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// 2. CORS configuration
app.use(cors({
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());

// 3. Rate Limiting for Distributed API Protection
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per 15 min window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // 50 auth requests per 15 min window
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts, please try again later.' }
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// 4. Socket.IO Setup
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 20000,
  pingInterval: 25000
});

/*
 * ============================================================================
 * HORIZONTAL SCALING NOTE (FOR COLLEGE PRESENTATION / VIVA):
 * ============================================================================
 * Currently this application operates as a single Node.js instance identified by CHAT_SERVER_ID.
 * To scale horizontally across multiple servers (e.g. Server 1, Server 2, Server 3):
 * 1. Deploy a Redis pub/sub broker.
 * 2. Install '@socket.io/redis-adapter' and 'redis'.
 * 3. Mount the adapter:
 *      const { createAdapter } = require('@socket.io/redis-adapter');
 *      const { createClient } = require('redis');
 *      const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
 *      const subClient = pubClient.duplicate();
 *      io.adapter(createAdapter(pubClient, subClient));
 * This enables all server instances to broadcast real-time events across any client connected
 * to any server node.
 */
app.set('io', io);

// Mount socket session & connection manager
const connectionStats = socketHandler(io);

// 5. System Health Check Endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    status: 'ok',
    server: CHAT_SERVER_ID,
    database: dbStatus,
    uptime: `${Math.floor(process.uptime())}s`,
    activeUsers: connectionStats.getActiveUsersCount(),
    activeSockets: connectionStats.getActiveSocketsCount(),
    timestamp: new Date().toISOString()
  });
});

// 6. Application API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', chatRoutes);

// 7. 404 Route Handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `API Route ${req.originalUrl} not found`
  });
});

// 8. Centralized Express Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(`[${CHAT_SERVER_ID}] Error:`, err.message);
  
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// 9. MongoDB Database Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log(`[${CHAT_SERVER_ID}] Connected to MongoDB successfully.`))
  .catch((err) => console.error(`[${CHAT_SERVER_ID}] MongoDB connection error:`, err));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`[${CHAT_SERVER_ID}] ChatSphere Server listening on port ${PORT}`);
});

// 10. Graceful Shutdown Handling (SIGINT, SIGTERM)
const handleGracefulShutdown = (signal) => {
  console.log(`\n[${CHAT_SERVER_ID}] Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new HTTP connections
  server.close(async () => {
    console.log(`[${CHAT_SERVER_ID}] HTTP server closed.`);

    // Close all open Socket.IO connections
    try {
      io.close(() => {
        console.log(`[${CHAT_SERVER_ID}] All Socket.IO connections closed.`);
      });
    } catch (e) {
      console.error(`[${CHAT_SERVER_ID}] Error closing sockets:`, e);
    }

    // Close MongoDB connection
    try {
      await mongoose.connection.close(false);
      console.log(`[${CHAT_SERVER_ID}] MongoDB connection cleanly terminated.`);
    } catch (e) {
      console.error(`[${CHAT_SERVER_ID}] Error closing MongoDB connection:`, e);
    }

    console.log(`[${CHAT_SERVER_ID}] Graceful shutdown completed. Exiting.`);
    process.exit(0);
  });

  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    console.error(`[${CHAT_SERVER_ID}] Shutdown timed out. Forcing process exit.`);
    process.exit(1);
  }, 10000);
};

process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
