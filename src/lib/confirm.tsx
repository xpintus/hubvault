import { createRoot, Root } from 'react-dom/client';
import { useState, useEffect, ReactNode } from 'react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

function ConfirmHost({
  options,
  onDone,
}: {
  options: ConfirmOptions;
  onDone: (result: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => onDone(false), 150);
      return () => clearTimeout(t);
    }
  }, [open, onDone]);

  return (
    <ConfirmDialog
      open={open}
      onClose={() => setOpen(false)}
      onConfirm={() => {
        setOpen(false);
        onDone(true);
      }}
      title={options.title}
      message={options.message}
      confirmLabel={options.confirmLabel}
      cancelLabel={options.cancelLabel}
      danger={options.danger}
    />
  );
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function ensureMount(): Root {
  if (!container) {
    container = document.createElement('div');
    container.id = 'confirm-root';
    document.body.appendChild(container);
    root = createRoot(container);
  }
  return root!;
}

export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const r = ensureMount();
    const onDone = (result: boolean) => {
      r.render(<Wrapper>{null}</Wrapper>);
      resolve(result);
    };
    r.render(
      <Wrapper>
        <ConfirmHost options={options} onDone={onDone} />
      </Wrapper>
    );
  });
}

function Wrapper({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
