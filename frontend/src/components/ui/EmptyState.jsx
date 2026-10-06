import React from 'react';
import { MessageSquare } from 'lucide-react';

export const EmptyState = ({
  icon: Icon = MessageSquare,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center select-none ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-cs-accent-soft text-cs-accent border border-cs-accent/20 flex items-center justify-center mb-3.5 shadow-xs">
        <Icon size={26} />
      </div>
      {title && (
        <h4 className="text-sm font-bold text-cs-text-primary mb-1">
          {title}
        </h4>
      )}
      {description && (
        <p className="text-xs text-cs-text-muted max-w-xs leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

export default EmptyState;
