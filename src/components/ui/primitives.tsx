import { ButtonHTMLAttributes, forwardRef, ReactNode, SelectHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, HTMLAttributes } from 'react';
import { clsx } from 'clsx';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-600/40 shadow-soft hover:shadow-soft-lg',
  secondary: 'bg-brand-50 text-brand-700 hover:bg-brand-100 focus:ring-brand-600/30 dark:bg-brand-600/10 dark:text-brand-300 dark:hover:bg-brand-600/20',
  outline: 'border border-neutral-200 bg-[var(--card-bg)] text-neutral-700 dark:text-neutral-300 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 focus:ring-brand-600/20',
  ghost: 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100 focus:ring-neutral-400/30',
  danger: 'bg-error-600 text-white hover:bg-error-700 focus:ring-error-500/30 shadow-soft hover:shadow-soft-lg',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-5 py-3 text-sm gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...rest }, ref) => (
    <button
      ref={ref}
      className={clsx('btn', variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : (
        icon
      )}
      {children}
    </button>
  )
);
Button.displayName = 'Button';

export function Card({ className, children, hover = false, ...rest }: { className?: string; children: ReactNode; hover?: boolean } & HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx(hover ? 'card-hover' : 'card', className)} {...rest}>{children}</div>;
}

export function Badge({ children, color = 'slate', className }: { children: ReactNode; color?: string; className?: string }) {
  const colors: Record<string, string> = {
    slate: 'bg-neutral-100 text-neutral-600 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-700',
    green: 'bg-success-50 text-success-700 ring-success-200 dark:bg-success-500/15 dark:text-success-400 dark:ring-success-500/30',
    red: 'bg-error-50 text-error-700 ring-error-200 dark:bg-error-500/15 dark:text-error-400 dark:ring-error-500/30',
    amber: 'bg-warning-50 text-warning-700 ring-warning-200 dark:bg-warning-500/15 dark:text-warning-400 dark:ring-warning-500/30',
    blue: 'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30',
    yellow: 'bg-warning-50 text-warning-700 ring-warning-200 dark:bg-warning-500/15 dark:text-warning-400 dark:ring-warning-500/30',
  };
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', colors[color] || colors.slate, className)}>
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={clsx('inline-block rounded-full border-2 border-brand-600 border-t-transparent animate-spin', className || 'h-5 w-5')} />;
}

export function FullPageSpinner({ message }: { message?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ background: 'var(--page-bg)' }}>
      <Spinner className="h-8 w-8" />
      {message && <p className="text-sm text-neutral-500 font-medium">{message}</p>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card p-5 space-y-3">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-7 w-32" />
      {lines > 3 && <Skeleton className="h-3 w-20" />}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...rest }, ref) => {
    const inputId = id || rest.name;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
            {label}
          </label>
        )}
        <input ref={ref} id={inputId} className={clsx('input-base', error && 'border-error-400 focus:border-error-500 focus:ring-error-500/15', className)} {...rest} />
        {error ? <p className="mt-1.5 text-xs text-error-600 dark:text-error-400 font-medium flex items-center gap-1">{error}</p> : hint ? <p className="mt-1.5 text-xs text-neutral-500">{hint}</p> : null}
      </div>
    );
  }
);
Input.displayName = 'Input';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  children: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className, id, children, ...rest }, ref) => {
    const selectId = id || rest.name;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
            {label}
          </label>
        )}
        <select ref={ref} id={selectId} className={clsx('input-base appearance-none bg-no-repeat pr-9', error && 'border-error-400', className)}
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/20000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394A3B8' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")", backgroundPosition: 'right 0.6rem center', backgroundSize: '1.1rem' }}
          {...rest}
        >
          {children}
        </select>
        {error && <p className="mt-1.5 text-xs text-error-600 dark:text-error-400 font-medium">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...rest }, ref) => {
    const taId = id || rest.name;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={taId} className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
            {label}
          </label>
        )}
        <textarea ref={ref} id={taId} className={clsx('input-base resize-none', error && 'border-error-400', className)} {...rest} />
        {error && <p className="mt-1.5 text-xs text-error-600 dark:text-error-400 font-medium">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

export function EmptyState({ icon, title, message, action }: { icon?: ReactNode; title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in">
      {icon && <div className="mb-4 rounded-2xl bg-brand-50 dark:bg-brand-600/10 p-4 text-brand-600 dark:text-brand-400 ring-1 ring-brand-200 dark:ring-brand-600/20">{icon}</div>}
      <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{title}</p>
      {message && <p className="mt-1.5 text-sm text-neutral-500 max-w-sm leading-relaxed">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
