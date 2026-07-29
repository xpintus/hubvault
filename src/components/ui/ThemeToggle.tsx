import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { clsx } from 'clsx';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className={clsx(
        'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-700 bg-[var(--card-bg)] text-neutral-400 hover:text-brand-600 hover:border-brand-600/50 transition-all active:scale-90',
        className
      )}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}
