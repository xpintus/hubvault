import Modal from './Modal';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn px-4 py-2 text-neutral-300 bg-neutral-800 hover:bg-neutral-700 active:scale-95" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            className={`btn px-4 py-2 text-white active:scale-95 ${danger ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500/30' : 'bg-gradient-to-r from-brand-600 to-brand-400 hover:from-brand-700 hover:to-accent-600 focus:ring-brand-500/30 shadow-glow hover:shadow-glow'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Processing…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex gap-4">
        <div className={`shrink-0 rounded-xl p-3 ${danger ? 'bg-red-500/15 text-red-500' : 'bg-amber-500/15 text-amber-500'}`}>
          <AlertTriangle className="h-5 w-5" />
        </div>
        <p className="text-sm text-neutral-400 leading-relaxed pt-1.5">{message}</p>
      </div>
    </Modal>
  );
}
