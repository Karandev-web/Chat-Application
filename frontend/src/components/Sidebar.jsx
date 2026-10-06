import React, { useState, useEffect, useContext, useMemo } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import Avatar from './ui/Avatar';
import Badge from './ui/Badge';
import Button from './ui/Button';
import Modal from './ui/Modal';
import EmptyState from './ui/EmptyState';
import { 
  Users, Search, X, MessageSquare, Plus, UserPlus, 
  Check, CheckCheck, UserCheck, Sparkles, AlertCircle
} from 'lucide-react';

export const Sidebar = ({ onSelectConversation, activeConversation, onOpenProfile }) => {
  const { user } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);

  const [conversations, setConversations] = useState([]);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'direct' | 'group'
  const [searchQuery, setSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [typingConversations, setTypingConversations] = useState({}); // { [conversationId]: string }

  // Group creation modal state
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);
  const [groupModalError, setGroupModalError] = useState('');

  // Initial fetch
  useEffect(() => {
    fetchConversations();
  }, []);

  // Real-time socket events
  useEffect(() => {
    if (!socket) return;

    const handleConversationUpdated = () => fetchConversations();
    const handleStatusChange = ({ userId, isOnline, lastSeen }) => {
      setConversations(prev =>
        prev.map(conv => {
          if (conv.type === 'direct') {
            const updatedParticipants = conv.participants?.map(p =>
              p._id === userId ? { ...p, isOnline, lastSeen } : p
            );
            return { ...conv, participants: updatedParticipants };
          }
          return conv;
        })
      );
    };

    const handleGroupAdded = (conversation) => {
      socket.emit('join_group', { conversationId: conversation._id });
      fetchConversations();
    };

    const handleReceiveMessage = (msg) => {
      fetchConversations();
    };

    const handleTypingStart = (data) => {
      if (data.conversationId) {
        const label = data.isGroup && data.senderName ? `${data.senderName} is typing...` : 'Typing...';
        setTypingConversations(prev => ({ ...prev, [data.conversationId]: label }));
      }
    };

    const handleTypingStop = (data) => {
      if (data.conversationId) {
        setTypingConversations(prev => {
          const next = { ...prev };
          delete next[data.conversationId];
          return next;
        });
      }
    };

    socket.on('conversation_updated', handleConversationUpdated);
    socket.on('userStatusChange', handleStatusChange);
    socket.on('group_added', handleGroupAdded);
    socket.on('group_updated', handleConversationUpdated);
    socket.on('receive_message', handleReceiveMessage);
    socket.on('message_sent', handleConversationUpdated);
    socket.on('typing_start', handleTypingStart);
    socket.on('typing_stop', handleTypingStop);

    return () => {
      socket.off('conversation_updated', handleConversationUpdated);
      socket.off('userStatusChange', handleStatusChange);
      socket.off('group_added', handleGroupAdded);
      socket.off('group_updated', handleConversationUpdated);
      socket.off('receive_message', handleReceiveMessage);
      socket.off('message_sent', handleConversationUpdated);
      socket.off('typing_start', handleTypingStart);
      socket.off('typing_stop', handleTypingStop);
    };
  }, [socket]);

  const fetchConversations = async () => {
    try {
      const res = await api.get('/conversations');
      const data = res.data?.data || res.data;
      if (Array.isArray(data)) {
        setConversations(data);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search for global users
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setUserSearchResults([]);
      setIsSearchingUsers(false);
      return;
    }

    setIsSearchingUsers(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
        const users = res.data?.data || res.data;
        setUserSearchResults(Array.isArray(users) ? users : []);
      } catch (err) {
        console.error('User search error:', err);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const clearSearch = () => {
    setSearchQuery('');
    setUserSearchResults([]);
  };

  const startConversation = async (targetUser) => {
    try {
      const res = await api.post('/conversations', { receiverId: targetUser._id });
      const conv = res.data?.data || res.data;
      await fetchConversations();
      clearSearch();
      onSelectConversation(conv);
    } catch (err) {
      console.error('Error starting conversation:', err);
    }
  };

  // Group search & member selection
  const handleGroupUserSearch = async (e) => {
    const query = e.target.value;
    setGroupSearchQuery(query);
    if (query.trim()) {
      try {
        const res = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
        const users = res.data?.data || res.data;
        setGroupSearchResults(Array.isArray(users) ? users.filter(u => u._id !== user._id) : []);
      } catch (err) {
        console.error('Error searching users for group:', err);
      }
    } else {
      setGroupSearchResults([]);
    }
  };

  const toggleMemberSelection = (targetUser) => {
    setGroupModalError('');
    if (selectedMembers.some(m => m._id === targetUser._id)) {
      setSelectedMembers(selectedMembers.filter(m => m._id !== targetUser._id));
    } else {
      setSelectedMembers([...selectedMembers, targetUser]);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setGroupModalError('');

    if (!groupName.trim()) {
      setGroupModalError('Please enter a group name');
      return;
    }
    if (selectedMembers.length < 1) {
      setGroupModalError('Please select at least 1 other member');
      return;
    }

    setIsSubmittingGroup(true);
    try {
      const res = await api.post('/conversations/group', {
        name: groupName.trim(),
        description: groupDesc.trim(),
        participants: selectedMembers.map(m => m._id)
      });
      const newGroup = res.data?.data || res.data;
      if (socket) {
        socket.emit('join_group', { conversationId: newGroup._id });
      }
      await fetchConversations();
      setIsCreateGroupOpen(false);
      setGroupName('');
      setGroupDesc('');
      setSelectedMembers([]);
      setGroupSearchQuery('');
      setGroupSearchResults([]);
      onSelectConversation(newGroup);
    } catch (err) {
      setGroupModalError(err.response?.data?.message || 'Error creating group');
    } finally {
      setIsSubmittingGroup(false);
    }
  };

  // Filtered conversations
  const filteredConversations = useMemo(() => {
    let list = conversations;

    if (filterType === 'direct') {
      list = list.filter(c => c.type === 'direct');
    } else if (filterType === 'group') {
      list = list.filter(c => c.type === 'group');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(c => {
        if (c.type === 'group') {
          return c.name?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q);
        }
        const other = c.participants?.find(p => p._id !== user._id);
        return (
          other?.fullName?.toLowerCase().includes(q) ||
          other?.username?.toLowerCase().includes(q) ||
          other?.email?.toLowerCase().includes(q)
        );
      });
    }

    return list;
  }, [conversations, filterType, searchQuery, user._id]);

  const formatMessageTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) {
      return 'Yesterday';
    }
    if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-full h-full flex flex-col bg-cs-surface border-r border-cs-border select-none">
      {/* Top Header */}
      <div className="p-4 border-b border-cs-border shrink-0 space-y-3 bg-cs-surface">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold font-heading text-cs-text-primary tracking-tight">
            Chats
          </h2>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setGroupModalError('');
                setIsCreateGroupOpen(true);
              }}
              className="p-2 rounded-xl text-cs-accent hover:bg-cs-accent-soft transition-colors focus-ring cursor-pointer"
              title="Create New Group"
              aria-label="New Group"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        {/* Search Input Bar */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-cs-text-muted" />
          <input
            type="text"
            placeholder="Search chats or people..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-cs-surface-raised border border-cs-border rounded-xl text-xs text-cs-text-primary placeholder:text-cs-text-muted focus:bg-cs-surface focus:border-cs-accent focus:ring-2 focus:ring-cs-accent/20 focus-ring transition-all"
            aria-label="Search conversations or users"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-cs-text-muted hover:text-cs-text-primary p-0.5 rounded-md"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 pt-0.5">
          {[
            { id: 'all', label: 'All' },
            { id: 'direct', label: 'Direct' },
            { id: 'group', label: 'Groups' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer focus-ring ${
                filterType === tab.id
                  ? 'bg-cs-accent text-white shadow-xs'
                  : 'bg-cs-surface-raised text-cs-text-secondary hover:text-cs-text-primary hover:bg-cs-surface-raised/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main List Feed */}
      <div className="flex-1 overflow-y-auto divide-y divide-cs-border/40">
        {/* People Search Results (shown if searching) */}
        {searchQuery.trim() && userSearchResults.length > 0 && (
          <div className="bg-cs-surface-raised/50 pb-2">
            <div className="px-4 py-2 text-[10px] font-bold text-cs-text-muted uppercase tracking-wider flex items-center justify-between">
              <span>People ({userSearchResults.length})</span>
              {isSearchingUsers && <span className="animate-pulse">Searching...</span>}
            </div>
            {userSearchResults.map(u => (
              <div
                key={u._id}
                onClick={() => startConversation(u)}
                className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-cs-surface cursor-pointer transition-colors"
              >
                <Avatar user={u} size="sm" showPresence isOnline={u.isOnline} />
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-cs-text-primary truncate">
                    {u.fullName}
                  </h4>
                  <p className="text-[11px] text-cs-text-muted truncate">
                    @{u.username} • {u.isOnline ? 'Online' : 'Offline'}
                  </p>
                </div>
                <Button size="sm" variant="secondary" className="shrink-0 text-[11px] py-1 px-2.5">
                  Chat
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Existing Conversations Feed */}
        {isLoading ? (
          <div className="p-8 text-center text-xs text-cs-text-muted">
            <div className="w-6 h-6 border-2 border-cs-accent border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading chats...
          </div>
        ) : filteredConversations.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title={searchQuery ? 'No conversations found' : 'No chats yet'}
            description={
              searchQuery
                ? `No existing chats matching "${searchQuery}". Check the People section or try another name.`
                : 'Start a direct chat with someone or create a new group room.'
            }
            action={
              !searchQuery && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsCreateGroupOpen(true)}
                  icon={Plus}
                >
                  Create Group
                </Button>
              )
            }
          />
        ) : (
          filteredConversations.map(conv => {
            const isGroup = conv.type === 'group';
            const otherUser = isGroup ? null : conv.participants?.find(p => p._id !== user._id);
            const isSelected = activeConversation?._id === conv._id;

            const name = isGroup ? conv.name : otherUser?.fullName || 'User';
            const isOnline = isGroup ? false : !!otherUser?.isOnline;
            const typingText = typingConversations[conv._id];

            const lastMsg = conv.lastMessage;
            const isLastMsgMine = lastMsg && ((lastMsg.senderId === user._id) || (lastMsg.senderId?._id === user._id));

            return (
              <div
                key={conv._id}
                onClick={() => onSelectConversation(conv)}
                className={`flex items-center gap-3 px-3.5 py-3 h-16 cursor-pointer transition-colors relative border-l-3 ${
                  isSelected
                    ? 'bg-cs-accent-soft/80 border-cs-accent'
                    : 'hover:bg-cs-surface-raised/70 border-transparent'
                }`}
              >
                {/* Avatar with Presence */}
                <Avatar
                  user={otherUser}
                  name={isGroup ? conv.name : undefined}
                  isGroup={isGroup}
                  showPresence={!isGroup}
                  isOnline={isOnline}
                  size="md"
                />

                {/* Metadata & Message Preview */}
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h4 className="text-xs font-bold text-cs-text-primary truncate pr-1">
                      {name}
                    </h4>
                    {lastMsg?.createdAt && (
                      <span className="text-[10px] text-cs-text-muted shrink-0 font-medium">
                        {formatMessageTime(lastMsg.createdAt)}
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="text-xs text-cs-text-secondary truncate pr-2 flex items-center gap-1">
                      {typingText ? (
                        <span className="text-cs-accent font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-cs-accent animate-pulse" />
                          {typingText}
                        </span>
                      ) : lastMsg ? (
                        <>
                          {isLastMsgMine && (
                            <span className="shrink-0 text-cs-text-muted">
                              {lastMsg.status === 'read' ? (
                                <CheckCheck size={13} className="text-sky-500" />
                              ) : lastMsg.status === 'delivered' ? (
                                <CheckCheck size={13} className="text-cs-text-muted" />
                              ) : (
                                <Check size={13} className="text-cs-text-muted" />
                              )}
                            </span>
                          )}
                          <span className="truncate">
                            {isGroup && lastMsg.senderId && !isLastMsgMine ? (
                              <strong className="text-cs-text-primary font-medium">
                                {lastMsg.senderId.fullName?.split(' ')[0]}:{' '}
                              </strong>
                            ) : null}
                            {lastMsg.text}
                          </span>
                        </>
                      ) : (
                        <span className="text-cs-text-muted italic text-[11px]">
                          No messages yet
                        </span>
                      )}
                    </div>

                    {isGroup && (
                      <Badge variant="neutral" size="xs" className="shrink-0 text-[10px]">
                        {conv.participants?.length || 0}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Group Modal */}
      <Modal
        isOpen={isCreateGroupOpen}
        onClose={() => setIsCreateGroupOpen(false)}
        title="Create Group Room"
        description="Collaborate in real-time with multiple teammates"
      >
        {groupModalError && (
          <div className="mb-4 p-3 bg-cs-danger/10 border border-cs-danger/30 rounded-xl text-xs text-cs-danger flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{groupModalError}</span>
          </div>
        )}

        <form onSubmit={handleCreateGroup} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-cs-text-primary mb-1">
              Group Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Distributed Systems Lab"
              required
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-3 py-2 bg-cs-surface-raised border border-cs-border rounded-xl text-xs text-cs-text-primary placeholder:text-cs-text-muted focus:border-cs-accent focus:bg-cs-surface focus:ring-2 focus:ring-cs-accent/20 focus-ring"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-cs-text-primary mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              placeholder="Project goals or group purpose"
              value={groupDesc}
              onChange={(e) => setGroupDesc(e.target.value)}
              className="w-full px-3 py-2 bg-cs-surface-raised border border-cs-border rounded-xl text-xs text-cs-text-primary placeholder:text-cs-text-muted focus:border-cs-accent focus:bg-cs-surface focus:ring-2 focus:ring-cs-accent/20 focus-ring"
            />
          </div>

          {/* Member Search & Selection */}
          <div>
            <label className="block text-xs font-semibold text-cs-text-primary mb-1">
              Add Members ({selectedMembers.length} selected)
            </label>

            {/* Selected Member Chips */}
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2.5 max-h-24 overflow-y-auto p-1.5 bg-cs-surface-raised/60 rounded-xl border border-cs-border">
                {selectedMembers.map(m => (
                  <span
                    key={m._id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cs-accent-soft text-cs-accent text-xs font-semibold border border-cs-accent/20"
                  >
                    <span>{m.fullName}</span>
                    <button
                      type="button"
                      onClick={() => toggleMemberSelection(m)}
                      className="hover:text-cs-danger p-0.5"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cs-text-muted" />
              <input
                type="text"
                placeholder="Search users to add..."
                value={groupSearchQuery}
                onChange={handleGroupUserSearch}
                className="w-full pl-8 pr-3 py-2 bg-cs-surface-raised border border-cs-border rounded-xl text-xs text-cs-text-primary placeholder:text-cs-text-muted focus:border-cs-accent focus:bg-cs-surface focus:ring-2 focus:ring-cs-accent/20 focus-ring"
              />
            </div>

            {/* Search candidates list */}
            {groupSearchResults.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto divide-y divide-cs-border border border-cs-border rounded-xl bg-cs-surface">
                {groupSearchResults.map(m => {
                  const isSelected = selectedMembers.some(sm => sm._id === m._id);
                  return (
                    <div
                      key={m._id}
                      onClick={() => toggleMemberSelection(m)}
                      className={`flex items-center justify-between p-2.5 hover:bg-cs-surface-raised cursor-pointer transition-colors ${
                        isSelected ? 'bg-cs-accent-soft/60' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar user={m} size="xs" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-cs-text-primary truncate">
                            {m.fullName}
                          </p>
                          <p className="text-[10px] text-cs-text-muted truncate">@{m.username}</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                        isSelected
                          ? 'bg-cs-accent border-cs-accent text-white'
                          : 'border-cs-border bg-cs-surface'
                      }`}>
                        {isSelected && <Check size={12} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateGroupOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmittingGroup}
              disabled={isSubmittingGroup || !groupName.trim() || selectedMembers.length < 1}
            >
              Create Group
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Sidebar;
