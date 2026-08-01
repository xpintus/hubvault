import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users, Plus, Pencil, Search, Phone, BadgeCheck, Ban, MoreVertical, RotateCcw, Eye, TrendingDown, Wallet, Banknote, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useHub } from '@/lib/hubContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { Button, Card, EmptyState, Input, Select, Spinner, Badge, Skeleton } from '@/components/ui/primitives';
import Modal from '@/components/ui/Modal';
import { confirm } from '@/lib/confirm';
import { Collector, CollectorStatus, Hub, Due, Recovery } from '@/types';
import { formatINR, formatDate, toISODate } from '@/lib/format';
import { db } from '@/lib/offline/db';
import { addToQueue } from '@/lib/offline/syncQueue';
import { v4 as uuidv4 } from 'uuid';
import { clsx } from 'clsx';

export default function Collectors() {
  const { profile } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Collector | null>(null);
  const [form, setForm] = useState({ name: '', employee_id: '', phone: '', hub_id: '', status: 'active' as CollectorStatus });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [profileData, setProfileData] = useState<Collector | null>(null);
  const [profileDues, setProfileDues] = useState<Due[]>([]);
  const [profileRecoveries, setProfileRecoveries] = useState<Recovery[]>([]);
  const [profileSummary, setProfileSummary] = useState<{ todayCollection: number; totalCollection: number; totalRecovered: number; totalPending: number; outstandingDue: number } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [recoveryModalFor, setRecoveryModalFor] = useState<Collector | null>(null);
  const [recoveryForm, setRecoveryForm] = useState({ due_id: '', amount: '', payment_mode: 'cash', notes: '', reference_number: '' });
  const [recoveryDues, setRecoveryDues] = useState<Due[]>([]);
  const [savingRecovery, setSavingRecovery] = useState(false);

  const isSuperAdmin = profile?.role === 'super_admin';
  const canManage = ['super_admin', 'hub_admin', 'supervisor'].includes(profile?.role ?? '');
  const hubCtx = useHub();

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      let availableHubs: Hub[] = [];
      if (isSuperAdmin) {
        const { data: h } = await supabase.from('hubs').select('*').order('name');
        availableHubs = h ?? [];
      } else {
        availableHubs = hubCtx.accessibleHubs;
      }
      setHubs(availableHubs);

      if (!navigator.onLine) {
        let cols = await db.collectors.toArray();
        if (hubCtx.selectedHubId) cols = cols.filter(c => c.hub_id === hubCtx.selectedHubId);
        else if (!isSuperAdmin && profile.hub_id) cols = cols.filter(c => c.hub_id === profile.hub_id);

        // Mock the hub relation for offline list
        const hydrated = cols.map(c => ({
            ...c,
            hub: availableHubs.find(h => h.id === c.hub_id) || { id: c.hub_id, name: 'Offline Hub', code: '' }
        }));

        setCollectors(hydrated.sort((a, b) => a.name.localeCompare(b.name)) as any[]);
      } else {
        let q = supabase.from('collectors').select('*, hub: hubs(*)').order('name');
        if (hubCtx.selectedHubId) q = q.eq('hub_id', hubCtx.selectedHubId);
        else if (!isSuperAdmin && profile.hub_id) q = q.eq('hub_id', profile.hub_id);
        const { data, error } = await q;
        if (error) throw error;
        setCollectors(data ?? []);

        // Cache for offline
        if (data) {
           const pureCols = data.map(c => {
               const { hub, ...rest } = c as any;
               return rest;
           });
           await db.collectors.bulkPut(pureCols);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [profile, isSuperAdmin, hubCtx.selectedHubId, hubCtx.accessibleHubs, toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return collectors.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.employee_id.toLowerCase().includes(q) || (c.phone ?? '').includes(q);
    });
  }, [collectors, search, statusFilter]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', employee_id: '', phone: '', hub_id: hubCtx.selectedHubId || (isSuperAdmin ? '' : (profile?.hub_id ?? '')), status: 'active' });
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (c: Collector) => {
    setEditing(c);
    setForm({ name: c.name, employee_id: c.employee_id, phone: c.phone ?? '', hub_id: c.hub_id, status: c.status });
    setErrors({});
    setModalOpen(true);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.employee_id.trim()) e.employee_id = 'Employee ID is required';
    if (!form.hub_id) e.hub_id = 'Assign a hub';
    if (form.phone && !/^[0-9+\-\s]{7,15}$/.test(form.phone)) e.phone = 'Invalid phone number';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        employee_id: form.employee_id.trim(),
        phone: form.phone.trim() || null,
        hub_id: form.hub_id,
        status: form.status,
      };

      if (!navigator.onLine) {
         if (editing) {
             const updatePayload = { ...payload, id: editing.id, client_id: profile?.id };
             await db.collectors.update(editing.id, updatePayload);
             await addToQueue(profile?.id || '', form.hub_id, 'collectors', 'UPDATE', updatePayload);
             toast.success('Employee updated offline');
         } else {
             const insertPayload = {
                 ...payload,
                 id: uuidv4(),
                 created_at: new Date().toISOString(),
                 client_id: profile?.id,
                 created_offline: true
             };
             await db.collectors.add(insertPayload as any);
             await addToQueue(profile?.id || '', form.hub_id, 'collectors', 'INSERT', insertPayload);
             toast.success('Employee added offline');
         }
      } else {
          if (editing) {
            const { error } = await supabase.from('collectors').update(payload).eq('id', editing.id);
            if (error) throw error;
            toast.success('Employee updated');
          } else {
            const { error } = await supabase.from('collectors').insert(payload);
            if (error) throw error;
            toast.success('Employee added');
          }
      }

      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save employee');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (c: Collector) => {
    const next: CollectorStatus = c.status === 'active' ? 'inactive' : 'active';

    if (!navigator.onLine) {
        const updatePayload = { id: c.id, status: next, client_id: profile?.id };
        await db.collectors.update(c.id, updatePayload);
        await addToQueue(profile?.id || '', c.hub_id, 'collectors', 'UPDATE', updatePayload);
        toast.success(`${c.name} ${next === 'active' ? 'enabled' : 'disabled'} offline`);
    } else {
        const { error } = await supabase.from('collectors').update({ status: next }).eq('id', c.id);
        if (error) { toast.error(error.message); return; }
        toast.success(`${c.name} ${next === 'active' ? 'enabled' : 'disabled'}`);
    }
    load();
  };

  const openProfile = async (c: Collector) => {
    setProfileData(c);
    setProfileLoading(true);
    try {
      const todayStr = toISODate(new Date());
      const { data: todayEntries } = await supabase
        .from('collection_entries')
        .select('total_collection, expected_cod')
        .eq('collector_id', c.id)
        .eq('collection_date', todayStr);
      const todayCollection = (todayEntries ?? []).reduce((s, e) => s + Number(e.total_collection), 0);

      const { data: allEntries } = await supabase
        .from('collection_entries')
        .select('total_collection, expected_cod')
        .eq('collector_id', c.id);
      const totalCollection = (allEntries ?? []).reduce((s, e) => s + Number(e.total_collection), 0);
      const totalPending = (allEntries ?? []).reduce((s, e) => s + Math.max(0, Number(e.expected_cod) - Number(e.total_collection)), 0);

      const { data: dueData } = await supabase
        .from('dues')
        .select('*, collector: collectors(*)')
        .eq('collector_id', c.id)
        .order('due_date', { ascending: false });
      const outstandingDue = (dueData ?? []).filter((d) => d.status !== 'fully_recovered').reduce((s, d) => s + Number(d.remaining_amount), 0);
      const totalRecovered = (dueData ?? []).reduce((s, d) => s + Number(d.recovered_amount), 0);
      setProfileDues(dueData ?? []);

      const { data: recData } = await supabase
        .from('recoveries')
        .select('*, due: dues(*)')
        .eq('collector_id', c.id)
        .order('recovery_date', { ascending: false });
      setProfileRecoveries(recData ?? []);

      setProfileSummary({ todayCollection, totalCollection, totalRecovered, totalPending, outstandingDue });
    } catch {
      setProfileSummary({ todayCollection: 0, totalCollection: 0, totalRecovered: 0, totalPending: 0, outstandingDue: 0 });
    } finally {
      setProfileLoading(false);
    }
  };

  const openRecoveryModal = async (c: Collector) => {
    setRecoveryModalFor(c);
    setRecoveryForm({ due_id: '', amount: '', payment_mode: 'cash', notes: '', reference_number: '' });
    try {
      const { data } = await supabase
        .from('dues')
        .select('*, collector: collectors(*)')
        .eq('collector_id', c.id)
        .neq('status', 'fully_recovered')
        .order('due_date', { ascending: false });
      setRecoveryDues(data ?? []);
    } catch {
      setRecoveryDues([]);
    }
  };

  const handleSaveRecovery = async () => {
    if (!recoveryModalFor) return;
    if (!recoveryForm.due_id) { toast.error('Select a due to recover against'); return; }
    const amount = Number(recoveryForm.amount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    const due = recoveryDues.find((d) => d.id === recoveryForm.due_id);
    if (!due) { toast.error('Selected due not found'); return; }
    if (amount > Number(due.remaining_amount)) { toast.error(`Amount exceeds remaining due of ${formatINR(due.remaining_amount)}`); return; }

    setSavingRecovery(true);
    try {
      const { error: recErr } = await supabase.from('recoveries').insert({
        collector_id: recoveryModalFor.id,
        hub_id: due.hub_id,
        due_id: due.id,
        recovery_date: toISODate(new Date()),
        amount,
        payment_mode: recoveryForm.payment_mode,
        reference_number: recoveryForm.reference_number.trim() || null,
        notes: recoveryForm.notes.trim() || null,
        created_by: profile?.id ?? null,
      });
      if (recErr) throw recErr;

      const newRecovered = Number(due.recovered_amount) + amount;
      const newRemaining = Number(due.original_amount) - newRecovered;
      const newStatus = newRemaining <= 0 ? 'fully_recovered' : 'partially_recovered';
      await supabase.from('dues').update({
        recovered_amount: newRecovered,
        remaining_amount: Math.max(0, newRemaining),
        status: newStatus,
        updated_at: new Date().toISOString(),
      }).eq('id', due.id);

      toast.success(newStatus === 'fully_recovered' ? 'Recovery recorded — due fully recovered' : 'Recovery recorded');
      setRecoveryModalFor(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to record recovery');
    } finally {
      setSavingRecovery(false);
    }
  };

  const defaultHub = hubCtx.selectedHubId || (isSuperAdmin ? '' : (profile?.hub_id ?? ''));

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Employee Management</h1>
          <p className="mt-1 text-sm text-neutral-500">Manage field employees who collect cash and online payments.</p>
          <p className="mt-2 text-sm text-neutral-500 font-medium">{collectors.length} employee{collectors.length !== 1 ? 's' : ''} registered</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openAdd} className="shadow-glow">Add Employee</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 dark:text-neutral-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, employee ID, or phone…" className="input-base pl-10" />
        </div>
          {isSuperAdmin && hubCtx.isAllHubs && (
            <Select value={hubCtx.selectedHubId} onChange={(e) => { if (e.target.value) hubCtx.selectHub(e.target.value); else hubCtx.selectAllHubs(); }} className="sm:w-48">
              <option value="">All Hubs</option>
              {hubCtx.accessibleHubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </Select>
          )}
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-40">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon={<Users className="h-7 w-7" />} title="No employees found" message="Add an employee to start recording their collections." action={<Button icon={<Plus className="h-4 w-4" />} onClick={openAdd}>Add Employee</Button>} /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 text-xs uppercase tracking-wide sticky top-0">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold">Employee</th>
                  <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Employee ID</th>
                  <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Phone</th>
                  <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Hub</th>
                  <th className="text-right px-4 py-3 font-semibold hidden xl:table-cell">Outstanding Due</th>
                  <th className="text-center px-4 py-3 font-semibold">Status</th>
                  <th className="text-right px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {filtered.map((c) => (
                  <tr key={c.id} className="group hover:bg-neutral-50 dark:hover:bg-neutral-950/70 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-600/20 to-brand-600/10 text-brand-600 flex items-center justify-center font-bold text-xs shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-neutral-800 dark:text-neutral-200 truncate">{c.name}</p>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 sm:hidden font-mono">{c.employee_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-neutral-500 dark:text-neutral-400 font-mono text-xs hidden sm:table-cell">{c.employee_id}</td>
                    <td className="px-4 py-3.5 text-neutral-500 dark:text-neutral-400 hidden md:table-cell">{c.phone ? <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-neutral-500 dark:text-neutral-400" />{c.phone}</span> : '—'}</td>
                    {isSuperAdmin && hubCtx.isAllHubs && <td className="px-4 py-3.5 text-neutral-500 dark:text-neutral-400 hidden lg:table-cell">{c.hub?.name ?? '—'}</td>}
                    <td className="px-4 py-3.5 text-right tabular-nums hidden xl:table-cell text-neutral-500 dark:text-neutral-400">—</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={clsx('inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', c.status === 'active' ? 'bg-brand-50 dark:bg-brand-600/15 text-brand-600 ring-brand-600/30' : 'bg-[var(--card-bg)] text-neutral-500 ring-neutral-200 dark:ring-neutral-700/60')}>
                        <span className={clsx('h-1.5 w-1.5 rounded-full', c.status === 'active' ? 'bg-brand-500' : 'bg-slate-400')} />
                        {c.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openProfile(c)} title="View Profile" className="p-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-blue-400 hover:bg-blue-500/10 transition active:scale-90"><Eye className="h-4 w-4" /></button>
                        <button onClick={() => openRecoveryModal(c)} title="Record Recovery" className="p-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-blue-400 hover:bg-blue-500/10 transition active:scale-90"><RotateCcw className="h-4 w-4" /></button>
                        <button onClick={() => openEdit(c)} title="Edit" className="p-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-600/15 transition active:scale-90"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => toggleStatus(c)} title={c.status === 'active' ? 'Disable' : 'Enable'} className="p-1.5 rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-amber-400 hover:bg-amber-500/10 transition active:scale-90">
                          {c.status === 'active' ? <Ban className="h-4 w-4" /> : <BadgeCheck className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Employee' : 'Add Employee'}
        subtitle={editing ? 'Update employee details' : 'Register a new field employee'}
        size="md"
        footer={<>
          <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} loading={saving}>{editing ? 'Update Employee' : 'Save Employee'}</Button>
        </>}
      >
        <div className="space-y-4">
          <Input label="Full Name" name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} placeholder="Rahul Sharma" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Employee ID" name="employee_id" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} error={errors.employee_id} placeholder="EMP1001" />
            <Input label="Phone Number" name="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} placeholder="9876543210" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Hub" name="hub_id" value={form.hub_id || defaultHub} onChange={(e) => setForm({ ...form, hub_id: e.target.value })} error={errors.hub_id} disabled={!isSuperAdmin && !!hubCtx.selectedHubId}>
              <option value="">Select hub…</option>
              {(isSuperAdmin ? hubs : hubCtx.accessibleHubs.length > 0 ? hubCtx.accessibleHubs : hubs).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </Select>
            <Select label="Status" name="status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as CollectorStatus })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
        </div>
      </Modal>

      {/* Employee Profile Modal */}
      <Modal
        open={!!profileData}
        onClose={() => setProfileData(null)}
        title={profileData?.name ?? 'Employee Profile'}
        subtitle={profileData ? `${profileData.employee_id} · ${profileData.phone ?? 'No phone'}` : ''}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setProfileData(null)}>Close</Button>
            {canManage && profileData && (
              <Button icon={<RotateCcw className="h-4 w-4" />} onClick={() => { setProfileData(null); openRecoveryModal(profileData); }}>
                Record Recovery
              </Button>
            )}
          </>
        }
      >
        {profileLoading ? (
          <div className="flex justify-center py-8"><Spinner className="h-6 w-6" /></div>
        ) : profileSummary ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Today's Collection", value: profileSummary.todayCollection, icon: Wallet, color: 'text-brand-600 bg-brand-600/15' },
                { label: 'Total Collection', value: profileSummary.totalCollection, icon: Banknote, color: 'text-emerald-600 bg-emerald-50' },
                { label: 'Outstanding Due', value: profileSummary.outstandingDue, icon: TrendingDown, color: 'text-red-400 bg-red-500/10' },
                { label: 'Total Recovered', value: profileSummary.totalRecovered, icon: CheckCircle2, color: 'text-blue-400 bg-blue-500/10' },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-neutral-200 dark:border-neutral-800/70 p-3">
                  <div className={clsx('inline-flex h-9 w-9 items-center justify-center rounded-lg mb-2', s.color)}>
                    <s.icon className="h-4 w-4" />
                  </div>
                  <p className="text-xs text-neutral-500">{s.label}</p>
                  <p className="text-base font-bold text-neutral-800 dark:text-neutral-200 tabular-nums mt-0.5">{formatINR(s.value)}</p>
                </div>
              ))}
            </div>

            {profileDues.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2">Due History</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {profileDues.map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-lg border border-neutral-200 dark:border-neutral-800/60 px-3 py-2 text-sm">
                      <div>
                        <span className="text-neutral-500 dark:text-neutral-400">Due {formatINR(d.original_amount)}</span>
                        <span className="text-neutral-500 dark:text-neutral-400 text-xs ml-2">since {formatDate(d.due_date)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-brand-600">Recovered: {formatINR(d.recovered_amount)}</span>
                        <span className={clsx('text-xs font-semibold', d.remaining_amount > 0 ? 'text-red-400' : 'text-brand-600')}>Remaining: {formatINR(d.remaining_amount)}</span>
                        <span className={clsx('rounded px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset',
                          d.status === 'fully_recovered' ? 'bg-brand-50 dark:bg-brand-600/15 text-brand-600 ring-brand-600/30' :
                          d.status === 'partially_recovered' ? 'bg-amber-500/10 text-amber-400 ring-amber-500/30' :
                          'bg-red-500/10 text-red-400 ring-red-500/30'
                        )}>{d.status.replace('_', ' ')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {profileRecoveries.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-2">Recovery History</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {profileRecoveries.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-lg border border-neutral-200 dark:border-neutral-800/60 px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-blue-400 font-semibold tabular-nums">{formatINR(r.amount)}</span>
                        <span className="text-neutral-500 dark:text-neutral-400 text-xs">{formatDate(r.recovery_date)}</span>
                      </div>
                      <span className={clsx('rounded px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
                        r.payment_mode === 'cash' ? 'bg-brand-50 dark:bg-brand-600/15 text-brand-600 ring-brand-600/30' :
                        r.payment_mode === 'online' ? 'bg-blue-500/10 text-blue-400 ring-blue-200/60' :
                        'bg-[var(--card-bg)] text-neutral-500 dark:text-neutral-400 ring-neutral-200 dark:ring-neutral-700/60'
                      )}>{r.payment_mode}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {profileDues.length === 0 && profileRecoveries.length === 0 && (
              <div className="text-center py-6 text-sm text-neutral-500 dark:text-neutral-400">No dues or recovery records for this employee.</div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* Recovery Modal from Collectors */}
      <Modal
        open={!!recoveryModalFor}
        onClose={() => setRecoveryModalFor(null)}
        title="Record Recovery"
        subtitle={recoveryModalFor ? `${recoveryModalFor.name} (${recoveryModalFor.employee_id})` : ''}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setRecoveryModalFor(null)} disabled={savingRecovery}>Cancel</Button>
            <Button onClick={handleSaveRecovery} loading={savingRecovery}>Record Recovery</Button>
          </>
        }
      >
        {recoveryDues.length === 0 ? (
          <div className="text-center py-6 text-sm text-neutral-500 dark:text-neutral-400">This employee has no outstanding dues to recover.</div>
        ) : (
          <div className="space-y-4">
            <Select label="Against Due" value={recoveryForm.due_id} onChange={(e) => setRecoveryForm({ ...recoveryForm, due_id: e.target.value })}>
              <option value="">Select due…</option>
              {recoveryDues.map((d) => (
                <option key={d.id} value={d.id}>
                  Due {formatINR(d.original_amount)} · Remaining {formatINR(d.remaining_amount)} · Since {formatDate(d.due_date)}
                </option>
              ))}
            </Select>
            <Input label="Recovery Amount" type="number" value={recoveryForm.amount} onChange={(e) => setRecoveryForm({ ...recoveryForm, amount: e.target.value })} placeholder="0" />
            <Select label="Payment Mode" value={recoveryForm.payment_mode} onChange={(e) => setRecoveryForm({ ...recoveryForm, payment_mode: e.target.value })}>
              <option value="cash">Cash</option>
              <option value="online">Online</option>
              <option value="other">Other</option>
            </Select>
            <Input label="Reference Number (optional)" value={recoveryForm.reference_number} onChange={(e) => setRecoveryForm({ ...recoveryForm, reference_number: e.target.value })} placeholder="Transaction ID…" />
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Notes (optional)</label>
              <textarea value={recoveryForm.notes} onChange={(e) => setRecoveryForm({ ...recoveryForm, notes: e.target.value })} rows={2} placeholder="Notes…" className="input-base resize-none" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
