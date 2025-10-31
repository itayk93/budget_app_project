import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer,
  size = 'medium',
  closeOnBackdrop = true,
  className = ''
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Prevent interactions with the page behind the modal
      const appRoot = document.getElementById('root') || document.querySelector('#app');
      if (appRoot) {
        appRoot.setAttribute('inert', '');
        appRoot.setAttribute('aria-hidden', 'true');
      }
    } else {
      document.body.style.overflow = 'unset';
      const appRoot = document.getElementById('root') || document.querySelector('#app');
      if (appRoot) {
        appRoot.removeAttribute('inert');
        appRoot.removeAttribute('aria-hidden');
      }
    }

    return () => {
      document.body.style.overflow = 'unset';
      const appRoot = document.getElementById('root') || document.querySelector('#app');
      if (appRoot) {
        appRoot.removeAttribute('inert');
        appRoot.removeAttribute('aria-hidden');
      }
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && closeOnBackdrop) {
      onClose();
    }
  };

  const sizeClass = {
    small: 'max-w-md',
    medium: 'max-w-2xl',
    large: 'max-w-4xl',
    full: 'max-w-full mx-4'
  }[size];

  return createPortal(
    <div className="modal-overlay" onClick={handleBackdropClick}>
      <div 
        className={`modal ${sizeClass} ${className}`}
        dir="rtl"
        role="dialog"
        aria-modal="true"
        // Stop all click events from bubbling to the page beneath
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="modal-header">
            <h3 className="modal-title">{title}</h3>
            <button
              className="modal-close"
              onClick={onClose}
              aria-label="סגור"
            >
              ×
            </button>
          </div>
        )}
        
        {children}
        
        {footer && footer}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
