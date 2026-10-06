import React, { useContext, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import NavigationRail from '../components/NavigationRail';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import Avatar from '../components/ui/Avatar';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import { 
  LogOut, Sun, Moon, Settings, Mail, Shield, 
  CheckCircle2, MessageSquare, User as UserIcon
} from 'lucide-react';

export const Dashboard = () => {
  const { user, logout } = useContext(AuthContext);
  const { connectionStatus } = useContext(SocketContext);
  const { theme, toggleTheme } = useTheme();
  
  const [activeConversation, setActiveConversation] = useState(null);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState('profile'); // 'profile' | 'appearance' | 'account'
  const [mobileTab, setMobileTab] = useState('chats'); // 'chats' | 'profile' | 'settings'

  const handleSelectConversation = (conv) => {
    setActiveConversation(conv);
    setIsMobileChatOpen(true);
  };

  const handleBackToList = () => {
    setIsMobileChatOpen(false);
  };

  const handleConversationUpdated = (updatedConv) => {
    if (activeConversation && activeConversation._id === updatedConv._id) {
      setActiveConversation(updatedConv);
    }
  };

  return (
    <div className="h-screen w-full bg-cs-bg flex overflow-hidden font-sans text-cs-text-primary transition-colors duration-200">
      {/* Desktop Icon Rail (>= 768px) */}
      <div className="hidden md:flex shrink-0">
        <NavigationRail
          activeTab="chats"
          onSelectTab={() => {}}
          onOpenSettings={() => {
            setActiveSettingsTab('appearance');
            setIsSettingsModalOpen(true);
          }}
          onOpenProfile={() => {
            setActiveSettingsTab('profile');
            setIsSettingsModalOpen(true);
          }}
        />
      </div>

      {/* Main Workspace Layout */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Conversations Column */}
        <div
          className={`
            absolute inset-0 z-20 md:relative md:flex md:w-[320px] lg:w-[340px] shrink-0
            transition-transform duration-200 ease-in-out bg-cs-surface
            ${isMobileChatOpen ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}
          `}
        >
          <div className="w-full h-full flex flex-col">
            <Sidebar
              onSelectConversation={handleSelectConversation}
              activeConversation={activeConversation}
              onOpenProfile={() => {
                setActiveSettingsTab('profile');
                setIsSettingsModalOpen(true);
              }}
            />

            {/* Mobile Bottom Navigation (< 768px) */}
            <div className="md:hidden border-t border-cs-border bg-cs-surface flex items-center justify-around py-2.5 px-4 shrink-0">
              <button
                onClick={() => setMobileTab('chats')}
                className={`flex flex-col items-center gap-1 text-xs font-semibold ${
                  mobileTab === 'chats' ? 'text-cs-accent' : 'text-cs-text-muted'
                }`}
              >
                <MessageSquare size={18} />
                <span>Chats</span>
              </button>

              <button
                onClick={() => {
                  setActiveSettingsTab('appearance');
                  setIsSettingsModalOpen(true);
                }}
                className="flex flex-col items-center gap-1 text-xs font-semibold text-cs-text-muted hover:text-cs-text-primary"
              >
                <Settings size={18} />
                <span>Settings</span>
              </button>

              <button
                onClick={() => {
                  setActiveSettingsTab('profile');
                  setIsSettingsModalOpen(true);
                }}
                className="flex flex-col items-center gap-1 text-xs font-semibold text-cs-text-muted hover:text-cs-text-primary"
              >
                <UserIcon size={18} />
                <span>Profile</span>
              </button>
            </div>
          </div>
        </div>

        {/* Active Chat Column */}
        <div
          className={`
            absolute inset-0 z-10 md:relative md:flex md:flex-1 overflow-hidden
            transition-transform duration-200 ease-in-out bg-cs-bg
            ${isMobileChatOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
          `}
        >
          <ChatArea
            conversation={activeConversation}
            onBack={handleBackToList}
            connectionStatus={connectionStatus}
            onConversationUpdated={handleConversationUpdated}
          />
        </div>
      </main>

      {/* Profile & Settings Modern Modal */}
      <Modal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        title="Settings & Profile"
        description="Preferences and account identity"
      >
        <div>
          {/* Navigation Tabs */}
          <div className="flex border-b border-cs-border gap-4 text-xs font-semibold mb-4">
            <button
              onClick={() => setActiveSettingsTab('profile')}
              className={`pb-2.5 transition-colors border-b-2 cursor-pointer ${
                activeSettingsTab === 'profile'
                  ? 'border-cs-accent text-cs-accent'
                  : 'border-transparent text-cs-text-muted hover:text-cs-text-primary'
              }`}
            >
              Profile
            </button>
            <button
              onClick={() => setActiveSettingsTab('appearance')}
              className={`pb-2.5 transition-colors border-b-2 cursor-pointer ${
                activeSettingsTab === 'appearance'
                  ? 'border-cs-accent text-cs-accent'
                  : 'border-transparent text-cs-text-muted hover:text-cs-text-primary'
              }`}
            >
              Appearance
            </button>
            <button
              onClick={() => setActiveSettingsTab('account')}
              className={`pb-2.5 transition-colors border-b-2 cursor-pointer ${
                activeSettingsTab === 'account'
                  ? 'border-cs-accent text-cs-accent'
                  : 'border-transparent text-cs-text-muted hover:text-cs-text-primary'
              }`}
            >
              Account
            </button>
          </div>

          {/* Modal Tab Body */}
          {activeSettingsTab === 'profile' && (
            <div className="space-y-4">
              <div className="text-center pb-2">
                <Avatar
                  user={user}
                  size="xl"
                  showPresence
                  isOnline={true}
                  className="mx-auto mb-2.5"
                />
                <h4 className="text-base font-bold text-cs-text-primary font-heading">
                  {user?.fullName}
                </h4>
                <p className="text-xs text-cs-text-muted">
                  @{user?.username}
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="p-3 bg-cs-surface-raised rounded-xl border border-cs-border">
                  <div className="flex items-center gap-2 text-cs-text-muted mb-0.5">
                    <Mail size={13} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Email Address</span>
                  </div>
                  <p className="text-xs font-medium text-cs-text-primary">
                    {user?.email}
                  </p>
                </div>

                <div className="p-3 bg-cs-surface-raised rounded-xl border border-cs-border">
                  <div className="flex items-center gap-2 text-cs-text-muted mb-0.5">
                    <Shield size={13} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Status Message</span>
                  </div>
                  <p className="text-xs font-medium text-cs-text-primary">
                    {user?.status || 'Active on ChatSphere'}
                  </p>
                </div>

                <div className="p-3 bg-cs-surface-raised rounded-xl border border-cs-border flex items-center justify-between">
                  <div className="flex items-center gap-2 text-cs-text-muted">
                    <CheckCircle2 size={13} className="text-cs-online" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Presence Status</span>
                  </div>
                  <Badge variant="online" size="sm">
                    Online
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {activeSettingsTab === 'appearance' && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-cs-text-primary mb-2">
                Interface Color Scheme
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => theme === 'dark' && toggleTheme()}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                    theme === 'light'
                      ? 'border-cs-accent bg-cs-accent-soft text-cs-accent ring-2 ring-cs-accent/20'
                      : 'border-cs-border hover:bg-cs-surface-raised text-cs-text-secondary'
                  }`}
                >
                  <Sun size={20} className={theme === 'light' ? 'text-cs-accent' : 'text-cs-text-muted'} />
                  <span className="text-xs font-bold font-heading">Light Mode</span>
                  <span className="text-[10px] text-cs-text-muted">Calm daylight aesthetic</span>
                </button>

                <button
                  onClick={() => theme === 'light' && toggleTheme()}
                  className={`p-3.5 rounded-2xl border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                    theme === 'dark'
                      ? 'border-cs-accent bg-cs-accent-soft text-cs-accent ring-2 ring-cs-accent/20'
                      : 'border-cs-border hover:bg-cs-surface-raised text-cs-text-secondary'
                  }`}
                >
                  <Moon size={20} className={theme === 'dark' ? 'text-cs-accent' : 'text-cs-text-muted'} />
                  <span className="text-xs font-bold font-heading">Dark Mode</span>
                  <span className="text-[10px] text-cs-text-muted">Deep sleek night aesthetic</span>
                </button>
              </div>
            </div>
          )}

          {activeSettingsTab === 'account' && (
            <div className="space-y-4">
              <div className="p-3 bg-cs-surface-raised rounded-xl border border-cs-border space-y-1">
                <p className="text-xs font-bold text-cs-text-primary">Session Security</p>
                <p className="text-[11px] text-cs-text-muted">
                  Your session is authenticated via secure JSON Web Token with automated socket sync.
                </p>
              </div>

              <div className="pt-2">
                <Button
                  variant="danger"
                  size="md"
                  className="w-full"
                  onClick={logout}
                  icon={LogOut}
                >
                  Log Out of ChatSphere
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Dashboard;
