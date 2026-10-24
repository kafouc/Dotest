/**
 * Composant Toast pour les notifications
 */

'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export type Toast = {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
};

type ToastProps = {
  toast: Toast;
  onClose: (id: string) => void;
};

const toastStyles = {
  success: {
    bg: 'bg-brand-teal-light',
    border: 'border-brand-teal',
    text: 'text-brand-teal-dark',
    icon: '✓',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    icon: '✕',
  },
  warning: {
    bg: 'bg-brand-yellow-light',
    border: 'border-brand-yellow',
    text: 'text-brand-yellow-dark',
    icon: '⚠',
  },
  info: {
    bg: 'bg-brand-teal-light',
    border: 'border-brand-teal',
    text: 'text-brand-teal-dark',
    icon: 'ℹ',
  },
};

function ToastItem({ toast, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose(toast.id), 300); // Attend la fin de l'animation
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onClose]);

  const style = toastStyles[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : -20, scale: isVisible ? 1 : 0.95 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={`${style.bg} ${style.border} ${style.text} border rounded-lg shadow-lg p-4 flex items-center gap-3 min-w-[300px] max-w-md`}
      role="alert"
      aria-live="polite"
    >
      <span className="text-xl font-bold">{style.icon}</span>
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(() => onClose(toast.id), 300);
        }}
        className="text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Fermer la notification"
      >
        ✕
      </button>
    </motion.div>
  );
}

type ToastContainerProps = {
  toasts: Toast[];
  onClose: (id: string) => void;
};

export default function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-label="Notifications"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onClose={onClose} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Hook pour gérer les toasts
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: ToastType = 'info', duration?: number) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return { toasts, showToast, removeToast };
}

