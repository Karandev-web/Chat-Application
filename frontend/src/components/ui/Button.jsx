import React from 'react';
import { Loader2 } from 'lucide-react';

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  icon: Icon,
  className = '',
  type = 'button',
  onClick,
  ...props
}) => {
  const variantClasses = {
    primary:
      'bg-cs-accent hover:bg-cs-accent-hover active:scale-[0.98] text-white shadow-xs focus-ring',
    secondary:
      'bg-cs-surface-raised hover:bg-cs-surface text-cs-text-primary border border-cs-border focus-ring',
    ghost:
      'text-cs-text-secondary hover:text-cs-text-primary hover:bg-cs-surface-raised active:bg-cs-surface focus-ring',
    danger:
      'bg-cs-danger/10 hover:bg-cs-danger/20 text-cs-danger border border-cs-danger/30 focus-ring',
    accentSoft:
      'bg-cs-accent-soft hover:bg-cs-accent-soft/80 text-cs-accent border border-cs-accent/20 focus-ring',
  };

  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-xs rounded-xl font-medium gap-1.5',
    md: 'px-3.5 py-2 text-xs rounded-xl font-semibold gap-2',
    lg: 'px-5 py-2.5 text-sm rounded-xl font-semibold gap-2.5',
    icon: 'p-2 rounded-xl',
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`inline-flex items-center justify-center transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer ${
        variantClasses[variant] || variantClasses.primary
      } ${sizeClasses[size] || sizeClasses.md} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="animate-spin text-current" size={size === 'sm' ? 14 : 16} />
      ) : (
        Icon && <Icon size={size === 'sm' ? 14 : 16} className="shrink-0" />
      )}
      {children}
    </button>
  );
};

export default Button;
