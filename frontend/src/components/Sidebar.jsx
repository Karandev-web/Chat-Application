import React, { useState, useEffect, useContext } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { Users, Search, X, MessageSquare, Check, Plus, UserPlus, Sparkles } from 'lucide-react';

const Sidebar = ({ onSelectConversation, activeConversation, onOpenProfile }) => {
  const { user } = useContext(AuthContext);
  const { socket } = useContext(SocketContext);

  const [conversations, setConversations] = useState([]);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'direct' | 'group'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Group creation modal state
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);
  const [groupModalError, setGroupModalError] = useState('');

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (socket) {
      const handleConversationUpdated = () => fetchConversations();
      const handleStatusChange = () => fetchConversations();
      const handleGroupAdded = (conversation) => {
        socket.emit('join_group', { conversationId: conversation._id });
        fetchConversations();
      };

      socket.on('conversation_updated', handleConversationUpdated);
      socket.on('userStatusChange', handleStatusChange);
      socket.on('group_added', handleGroupAdded);
      socket.on('group_updated', handleConversationUpdated);

      return () => {
        socket.off('conversation_updated', handleConversationUpdated);
        socket.off('userStatusChange', handleStatusChange);
        socket.off('group_added', handleGroupAdded);
        socket.off('group_updated', handleConversationUpdated);
      };
    }
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

  const handleSearch = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.trim().length > 0) {
      setIsSearching(true);
      try {
        const res = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
        const users = res.data?.data || res.data;
        setSearchResults(Array.isArray(users) ? users : []);
      } catch (err) {
        console.error('Search error:', err);
      }
    } else {
      setIsSearching(false);
      setSearchResults([]);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
    setSearchResults([]);
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

  // Group search & member toggling
  const handleGroupUserSearch = async (e) => {
    const query = e.target.value;
    setGroupSearchQuery(query);
    if (query.trim()) {
      try {
        const res = await api.get(`/users/search?q=${encodeURIComponent(query)}`);
        const users = res.data?.data || res.data;
        setGroupSearchResults(Array.isArray(users) ? users : []);
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

  // Filter conversations based on tab selection
  const filteredConversations = conversations.filter(conv => {
    if (filterType === 'direct') return conv.type === 'direct';
    if (filterType === 'group') return conv.type === 'group';
    return true;
  });

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800/80 select-none transition-colors duration-200">
      {/* Top Sidebar Header */}
      <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40">
        <div className="flex items-center justify-between">
          {/* User Profile Card */}
          <div 
            onClick={onOpenProfile}
            className="flex items-center gap-2.5 min-w-0 cursor-pointer p-1.5 -m-1.5 rounded-xl hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
            title="View profile & settings"
          >
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">
                {user?.fullName || 'User'}
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-400 truncate">
                @{user?.username || 'user'}
              </p>
            </div>
          </div>
          
          {/* New Group Button */}
          <button 
            onClick={() => {
              setGroupModalError('');
              setIsCreateGroupOpen(true);
            }}
            className="px-2.5 py-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-bold"
            title="Create Group Room"
            aria-label="Create New Group"
          >
            <Plus size={15} />
            <span>New Group</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="mt-3 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input 
            type="text" 
            placeholder="Search people or conversations..." 
            className="w-full pl-8 pr-7 py-2 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700/80 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            value={searchQuery}
            onChange={handleSearch}
          />
          {searchQuery && (
            <button 
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        {!isSearching && (
          <div className="flex items-center gap-1 mt-2.5">
            {[
              { id: 'all', label: 'All' },
              { id: 'direct', label: 'Direct' },
              { id: 'group', label: 'Groups' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filterType === tab.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Conversation Feed */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
        {isSearching ? (
          <div>
            <div className="px-4 py-2 text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-850">
              Search Results
            </div>
            {searchResults.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No users found matching "{searchQuery}"
              </div>
            ) : (
              searchResults.map(u => (
                <div 
                  key={u._id} 
                  className="flex items-center gap-3 p-3 hover:bg-blue-50/50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                  onClick={() => startConversation(u)}
                >
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs">
                      {u?.fullName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    {u.isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate leading-snug">
                      {u.fullName}
                    </h4>
                    <p className="text-[11px] text-slate-400 dark:text-slate-400 truncate">
                      @{u.username} • {u.isOnline ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div>
            {isLoading ? (
              <div className="p-8 text-center text-slate-400 text-xs">Loading conversations...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mx-auto mb-2 text-slate-400">
                  <MessageSquare size={18} />
                </div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No conversations yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Search for users above to start chatting</p>
              </div>
            ) : (
              filteredConversations.map(conv => {
                const isGroup = conv.type === 'group';
                const otherUser = isGroup ? null : conv.participants?.find(p => p._id !== user._id);
                const isSelected = activeConversation?._id === conv._id;

                const name = isGroup ? conv.name : otherUser?.fullName || 'User';
                const isOnline = isGroup ? false : otherUser?.isOnline;

                return (
                  <div 
                    key={conv._id} 
                    className={`flex items-center gap-3 p-3 cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-blue-50/80 dark:bg-blue-950/40 border-l-3 border-blue-600 dark:border-blue-500 pl-2.5' 
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-3 border-transparent'
                    }`}
                    onClick={() => onSelectConversation(conv)}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      {isGroup ? (
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs">
                          <Users size={18} />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs shadow-xs">
                          {name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {!isGroup && isOnline && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                          {name}
                        </h4>
                        {conv.lastMessage && (
                          <span className="text-[10px] text-slate-400 dark:text-slate-400 shrink-0 ml-2 font-mono">
                            {new Date(conv.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      <div className="flex justify-between items-center">
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate pr-2">
                          {conv.lastMessage ? (
                            isGroup && conv.lastMessage.senderId ? (
                              <span>
                                <strong className="text-slate-700 dark:text-slate-300 font-semibold">
                                  {conv.lastMessage.senderId.fullName?.split(' ')[0]}:
                                </strong>{' '}
                                {conv.lastMessage.text}
                              </span>
                            ) : (
                              conv.lastMessage.text
                            )
                          ) : (
                            <span className="text-slate-400 italic">No messages yet</span>
                          )}
                        </p>
                        {isGroup && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-md font-medium">
                            {conv.participants?.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* New Group Modal */}
      {isCreateGroupOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/70 dark:bg-slate-800/40">
              <div className="flex items-center gap-2">
                <Users size={17} className="text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">Create Group Room</h3>
              </div>
              <button 
                onClick={() => setIsCreateGroupOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>

            {/* Error Banner */}
            {groupModalError && (
              <div className="mx-5 mt-4 p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200/70 dark:border-rose-900/50 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-medium">
                {groupModalError}
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleCreateGroup} className="p-5 flex-1 overflow-y-auto space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Group Name *
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. Distributed Computing Group"
                  required
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description (Optional)
                </label>
                <input 
                  type="text" 
                  placeholder="Topic or project goals"
                  value={groupDesc}
                  onChange={e => setGroupDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Add Members ({selectedMembers.length} selected)
                </label>

                {/* Selected Member Chips */}
                {selectedMembers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2.5 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                    {selectedMembers.map(m => (
                      <span 
                        key={m._id} 
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                      >
                        {m.fullName}
                        <button 
                          type="button" 
                          onClick={() => toggleMemberSelection(m)}
                          className="hover:text-blue-950 dark:hover:text-blue-100"
                          aria-label={`Remove ${m.fullName}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Search users */}
                <div className="relative mb-2">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search people to add..."
                    value={groupSearchQuery}
                    onChange={handleGroupUserSearch}
                    className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                {/* Search Candidates List */}
                <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800">
                  {groupSearchResults.length === 0 ? (
                    <p className="p-3 text-center text-xs text-slate-400">
                      {groupSearchQuery ? 'No users matching search' : 'Search for users above'}
                    </p>
                  ) : (
                    groupSearchResults.map(candidate => {
                      const isSelected = selectedMembers.some(m => m._id === candidate._id);
                      return (
                        <div 
                          key={candidate._id}
                          onClick={() => toggleMemberSelection(candidate)}
                          className={`flex items-center justify-between p-2.5 cursor-pointer text-xs transition-colors ${
                            isSelected ? 'bg-blue-50/60 dark:bg-blue-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-700/40'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 text-xs">
                              {candidate.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800 dark:text-slate-100">{candidate.fullName}</p>
                              <p className="text-[10px] text-slate-400">@{candidate.username}</p>
                            </div>
                          </div>
                          <div className={`w-4 h-4 rounded-md flex items-center justify-center border ${
                            isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-600'
                          }`}>
                            {isSelected && <Check size={12} />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Submit Action */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingGroup || !groupName.trim() || selectedMembers.length < 1}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmittingGroup ? 'Creating Group...' : `Create Group (${selectedMembers.length + 1} Members)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
