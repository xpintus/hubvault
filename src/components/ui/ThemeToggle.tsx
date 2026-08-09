import { Theme,useTheme } from '@/lib/theme';
import { clsx } from 'clsx';
import { Check,ChevronDown,Monitor,Moon,Palette,Sun } from 'lucide-react';
import { useEffect,useRef,useState } from 'react';

const options: Array<{ value: Theme; label: string; description: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Light', description: 'Bright workspace', icon: Sun },
  { value: 'dark', label: 'Dark', description: 'Easy on the eyes', icon: Moon },
  { value: 'system', label: 'System', description: 'Match this device', icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const ActiveIcon = resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={clsx(
          'group inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-neutral-200/80 bg-white/80 px-2.5 text-neutral-600 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-brand-300 hover:text-brand-600 hover:shadow-md dark:border-neutral-700/80 dark:bg-neutral-900/80 dark:text-neutral-300',
          className
        )}
        title="Choose theme"
        aria-label="Choose theme"
        aria-expanded={open}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
          <ActiveIcon className="h-3.5 w-3.5" />
        </span>
        <ChevronDown className={clsx('hidden h-3.5 w-3.5 transition-transform sm:block', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 z-[70] mt-2 w-64 origin-top-right rounded-2xl border border-neutral-200/80 bg-white/95 p-2 shadow-dropdown backdrop-blur-2xl animate-scale-in dark:border-neutral-700/80 dark:bg-neutral-900/95">
          <div className="flex items-center gap-2 px-2.5 pb-2 pt-1.5">
            <Palette className="h-4 w-4 text-brand-600" />
            <div>
              <p className="text-xs font-extrabold text-neutral-900 dark:text-white">Appearance</p>
              <p className="text-[10px] text-neutral-500">Choose your workspace theme</p>
            </div>
          </div>
          <div className="space-y-1">
            {options.map((option) => {
              const Icon = option.icon;
              const selected = theme === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => { setTheme(option.value); setOpen(false); }}
                  className={clsx(
                    'flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition',
                    selected ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200' : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
                  )}
                >
                  <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', selected ? 'bg-brand-600 text-white shadow-glow' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300')}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{option.label}</span>
                    <span className="block text-[10px] text-neutral-500 dark:text-neutral-400">{option.description}</span>
                  </span>
                  {selected && <Check className="h-4 w-4 text-brand-600 dark:text-brand-300" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
