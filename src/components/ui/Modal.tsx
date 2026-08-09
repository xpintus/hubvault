import { X } from 'lucide-react';
import { ReactNode,useEffect } from 'react';

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
      <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-lg animate-fade-in" onClick={closable ? onClose : undefined} />
      <div className={`relative card w-[calc(100vw-1rem)] sm:w-full ${sizes[size]} max-h-[90vh] flex flex-col animate-scale-in overflow-hidden border-white/70 shadow-[0_30px_80px_-24px_rgba(2,6,23,.55)] dark:border-white/10`}>
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200/70 bg-gradient-to-r from-brand-50/70 to-transparent px-4 py-4 dark:border-white/5 dark:from-brand-500/10 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <p className="mb-0.5 text-[9px] font-black uppercase tracking-[.18em] text-brand-500">HubVault</p>
            <h2 className="text-lg font-black tracking-tight text-neutral-950 dark:text-white">{title}</h2>
            {subtitle && <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">{subtitle}</p>}
          </div>
          {closable && (
            <button
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-neutral-200/70 bg-white/80 text-neutral-400 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-500 active:scale-90 dark:border-white/10 dark:bg-white/5 dark:hover:bg-red-500/10"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="overflow-y-auto px-3.5 sm:px-6 py-4 sm:py-5 flex-1 space-y-4">{children}</div>
        {footer && <div className="flex justify-end gap-3 border-t border-neutral-200/70 bg-neutral-50/80 px-4 py-3.5 dark:border-white/5 dark:bg-white/[.025] sm:px-6 sm:py-4">{footer}</div>}
      </div>
    </div>
  );
}
