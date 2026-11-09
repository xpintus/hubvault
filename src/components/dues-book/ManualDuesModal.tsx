import Modal from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/primitives';
import { toISODate } from '@/lib/format';
import { createManualRiderDue } from '@/lib/riderDuesService';
import { Collector, Hub, RiderDueCategory } from '@/types';
import {
  Building2,
  Hash,
  Phone,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';

const DUES_CATEGORIES: RiderDueCategory[] = [
  'COD Short',
  'Cash Short',
  'Penalty',
  'Damage',
  'Advance',
  'Salary Adjustment',
  'Other',
];

interface ManualDuesModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  collectors: Collector[];
  hubs: Hub[];
  currentUserId?: string | null;
  defaultRiderId?: string;
}

export default function ManualDuesModal({
  open,
  onClose,
  onSuccess,
  collectors,
  hubs,
  currentUserId,
  defaultRiderId,
}: ManualDuesModalProps) {
  const toast = useToast();

  const [selectedRiderId, setSelectedRiderId] = useState(defaultRiderId || '');
  const [riderSearch, setRiderSearch] = useState('');
  const [duesDate, setDuesDate] = useState(toISODate(new Date()));
  const [category, setCategory] = useState<RiderDueCategory>('COD Short');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  // Auto-find selected rider details
  const selectedRider = useMemo(() => {
    return collectors.find((c) => c.id === selectedRiderId) || null;
  }, [collectors, selectedRiderId]);

  // Auto-find selected hub
  const selectedHub = useMemo(() => {
    if (!selectedRider) return null;
    return hubs.find((h) => h.id === selectedRider.hub_id) || null;
  }, [hubs, selectedRider]);

  // Filtered riders for searchable dropdown
  const filteredRiders = useMemo(() => {
    if (!riderSearch.trim()) return collectors.slice(0, 50);
    const q = riderSearch.toLowerCase();
    return collectors.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.employee_id.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q))
    );
  }, [collectors, riderSearch]);

  const resetForm = () => {
    if (!defaultRiderId) setSelectedRiderId('');
    setAmount('');
    setDescription('');
    setReferenceId('');
    setRemarks('');
    setCategory('COD Short');
    setDuesDate(toISODate(new Date()));
  };

  const handleSave = async (addAnother = false) => {
    if (!selectedRiderId) {
      toast.error('Please select a rider');
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid dues amount greater than ₹0');
      return;
    }
    if (!description.trim()) {
      toast.error('Please provide a reason or description for this due');
      return;
    }

    setSaving(true);
    try {
      await createManualRiderDue({
        rider_id: selectedRiderId,
        hub_id: selectedRider!.hub_id,
        dues_date: duesDate,
        category,
        amount: numAmount,
        description: description.trim(),
        reference_id: referenceId.trim() || null,
        remarks: remarks.trim() || null,
        created_by: currentUserId,
      });

      toast.success(
        `Added dues of ₹${numAmount.toLocaleString('en-IN')} for ${selectedRider?.name}`
      );
      onSuccess();

      if (addAnother) {
        resetForm();
      } else {
        resetForm();
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save dues entry');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add New Dues Entry"
      subtitle="Record manual COD shortage, damage, penalty, or field advance"
      size="lg"
    >
      <div className="space-y-4">

        {/* Form Body */}
        <div className="mt-5 space-y-4">
          {/* Rider Selection & Search */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Rider Name / Employee <span className="text-rose-500">*</span>
            </label>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Search by rider name, FE ID or phone..."
                value={riderSearch}
                onChange={(e) => setRiderSearch(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={selectedRiderId}
                onChange={(e) => setSelectedRiderId(e.target.value)}
                className="w-full text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Select Rider --</option>
                {filteredRiders.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.employee_id}) — {c.phone || 'No Phone'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Auto-Fetched Details Card */}
          {selectedRider && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Rider / FE ID</span>
                <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1 mt-0.5">
                  <Hash className="h-3 w-3 text-indigo-500" />
                  {selectedRider.employee_id}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Mobile Number</span>
                <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1 mt-0.5">
                  <Phone className="h-3 w-3 text-emerald-500" />
                  {selectedRider.phone || 'N/A'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400 block">Assigned Hub</span>
                <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1 mt-0.5">
                  <Building2 className="h-3 w-3 text-amber-500" />
                  {selectedHub?.name || 'Main Hub'}
                </span>
              </div>
            </div>
          )}

          {/* Row 2: Dues Date, Category, Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Dues Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={duesDate}
                  onChange={(e) => setDuesDate(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Dues Category <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as RiderDueCategory)}
                className="w-full text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {DUES_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Dues Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                placeholder="0.00"
                min="1"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-rose-600 dark:text-rose-400 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          {/* Row 3: Description / Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description / Reason <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. COD cash short during evening closing, customer change not handed over"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Row 4: Reference ID / AWB & Remarks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reference ID / AWB (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. AWB-12883492 or DRS-8821"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Remarks (Optional)
              </label>
              <input
                type="text"
                placeholder="Supervisor notes or settlement commitment"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose} disabled={saving} className="w-full sm:w-auto">
            Cancel
          </Button>

          <Button
            variant="secondary"
            onClick={() => handleSave(true)}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            Save &amp; Add Another
          </Button>

          <Button
            variant="primary"
            onClick={() => handleSave(false)}
            disabled={saving}
            className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white"
          >
            {saving ? 'Saving...' : 'Save Dues'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
