import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closable?: boolean;
}

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export default function Modal({ open, onClose, title, subtitle, children, footer, size = 'md', closable = true }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closable) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose, closable]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md animate-fade-in" onClick={closable ? onClose : undefined} />
      <div className={`relative card w-[calc(100vw-1rem)] sm:w-full ${sizes[size]} max-h-[90vh] flex flex-col animate-scale-in shadow-dropdown`}>
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 px-4 sm:px-6 py-3.5 sm:py-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">{title}</h2>
            {subtitle && <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">{subtitle}</p>}
          </div>
          {closable && (
            <button
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-200 transition active:scale-90"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="overflow-y-auto px-3.5 sm:px-6 py-4 sm:py-5 flex-1 space-y-4">{children}</div>
        {footer && <div className="border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 px-4 sm:px-6 py-3.5 sm:py-4 flex justify-end gap-3 rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  );
}
