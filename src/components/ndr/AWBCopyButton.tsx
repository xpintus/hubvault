import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export function AWBCopyButton({ awb }: { awb: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(awb.trim());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <span className="inline-flex max-w-full items-center gap-1.5">
      <span className="truncate font-mono font-bold text-neutral-900 dark:text-neutral-100">{awb}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-400 transition hover:bg-neutral-100 hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/40 dark:hover:bg-neutral-800"
        title={copied ? 'AWB copied' : 'Copy AWB'}
        aria-label={copied ? `AWB ${awb} copied` : `Copy AWB ${awb}`}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}
