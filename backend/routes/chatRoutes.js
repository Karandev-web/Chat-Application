const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, chatController.createOrGetConversation);
router.post('/group', protect, chatController.createGroup);
router.put('/:id/group', protect, chatController.updateGroup);
router.put('/:id/group/add', protect, chatController.addGroupMember);
router.put('/:id/group/remove', protect, chatController.removeGroupMember);
router.put('/:id/group/leave', protect, chatController.leaveGroup);

router.get('/', protect, chatController.getConversations);
router.get('/:conversationId/messages', protect, chatController.getMessages);

module.exports = router;
