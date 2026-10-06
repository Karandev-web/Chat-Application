import React, { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import { 
  LogOut, WifiOff, Loader2, MessageSquare, X, Mail, Shield, 
  CheckCircle2, Sun, Moon, Settings, User as UserIcon
} from 'lucide-react';

const Dashboard = () => {
  const { user, logout } = useContext(AuthContext);
  const { connectionStatus } = useContext(SocketContext);
  const { theme, toggleTheme } = useTheme();
  
  const [activeConversation, setActiveConversation] = useState(null);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState('profile'); // 'profile' | 'appearance' | 'account'

  const handleSelectConversation = (conv) => {
    setActiveConversation(conv);
    setIsMobileChatOpen(true);
  };

  const handleBackToList = () => {
    setIsMobileChatOpen(false);
  };

  // Connection status indicator (only shown if connection drop/reconnect occurs)
  const renderConnectionWarning = () => {
    if (connectionStatus === 'reconnecting') {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
          <Loader2 size={12} className="animate-spin text-amber-500" />
          <span>Reconnecting...</span>
        </div>
      );
    }
    if (connectionStatus === 'disconnected') {
      return (
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          <WifiOff size={12} className="text-rose-500" />
          <span>Connection Lost</span>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-screen w-full bg-slate-100 dark:bg-slate-950 flex flex-col overflow-hidden font-sans text-slate-800 dark:text-slate-100 transition-colors duration-200">
      {/* Top Application Header */}
      <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-4 sm:px-6 py-2.5 flex justify-between items-center z-30 shrink-0 shadow-xs">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/25">
            <MessageSquare size={17} />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-none">
              ChatSphere
            </h1>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Connection warning if offline */}
          {renderConnectionWarning()}

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? (
              <Sun size={17} className="text-amber-400" />
            ) : (
              <Moon size={17} className="text-slate-600" />
            )}
          </button>

          {/* User Profile / Settings Button */}
          <button
            onClick={() => {
              setActiveSettingsTab('profile');
              setIsSettingsModalOpen(true);
            }}
            className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            title="Profile & Settings"
            aria-label="Open Profile and Settings"
          >
            <div className="relative">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 border border-white dark:border-slate-900 rounded-full"></span>
            </div>
            <span className="hidden md:inline text-xs font-semibold text-slate-700 dark:text-slate-200">
              {user?.fullName?.split(' ')[0]}
            </span>
          </button>

          {/* Logout */}
          <button 
            onClick={logout}
            className="p-2 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors text-xs font-medium flex items-center gap-1.5"
            title="Log out of account"
            aria-label="Logout"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>
      
      {/* Main Workspace */}
      <main className="flex-1 overflow-hidden flex relative">
        {/* Left Sidebar (Conversations) */}
        <div className={`
          absolute inset-0 z-20 bg-white dark:bg-slate-900 md:relative md:flex md:w-80 lg:w-[360px] md:border-r md:border-slate-200/80 md:dark:border-slate-800/80
          transition-transform duration-200 ease-in-out
          ${isMobileChatOpen ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}
        `}>
          <Sidebar
            onSelectConversation={handleSelectConversation}
            activeConversation={activeConversation}
            onOpenProfile={() => {
              setActiveSettingsTab('profile');
              setIsSettingsModalOpen(true);
            }}
          />
        </div>
        
        {/* Chat Area */}
        <div className={`
          absolute inset-0 z-10 bg-slate-50 dark:bg-slate-950 md:relative md:flex md:flex-1
          transition-transform duration-200 ease-in-out
          ${isMobileChatOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
        `}>
          <ChatArea
            conversation={activeConversation}
            onBack={handleBackToList}
            connectionStatus={connectionStatus}
          />
        </div>
      </main>

      {/* Profile & Settings Modern Dialog */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/70 dark:bg-slate-800/40">
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  Settings & Profile
                </h3>
              </div>
              <button 
                onClick={() => setIsSettingsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
                aria-label="Close settings"
              >
                <X size={16} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-100 dark:border-slate-800 px-5 pt-2 gap-4 text-xs font-semibold">
              <button
                onClick={() => setActiveSettingsTab('profile')}
                className={`pb-2.5 transition-colors border-b-2 ${
                  activeSettingsTab === 'profile'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                Profile
              </button>
              <button
                onClick={() => setActiveSettingsTab('appearance')}
                className={`pb-2.5 transition-colors border-b-2 ${
                  activeSettingsTab === 'appearance'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                Appearance
              </button>
              <button
                onClick={() => setActiveSettingsTab('account')}
                className={`pb-2.5 transition-colors border-b-2 ${
                  activeSettingsTab === 'account'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                Account
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex-1 overflow-y-auto">
              {activeSettingsTab === 'profile' && (
                <div className="space-y-4">
                  {/* Avatar & Names */}
                  <div className="text-center pb-2">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-2xl flex items-center justify-center mx-auto mb-2.5 shadow-md shadow-blue-500/20">
                      {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <h4 className="text-base font-bold text-slate-800 dark:text-white">
                      {user?.fullName}
                    </h4>
                    <p className="text-xs text-slate-400 dark:text-slate-400">
                      @{user?.username}
                    </p>
                  </div>

                  {/* Profile info cards */}
                  <div className="space-y-2.5">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2 text-slate-400 dark:text-slate-400 mb-0.5">
                        <Mail size={13} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Email Address</span>
                      </div>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                        {user?.email}
                      </p>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2 text-slate-400 dark:text-slate-400 mb-0.5">
                        <Shield size={13} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Status Message</span>
                      </div>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                        {user?.status || 'Using ChatSphere'}
                      </p>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-400 dark:text-slate-400">
                        <CheckCircle2 size={13} className="text-emerald-500" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Live Status</span>
                      </div>
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 capitalize flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Online
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsTab === 'appearance' && (
                <div className="space-y-4">
                  <div>
                    <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                      Interface Theme
                    </h5>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => theme === 'dark' && toggleTheme()}
                        className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                          theme === 'light'
                            ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 text-blue-600'
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <Sun size={18} className={theme === 'light' ? 'text-blue-600' : 'text-slate-400'} />
                        <span className="text-xs font-bold">Light Mode</span>
                        <span className="text-[10px] text-slate-400">Clean, bright interface</span>
                      </button>

                      <button
                        onClick={() => theme === 'light' && toggleTheme()}
                        className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                          theme === 'dark'
                            ? 'border-blue-500 bg-blue-950/40 text-blue-400'
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <Moon size={18} className={theme === 'dark' ? 'text-blue-400' : 'text-slate-400'} />
                        <span className="text-xs font-bold">Dark Mode</span>
                        <span className="text-[10px] text-slate-400">Deep, sleek modern dark</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeSettingsTab === 'account' && (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">Session Security</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Your session is authenticated via secure JSON Web Token.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={logout}
                      className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl border border-rose-200/60 dark:border-rose-900/40 transition-colors flex items-center justify-center gap-2"
                    >
                      <LogOut size={15} />
                      <span>Log Out of ChatSphere</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 flex justify-end">
              <button
                onClick={() => setIsSettingsModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
