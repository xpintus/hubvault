import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Plus, Pencil, Trash2, MapPin, Search, User, Shield, CreditCard, Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useHub } from '@/lib/hubContext';
import { useNotifications } from '@/lib/notifications';
import { supabase, SUPABASE_URL } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';
import { logAudit } from '@/lib/audit';
import { Button, Card, EmptyState, Input, Select, Spinner, Badge, Skeleton } from '@/components/ui/primitives';
import Modal from '@/components/ui/Modal';
import { confirm } from '@/lib/confirm';
import { Hub, HubStatus, Profile } from '@/types';
import { formatDate, formatINR } from '@/lib/format';
import { clsx } from 'clsx';
import RequestLicenseModal from '@/components/RequestLicenseModal';

export default function Hubs() {
  const { profile, refreshProfile } = useAuth();
  const { markHubNotificationsRead } = useNotifications();
  const hubCtx = useHub();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [hubAdmins, setHubAdmins] = useState<Record<string, Profile[]>>({});
  const [hubSupervisors, setHubSupervisors] = useState<Record<string, Profile[]>>({});
  const [hubCreators, setHubCreators] = useState<Record<string, Profile>>({});
  const [stats, setStats] = useState<Record<string, { entries: number; total: number }>>({});
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Hub | null>(null);
  const [form, setForm] = useState({ name: '', code: '', location: '', status: 'active' as HubStatus });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isSuperAdmin = profile?.role === 'super_admin';
  const canCreateHub = isSuperAdmin || (profile?.role === 'hub_admin' && profile?.can_create_hub);
  const hubAddCredits = profile?.hub_add_credits ?? 0;
  const [hubAddModalOpen, setHubAddModalOpen] = useState(false);
  const [openFormAfterCredit, setOpenFormAfterCredit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = supabase.from('hubs').select('*, creator: profiles!hubs_created_by_fkey(*)').order('name');
      const { data, error } = await q;
      if (error) throw error;
      setHubs(data ?? []);

      const { data: ents } = await supabase.from('collection_entries').select('hub_id, total_collection');
      const map: Record<string, { entries: number; total: number }> = {};
      (ents ?? []).forEach((e: { hub_id: string; total_collection: string | number }) => {
        const k = e.hub_id;
        if (!map[k]) map[k] = { entries: 0, total: 0 };
        map[k].entries += 1;
        map[k].total += Number(e.total_collection);
      });
      setStats(map);

      const { data: access } = await supabase
        .from('user_hub_access')
        .select('user_id, hub_id, user: profiles(*)');
      const adminMap: Record<string, Profile[]> = {};
      const supMap: Record<string, Profile[]> = {};
      const creatorMap: Record<string, Profile> = {};
      (access ?? []).forEach((row: { hub_id: string; user: Profile | Profile[] | null }) => {
        const user = Array.isArray(row.user) ? row.user[0] : row.user;
        if (!user) return;
        if (!adminMap[row.hub_id]) adminMap[row.hub_id] = [];
        adminMap[row.hub_id].push(user);
        if (user.role === 'supervisor') {
          if (!supMap[row.hub_id]) supMap[row.hub_id] = [];
          supMap[row.hub_id].push(user);
        }
      });
      setHubAdmins(adminMap);
      setHubSupervisors(supMap);

      (data ?? []).forEach((h: Hub & { creator?: Profile | null }) => {
        if (h.creator) creatorMap[h.id] = h.creator;
      });
      setHubCreators(creatorMap);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load hubs');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (profile?.role === 'super_admin') {
      markHubNotificationsRead();
    }
  }, [profile?.role, markHubNotificationsRead]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const visibleHubs = useMemo(() => {
    if (isSuperAdmin) return hubs;
    const accessibleIds = new Set(hubCtx.accessibleHubs.map((h) => h.id));
    return hubs.filter((h) => accessibleIds.has(h.id));
  }, [hubs, isSuperAdmin, hubCtx.accessibleHubs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visibleHubs;
    return visibleHubs.filter((h) => h.name.toLowerCase().includes(q) || h.code.toLowerCase().includes(q) || (h.location ?? '').toLowerCase().includes(q));
  }, [visibleHubs, search]);

  const openAddForm = () => {
    setEditing(null);
    setForm({ name: '', code: '', location: '', status: 'active' });
    setErrors({});
    setModalOpen(true);
  };

  const openAdd = async () => {
    if (!isSuperAdmin && profile?.role === 'hub_admin') {
      const { data: freshProf } = await supabase
        .from('profiles')
        .select('hub_add_credits')
        .eq('id', profile.id)
        .maybeSingle();
      const latestCredits = freshProf?.hub_add_credits ?? 0;
      const assignedHubCount = hubCtx.accessibleHubs.length;
      if (assignedHubCount > 0 && latestCredits <= 0) {
        setOpenFormAfterCredit(true);
        setHubAddModalOpen(true);
        return;
      }
    }
    openAddForm();
  };

  const openEdit = (h: Hub) => {
    setEditing(h);
    setForm({ name: h.name, code: h.code, location: h.location ?? '', status: h.status });
    setErrors({});
    setModalOpen(true);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Hub name is required';
    if (!form.code.trim()) e.code = 'Hub code is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/manage-user`;

  const callEdgeFunction = async (action: string, body: Record<string, unknown>) => {
    let token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) {
      const { data } = await supabase.auth.refreshSession();
      token = data.session?.access_token;
    }
    if (!token) throw new Error('Your session has expired. Please log in again.');
    const response = await fetch(`${FUNCTION_URL}?action=${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed.session?.access_token) {
          const retry = await fetch(`${FUNCTION_URL}?action=${action}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${refreshed.session.access_token}`,
            },
            body: JSON.stringify(body),
          });
          const retryData = await retry.json();
          if (!retry.ok) throw new Error(retryData.error || `Request failed (${retry.status})`);
          return retryData;
        }
      }
      throw new Error(data.error || `Request failed (${response.status})`);
    }
    return data;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from('hubs').update({
          name: form.name.trim(), code: form.code.trim().toUpperCase(),
          location: form.location.trim() || null, status: form.status,
        }).eq('id', editing.id);
        if (error) throw error;
        await logAudit('hub_created', profile?.id ?? null, `Updated hub ${form.name}`, null, editing.id);
        toast.success('Hub updated');
      } else {
        if (!isSuperAdmin && profile?.role === 'hub_admin') {
          // Use edge function for hub admin — enforces credit check
          await callEdgeFunction('create-hub', {
            name: form.name.trim(),
            code: form.code.trim().toUpperCase(),
            location: form.location.trim() || undefined,
          });
          await logAudit('hub_created_by_hub_admin', profile.id, `Hub Admin created hub ${form.name}`, profile.id, null);
          await refreshProfile();
          toast.success('Hub added');
        } else {
          const { data: newHub, error } = await supabase.from('hubs').insert({
            name: form.name.trim(), code: form.code.trim().toUpperCase(),
            location: form.location.trim() || null, status: form.status,
            created_by: profile?.id ?? null,
          }).select().single();
          if (error) throw error;
          await logAudit('hub_created', profile?.id ?? null, `Created hub ${form.name}`, null, newHub.id);
          toast.success('Hub added');
        }
        hubCtx.refresh();
      }
      setModalOpen(false);
      load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save hub';
      if (msg.includes('hub-add license') || msg.includes('hub credit')) {
        setModalOpen(false);
        setOpenFormAfterCredit(true);
        setHubAddModalOpen(true);
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (h: Hub) => {
    const ok = await confirm({
      title: 'Delete hub?',
      message: `Deleting "${h.name}" will also remove all its collectors and collection entries. This cannot be undone.`,
      confirmLabel: 'Delete Hub',
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('hubs').delete().eq('id', h.id);
    if (error) toast.error(error.message);
    else {
      await logAudit('hub_created', profile?.id ?? null, `Deleted hub ${h.name}`, null, h.id);
      toast.success('Hub deleted');
      hubCtx.refresh();
      load();
    }
  };

  return (
    <div className="space-y-5 lg:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Hub Management</h1>
          <p className="mt-1 text-sm text-neutral-500">Manage logistics hubs and branches across your network.</p>
          <p className="mt-2 text-sm text-neutral-500 font-medium">{visibleHubs.length} hub{visibleHubs.length !== 1 ? 's' : ''} {isSuperAdmin ? 'total' : 'accessible'}</p>
        </div>
        {canCreateHub && !isSuperAdmin && profile?.role === 'hub_admin' && hubAddCredits > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <CreditCard className="h-4 w-4 text-brand-600" />
            <span className="text-neutral-500">Hub credits: <strong className="text-brand-600">{hubAddCredits}</strong></span>
          </div>
        )}
        {canCreateHub && (
          <Button icon={<Plus className="h-4 w-4" />} onClick={openAdd} className="shadow-glow">Add Hub</Button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 dark:text-neutral-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search hubs…" className="input-base pl-10" />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-52" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon={<Building2 className="h-7 w-7" />} title="No hubs found" message={canCreateHub ? "Add your first hub to get started." : "No hubs are assigned to you yet."} action={canCreateHub ? <Button icon={<Plus className="h-4 w-4" />} onClick={openAdd}>Add Hub</Button> : undefined} /></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((h) => {
            const s = stats[h.id] ?? { entries: 0, total: 0 };
            const admins = hubAdmins[h.id] ?? [];
            const sups = hubSupervisors[h.id] ?? [];
            const creator = hubCreators[h.id];
            return (
              <Card key={h.id} hover className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-gradient-to-br from-brand-600/20 to-brand-600/10 text-brand-600 p-2.5">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-neutral-900 dark:text-neutral-100">{h.name}</h3>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">{h.code}</span>
                    </div>
                  </div>
                  <Badge color={h.status === 'active' ? 'green' : 'slate'}>{h.status}</Badge>
                </div>
                {h.location && (
                  <p className="text-sm text-neutral-500 flex items-center gap-1.5 mb-3">
                    <MapPin className="h-3.5 w-3.5 text-neutral-500 dark:text-neutral-400" /> {h.location}
                  </p>
                )}
                <div className="space-y-2 mb-3 text-xs">
                  {creator && (
                    <div className="flex items-center gap-1.5 text-neutral-500">
                      <User className="h-3 w-3 text-neutral-500 dark:text-neutral-400" />
                      <span>Created by <strong className="text-neutral-500 dark:text-neutral-400">{creator.name}</strong></span>
                    </div>
                  )}
                  {admins.length > 0 && (
                    <div className="flex items-center gap-1.5 text-neutral-500">
                      <Shield className="h-3 w-3 text-neutral-500 dark:text-neutral-400" />
                      <span>{admins.length} admin{admins.length !== 1 ? 's' : ''}: <strong className="text-neutral-500 dark:text-neutral-400">{admins.map((a) => a.name).join(', ')}</strong></span>
                    </div>
                  )}
                  {sups.length > 0 && (
                    <div className="flex items-center gap-1.5 text-neutral-500">
                      <User className="h-3 w-3 text-neutral-500 dark:text-neutral-400" />
                      <span>{sups.length} supervisor{sups.length !== 1 ? 's' : ''}: <strong className="text-neutral-500 dark:text-neutral-400">{sups.map((s) => s.name).join(', ')}</strong></span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800/70 p-3">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Collections</p>
                    <p className="text-base font-bold text-neutral-700 dark:text-neutral-300 tabular-nums">{s.entries}</p>
                  </div>
                  <div className="rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800/70 p-3">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Total Amount</p>
                    <p className="text-base font-bold text-neutral-700 dark:text-neutral-300 tabular-nums">{formatINR(s.total)}</p>
                  </div>
                </div>
                <div className="flex gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                  {(isSuperAdmin || (profile?.role === 'hub_admin' && hubCtx.accessibleHubs.some((ah) => ah.id === h.id))) && (
                    <Button variant="outline" size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => openEdit(h)} className="flex-1">Edit</Button>
                  )}
                  {isSuperAdmin && (
                    <Button variant="ghost" size="sm" className="text-red-400 hover:bg-red-500/10" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => handleDelete(h)}>Delete</Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Hub' : 'Add Hub'}
        subtitle={editing ? 'Update hub details' : 'Create a new logistics hub'}
        size="md"
        footer={<>
          <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} loading={saving}>{editing ? 'Update Hub' : 'Save Hub'}</Button>
        </>}
      >
        <div className="space-y-4">
          <Input label="Hub Name" name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} placeholder="Mumbai Central Hub" />
          <Input label="Hub Code" name="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} error={errors.code} placeholder="MUM-01" hint="A unique short code" />
          <Input label="Location" name="location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Andheri East, Mumbai" />
          <Select label="Status" name="status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as HubStatus })}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
      </Modal>

      <RequestLicenseModal
        open={hubAddModalOpen}
        onClose={() => { setHubAddModalOpen(false); setOpenFormAfterCredit(false); }}
        profile={profile!}
        mode="hub_add"
        onHubCreditGranted={() => {
          setHubAddModalOpen(false);
          refreshProfile();
          load();
          if (openFormAfterCredit) {
            setOpenFormAfterCredit(false);
            openAddForm();
          } else {
            toast.success('Hub credit added! You can now create a new hub.');
          }
        }}
        onLicenseObtained={() => {}}
      />
    </div>
  );
}
