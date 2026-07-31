import { useEffect, useMemo, useState } from 'react';
import { Banknote, Smartphone, Calculator } from 'lucide-react';
import Modal from './ui/Modal';
import { Button, Input, Select, Textarea } from './ui/primitives';
import DenominationPanel from './DenominationPanel';
import { useToast } from './ui/Toast';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { db } from '@/lib/offline/db';
import { addToQueue } from '@/lib/offline/syncQueue';
import { v4 as uuidv4 } from 'uuid';
import {
  CollectionEntry,
  CollectionEntryInput,
  Collector,
  DenominationInput,
  EMPTY_DENOMINATIONS,
  OnlinePaymentMode,
  PAYMENT_MODE_LABELS,
} from '@/types';
import { computeGap, computeStatus, computeTotal, denomCashTotal, computePendingAmount } from '@/lib/calc';
import { formatINR } from '@/lib/format';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  collectors: Collector[];
  hubId: string;
  defaultDate: string;
  editing?: CollectionEntry | null;
}

export default function CollectionEntryModal({
  open,
  onClose,
  onSaved,
  collectors,
  hubId,
  defaultDate,
  editing,
}: Props) {
  const { profile } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    collection_date: defaultDate,
    collector_id: '',
    expected_cod: '',
    online_amount: '',
    online_payment_mode: 'upi' as OnlinePaymentMode,
    remarks: '',
  });
  const [denoms, setDenoms] = useState<DenominationInput>({ ...EMPTY_DENOMINATIONS });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const activeCollectors = useMemo(
    () => collectors.filter((c) => c.status === 'active' || c.id === form.collector_id),
    [collectors, form.collector_id]
  );

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        collection_date: editing.collection_date,
        collector_id: editing.collector_id,
        expected_cod: String(editing.expected_cod),
        online_amount: String(editing.online_amount),
        online_payment_mode: editing.online_payment_mode ?? 'upi',
        remarks: editing.remarks ?? '',
      });
      setDenoms(
        (() => {
          const d = editing.denominations
            ? (Array.isArray(editing.denominations) ? editing.denominations[0] : editing.denominations)
            : null;
          if (!d) return { ...EMPTY_DENOMINATIONS };
          return {
              note_500: d.note_500,
              note_200: d.note_200,
              note_100: d.note_100,
              note_50: d.note_50,
              note_20: d.note_20,
              note_10: d.note_10,
              note_5: d.note_5,
              note_2: d.note_2,
              note_1: d.note_1,
          };
        })()
      );
    } else {
      setForm({
        collection_date: defaultDate,
        collector_id: '',
        expected_cod: '',
        online_amount: '',
        online_payment_mode: 'upi',
        remarks: '',
      });
      setDenoms({ ...EMPTY_DENOMINATIONS });
    }
    setErrors({});
  }, [open, editing, defaultDate]);

  const cashTotal = useMemo(() => denomCashTotal(denoms), [denoms]);
  const online = Number(form.online_amount) || 0;
  const expectedCod = Number(form.expected_cod) || 0;
  const total = computeTotal(cashTotal, online);
  const gap = computeGap(total, expectedCod);
  const status = computeStatus(gap, total > 0 || expectedCod > 0);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.collection_date) e.collection_date = 'Date is required';
    if (!form.collector_id) e.collector_id = 'Select an employee';
    if (expectedCod < 0) e.expected_cod = 'Cannot be negative';
    if (online < 0) e.online_amount = 'Cannot be negative';
    if (online > 0 && !form.online_payment_mode) e.online_payment_mode = 'Select a payment mode';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (!profile) return;
    const selectedCollector = collectors.find((c) => c.id === form.collector_id);
    if (!selectedCollector) {
      toast.error('Selected employee not found');
      return;
    }

    const payload: Omit<CollectionEntryInput, 'denominations'> = {
      collection_date: form.collection_date,
      collector_id: form.collector_id,
      hub_id: hubId,
      expected_cod: expectedCod,
      cash_amount: cashTotal,
      online_amount: online,
      online_payment_mode: online > 0 ? form.online_payment_mode : null,
      total_collection: total,
      gap,
      status,
      remarks: form.remarks.trim() || null,
    };

    if (!hubId) {
      toast.error('No hub assigned. Please ask an admin to assign you to a hub first.');
      return;
    }

    setSaving(true);
    try {
      const pendingAmount = computePendingAmount(expectedCod, total);

      if (!navigator.onLine) {
        if (editing) {
          // OFFLINE UPDATE
          const updatePayload = { ...payload, id: editing.id, created_by: profile.id, client_id: profile.id };
          await db.collection_entries.update(editing.id, updatePayload);
          await addToQueue(profile.id, hubId, 'collection_entries', 'UPDATE', updatePayload);

          const existingDenom = Array.isArray(editing.denominations) ? editing.denominations[0] : editing.denominations;
          if (existingDenom) {
             const dPayload = { ...denoms, id: existingDenom.id, collection_entry_id: editing.id, client_id: profile.id };
             await db.denominations.update(existingDenom.id, dPayload);
             await addToQueue(profile.id, hubId, 'denominations', 'UPDATE', dPayload);
          } else {
             const dId = uuidv4();
             const dPayload = { ...denoms, id: dId, collection_entry_id: editing.id, client_id: profile.id };
             await db.denominations.add(dPayload as any);
             await addToQueue(profile.id, hubId, 'denominations', 'INSERT', dPayload);
          }

          let existingDue = await db.dues.where('collection_entry_id').equals(editing.id).first();
          if (pendingAmount > 0 && !existingDue) {
            const dueId = uuidv4();
            const duePayload = {
              id: dueId,
              collector_id: form.collector_id,
              hub_id: hubId,
              collection_entry_id: editing.id,
              original_amount: pendingAmount,
              remaining_amount: pendingAmount,
              recovered_amount: 0,
              due_date: form.collection_date,
              status: 'outstanding',
              created_by: profile.id,
              client_id: profile.id
            };
            await db.dues.add(duePayload as any);
            await addToQueue(profile.id, hubId, 'dues', 'INSERT', duePayload);
          } else if (pendingAmount === 0 && existingDue) {
            await db.dues.delete(existingDue.id);
            await addToQueue(profile.id, hubId, 'dues', 'DELETE', { id: existingDue.id });
          } else if (pendingAmount > 0 && existingDue && existingDue.recovered_amount === 0) {
            const dueUpdate = {
              id: existingDue.id,
              original_amount: pendingAmount,
              remaining_amount: pendingAmount,
            };
            await db.dues.update(existingDue.id, dueUpdate);
            await addToQueue(profile.id, hubId, 'dues', 'UPDATE', dueUpdate);
          }

          toast.success('Collection entry updated offline');
        } else {
          // OFFLINE INSERT
          const entryId = uuidv4();
          const denomId = uuidv4();
          const insertPayload = {
              ...payload,
              id: entryId,
              created_by: profile.id,
              created_at: new Date().toISOString(),
              client_id: profile.id,
              created_offline: true
          };
          await db.collection_entries.add(insertPayload as any);
          await addToQueue(profile.id, hubId, 'collection_entries', 'INSERT', insertPayload);

          const dPayload = {
              ...denoms,
              id: denomId,
              collection_entry_id: entryId,
              client_id: profile.id,
              created_offline: true
          };
          await db.denominations.add(dPayload as any);
          await addToQueue(profile.id, hubId, 'denominations', 'INSERT', dPayload);

          if (pendingAmount > 0) {
              const dueId = uuidv4();
              const duePayload = {
                  id: dueId,
                  collector_id: form.collector_id,
                  hub_id: hubId,
                  collection_entry_id: entryId,
                  original_amount: pendingAmount,
                  remaining_amount: pendingAmount,
                  recovered_amount: 0,
                  due_date: form.collection_date,
                  status: 'outstanding',
                  created_by: profile.id,
                  created_at: new Date().toISOString(),
                  client_id: profile.id,
                  created_offline: true
              };
              await db.dues.add(duePayload as any);
              await addToQueue(profile.id, hubId, 'dues', 'INSERT', duePayload);
          }

          toast.success('Collection entry saved offline');
        }
      } else {
        // ONLINE
        if (editing) {
          const { error: entryErr } = await supabase
            .from('collection_entries')
            .update({ ...payload, created_by: profile.id })
            .eq('id', editing.id);
          if (entryErr) throw entryErr;

          const existingDenom = Array.isArray(editing.denominations) ? editing.denominations[0] : editing.denominations;
          if (existingDenom) {
            const { error: dErr } = await supabase
              .from('denominations')
              .update(denoms)
              .eq('collection_entry_id', editing.id);
            if (dErr) throw dErr;
          } else {
            const { error: dErr } = await supabase
              .from('denominations')
              .insert({ collection_entry_id: editing.id, ...denoms });
            if (dErr) throw dErr;
          }

          const { data: existingDue } = await supabase
            .from('dues')
            .select('id, original_amount, recovered_amount')
            .eq('collection_entry_id', editing.id)
            .maybeSingle();
          if (pendingAmount > 0 && !existingDue) {
            await supabase.from('dues').insert({
              collector_id: form.collector_id,
              hub_id: hubId,
              collection_entry_id: editing.id,
              original_amount: pendingAmount,
              remaining_amount: pendingAmount,
              due_date: form.collection_date,
              status: 'outstanding',
              created_by: profile.id,
            });
          } else if (pendingAmount === 0 && existingDue) {
            await supabase.from('dues').delete().eq('id', existingDue.id);
          } else if (pendingAmount > 0 && existingDue && existingDue.recovered_amount === 0) {
            await supabase.from('dues').update({
              original_amount: pendingAmount,
              remaining_amount: pendingAmount,
            }).eq('id', existingDue.id);
          }

          toast.success('Collection entry updated');
        } else {
          const { data: entry, error: entryErr } = await supabase
            .from('collection_entries')
            .insert({ ...payload, created_by: profile.id })
            .select()
            .single();
          if (entryErr) throw entryErr;

          const { error: dErr } = await supabase
            .from('denominations')
            .insert({ collection_entry_id: entry.id, ...denoms });
          if (dErr) throw dErr;

          if (pendingAmount > 0) {
            await supabase.from('dues').insert({
              collector_id: form.collector_id,
              hub_id: hubId,
              collection_entry_id: entry.id,
              original_amount: pendingAmount,
              remaining_amount: pendingAmount,
              due_date: form.collection_date,
              status: 'outstanding',
              created_by: profile.id,
            });
          }
          toast.success('Collection entry saved');
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save entry';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const statusColor =
    status === 'reconciled'
      ? 'bg-brand-600/20 text-brand-600 ring-brand-600/30'
      : status === 'shortage'
      ? 'bg-red-500/15 text-red-400 ring-red-500/30'
      : status === 'excess'
      ? 'bg-amber-500/15 text-amber-400 ring-amber-500/30'
      : 'bg-[var(--card-bg)] text-neutral-500 dark:text-neutral-400 ring-neutral-300 dark:ring-neutral-700/60';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Collection Entry' : 'Add Collection Entry'}
      subtitle={editing ? 'Update the collection record and denominations' : 'Record a new collection with denomination breakdown'}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            {editing ? 'Update Entry' : 'Save Entry'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: form fields */}
        <div className="lg:col-span-3 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Collection Date"
              type="date"
              name="collection_date"
              value={form.collection_date}
              onChange={(e) => setForm({ ...form, collection_date: e.target.value })}
              error={errors.collection_date}
            />
            <Select
              label="Employee"
              name="collector_id"
              value={form.collector_id}
              onChange={(e) => setForm({ ...form, collector_id: e.target.value })}
              error={errors.collector_id}
            >
              <option value="">Select employee…</option>
              {activeCollectors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.employee_id})
                </option>
              ))}
            </Select>
          </div>

          <Input
            label="Expected COD"
            type="number"
            name="expected_cod"
            value={form.expected_cod}
            onChange={(e) => setForm({ ...form, expected_cod: e.target.value })}
            placeholder="0"
            error={errors.expected_cod}
            hint="Total cash-on-delivery expected from this employee"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Online Collection</label>
              <div className="relative">
                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="number"
                  name="online_amount"
                  value={form.online_amount}
                  onChange={(e) => setForm({ ...form, online_amount: e.target.value })}
                  placeholder="0"
                  className="input-base pl-9"
                />
              </div>
              {errors.online_amount && <p className="mt-1.5 text-xs text-red-400 font-medium">{errors.online_amount}</p>}
            </div>
            <Select
              label="Online Payment Mode"
              name="online_payment_mode"
              value={form.online_payment_mode}
              onChange={(e) => setForm({ ...form, online_payment_mode: e.target.value as OnlinePaymentMode })}
              error={errors.online_payment_mode}
            >
              {(Object.keys(PAYMENT_MODE_LABELS) as OnlinePaymentMode[]).map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_MODE_LABELS[m]}
                </option>
              ))}
            </Select>
          </div>

          <Textarea
            label="Remarks"
            name="remarks"
            rows={3}
            value={form.remarks}
            onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            placeholder="Optional notes about this collection…"
          />

          {/* Live calculation summary */}
          <div className="rounded-xl bg-gradient-to-br from-neutral-50 dark:from-neutral-950 to-neutral-100 dark:to-neutral-900/50 border border-neutral-200 dark:border-neutral-800/80 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-neutral-700 dark:text-neutral-300">
              <div className="rounded-lg bg-brand-600/20 p-1.5 text-brand-600">
                <Calculator className="h-4 w-4" />
              </div>
              Live Calculation
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 flex items-center gap-1.5">
                  <Banknote className="h-3.5 w-3.5 text-brand-600" /> Cash
                </span>
                <span className="font-semibold tabular-nums text-neutral-700 dark:text-neutral-300">{formatINR(cashTotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5 text-blue-500" /> Online
                </span>
                <span className="font-semibold tabular-nums text-neutral-700 dark:text-neutral-300">{formatINR(online)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-200 dark:border-neutral-800/80 pt-2.5">
                <span className="text-neutral-500 dark:text-neutral-400 font-medium">Total Collection</span>
                <span className="font-bold tabular-nums text-neutral-800 dark:text-neutral-200">{formatINR(total)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-neutral-200 dark:border-neutral-800/80 pt-2.5">
                <span className="text-neutral-500 dark:text-neutral-400 font-medium">Expected COD</span>
                <span className="font-bold tabular-nums text-neutral-800 dark:text-neutral-200">{formatINR(expectedCod)}</span>
              </div>
              <div className="col-span-2 flex items-center justify-between border-t border-neutral-200 dark:border-neutral-800/80 pt-2.5">
                <span className="text-neutral-700 dark:text-neutral-300 font-bold">Gap</span>
                <span className={`font-bold tabular-nums ${gap < 0 ? 'text-red-400' : gap > 0 ? 'text-amber-400' : 'text-brand-600'}`}>
                  {gap < 0 ? '-' : gap > 0 ? '+' : ''}{formatINR(Math.abs(gap))}
                </span>
              </div>
              <div className="col-span-2 flex items-center justify-between">
                <span className="text-neutral-700 dark:text-neutral-300 font-bold">Status</span>
                <span className={`rounded-lg px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${statusColor}`}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: denomination panel */}
        <div className="lg:col-span-2">
          <DenominationPanel value={denoms} onChange={setDenoms} />
        </div>
      </div>
    </Modal>
  );
}
