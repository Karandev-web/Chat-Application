import React from 'react';

export const Badge = ({
  children,
  variant = 'neutral',
  size = 'sm',
  className = '',
}) => {
  const variantClasses = {
    accent: 'bg-cs-accent text-white',
    'accent-soft': 'bg-cs-accent-soft text-cs-accent border border-cs-accent/20',
    neutral: 'bg-cs-surface-raised text-cs-text-secondary border border-cs-border',
    online: 'bg-cs-online/15 text-cs-online border border-cs-online/30',
    danger: 'bg-cs-danger/15 text-cs-danger border border-cs-danger/30',
    warning: 'bg-cs-warning/15 text-cs-warning border border-cs-warning/30',
  };

  const sizeClasses = {
    xs: 'px-1.5 py-0.2 text-[10px] font-semibold rounded-md',
    sm: 'px-2 py-0.5 text-xs font-semibold rounded-lg',
    pill: 'px-2 py-0.5 text-[11px] font-bold rounded-full min-w-5 text-center',
  };

  return (
    <span
      className={`inline-flex items-center justify-center font-medium ${variantClasses[variant] || variantClasses.neutral} ${sizeClasses[size] || sizeClasses.sm} ${className}`}
    >
      {children}
    </span>
  );
};

export default Badge;
