import { Button,Input,Select,Textarea } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth';
import { formatINRNumber } from '@/lib/khatabook';
import { Party,PartyTransaction,PartyTransactionInput } from '@/types';
import { Receipt,X } from 'lucide-react';
import { useEffect,useState } from 'react';

interface TransactionModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (input: PartyTransactionInput) => Promise<void>;
  parties: Party[];
  editingTx?: PartyTransaction | null;
  defaultPartyId?: string;
  selectedHubId?: string | null;
}

export default function TransactionModal({
  open,
  onClose,
  onSave,
  parties,
  editingTx,
  defaultPartyId,
  selectedHubId,
}: TransactionModalProps) {
  const toast = useToast();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const [partyId, setPartyId] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);
  const [amountReceived, setAmountReceived] = useState<number | string>(0);
  const [cashPaid, setCashPaid] = useState<number | string>(0);
  const [onlinePaid, setOnlinePaid] = useState<number | string>(0);
  const [paymentReference, setPaymentReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');

  useEffect(() => {
    if (editingTx) {
      setPartyId(editingTx.party_id || '');
      setTransactionDate(editingTx.transaction_date || new Date().toISOString().split('T')[0]);
      setAmountReceived(editingTx.amount_received || 0);
      setCashPaid(editingTx.cash_paid || 0);
      setOnlinePaid(editingTx.online_paid || 0);
      setPaymentReference(editingTx.payment_reference || '');
      setRemarks(editingTx.remarks || '');
      setAttachmentUrl(editingTx.attachment_url || '');
    } else {
      setPartyId(defaultPartyId || (parties.length > 0 ? parties[0].id : ''));
      setTransactionDate(new Date().toISOString().split('T')[0]);
      setAmountReceived(0);
      setCashPaid(0);
      setOnlinePaid(0);
      setPaymentReference('');
      setRemarks('');
      setAttachmentUrl('');
    }
  }, [editingTx, defaultPartyId, parties, open]);

  if (!open) return null;

  const numReceived = Number(amountReceived || 0);
  const numCash = Number(cashPaid || 0);
  const numOnline = Number(onlinePaid || 0);
  const totalPaid = numCash + numOnline;
  const netDifference = numReceived - totalPaid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyId) {
      toast.error('Please select a Party');
      return;
    }
    if (!transactionDate) {
      toast.error('Transaction Date is required');
      return;
    }
    if (numReceived === 0 && totalPaid === 0) {
      toast.error('Enter either Amount Received or Cash/Online Paid');
      return;
    }

    setLoading(true);
    try {
      const selectedParty = parties.find((p) => p.id === partyId);
      await onSave({
        party_id: partyId,
        hub_id: selectedParty?.hub_id || selectedHubId || profile?.hub_id || null,
        transaction_date: transactionDate,
        amount_received: numReceived,
        cash_paid: numCash,
        online_paid: numOnline,
        payment_reference: paymentReference.trim() || null,
        remarks: remarks.trim() || null,
        attachment_url: attachmentUrl.trim() || null,
      });
      toast.success(editingTx ? 'Transaction updated successfully' : 'Transaction saved successfully');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-xl rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: 'var(--card-bg)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-600/10 text-brand-600 dark:text-brand-400">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
                {editingTx ? 'Edit Transaction' : 'Record Transaction Entry'}
              </h2>
              <p className="text-xs text-neutral-500">KhataBook Party Ledger Transaction</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Party Name *"
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              required
            >
              <option value="">Select Party</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.company_name ? `(${p.company_name})` : ''}
                </option>
              ))}
            </Select>

            <Input
              label="Transaction Date *"
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              required
            />
          </div>

          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Amount Details</p>

            <Input
              label="Amount Received From Party (₹)"
              type="number"
              min="0"
              step="any"
              placeholder="0"
              value={amountReceived}
              onChange={(e) => setAmountReceived(e.target.value)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Cash Paid (₹)"
                type="number"
                min="0"
                step="any"
                placeholder="0"
                value={cashPaid}
                onChange={(e) => setCashPaid(e.target.value)}
              />
              <Input
                label="Online Payment Made (₹)"
                type="number"
                min="0"
                step="any"
                placeholder="0"
                value={onlinePaid}
                onChange={(e) => setOnlinePaid(e.target.value)}
              />
            </div>
          </div>

          {/* Auto calculation summary badge */}
          <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-brand-50/50 dark:bg-brand-600/10 border border-brand-200/50 dark:border-brand-600/20">
            <div>
              <p className="text-[10px] uppercase font-bold text-neutral-500">Received</p>
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {formatINRNumber(numReceived)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-neutral-500">Total Paid</p>
              <p className="text-sm font-semibold text-brand-600 dark:text-brand-400 mt-0.5">
                {formatINRNumber(totalPaid)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-neutral-500">Difference</p>
              <p className={`text-sm font-bold mt-0.5 ${netDifference >= 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                {formatINRNumber(netDifference)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Payment Reference / UTR"
              placeholder="e.g. UTR12345678"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
            />
            <Input
              label="Attachment URL (Optional)"
              placeholder="https://..."
              value={attachmentUrl}
              onChange={(e) => setAttachmentUrl(e.target.value)}
            />
          </div>

          <Textarea
            label="Remarks / Description"
            placeholder="Add transaction remarks or invoice numbers..."
            rows={2}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />

          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-3 shrink-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {editingTx ? 'Update Entry' : 'Save Transaction'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
