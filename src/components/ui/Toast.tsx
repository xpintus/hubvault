import { AlertTriangle,CheckCircle2,Info,X,XCircle } from 'lucide-react';
import { createContext,ReactNode,useCallback,useContext,useState } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const icons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles = {
  success: 'border-success-500/30 bg-[var(--card-bg)] text-neutral-800 dark:text-neutral-200',
  error: 'border-error-500/30 bg-[var(--card-bg)] text-neutral-800 dark:text-neutral-200',
  warning: 'border-warning-500/30 bg-[var(--card-bg)] text-neutral-800 dark:text-neutral-200',
  info: 'border-brand-500/30 bg-[var(--card-bg)] text-neutral-800 dark:text-neutral-200',
};

const iconColors = {
  success: 'text-success-600 dark:text-success-400 bg-success-500/15',
  error: 'text-error-600 dark:text-error-400 bg-error-500/15',
  warning: 'text-warning-600 dark:text-warning-400 bg-warning-500/15',
  info: 'text-brand-600 dark:text-brand-400 bg-brand-500/15',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, type, message }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove]
  );

  const value: ToastContextValue = {
    toast,
    success: (m) => toast(m, 'success'),
    error: (m) => toast(m, 'error'),
    warning: (m) => toast(m, 'warning'),
    info: (m) => toast(m, 'info'),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
        {toasts.map((t) => {
          const Icon = icons[t.type];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-dropdown backdrop-blur animate-slide-up ${styles[t.type]}`}
            >
              <div className={`shrink-0 rounded-lg p-1 ${iconColors[t.type]}`}>
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium flex-1 leading-snug pt-0.5">{t.message}</p>
              <button onClick={() => remove(t.id)} className="shrink-0 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition pt-0.5">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
