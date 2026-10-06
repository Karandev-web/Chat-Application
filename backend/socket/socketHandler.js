const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const jwt = require('jsonwebtoken');

// ============================================================================
// DISTRIBUTED CHAT: SOCKET CONNECTION & SESSION MANAGER
// ============================================================================
// Map tracking active users and their socket connections (multi-tab support)
// userId (string) -> Set<socketId>
const activeUserSockets = new Map();

// socketId -> { userId, connectedAt, lastActivity }
const socketMetadata = new Map();

module.exports = (io) => {
  // Authentication Middleware for WebSocket Handshake
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }
      
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();
    const serverId = process.env.CHAT_SERVER_ID || 'server-1';

    // 1. Connection Manager: Register socket connection
    if (!activeUserSockets.has(userId)) {
      activeUserSockets.set(userId, new Set());
    }
    const userSockets = activeUserSockets.get(userId);
    const isFirstConnection = userSockets.size === 0;
    userSockets.add(socket.id);

    socketMetadata.set(socket.id, {
      userId,
      connectedAt: new Date(),
      lastActivity: new Date()
    });

    console.log(`[${serverId}] Socket Connected: ${socket.user.username} (${socket.id}). Active sockets for user: ${userSockets.size}`);

    // If this is the user's first active tab/device, mark online in MongoDB & broadcast
    if (isFirstConnection) {
      await User.findByIdAndUpdate(userId, { isOnline: true });
      io.emit('userStatusChange', { userId, isOnline: true });
    }

    // Join personal room for private messaging
    socket.join(userId);

    // Join rooms for all conversations the user is a participant of
    try {
      const conversations = await Conversation.find({ participants: socket.user._id });
      conversations.forEach(c => socket.join(c._id.toString()));
    } catch (err) {
      console.error('Error joining conversation rooms on connect:', err);
    }

    // Confirm connection & sync server identity to client
    socket.emit('connection_established', {
      serverId,
      socketId: socket.id,
      timestamp: new Date()
    });

    // Helper to update socket activity
    const updateActivity = () => {
      const meta = socketMetadata.get(socket.id);
      if (meta) meta.lastActivity = new Date();
    };

    // ========================================================================
    // DISTRIBUTED MESSAGE FLOW: SENDING & RELIABILITY
    // ========================================================================
    /*
     * Direct Chat Flow:
     *   Client A (tempId/clientMessageId)
     *      ↓ Socket.IO ('send_message')
     *   Node Server (Validation + Idempotency check)
     *      ↓
     *   MongoDB (Persistent Storage)
     *      ↓
     *   Socket.IO (Personal room 'receiverId')
     *      ↓
     *   Client B (Receives message, emits 'mark_message_delivered')
     *      ↓
     *   Node Server (confirms 'message_sent' back to Client A with tempId)
     *
     * Group Chat Flow:
     *   Client A
     *      ↓ Socket.IO ('send_message')
     *   Node Server (Membership authorization)
     *      ↓
     *   MongoDB (Persistent Storage + lastMessage update)
     *      ↓
     *   Socket.IO Room ('conversationId')
     *   ↙   ↓   ↘
     *   B   C   D (All authorized group participants)
     */
    socket.on('send_message', async (data) => {
      updateActivity();
      try {
        const { conversationId, receiverId, text, tempId, clientMessageId } = data;
        const senderId = socket.user._id;
        const idempotencyKey = clientMessageId || tempId;

        if (!conversationId || !text || !text.trim()) {
          return socket.emit('error', { message: 'Invalid conversation or empty message' });
        }

        // Verify conversation membership
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.some(p => p.toString() === senderId.toString())) {
          return socket.emit('error', { message: 'Unauthorized: Not a conversation participant' });
        }

        // Idempotency: Check if message with same clientMessageId already exists
        if (idempotencyKey) {
          const existingMessage = await Message.findOne({
            conversationId,
            clientMessageId: idempotencyKey
          }).populate('senderId', '-password').populate('receiverId', '-password');

          if (existingMessage) {
            console.log(`Duplicate message prevented via idempotency key: ${idempotencyKey}`);
            return socket.emit('message_sent', {
              ...existingMessage.toJSON(),
              tempId,
              clientMessageId: idempotencyKey
            });
          }
        }

        const isGroup = conversation.type === 'group';

        // Persist message in MongoDB
        const message = new Message({
          conversationId,
          senderId,
          receiverId: isGroup ? undefined : receiverId,
          text: text.trim(),
          clientMessageId: idempotencyKey,
          status: 'sent',
          deliveredTo: isGroup ? [senderId] : [],
          readBy: isGroup ? [senderId] : []
        });

        await message.save();

        // Update conversation's lastMessage reference & updatedAt timestamp
        conversation.lastMessage = message._id;
        await conversation.save();

        const populatedMessage = await Message.findById(message._id)
          .populate('senderId', '-password')
          .populate('receiverId', '-password');

        if (isGroup) {
          // Broadcast to all other participants in the group room
          socket.to(conversationId.toString()).emit('receive_message', populatedMessage);
          socket.to(conversationId.toString()).emit('conversation_updated', {
            conversationId,
            lastMessage: populatedMessage
          });
        } else {
          // Direct message: deliver to receiver's private room
          socket.to(receiverId.toString()).emit('receive_message', populatedMessage);
          socket.to(receiverId.toString()).emit('conversation_updated', {
            conversationId,
            lastMessage: populatedMessage
          });
        }

        // Acknowledge back to sender with confirmed saved message & client tempId
        socket.emit('message_sent', {
          ...populatedMessage.toJSON(),
          tempId,
          clientMessageId: idempotencyKey
        });

      } catch (err) {
        console.error('Socket send_message error:', err);
        socket.emit('message_send_failed', {
          tempId: data?.tempId,
          clientMessageId: data?.clientMessageId || data?.tempId,
          error: 'Failed to deliver message to server'
        });
      }
    });

    // ========================================================================
    // TYPING INDICATORS
    // ========================================================================
    socket.on('typing_start', (data) => {
      updateActivity();
      const { receiverId, conversationId, isGroup } = data;
      if (isGroup) {
        socket.to(conversationId.toString()).emit('typing_start', {
          senderId: socket.user._id,
          conversationId,
          isGroup: true,
          senderName: socket.user.fullName
        });
      } else if (receiverId) {
        socket.to(receiverId.toString()).emit('typing_start', {
          senderId: socket.user._id,
          conversationId
        });
      }
    });

    socket.on('typing_stop', (data) => {
      updateActivity();
      const { receiverId, conversationId, isGroup } = data;
      if (isGroup) {
        socket.to(conversationId.toString()).emit('typing_stop', {
          senderId: socket.user._id,
          conversationId,
          isGroup: true
        });
      } else if (receiverId) {
        socket.to(receiverId.toString()).emit('typing_stop', {
          senderId: socket.user._id,
          conversationId
        });
      }
    });

    // ========================================================================
    // ROOM SUBSCRIPTIONS
    // ========================================================================
    socket.on('join_group', (data) => {
      updateActivity();
      if (data?.conversationId) {
        socket.join(data.conversationId.toString());
      }
    });

    socket.on('leave_group', (data) => {
      updateActivity();
      if (data?.conversationId) {
        socket.leave(data.conversationId.toString());
      }
    });

    // ========================================================================
    // DELIVERY & READ RECEIPTS
    // ========================================================================
    socket.on('mark_message_delivered', async (data) => {
      updateActivity();
      try {
        const { messageId, senderId } = data;
        const msg = await Message.findById(messageId).populate('conversationId');
        if (!msg) return;

        if (msg.conversationId.type === 'direct' && msg.status === 'sent') {
          msg.status = 'delivered';
          msg.deliveredAt = new Date();
          await msg.save();
          if (senderId) {
            socket.to(senderId.toString()).emit('message_status_updated', {
              messageId: msg._id,
              status: 'delivered',
              deliveredAt: msg.deliveredAt
            });
          }
        } else if (msg.conversationId.type === 'group' && !msg.deliveredTo.includes(socket.user._id)) {
          msg.deliveredTo.push(socket.user._id);
          await msg.save();
        }
      } catch (err) {
        console.error('Error marking delivered:', err);
      }
    });

    socket.on('mark_message_read', async (data) => {
      updateActivity();
      try {
        const { messageId, senderId, conversationId } = data;
        const msg = await Message.findById(messageId).populate('conversationId');
        if (!msg) return;

        if (msg.conversationId.type === 'direct' && (msg.status === 'sent' || msg.status === 'delivered')) {
          msg.status = 'read';
          msg.readAt = new Date();
          await msg.save();
          if (senderId) {
            socket.to(senderId.toString()).emit('message_status_updated', {
              messageId: msg._id,
              status: 'read',
              readAt: msg.readAt
            });
          }
        } else if (msg.conversationId.type === 'group' && !msg.readBy.includes(socket.user._id)) {
          msg.readBy.push(socket.user._id);
          await msg.save();
        }
      } catch (err) {
        console.error('Error marking read:', err);
      }
    });

    // ========================================================================
    // DISCONNECTION & MULTI-TAB HANDLING
    // ========================================================================
    socket.on('disconnect', async (reason) => {
      const userSockets = activeUserSockets.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          activeUserSockets.delete(userId);
          // Only mark offline if all client tabs/connections have closed
          const lastSeen = new Date();
          await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastSeen
          });

          // Broadcast to all other connected clients
          io.emit('userStatusChange', {
            userId,
            isOnline: false,
            lastSeen
          });
          console.log(`[${serverId}] User Offline: ${socket.user.username}. All sockets closed.`);
        } else {
          console.log(`[${serverId}] Socket Disconnected: ${socket.user.username} (${socket.id}). Remaining active sockets: ${userSockets.size}`);
        }
      }
      socketMetadata.delete(socket.id);
    });
  });

  // Expose connection metrics for health check endpoint
  return {
    getActiveUsersCount: () => activeUserSockets.size,
    getActiveSocketsCount: () => socketMetadata.size
  };
};
