import { Button,Input,Select,Textarea } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth';
import { OpeningBalanceType,Party,PartyInput } from '@/types';
import { Users,X } from 'lucide-react';
import { useEffect,useState } from 'react';

interface PartyModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (input: PartyInput) => Promise<void>;
  editingParty?: Party | null;
  selectedHubId?: string | null;
}

export default function PartyModal({
  open,
  onClose,
  onSave,
  editingParty,
  selectedHubId,
}: PartyModalProps) {
  const toast = useToast();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [openingBalance, setOpeningBalance] = useState<number | string>(0);
  const [openingBalanceType, setOpeningBalanceType] = useState<OpeningBalanceType>('receivable');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (editingParty) {
      setName(editingParty.name || '');
      setCompanyName(editingParty.company_name || '');
      setMobile(editingParty.mobile || '');
      setAddress(editingParty.address || '');
      setGstin(editingParty.gstin || '');
      setOpeningBalance(editingParty.opening_balance || 0);
      setOpeningBalanceType(editingParty.opening_balance_type || 'receivable');
      setNotes(editingParty.notes || '');
    } else {
      setName('');
      setCompanyName('');
      setMobile('');
      setAddress('');
      setGstin('');
      setOpeningBalance(0);
      setOpeningBalanceType('receivable');
      setNotes('');
    }
  }, [editingParty, open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Party Name is required');
      return;
    }

    setLoading(true);
    try {
      await onSave({
        hub_id: editingParty ? editingParty.hub_id : (selectedHubId || profile?.hub_id || null),
        name: name.trim(),
        company_name: companyName.trim() || null,
        mobile: mobile.trim() || null,
        address: address.trim() || null,
        gstin: gstin.trim() || null,
        opening_balance: Number(openingBalance) || 0,
        opening_balance_type: openingBalanceType,
        notes: notes.trim() || null,
      });
      toast.success(editingParty ? 'Party updated successfully' : 'Party created successfully');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save party');
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
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
                {editingParty ? 'Edit Party Master' : 'Create New Party'}
              </h2>
              <p className="text-xs text-neutral-500">Party details for KhataBook ledger</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Party Name *"
              placeholder="e.g. Ramesh Kumar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label="Company Name"
              placeholder="e.g. RK Traders Pvt Ltd"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Mobile Number"
              placeholder="e.g. 9876543210"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />
            <Input
              label="GSTIN (Optional)"
              placeholder="e.g. 27AAAAA0000A1Z5"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Opening Balance (₹)"
              type="number"
              min="0"
              step="any"
              placeholder="0"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
            />
            <Select
              label="Opening Balance Type"
              value={openingBalanceType}
              onChange={(e) => setOpeningBalanceType(e.target.value as OpeningBalanceType)}
            >
              <option value="receivable">Receivable (Party Owes Us / Pending)</option>
              <option value="payable">Payable (We Owe Party / Excess)</option>
            </Select>
          </div>

          <Input
            label="Address"
            placeholder="Complete postal address or city"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />

          <Textarea
            label="Notes / Remarks"
            placeholder="Add any internal notes regarding credit terms or party agreements..."
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-3 shrink-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {editingParty ? 'Update Party' : 'Create Party'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
