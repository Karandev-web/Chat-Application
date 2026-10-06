import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export const Modal = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'max-w-md',
  footer,
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity duration-150 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative z-10 w-full ${maxWidth} bg-cs-surface border border-cs-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in fade-in zoom-in-95 duration-150`}
      >
        {/* Header */}
        {(title || onClose) && (
          <div className="px-5 py-4 border-b border-cs-border flex items-center justify-between bg-cs-surface-raised/40">
            <div>
              {title && (
                <h3 id="modal-title" className="text-sm font-bold text-cs-text-primary">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-xs text-cs-text-muted mt-0.5">{description}</p>
              )}
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-cs-text-muted hover:text-cs-text-primary hover:bg-cs-surface-raised transition-colors focus-ring"
                aria-label="Close dialog"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {/* Content body */}
        <div className="p-5 flex-1 overflow-y-auto">{children}</div>

        {/* Optional Footer */}
        {footer && (
          <div className="px-5 py-3.5 border-t border-cs-border bg-cs-surface-raised/40 flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
