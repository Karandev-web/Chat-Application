import React, { useState } from 'react';
import { Users } from 'lucide-react';

const GRADIENTS = [
  'from-indigo-600 to-violet-600',
  'from-blue-600 to-cyan-600',
  'from-emerald-600 to-teal-600',
  'from-violet-600 to-fuchsia-600',
  'from-rose-600 to-amber-500',
  'from-amber-600 to-orange-600',
  'from-sky-600 to-indigo-600',
  'from-pink-600 to-rose-600',
];

const getGradient = (str = '') => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % GRADIENTS.length;
  return GRADIENTS[index];
};

const getInitials = (name = '') => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

export const Avatar = ({
  user,
  name,
  id,
  image,
  isGroup = false,
  isOnline = false,
  showPresence = false,
  size = 'md',
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);

  const displayName = name || user?.fullName || user?.name || user?.username || 'User';
  const displayId = id || user?._id || displayName;
  const avatarImage = !imageError ? (image || user?.profilePicture) : null;

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px] rounded-lg',
    sm: 'w-8 h-8 text-xs rounded-xl',
    md: 'w-10 h-10 text-sm rounded-xl',
    lg: 'w-12 h-12 text-base rounded-2xl',
    xl: 'w-16 h-16 text-xl rounded-2xl',
  };

  const dotSizeClasses = {
    xs: 'w-2 h-2 -bottom-0.5 -right-0.5 border',
    sm: 'w-2.5 h-2.5 -bottom-0.5 -right-0.5 border-2',
    md: 'w-3 h-3 -bottom-0.5 -right-0.5 border-2',
    lg: 'w-3.5 h-3.5 -bottom-0.5 -right-0.5 border-2',
    xl: 'w-4 h-4 -bottom-1 -right-1 border-2',
  };

  const gradientClass = getGradient(displayId);

  return (
    <div className={`relative shrink-0 select-none ${className}`}>
      {isGroup ? (
        <div
          className={`${sizeClasses[size] || sizeClasses.md} bg-cs-accent-soft text-cs-accent border border-cs-border flex items-center justify-center font-bold shadow-xs`}
          aria-label={displayName}
        >
          <Users size={size === 'xs' ? 12 : size === 'sm' ? 15 : size === 'lg' ? 22 : size === 'xl' ? 28 : 18} />
        </div>
      ) : avatarImage ? (
        <img
          src={avatarImage}
          alt={displayName}
          onError={() => setImageError(true)}
          className={`${sizeClasses[size] || sizeClasses.md} object-cover shadow-xs border border-cs-border`}
        />
      ) : (
        <div
          className={`${sizeClasses[size] || sizeClasses.md} bg-gradient-to-tr ${gradientClass} text-white font-bold flex items-center justify-center shadow-xs`}
          aria-label={displayName}
        >
          {getInitials(displayName)}
        </div>
      )}

      {showPresence && !isGroup && (
        <span
          className={`absolute rounded-full border-cs-surface ${dotSizeClasses[size] || dotSizeClasses.md} ${
            isOnline ? 'bg-cs-online' : 'bg-cs-offline'
          }`}
          title={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
};

export default Avatar;
