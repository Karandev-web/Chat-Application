import React, { useState, useEffect, useRef, useContext } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { 
  ArrowLeft, Send, Users, Info, UserPlus, LogOut, 
  Check, CheckCheck, Clock, AlertCircle, RefreshCw, X, MessageSquare, Search, Sparkles
} from 'lucide-react';

const ChatArea = ({ conversation, onBack, connectionStatus }) => {
  const { user } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState({}); // { senderId: senderName }
  const [showInfo, setShowInfo] = useState(false);

  // Pagination states
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Notification Toast state
  const [toastMessage, setToastMessage] = useState('');

  // Modals for group management
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [addMemberQuery, setAddMemberQuery] = useState('');
  const [addMemberResults, setAddMemberResults] = useState([]);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });

  const pendingTimeoutsRef = useRef({});
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const isGroup = conversation?.type === 'group';
  const otherUser = isGroup ? null : conversation?.participants?.find(p => p._id !== user._id);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3500);
  };

  // 1. Initial message load
  useEffect(() => {
    if (conversation) {
      setMessages([]);
      setPage(1);
      setHasMore(false);
      setShowInfo(false);
      setTypingUsers({});
      fetchInitialMessages();
    }
  }, [conversation?._id]);

  // 2. Offline / Reconnection Sync
  useEffect(() => {
    if (socket && connectionStatus === 'connected' && conversation) {
      syncMissedMessages();
    }
  }, [connectionStatus]);

  // 3. Socket event handlers
  useEffect(() => {
    if (!socket || !conversation) return;

    const handleReceiveMessage = (msg) => {
      if (msg.conversationId === conversation._id || msg.conversationId?._id === conversation._id) {
        setMessages(prev => {
          if (prev.some(m => m._id === msg._id || (msg.clientMessageId && m.clientMessageId === msg.clientMessageId))) {
            return prev;
          }
          return [...prev, msg];
        });

        socket.emit('mark_message_read', {
          messageId: msg._id,
          conversationId: conversation._id,
          senderId: msg.senderId?._id || msg.senderId
        });
      }
    };

    const handleMessageSent = (confirmedMsg) => {
      const matchId = confirmedMsg.tempId || confirmedMsg.clientMessageId || confirmedMsg._id;
      
      if (pendingTimeoutsRef.current[matchId]) {
        clearTimeout(pendingTimeoutsRef.current[matchId]);
        delete pendingTimeoutsRef.current[matchId];
      }

      setMessages(prev => {
        const index = prev.findIndex(m => 
          m._id === matchId || 
          m.clientMessageId === matchId || 
          m._id === confirmedMsg._id
        );
        if (index === -1) return [...prev, confirmedMsg];
        const updated = [...prev];
        updated[index] = { ...confirmedMsg, status: 'sent' };
        return updated;
      });
    };

    const handleStatusUpdated = ({ messageId, status, deliveredAt, readAt }) => {
      setMessages(prev => prev.map(m => {
        if (m._id === messageId) {
          return { ...m, status, deliveredAt, readAt };
        }
        return m;
      }));
    };

    const handleTypingStart = (data) => {
      if (data.conversationId === conversation._id) {
        if (data.isGroup) {
          setTypingUsers(prev => ({ ...prev, [data.senderId]: data.senderName }));
        } else if (data.senderId === otherUser?._id) {
          setTypingUsers({ [data.senderId]: 'Typing...' });
        }
      }
    };

    const handleTypingStop = (data) => {
      if (data.conversationId === conversation._id) {
        setTypingUsers(prev => {
          const updated = { ...prev };
          delete updated[data.senderId];
          return updated;
        });
      }
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('message_sent', handleMessageSent);
    socket.on('message_status_updated', handleStatusUpdated);
    socket.on('typing_start', handleTypingStart);
    socket.on('typing_stop', handleTypingStop);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('message_sent', handleMessageSent);
      socket.off('message_status_updated', handleStatusUpdated);
      socket.off('typing_start', handleTypingStart);
      socket.off('typing_stop', handleTypingStop);
    };
  }, [socket, conversation, otherUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, Object.keys(typingUsers).length]);

  const fetchInitialMessages = async () => {
    try {
      const res = await api.get(`/conversations/${conversation._id}/messages?page=1&limit=30`);
      const payload = res.data;
      const list = payload?.messages || (Array.isArray(payload) ? payload : []);
      setMessages(list);
      setHasMore(payload?.hasMore || false);
      setPage(1);
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  };

  const syncMissedMessages = async () => {
    if (!messages.length) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg?._id) return;

    try {
      const res = await api.get(`/conversations/${conversation._id}/messages?after=${lastMsg._id}`);
      const payload = res.data;
      const missed = payload?.messages || (Array.isArray(payload) ? payload : []);
      if (missed.length > 0) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m._id));
          const fresh = missed.filter(m => !existingIds.has(m._id));
          return [...prev, ...fresh];
        });
      }
    } catch (err) {
      console.error('Error syncing missed messages:', err);
    }
  };

  const handleLoadEarlier = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;

    try {
      const res = await api.get(`/conversations/${conversation._id}/messages?page=${nextPage}&limit=30`);
      const payload = res.data;
      const older = payload?.messages || (Array.isArray(payload) ? payload : []);
      if (older.length > 0) {
        setMessages(prev => [...older, ...prev]);
        setPage(nextPage);
        setHasMore(payload?.hasMore || false);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error fetching older messages:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleTypingChange = (e) => {
    setNewMessage(e.target.value);
    if (!socket || !conversation) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit('typing_start', {
        receiverId: otherUser?._id,
        conversationId: conversation._id,
        isGroup
      });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('typing_stop', {
        receiverId: otherUser?._id,
        conversationId: conversation._id,
        isGroup
      });
    }, 1200);
  };

  const handleSendMessage = (e) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !conversation) return;

    const text = newMessage.trim();
    setNewMessage('');

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (isTyping) {
      setIsTyping(false);
      socket?.emit('typing_stop', {
        receiverId: otherUser?._id,
        conversationId: conversation._id,
        isGroup
      });
    }

    const clientMessageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    const optimisticMessage = {
      _id: clientMessageId,
      clientMessageId,
      conversationId: conversation._id,
      senderId: user,
      receiverId: otherUser?._id,
      text,
      status: 'sending',
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, optimisticMessage]);

    if (socket && socket.connected) {
      socket.emit('send_message', {
        conversationId: conversation._id,
        receiverId: otherUser?._id,
        text,
        tempId: clientMessageId,
        clientMessageId
      });

      pendingTimeoutsRef.current[clientMessageId] = setTimeout(() => {
        setMessages(prev => prev.map(m => {
          if (m.clientMessageId === clientMessageId && m.status === 'sending') {
            return { ...m, status: 'failed' };
          }
          return m;
        }));
      }, 6000);
    } else {
      setTimeout(() => {
        setMessages(prev => prev.map(m => {
          if (m.clientMessageId === clientMessageId) {
            return { ...m, status: 'failed' };
          }
          return m;
        }));
      }, 1000);
    }
  };

  const handleRetryMessage = (failedMsg) => {
    setMessages(prev => prev.map(m => {
      if (m.clientMessageId === failedMsg.clientMessageId) {
        return { ...m, status: 'sending' };
      }
      return m;
    }));

    if (socket && socket.connected) {
      socket.emit('send_message', {
        conversationId: conversation._id,
        receiverId: otherUser?._id,
        text: failedMsg.text,
        tempId: failedMsg.clientMessageId,
        clientMessageId: failedMsg.clientMessageId
      });

      pendingTimeoutsRef.current[failedMsg.clientMessageId] = setTimeout(() => {
        setMessages(prev => prev.map(m => {
          if (m.clientMessageId === failedMsg.clientMessageId && m.status === 'sending') {
            return { ...m, status: 'failed' };
          }
          return m;
        }));
      }, 6000);
    } else {
      showToast('Cannot retry: Network connection is offline.');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSearchUsersToAdd = async (q) => {
    setAddMemberQuery(q);
    if (!q.trim()) {
      setAddMemberResults([]);
      return;
    }
    setIsSearchingMembers(true);
    try {
      const res = await api.get(`/users/search?q=${encodeURIComponent(q.trim())}`);
      const list = res.data?.data || res.data;
      const currentIds = new Set(conversation.participants?.map(p => p._id));
      setAddMemberResults((Array.isArray(list) ? list : []).filter(u => !currentIds.has(u._id)));
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearchingMembers(false);
    }
  };

  const handleAddMember = async (targetUser) => {
    try {
      await api.put(`/conversations/${conversation._id}/group/add`, { userId: targetUser._id });
      setIsAddMemberModalOpen(false);
      setAddMemberQuery('');
      setAddMemberResults([]);
      showToast(`Added ${targetUser.fullName} to group.`);
      window.location.reload();
    } catch (err) {
      showToast(err.response?.data?.message || 'Error adding member');
    }
  };

  const handlePromptRemoveMember = (member) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove Member',
      message: `Are you sure you want to remove ${member.fullName} from this group?`,
      onConfirm: async () => {
        try {
          await api.put(`/conversations/${conversation._id}/group/remove`, { userId: member._id });
          setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });
          showToast(`Removed ${member.fullName} from group.`);
          window.location.reload();
        } catch (err) {
          showToast(err.response?.data?.message || 'Error removing member');
        }
      }
    });
  };

  const handlePromptLeaveGroup = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Leave Group',
      message: `Are you sure you want to leave ${conversation.name}?`,
      onConfirm: async () => {
        try {
          await api.put(`/conversations/${conversation._id}/group/leave`);
          socket?.emit('leave_group', { conversationId: conversation._id });
          window.location.reload();
        } catch (err) {
          showToast(err.response?.data?.message || 'Error leaving group');
        }
      }
    });
  };

  const renderMessageStatus = (msg, isMine) => {
    if (!isMine) return null;

    if (msg.status === 'failed') {
      return (
        <span className="flex items-center gap-1 text-rose-300 font-medium">
          <AlertCircle size={11} />
          <span>Failed</span>
          <button 
            onClick={() => handleRetryMessage(msg)}
            className="underline hover:text-white flex items-center gap-0.5 ml-1"
          >
            <RefreshCw size={10} /> Retry
          </button>
        </span>
      );
    }

    if (msg.status === 'sending') {
      return <Clock size={11} className="text-blue-200 animate-spin" />;
    }

    if (isGroup) {
      return <Check size={12} className="text-blue-200" title="Delivered to group" />;
    }

    if (msg.status === 'read') {
      return <CheckCheck size={13} className="text-sky-300 font-bold" title="Read" />;
    }

    if (msg.status === 'delivered') {
      return <CheckCheck size={13} className="text-blue-200" title="Delivered" />;
    }

    return <Check size={12} className="text-blue-200" title="Sent to server" />;
  };

  // Format date separator label
  const getDateLabel = (dateStr) => {
    const msgDate = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (msgDate.toDateString() === today.toDateString()) return 'Today';
    if (msgDate.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return msgDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Empty State View
  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 text-center select-none transition-colors duration-200">
        <div className="relative mb-6">
          <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white rounded-3xl flex items-center justify-center shadow-xl shadow-indigo-500/20">
            <MessageSquare size={38} />
          </div>
          <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center shadow-xs border border-slate-200 dark:border-slate-800 text-amber-500">
            <Sparkles size={16} />
          </div>
        </div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">
          ChatSphere
        </h3>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mt-1 max-w-sm">
          Your conversations, all in one place.
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-400 mt-1 max-w-xs leading-relaxed">
          Select a conversation from the sidebar to start chatting, or create a group to collaborate with friends.
        </p>
      </div>
    );
  }

  const typingArray = Object.values(typingUsers);
  let typingLabel = '';
  if (typingArray.length === 1) typingLabel = isGroup ? `${typingArray[0]} is typing...` : 'Typing...';
  else if (typingArray.length === 2) typingLabel = `${typingArray[0]} and ${typingArray[1]} are typing...`;
  else if (typingArray.length > 2) typingLabel = `${typingArray.length} people are typing...`;

  const onlineCount = conversation.participants?.filter(p => p.isOnline)?.length || 0;
  const amIAdmin = isGroup && conversation.admins?.some(a => (a._id || a) === user._id);

  return (
    <div className="flex-1 flex h-full bg-slate-50 dark:bg-slate-950 relative overflow-hidden transition-colors duration-200">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 dark:bg-slate-100 dark:text-slate-900 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-lg backdrop-blur-xs animate-in fade-in slide-in-from-top-2 duration-150">
          {toastMessage}
        </div>
      )}

      {/* Main Chat Column */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Chat Header */}
        <div className="px-4 py-3 border-b border-slate-200/80 dark:border-slate-800/80 flex justify-between items-center bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-xs z-10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button 
              className="md:hidden text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 p-1.5 -ml-1 rounded-xl"
              onClick={onBack}
              aria-label="Back to conversations"
            >
              <ArrowLeft size={18} />
            </button>

            <div className="relative shrink-0">
              {isGroup ? (
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
                  <Users size={18} />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs shadow-xs">
                  {otherUser?.fullName?.charAt(0)?.toUpperCase() || '?'}
                </div>
              )}
              {!isGroup && otherUser?.isOnline && (
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
              )}
            </div>

            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate leading-snug">
                {isGroup ? conversation.name : otherUser?.fullName}
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-400 truncate">
                {isGroup 
                  ? `${conversation.participants?.length || 0} members • ${onlineCount} online`
                  : (otherUser?.isOnline ? 'Online' : 'Offline')
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {isGroup && (
              <button 
                onClick={() => setShowInfo(!showInfo)}
                className={`p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                  showInfo ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400' : ''
                }`}
                title="Group Room Information"
                aria-label="View Group Information"
              >
                <Info size={17} />
              </button>
            )}
          </div>
        </div>

        {/* Message Feed Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-slate-50/60 dark:bg-slate-950">
          {/* Pagination Trigger */}
          {hasMore && (
            <div className="text-center pt-1 pb-2">
              <button
                onClick={handleLoadEarlier}
                disabled={isLoadingMore}
                className="px-3.5 py-1.5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-full text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs transition-colors"
              >
                {isLoadingMore ? 'Loading earlier messages...' : 'Load earlier messages'}
              </button>
            </div>
          )}

          {/* Empty Conversation Notice */}
          {messages.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-xs">
              No messages yet. Send a message to start chatting!
            </div>
          )}

          {/* Messages Feed with grouping and date dividers */}
          {messages.map((msg, index) => {
            const isMine = (msg.senderId === user._id) || (msg.senderId?._id === user._id);
            const senderName = msg.senderId?.fullName || 'User';

            // Check if previous message exists for date separator & grouping
            const prevMsg = messages[index - 1];
            const showDateDivider = !prevMsg || getDateLabel(prevMsg.createdAt) !== getDateLabel(msg.createdAt);
            const isConsecutive = prevMsg && 
              ((prevMsg.senderId === msg.senderId) || (prevMsg.senderId?._id === msg.senderId?._id)) &&
              !showDateDivider;

            return (
              <React.Fragment key={msg.clientMessageId || msg._id || index}>
                {/* Date Divider */}
                {showDateDivider && (
                  <div className="flex items-center justify-center my-3">
                    <span className="px-3 py-1 bg-white/80 dark:bg-slate-850/80 backdrop-blur-xs border border-slate-200/60 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold rounded-full uppercase tracking-wider shadow-2xs">
                      {getDateLabel(msg.createdAt)}
                    </span>
                  </div>
                )}

                {/* Message Bubble Container */}
                <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} ${isConsecutive ? 'mt-1' : 'mt-2.5'}`}>
                  <div 
                    className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2.5 transition-all shadow-xs ${
                      isMine 
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-xs' 
                        : 'bg-white dark:bg-slate-850 text-slate-800 dark:text-slate-100 rounded-bl-xs border border-slate-200/80 dark:border-slate-800/80'
                    }`}
                  >
                    {/* Group message sender tag */}
                    {isGroup && !isMine && !isConsecutive && (
                      <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 mb-0.5">
                        {senderName}
                      </p>
                    )}

                    <p className="text-xs sm:text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {msg.text}
                    </p>

                    {/* Timestamp and status ticks */}
                    <div className={`text-[10px] mt-1 flex justify-end items-center gap-1.5 ${
                      isMine ? 'text-blue-100' : 'text-slate-400 dark:text-slate-400'
                    }`}>
                      <span>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {renderMessageStatus(msg, isMine)}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}

          {/* Typing Indicator Bubble */}
          {typingLabel && (
            <div className="flex items-center gap-2 mt-2">
              <div className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-bl-xs px-3.5 py-2 shadow-xs flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce"></span>
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">{typingLabel}</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Message Composer Footer */}
        <div className="p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80">
          <form className="flex items-center gap-2 max-w-5xl mx-auto" onSubmit={handleSendMessage}>
            <div className="flex-1 relative flex items-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-100/90 dark:hover:bg-slate-800/90 focus-within:bg-white dark:focus-within:bg-slate-850 border border-slate-200/80 dark:border-slate-750 focus-within:border-blue-500 rounded-2xl px-3.5 py-1.5 transition-all">
              <textarea
                className="w-full bg-transparent text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none resize-none max-h-32 transition-all leading-normal"
                rows="1"
                placeholder="Type a message..."
                value={newMessage}
                onChange={handleTypingChange}
                onKeyDown={handleKeyDown}
                aria-label="Message input"
              ></textarea>
            </div>

            <button 
              type="submit" 
              disabled={!newMessage.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:cursor-not-allowed text-white rounded-2xl w-10 h-10 flex items-center justify-center transition-all shadow-xs shrink-0"
              title="Send message"
              aria-label="Send Message"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>

      {/* Group Info Drawer */}
      {isGroup && showInfo && (
        <div className="w-72 sm:w-80 border-l border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-full z-20 shadow-xl md:shadow-none animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/70 dark:bg-slate-850/40">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Group Details
            </h4>
            <button 
              onClick={() => setShowInfo(false)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-lg"
              aria-label="Close group panel"
            >
              <X size={16} />
            </button>
          </div>

          {/* Group Header Info */}
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 text-center">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center mb-2.5 shadow-xs">
              <Users size={28} />
            </div>

            {amIAdmin ? (
              <div className="space-y-1.5">
                <input 
                  type="text" 
                  defaultValue={conversation.name} 
                  onBlur={async (e) => {
                    if (e.target.value !== conversation.name && e.target.value.trim()) {
                      try {
                        await api.put(`/conversations/${conversation._id}/group`, { name: e.target.value });
                        showToast('Group name updated.');
                      } catch(err) { showToast('Failed to update group name'); }
                    }
                  }}
                  className="font-bold text-sm text-center w-full px-2 py-1 bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 rounded-lg text-slate-900 dark:text-white"
                  title="Click to rename group"
                />
                <input 
                  type="text" 
                  placeholder="Group description"
                  defaultValue={conversation.description} 
                  onBlur={async (e) => {
                    if (e.target.value !== conversation.description) {
                      try {
                        await api.put(`/conversations/${conversation._id}/group`, { description: e.target.value });
                        showToast('Description updated.');
                      } catch(err) { showToast('Failed to update description'); }
                    }
                  }}
                  className="text-xs text-slate-500 dark:text-slate-400 text-center w-full px-2 py-1 bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 rounded-lg"
                />
              </div>
            ) : (
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">{conversation.name}</h3>
                {conversation.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{conversation.description}</p>
                )}
              </div>
            )}
          </div>

          {/* Members List */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex justify-between items-center mb-2.5">
              <h5 className="text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                Members ({conversation.participants?.length || 0})
              </h5>
            </div>

            <div className="space-y-2">
              {conversation.participants?.map(member => {
                const isAdmin = conversation.admins?.some(a => (a._id || a) === member._id);
                const isMe = member._id === user._id;

                return (
                  <div key={member._id} className="flex items-center justify-between group py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="relative shrink-0">
                        <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs">
                          {member.fullName?.charAt(0)?.toUpperCase()}
                        </div>
                        {member.isOnline && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 border border-white dark:border-slate-900 rounded-full"></span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {member.fullName} {isMe && '(You)'}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">@{member.username}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isAdmin && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          Admin
                        </span>
                      )}

                      {amIAdmin && !isMe && (
                        <button
                          onClick={() => handlePromptRemoveMember(member)}
                          className="text-[10px] text-rose-600 hover:text-rose-800 dark:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove user from group"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Admin Add Member Action */}
            {amIAdmin && (
              <button 
                onClick={() => {
                  setAddMemberQuery('');
                  setAddMemberResults([]);
                  setIsAddMemberModalOpen(true);
                }}
                className="w-full mt-4 py-2 border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 text-slate-600 dark:text-slate-300 hover:text-blue-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <UserPlus size={14} /> Add Member
              </button>
            )}
          </div>

          {/* Leave Group Action */}
          <div className="p-4 border-t border-slate-100 dark:border-slate-800">
            <button 
              onClick={handlePromptLeaveGroup}
              className="w-full py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors border border-rose-200/60 dark:border-rose-900/40"
            >
              <LogOut size={14} /> Leave Group Room
            </button>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {isAddMemberModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/70 dark:bg-slate-850/40">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Add Group Member
              </h4>
              <button 
                onClick={() => setIsAddMemberModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4">
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search user by name or username..."
                  value={addMemberQuery}
                  onChange={(e) => handleSearchUsersToAdd(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800">
                {addMemberResults.length === 0 ? (
                  <p className="p-4 text-center text-xs text-slate-400">
                    {addMemberQuery ? (isSearchingMembers ? 'Searching...' : 'No available users found') : 'Type above to search'}
                  </p>
                ) : (
                  addMemberResults.map(u => (
                    <div 
                      key={u._id}
                      className="flex items-center justify-between p-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/40 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{u.fullName}</p>
                        <p className="text-[10px] text-slate-400">@{u.username}</p>
                      </div>
                      <button 
                        onClick={() => handleAddMember(u)}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-semibold transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-5">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white mb-1">{confirmModal.title}</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">{confirmModal.message}</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null })}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatArea;
