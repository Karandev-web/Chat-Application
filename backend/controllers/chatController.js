const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// ============================================================================
// DIRECT CONVERSATIONS
// ============================================================================
exports.createOrGetConversation = async (req, res, next) => {
  try {
    const { receiverId } = req.body;
    const senderId = req.user._id;

    if (!receiverId || !isValidObjectId(receiverId)) {
      return res.status(400).json({ success: false, message: 'Valid Receiver ID is required' });
    }
    if (senderId.toString() === receiverId) {
      return res.status(400).json({ success: false, message: 'Cannot start a conversation with yourself' });
    }

    // Check if direct conversation already exists between these 2 users
    let conversation = await Conversation.findOne({
      type: 'direct',
      participants: { $all: [senderId, receiverId] },
      $expr: { $eq: [{ $size: "$participants" }, 2] }
    }).populate('participants', '-password');

    if (!conversation) {
      conversation = new Conversation({
        type: 'direct',
        participants: [senderId, receiverId]
      });
      await conversation.save();
      conversation = await conversation.populate('participants', '-password');
    }

    res.status(200).json({ success: true, data: conversation });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// GROUP CONVERSATIONS
// ============================================================================
exports.createGroup = async (req, res, next) => {
  try {
    const { name, description, avatar, participants } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Group name is required' });
    }
    if (!participants || !Array.isArray(participants) || participants.length < 1) {
      return res.status(400).json({ success: false, message: 'At least 1 other participant is required' });
    }

    // Validate participant IDs
    const validParticipants = participants.filter(p => isValidObjectId(p));
    const memberIds = [...new Set([...validParticipants, req.user._id.toString()])];

    if (memberIds.length < 2) {
      return res.status(400).json({ success: false, message: 'Group must have at least 2 members total' });
    }

    let conversation = new Conversation({
      type: 'group',
      name: name.trim(),
      description: description ? description.trim() : '',
      avatar: avatar || '',
      participants: memberIds,
      admins: [req.user._id],
      createdBy: req.user._id
    });
    
    await conversation.save();
    conversation = await conversation.populate('participants', '-password');

    // Notify all participants in real time via Socket.IO
    const io = req.app.get('io');
    if (io) {
      memberIds.forEach(id => {
        io.to(id.toString()).emit('group_added', conversation);
      });
    }

    res.status(201).json({ success: true, data: conversation });
  } catch (error) {
    next(error);
  }
};

exports.updateGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid Group ID' });
    }

    const { name, description, avatar } = req.body;
    const group = await Conversation.findOne({ _id: id, type: 'group' });
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    
    if (!group.admins.some(a => a.toString() === req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    if (name && name.trim()) group.name = name.trim();
    if (description !== undefined) group.description = description.trim();
    if (avatar !== undefined) group.avatar = avatar;

    await group.save();
    const populated = await group.populate('participants', '-password');

    const io = req.app.get('io');
    if (io) {
      io.to(group._id.toString()).emit('group_updated', populated);
    }

    res.json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

exports.addGroupMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!isValidObjectId(id) || !isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID provided' });
    }

    const group = await Conversation.findOne({ _id: id, type: 'group' });
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    if (!group.admins.some(a => a.toString() === req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    if (!group.participants.includes(userId)) {
      group.participants.push(userId);
      await group.save();
    }
    const populated = await group.populate('participants', '-password');

    const io = req.app.get('io');
    if (io) {
      io.to(userId.toString()).emit('group_added', populated);
      io.to(group._id.toString()).emit('group_updated', populated);
    }

    res.json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

exports.removeGroupMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!isValidObjectId(id) || !isValidObjectId(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid ID provided' });
    }

    const group = await Conversation.findOne({ _id: id, type: 'group' });
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    if (!group.admins.some(a => a.toString() === req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    if (userId === group.createdBy.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot remove group creator' });
    }

    group.participants = group.participants.filter(p => p.toString() !== userId);
    group.admins = group.admins.filter(a => a.toString() !== userId);
    await group.save();

    const populated = await group.populate('participants', '-password');

    const io = req.app.get('io');
    if (io) {
      io.to(group._id.toString()).emit('group_updated', populated);
    }

    res.json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

exports.leaveGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID' });
    }

    const group = await Conversation.findOne({ _id: id, type: 'group' });
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    
    group.participants = group.participants.filter(p => p.toString() !== req.user._id.toString());
    group.admins = group.admins.filter(a => a.toString() !== req.user._id.toString());
    
    // Auto assign new admin if no admin left but participants remain
    if (group.admins.length === 0 && group.participants.length > 0) {
      group.admins.push(group.participants[0]);
    }
    
    await group.save();
    res.json({ success: true, message: 'Left group successfully' });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// CONVERSATIONS LIST
// ============================================================================
exports.getConversations = async (req, res, next) => {
  try {
    const conversations = await Conversation.find({ participants: req.user._id })
      .populate('participants', '-password')
      .populate('admins', '-password')
      .populate({ path: 'lastMessage', populate: { path: 'senderId', select: 'fullName username' } })
      .sort({ updatedAt: -1 });

    res.status(200).json({ success: true, data: conversations });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// MESSAGE RETRIEVAL, PAGINATION & OFFLINE RECONNECTION SYNC
// ============================================================================
/*
 * GET /api/conversations/:conversationId/messages
 * Query parameters:
 *  - page: page number (default 1)
 *  - limit: number of messages per page (default 30)
 *  - after: timestamp or messageId to fetch only new/missed messages since disconnection
 */
exports.getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    if (!isValidObjectId(conversationId)) {
      return res.status(400).json({ success: false, message: 'Invalid conversation ID' });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) return res.status(404).json({ success: false, message: 'Conversation not found' });
    if (!conversation.participants.some(p => p.toString() === req.user._id.toString())) {
      return res.status(403).json({ success: false, message: 'Not authorized to view messages in this conversation' });
    }

    const { after } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));

    let query = { conversationId };

    // Offline / Reconnection Synchronization: only fetch messages newer than 'after'
    if (after) {
      if (isValidObjectId(after)) {
        const refMessage = await Message.findById(after);
        if (refMessage) {
          query.createdAt = { $gt: refMessage.createdAt };
        }
      } else {
        const dateAfter = new Date(after);
        if (!isNaN(dateAfter.getTime())) {
          query.createdAt = { $gt: dateAfter };
        }
      }
    }

    const totalMessages = await Message.countDocuments(query);

    // Fetch messages:
    // If 'after' is provided, fetch all new missed messages chronologically
    // Otherwise, fetch paginated chunk from newest backwards, then sort ascending
    let messages;
    if (after) {
      messages = await Message.find(query)
        .populate('senderId', '-password')
        .populate('receiverId', '-password')
        .sort({ createdAt: 1 });
    } else {
      const skip = (page - 1) * limit;
      const rawMessages = await Message.find(query)
        .populate('senderId', '-password')
        .populate('receiverId', '-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      messages = rawMessages.reverse();
    }

    const hasMore = !after && (page * limit < totalMessages);

    // Mark messages as read by current user
    if (conversation.type === 'direct') {
      const unreadDirect = messages.filter(
        m => m.receiverId && m.receiverId._id.toString() === req.user._id.toString() && m.status !== 'read'
      );
      if (unreadDirect.length > 0) {
        await Message.updateMany(
          { _id: { $in: unreadDirect.map(m => m._id) } },
          { $set: { status: 'read', readAt: new Date() } }
        );
        unreadDirect.forEach(m => m.status = 'read');
      }
    } else {
      const unreadGroup = messages.filter(
        m => m.senderId && m.senderId._id.toString() !== req.user._id.toString() && !m.readBy.includes(req.user._id)
      );
      if (unreadGroup.length > 0) {
        await Message.updateMany(
          { _id: { $in: unreadGroup.map(m => m._id) } },
          { $addToSet: { readBy: req.user._id } }
        );
        unreadGroup.forEach(m => m.readBy.push(req.user._id));
      }
    }

    res.status(200).json({
      success: true,
      messages,
      total: totalMessages,
      page,
      limit,
      hasMore
    });
  } catch (error) {
    next(error);
  }
};
