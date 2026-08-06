import React, { useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';

interface NDRToastProps {
  message: string | null;
  onClose: () => void;
  duration?: number;
}

export const NDRToast: React.FC<NDRToastProps> = ({ message, onClose, duration = 4000 }) => {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-bounce-in">
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 shadow-2xl border border-neutral-700/50 dark:border-neutral-300/50">
        <CheckCircle2 className="h-5 w-5 text-emerald-400 dark:text-emerald-600 shrink-0" />
        <span className="text-xs font-bold">{message}</span>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-200 transition"
        >
          <X className="h-4 w-4 text-neutral-400 hover:text-white dark:hover:text-neutral-900" />
        </button>
      </div>
    </div>
  );
};
