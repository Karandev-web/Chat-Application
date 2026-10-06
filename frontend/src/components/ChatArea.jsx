import React, { useState, useEffect, useRef, useContext, useMemo } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import Avatar from './ui/Avatar';
import Badge from './ui/Badge';
import Button from './ui/Button';
import Modal from './ui/Modal';
import EmptyState from './ui/EmptyState';
import { 
  ArrowLeft, Send, Users, Info, UserPlus, LogOut, 
  Check, CheckCheck, Clock, AlertCircle, RefreshCw, X, 
  MessageSquare, Search, ChevronDown, Shield, Mail, Sparkles, WifiOff, Loader2
} from 'lucide-react';

export const ChatArea = ({ 
  conversation, 
  onBack, 
  connectionStatus,
  onConversationUpdated 
}) => {
  const { user } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState({}); // { senderId: senderName }
  const [showInfo, setShowInfo] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

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
    confirmText: 'Confirm',
    isDanger: false,
    onConfirm: null
  });

  const pendingTimeoutsRef = useRef({});
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const textareaRef = useRef(null);

  const isGroup = conversation?.type === 'group';
  const otherUser = isGroup ? null : conversation?.participants?.find(p => p._id !== user._id);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3200);
  };

  // 1. Initial message load
  useEffect(() => {
    if (conversation) {
      setMessages([]);
      setPage(1);
      setHasMore(false);
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
      const convId = msg.conversationId?._id || msg.conversationId;
      if (convId === conversation._id) {
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
          setTypingUsers(prev => ({ ...prev, [data.senderId]: data.senderName || 'Member' }));
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
  }, [socket, conversation?._id, otherUser?._id]);

  // Scroll to bottom on initial message load or incoming message (if near bottom)
  useEffect(() => {
    if (!showScrollBottom) {
      scrollToBottom();
    }
  }, [messages.length, Object.keys(typingUsers).length]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isUp = scrollHeight - scrollTop - clientHeight > 180;
    setShowScrollBottom(isUp);
  };

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

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  const handleTypingChange = (e) => {
    setNewMessage(e.target.value);

    // Auto-grow textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }

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
    }, 1400);
  };

  const handleSendMessage = (e) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !conversation) return;

    const text = newMessage.trim();
    setNewMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

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

  // Group member management
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
      const res = await api.put(`/conversations/${conversation._id}/group/add`, { userId: targetUser._id });
      setIsAddMemberModalOpen(false);
      setAddMemberQuery('');
      setAddMemberResults([]);
      showToast(`Added ${targetUser.fullName} to group.`);
      if (onConversationUpdated) onConversationUpdated(res.data?.data || res.data);
    } catch (err) {
      showToast(err.response?.data?.message || 'Error adding member');
    }
  };

  const handlePromptRemoveMember = (member) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove Group Member',
      message: `Are you sure you want to remove ${member.fullName} from this group?`,
      confirmText: 'Remove Member',
      isDanger: true,
      onConfirm: async () => {
        try {
          const res = await api.put(`/conversations/${conversation._id}/group/remove`, { userId: member._id });
          setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });
          showToast(`Removed ${member.fullName} from group.`);
          if (onConversationUpdated) onConversationUpdated(res.data?.data || res.data);
        } catch (err) {
          showToast(err.response?.data?.message || 'Error removing member');
        }
      }
    });
  };

  const handlePromptLeaveGroup = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Leave Group Room',
      message: `Are you sure you want to leave ${conversation.name}? You will no longer receive group messages.`,
      confirmText: 'Leave Group',
      isDanger: true,
      onConfirm: async () => {
        try {
          await api.put(`/conversations/${conversation._id}/group/leave`);
          socket?.emit('leave_group', { conversationId: conversation._id });
          setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });
          if (onBack) onBack();
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
        <span className="flex items-center gap-1 text-red-300 font-medium ml-1">
          <AlertCircle size={11} />
          <button 
            onClick={() => handleRetryMessage(msg)}
            className="underline hover:text-white flex items-center gap-0.5 cursor-pointer"
          >
            <RefreshCw size={10} /> Retry
          </button>
        </span>
      );
    }

    if (msg.status === 'sending') {
      return <Clock size={11} className="text-white/60 animate-spin ml-1" />;
    }

    if (isGroup) {
      return <Check size={12} className="text-white/75 ml-1" title="Delivered to group" />;
    }

    if (msg.status === 'read') {
      return <CheckCheck size={13} className="text-[#9BE7FF] font-bold ml-1" title="Read" />;
    }

    if (msg.status === 'delivered') {
      return <CheckCheck size={13} className="text-white/70 ml-1" title="Delivered" />;
    }

    return <Check size={12} className="text-white/70 ml-1" title="Sent to server" />;
  };

  const getDateLabel = (dateStr) => {
    const msgDate = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (msgDate.toDateString() === today.toDateString()) return 'Today';
    if (msgDate.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return msgDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Empty State View when no active chat selected
  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-cs-bg p-8 text-center select-none">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 mb-4">
          <MessageSquare size={30} />
        </div>
        <h3 className="text-xl font-bold font-heading text-cs-text-primary tracking-tight">
          ChatSphere
        </h3>
        <p className="text-xs font-semibold text-cs-accent mt-1">
          Distributed Real-Time Messaging
        </p>
        <p className="text-xs text-cs-text-muted mt-2 max-w-xs leading-relaxed">
          Select a chat from the left panel to begin, or search for colleagues and start a new conversation.
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
    <div className="flex-1 flex h-full bg-cs-bg relative overflow-hidden">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-y-1/2 -translate-x-1/2 z-50 bg-cs-surface text-cs-text-primary border border-cs-border px-4 py-2 rounded-xl text-xs font-semibold shadow-lg backdrop-blur-xs animate-in fade-in slide-in-from-top-2 duration-150">
          {toastMessage}
        </div>
      )}

      {/* Main Chat Column */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-cs-bg">
        {/* Chat Header */}
        <header className="px-4 py-3 border-b border-cs-border flex justify-between items-center bg-cs-surface shadow-xs z-10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button 
              className="md:hidden text-cs-text-secondary hover:text-cs-text-primary p-1.5 -ml-1 rounded-xl focus-ring cursor-pointer"
              onClick={onBack}
              aria-label="Back to conversations"
            >
              <ArrowLeft size={18} />
            </button>

            <Avatar
              user={otherUser}
              name={isGroup ? conversation.name : undefined}
              isGroup={isGroup}
              showPresence={!isGroup}
              isOnline={otherUser?.isOnline}
              size="md"
            />

            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold font-heading text-cs-text-primary truncate">
                {isGroup ? conversation.name : otherUser?.fullName}
              </h3>
              <p className="text-[11px] text-cs-text-muted truncate">
                {isGroup 
                  ? `${conversation.participants?.length || 0} members • ${onlineCount} online`
                  : (otherUser?.isOnline ? 'Active now' : 'Offline')
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => setShowInfo(!showInfo)}
              className={`p-2 rounded-xl text-cs-text-secondary hover:text-cs-text-primary hover:bg-cs-surface-raised transition-colors focus-ring cursor-pointer ${
                showInfo ? 'bg-cs-accent-soft text-cs-accent' : ''
              }`}
              title="Chat Details & Info"
              aria-label="View Details"
            >
              <Info size={18} />
            </button>
          </div>
        </header>

        {/* Connection status alert banner (if offline/reconnecting) */}
        {connectionStatus !== 'connected' && (
          <div className="px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-center gap-2">
            {connectionStatus === 'reconnecting' ? (
              <>
                <Loader2 size={13} className="animate-spin text-amber-500" />
                <span>Reconnecting to chat server... Messages will sync upon reconnection.</span>
              </>
            ) : (
              <>
                <WifiOff size={13} className="text-rose-500" />
                <span>Connection offline. Retrying automatically...</span>
              </>
            )}
          </div>
        )}

        {/* Message Feed Area */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2 bg-cs-bg relative"
        >
          {/* Pagination Trigger */}
          {hasMore && (
            <div className="text-center pt-1 pb-3">
              <button
                onClick={handleLoadEarlier}
                disabled={isLoadingMore}
                className="px-4 py-1.5 bg-cs-surface border border-cs-border text-cs-text-secondary rounded-full text-xs font-semibold hover:bg-cs-surface-raised shadow-xs transition-colors cursor-pointer focus-ring"
              >
                {isLoadingMore ? 'Loading earlier messages...' : 'Load earlier messages'}
              </button>
            </div>
          )}

          {/* Empty Conversation Notice */}
          {messages.length === 0 && (
            <EmptyState
              icon={MessageSquare}
              title="No messages in this chat"
              description="Send the first message below to start the conversation."
            />
          )}

          {/* Messages Feed with 5-minute runs & grouping */}
          {messages.map((msg, index) => {
            const isMine = (msg.senderId === user._id) || (msg.senderId?._id === user._id);
            const senderName = msg.senderId?.fullName || 'User';

            const prevMsg = messages[index - 1];
            const nextMsg = messages[index + 1];

            // Date separator check
            const showDateDivider = !prevMsg || getDateLabel(prevMsg.createdAt) !== getDateLabel(msg.createdAt);

            // Grouping: same sender within 5 minutes (300,000 ms)
            const isSameSenderAsPrev = prevMsg &&
              ((prevMsg.senderId === msg.senderId) || (prevMsg.senderId?._id === msg.senderId?._id));
            const isWithin5MinPrev = isSameSenderAsPrev &&
              (new Date(msg.createdAt) - new Date(prevMsg.createdAt) < 5 * 60 * 1000);
            const isConsecutivePrev = isWithin5MinPrev && !showDateDivider;

            const isSameSenderAsNext = nextMsg &&
              ((nextMsg.senderId === msg.senderId) || (nextMsg.senderId?._id === msg.senderId?._id));
            const isWithin5MinNext = isSameSenderAsNext &&
              (new Date(nextMsg.createdAt) - new Date(msg.createdAt) < 5 * 60 * 1000);

            // Radius variations for message runs
            const isFirstInRun = !isConsecutivePrev;
            const isLastInRun = !isWithin5MinNext;

            let bubbleCornerClass = '';
            if (isMine) {
              if (isFirstInRun && isLastInRun) bubbleCornerClass = 'rounded-2xl rounded-br-xs';
              else if (isFirstInRun) bubbleCornerClass = 'rounded-2xl rounded-br-md';
              else if (isLastInRun) bubbleCornerClass = 'rounded-2xl rounded-tr-md rounded-br-xs';
              else bubbleCornerClass = 'rounded-2xl rounded-r-md';
            } else {
              if (isFirstInRun && isLastInRun) bubbleCornerClass = 'rounded-2xl rounded-bl-xs';
              else if (isFirstInRun) bubbleCornerClass = 'rounded-2xl rounded-bl-md';
              else if (isLastInRun) bubbleCornerClass = 'rounded-2xl rounded-tl-md rounded-bl-xs';
              else bubbleCornerClass = 'rounded-2xl rounded-l-md';
            }

            return (
              <React.Fragment key={msg.clientMessageId || msg._id || index}>
                {/* Date Divider */}
                {showDateDivider && (
                  <div className="flex items-center justify-center my-4">
                    <span className="px-3.5 py-1 bg-cs-surface border border-cs-border text-cs-text-muted text-[10px] font-bold rounded-full uppercase tracking-wider shadow-2xs">
                      {getDateLabel(msg.createdAt)}
                    </span>
                  </div>
                )}

                {/* Message Bubble Item */}
                <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} ${isConsecutivePrev ? 'mt-0.5' : 'mt-2.5'}`}>
                  {/* Group message sender label */}
                  {isGroup && !isMine && isFirstInRun && (
                    <span className="text-[11px] font-bold text-cs-accent ml-2 mb-0.5">
                      {senderName}
                    </span>
                  )}

                  <div 
                    className={`max-w-[85%] sm:max-w-[70%] px-3.5 py-2 transition-all shadow-xs ${bubbleCornerClass} ${
                      isMine 
                        ? 'bg-cs-accent text-white' 
                        : 'bg-cs-surface text-cs-text-primary border border-cs-border'
                    }`}
                  >
                    <p className="text-xs sm:text-[13px] whitespace-pre-wrap break-words leading-relaxed select-text">
                      {msg.text}
                    </p>

                    {/* Timestamp & Status ticks */}
                    <div className={`text-[10px] mt-1 flex justify-end items-center ${
                      isMine ? 'text-white/80' : 'text-cs-text-muted'
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
              <div className="bg-cs-surface border border-cs-border rounded-2xl rounded-bl-xs px-3.5 py-2 shadow-xs flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-cs-accent rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-cs-accent rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-cs-accent rounded-full animate-bounce" />
                </span>
                <span className="text-[11px] text-cs-text-secondary font-medium">{typingLabel}</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Floating "Jump to latest" button */}
        {showScrollBottom && (
          <button
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-20 right-6 z-20 p-2.5 rounded-full bg-cs-surface text-cs-text-secondary hover:text-cs-accent border border-cs-border shadow-lg transition-transform hover:scale-105 focus-ring cursor-pointer"
            title="Jump to latest message"
            aria-label="Scroll to bottom"
          >
            <ChevronDown size={18} />
          </button>
        )}

        {/* Message Composer Footer */}
        <footer className="p-3 bg-cs-surface border-t border-cs-border">
          <form className="flex items-end gap-2 max-w-5xl mx-auto" onSubmit={handleSendMessage}>
            <div className="flex-1 relative flex items-center bg-cs-surface-raised border border-cs-border focus-within:border-cs-accent focus-within:bg-cs-surface rounded-2xl px-3.5 py-2 transition-all">
              <textarea
                ref={textareaRef}
                className="w-full bg-transparent text-xs sm:text-sm text-cs-text-primary placeholder:text-cs-text-muted focus:outline-none resize-none max-h-32 transition-all leading-normal"
                rows="1"
                placeholder="Type a message... (Press Enter to send)"
                value={newMessage}
                onChange={handleTypingChange}
                onKeyDown={handleKeyDown}
                aria-label="Message text"
              />
            </div>

            <button 
              type="submit" 
              disabled={!newMessage.trim()}
              className="bg-cs-accent hover:bg-cs-accent-hover disabled:bg-cs-surface-raised disabled:text-cs-text-muted disabled:cursor-not-allowed text-white rounded-2xl w-10 h-10 flex items-center justify-center transition-all shadow-xs shrink-0 cursor-pointer focus-ring"
              title="Send message"
              aria-label="Send Message"
            >
              <Send size={16} />
            </button>
          </form>
        </footer>
      </div>

      {/* Right Column: Info Panel */}
      {showInfo && (
        <aside className="w-80 border-l border-cs-border bg-cs-surface flex flex-col h-full z-20 shadow-xl md:shadow-none animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="p-4 border-b border-cs-border flex justify-between items-center bg-cs-surface-raised/40">
            <h4 className="font-bold text-xs uppercase tracking-wider text-cs-text-secondary font-heading">
              {isGroup ? 'Group Information' : 'Contact Information'}
            </h4>
            <button 
              onClick={() => setShowInfo(false)}
              className="text-cs-text-muted hover:text-cs-text-primary p-1 rounded-lg focus-ring cursor-pointer"
              aria-label="Close info panel"
            >
              <X size={16} />
            </button>
          </div>

          {/* Profile details */}
          <div className="flex-1 overflow-y-auto">
            {isGroup ? (
              <div>
                {/* Group Banner & Identity */}
                <div className="p-6 text-center border-b border-cs-border">
                  <Avatar
                    name={conversation.name}
                    isGroup={true}
                    size="xl"
                    className="mx-auto mb-3"
                  />

                  {amIAdmin ? (
                    <div className="space-y-2">
                      <input 
                        type="text" 
                        defaultValue={conversation.name} 
                        onBlur={async (e) => {
                          if (e.target.value !== conversation.name && e.target.value.trim()) {
                            try {
                              const res = await api.put(`/conversations/${conversation._id}/group`, { name: e.target.value.trim() });
                              showToast('Group name updated.');
                              if (onConversationUpdated) onConversationUpdated(res.data?.data || res.data);
                            } catch(err) { showToast('Failed to update group name'); }
                          }
                        }}
                        className="font-bold text-sm text-center w-full px-2 py-1 bg-cs-surface-raised border border-cs-border focus:border-cs-accent rounded-xl text-cs-text-primary focus-ring"
                        title="Click to rename group"
                      />
                      <input 
                        type="text" 
                        placeholder="Add a group description..."
                        defaultValue={conversation.description} 
                        onBlur={async (e) => {
                          if (e.target.value !== conversation.description) {
                            try {
                              const res = await api.put(`/conversations/${conversation._id}/group`, { description: e.target.value.trim() });
                              showToast('Description updated.');
                              if (onConversationUpdated) onConversationUpdated(res.data?.data || res.data);
                            } catch(err) { showToast('Failed to update description'); }
                          }
                        }}
                        className="text-xs text-cs-text-secondary text-center w-full px-2 py-1 bg-cs-surface-raised border border-cs-border focus:border-cs-accent rounded-xl focus-ring"
                      />
                    </div>
                  ) : (
                    <div>
                      <h3 className="font-bold text-sm text-cs-text-primary">{conversation.name}</h3>
                      {conversation.description && (
                        <p className="text-xs text-cs-text-muted mt-1">{conversation.description}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Members list */}
                <div className="p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h5 className="text-[11px] font-bold text-cs-text-muted uppercase tracking-wider">
                      Members ({conversation.participants?.length || 0})
                    </h5>
                    {amIAdmin && (
                      <button
                        onClick={() => {
                          setAddMemberQuery('');
                          setAddMemberResults([]);
                          setIsAddMemberModalOpen(true);
                        }}
                        className="text-xs font-semibold text-cs-accent hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <UserPlus size={13} />
                        Add Member
                      </button>
                    )}
                  </div>

                  <div className="space-y-1">
                    {conversation.participants?.map(member => {
                      const isAdmin = conversation.admins?.some(a => (a._id || a) === member._id);
                      const isMe = member._id === user._id;

                      return (
                        <div key={member._id} className="flex items-center justify-between p-2 rounded-xl hover:bg-cs-surface-raised transition-colors group">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar
                              user={member}
                              size="sm"
                              showPresence
                              isOnline={member.isOnline}
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-cs-text-primary truncate">
                                {member.fullName} {isMe && '(You)'}
                              </p>
                              <p className="text-[10px] text-cs-text-muted truncate">@{member.username}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isAdmin && (
                              <Badge variant="accent-soft" size="xs">
                                Admin
                              </Badge>
                            )}
                            {amIAdmin && !isMe && (
                              <button
                                onClick={() => handlePromptRemoveMember(member)}
                                className="text-[11px] text-cs-danger p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:underline cursor-pointer"
                                title="Remove member"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Leave group button */}
                <div className="p-4 border-t border-cs-border">
                  <Button
                    variant="danger"
                    size="md"
                    className="w-full"
                    onClick={handlePromptLeaveGroup}
                    icon={LogOut}
                  >
                    Leave Group Room
                  </Button>
                </div>
              </div>
            ) : (
              /* Direct Chat Contact Details */
              <div className="p-6 text-center space-y-4">
                <Avatar
                  user={otherUser}
                  size="xl"
                  showPresence
                  isOnline={otherUser?.isOnline}
                  className="mx-auto"
                />
                <div>
                  <h3 className="font-bold text-base text-cs-text-primary">{otherUser?.fullName}</h3>
                  <p className="text-xs text-cs-text-muted">@{otherUser?.username}</p>
                </div>

                <div className="text-left space-y-3 pt-2">
                  <div className="p-3 bg-cs-surface-raised rounded-xl border border-cs-border">
                    <div className="flex items-center gap-1.5 text-cs-text-muted mb-0.5 text-[11px] font-bold uppercase tracking-wider">
                      <Mail size={13} />
                      <span>Email</span>
                    </div>
                    <p className="text-xs font-medium text-cs-text-primary">{otherUser?.email}</p>
                  </div>

                  <div className="p-3 bg-cs-surface-raised rounded-xl border border-cs-border">
                    <div className="flex items-center gap-1.5 text-cs-text-muted mb-0.5 text-[11px] font-bold uppercase tracking-wider">
                      <Shield size={13} />
                      <span>Status</span>
                    </div>
                    <p className="text-xs font-medium text-cs-text-primary">{otherUser?.status || 'Active on ChatSphere'}</p>
                  </div>

                  <div className="p-3 bg-cs-surface-raised rounded-xl border border-cs-border flex items-center justify-between">
                    <span className="text-[11px] font-bold text-cs-text-muted uppercase tracking-wider">Presence</span>
                    <Badge variant={otherUser?.isOnline ? 'online' : 'neutral'} size="sm">
                      {otherUser?.isOnline ? 'Active Online' : 'Offline'}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Add Member Modal */}
      <Modal
        isOpen={isAddMemberModalOpen}
        onClose={() => setIsAddMemberModalOpen(false)}
        title="Add Group Member"
        description="Search for registered users to invite into this group room"
      >
        <div className="space-y-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cs-text-muted" />
            <input
              type="text"
              placeholder="Search by name, username or email..."
              value={addMemberQuery}
              onChange={(e) => handleSearchUsersToAdd(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-cs-surface-raised border border-cs-border rounded-xl text-xs text-cs-text-primary placeholder:text-cs-text-muted focus:border-cs-accent focus:bg-cs-surface focus:ring-2 focus:ring-cs-accent/20 focus-ring"
            />
          </div>

          <div className="max-h-56 overflow-y-auto divide-y divide-cs-border border border-cs-border rounded-xl">
            {isSearchingMembers ? (
              <div className="p-6 text-center text-xs text-cs-text-muted">Searching...</div>
            ) : addMemberResults.length === 0 ? (
              <div className="p-6 text-center text-xs text-cs-text-muted">
                {addMemberQuery ? 'No eligible users found' : 'Type to search for users'}
              </div>
            ) : (
              addMemberResults.map(u => (
                <div
                  key={u._id}
                  className="flex items-center justify-between p-3 hover:bg-cs-surface-raised transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar user={u} size="sm" showPresence isOnline={u.isOnline} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-cs-text-primary truncate">{u.fullName}</p>
                      <p className="text-[10px] text-cs-text-muted truncate">@{u.username}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleAddMember(u)}
                  >
                    Add
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        title={confirmModal.title}
        description={confirmModal.message}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            >
              Cancel
            </Button>
            <Button
              variant={confirmModal.isDanger ? 'danger' : 'primary'}
              onClick={confirmModal.onConfirm}
            >
              {confirmModal.confirmText || 'Confirm'}
            </Button>
          </>
        }
      >
        <p className="text-xs text-cs-text-secondary leading-relaxed">
          {confirmModal.message}
        </p>
      </Modal>
    </div>
  );
};

export default ChatArea;
