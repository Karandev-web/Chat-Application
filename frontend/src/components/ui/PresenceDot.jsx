import React from 'react';

export const PresenceDot = ({ isOnline = false, size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  return (
    <span
      className={`inline-block rounded-full ${sizeClasses[size] || sizeClasses.md} ${
        isOnline ? 'bg-cs-online' : 'bg-cs-offline'
      } ${className}`}
      title={isOnline ? 'Online' : 'Offline'}
      aria-label={isOnline ? 'Online' : 'Offline'}
    />
  );
};

export default PresenceDot;
