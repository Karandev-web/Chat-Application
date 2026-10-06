import React, { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Avatar from './ui/Avatar';
import { 
  MessageSquare, Sun, Moon, Settings, LogOut, Sparkles
} from 'lucide-react';

export const NavigationRail = ({
  activeTab = 'chats',
  onSelectTab,
  totalUnreadCount = 0,
  onOpenSettings,
  onOpenProfile,
}) => {
  const { user, logout } = useContext(AuthContext);
  const { theme, toggleTheme } = useTheme();

  return (
    <aside
      className="w-16 h-full bg-cs-surface border-r border-cs-border flex flex-col items-center justify-between py-4 select-none shrink-0 z-30"
      aria-label="Sidebar Navigation"
    >
      {/* Top: ChatSphere Brand Logo & Home Trigger */}
      <div className="flex flex-col items-center">
        <button
          onClick={() => onSelectTab && onSelectTab('chats')}
          className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/25 relative group cursor-pointer focus-ring transition-transform hover:scale-105 active:scale-95"
          title="ChatSphere"
          aria-label="ChatSphere"
        >
          <MessageSquare size={20} className="relative z-10" />
          {totalUnreadCount > 0 ? (
            <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-cs-danger text-white text-[9px] font-bold flex items-center justify-center border-2 border-cs-surface">
              {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
            </span>
          ) : (
            <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-cs-surface rounded-full flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-cs-accent animate-pulse" />
            </span>
          )}
        </button>
      </div>

      {/* Middle / Bottom utilities */}
      <div className="flex flex-col items-center gap-3">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-2xl text-cs-text-secondary hover:text-cs-text-primary hover:bg-cs-surface-raised transition-colors focus-ring cursor-pointer"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? (
            <Sun size={19} className="text-amber-400" />
          ) : (
            <Moon size={19} className="text-cs-text-secondary" />
          )}
        </button>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="p-2.5 rounded-2xl text-cs-text-secondary hover:text-cs-text-primary hover:bg-cs-surface-raised transition-colors focus-ring cursor-pointer"
          title="Settings"
          aria-label="Settings"
        >
          <Settings size={19} />
        </button>

        {/* Divider */}
        <div className="w-8 h-px bg-cs-border my-1" />

        {/* User Avatar */}
        <button
          onClick={onOpenProfile}
          className="p-0.5 rounded-2xl hover:ring-2 hover:ring-cs-accent/40 transition-all focus-ring cursor-pointer"
          title={`${user?.fullName || 'User'} (View Profile)`}
          aria-label="User Profile"
        >
          <Avatar
            user={user}
            size="sm"
            showPresence
            isOnline={true}
          />
        </button>

        {/* Logout */}
        <button
          onClick={logout}
          className="p-2.5 rounded-2xl text-cs-text-muted hover:text-cs-danger hover:bg-cs-danger/10 transition-colors focus-ring cursor-pointer"
          title="Sign out of ChatSphere"
          aria-label="Log Out"
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
};

export default NavigationRail;
