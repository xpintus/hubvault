import Modal from '@/components/ui/Modal';
import { Badge,Button,Card,EmptyState,Input,Select,Skeleton,Spinner } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/lib/auth';
import { confirm } from '@/lib/confirm';
import { formatDate } from '@/lib/format';
import { supabase,SUPABASE_URL } from '@/lib/supabase';
import { Hub,Profile,ROLE_LABELS,UserRole } from '@/types';
import { clsx } from 'clsx';
import {
AlertTriangle,
Building2,Check,
CheckCircle2,
Clock,
Copy,
KeyRound,
Lock,
Pencil,
Plus,
RefreshCw,
Search,
ShieldCheck,
Trash2,
UserCog,
} from 'lucide-react';
import { useCallback,useEffect,useMemo,useState } from 'react';

const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: 'amber',
  hub_admin: 'blue',
  supervisor: 'green',
  collector: 'slate',
  guest: 'slate',
  trial_user: 'slate',
};

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  super_admin: 'Full system access — all hubs, users, and settings',
  hub_admin: 'Manages assigned hub(s) — can access multiple hubs',
  supervisor: 'Manages a single assigned hub only',
  collector: 'Field collector — limited access',
  guest: 'Guest — limited demo access',
  trial_user: 'Trial user — temporary access',
};

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/manage-user`;

export default function Users() {
  const { profile: currentUser } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Profile[]>([]);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [userAccessMap, setUserAccessMap] = useState<Record<string, Hub[]>>({});
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [hubFilter, setHubFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'collector' as UserRole, password: '', can_create_hub: false });
  const [selectedHubIds, setSelectedHubIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [resetUser, setResetUser] = useState<Profile | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [licenseModalUser, setLicenseModalUser] = useState<Profile | null>(null);
  const [licenseCode, setLicenseCode] = useState<string | null>(null);
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [licenseSaving, setLicenseSaving] = useState(false);

  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isHubAdmin = currentUser?.role === 'hub_admin';
  const canManageUsers = isSuperAdmin || isHubAdmin;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: h } = await supabase.from('hubs').select('*').order('name');
      setHubs(h ?? []);

      const { data: u, error } = await supabase
        .from('profiles')
        .select('id, name, email, role, hub_id, can_create_hub, phone, company, created_at, is_approved, license_status, hub: hubs!profiles_hub_id_fkey(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const formatted = (u ?? []).map((row: any) => ({
        ...row,
        hub: Array.isArray(row.hub) ? row.hub[0] ?? null : row.hub ?? null,
      }));
      setUsers(formatted as Profile[]);

      const { data: access } = await supabase
        .from('user_hub_access')
        .select('user_id, hub: hubs(*)');
      const map: Record<string, Hub[]> = {};
      (access ?? []).forEach((row: { user_id: string; hub: Hub | Hub[] | null }) => {
        const hub = Array.isArray(row.hub) ? row.hub[0] : row.hub;
        if (hub) {
          if (!map[row.user_id]) map[row.user_id] = [];
          map[row.user_id].push(hub);
        }
      });
      setUserAccessMap(map);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (hubFilter !== 'all') {
        const userHubs = userAccessMap[u.id] ?? [];
        const hasHub = userHubs.some((h) => h.id === hubFilter) || u.hub_id === hubFilter;
        if (!hasHub) return false;
      }
      if (!q) return true;
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [users, search, roleFilter, hubFilter, userAccessMap]);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', email: '', role: 'collector', password: '', can_create_hub: false });
    setSelectedHubIds([]);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (u: Profile) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, role: u.role, password: '', can_create_hub: u.can_create_hub ?? false });
    const accessHubs = userAccessMap[u.id] ?? [];
    const hubIds = accessHubs.map((h) => h.id);
    if (u.hub_id && !hubIds.includes(u.hub_id)) hubIds.push(u.hub_id);
    setSelectedHubIds(hubIds);
    setErrors({});
    setModalOpen(true);
  };

  const toggleHub = (hubId: string) => {
    setSelectedHubIds((prev) =>
      prev.includes(hubId) ? prev.filter((id) => id !== hubId) : [...prev, hubId]
    );
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email';
    if (!editing && !form.password) e.password = 'Password is required';
    else if (!editing && form.password.length < 6) e.password = 'Min 6 characters';
    if (form.role !== 'super_admin' && selectedHubIds.length === 0) e.hubs = 'Assign at least one hub';
    if (form.role === 'supervisor' && selectedHubIds.length > 1) e.hubs = 'A supervisor can only have one hub';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const callEdgeFunction = async (action: string, body: Record<string, unknown>) => {
    const { data: session } = await supabase.auth.getSession();
    const response = await fetch(`${FUNCTION_URL}?action=${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.session?.access_token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }
    return data;
  };

  const save = async () => {
    if (!validate()) return;
    if (!currentUser) return;
    setSaving(true);
    try {
      if (editing) {
        await callEdgeFunction('update', {
          user_id: editing.id,
          name: form.name.trim(),
          role: form.role,
          hub_id: form.role === 'super_admin' ? null : selectedHubIds[0] ?? null,
          can_create_hub: form.role === 'hub_admin' ? form.can_create_hub : false,
          hub_ids: form.role === 'super_admin' ? [] : selectedHubIds,
        });
        toast.success('User updated');
      } else {
        const result = await callEdgeFunction('create', {
          email: form.email.trim(),
          password: form.password,
          name: form.name.trim(),
          role: form.role,
          hub_id: form.role === 'super_admin' ? null : selectedHubIds[0] ?? null,
          can_create_hub: form.role === 'hub_admin' ? form.can_create_hub : false,
          hub_ids: form.role === 'super_admin' ? [] : selectedHubIds,
        });
        if (result.license_code) {
          setLicenseModalUser({ ...form, id: result.user_id, created_at: new Date().toISOString() } as unknown as Profile);
          setLicenseCode(result.license_code);
          toast.success(`User created! License code: ${result.license_code}`);
        } else {
          toast.success('User created');
        }
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: Profile) => {
    if (u.id === currentUser?.id) {
      toast.warning("You can't delete your own account");
      return;
    }
    const ok = await confirm({
      title: 'Delete user?',
      message: `This permanently removes ${u.name}'s account and all hub access. This cannot be undone.`,
      confirmLabel: 'Delete User',
      danger: true,
    });
    if (!ok) return;
    try {
      await callEdgeFunction('delete', { user_id: u.id });
      toast.success('User deleted');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    if (resetPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    try {
      await callEdgeFunction('reset-password', {
        user_id: resetUser.id,
        new_password: resetPassword,
      });
      toast.success('Password reset');
      setResetUser(null);
      setResetPassword('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset password');
    }
  };

  const openLicenseModal = async (u: Profile) => {
    setLicenseModalUser(u);
    setLicenseCode(null);
    setLicenseLoading(true);
    try {
      const { data, error } = await supabase
        .from('license_keys')
        .select('*')
        .eq('user_id', u.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) setLicenseCode(data.license_code);
    } catch {
      setLicenseCode(null);
    } finally {
      setLicenseLoading(false);
    }
  };

  const handleRegenerateLicense = async () => {
    if (!licenseModalUser) return;
    setLicenseSaving(true);
    try {
      const action = licenseCode ? 'regenerate-license' : 'generate-license';
      const data = await callEdgeFunction(action, { user_id: licenseModalUser.id });
      setLicenseCode(data.license_code);
      toast.success(licenseCode ? 'New license code generated' : 'License code generated');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate license');
    } finally {
      setLicenseSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('License code copied to clipboard');
  };

  if (!canManageUsers) {
    return <Card><EmptyState title="Access restricted" message="You do not have permission to manage users." /></Card>;
  }

  // Which roles can the current user assign?
  const assignableRoles = isSuperAdmin
    ? (Object.keys(ROLE_LABELS) as UserRole[])
    : (['supervisor', 'collector'] as UserRole[]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">User & Access Management</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {isSuperAdmin
              ? 'Manage dashboard access, roles, and hub assignments.'
              : 'Create and manage users for your assigned hubs.'}
          </p>
          <p className="mt-2 text-sm text-neutral-500 font-medium">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={openAdd} className="shadow-glow">Add User</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email…" className="input-base pl-10" />
        </div>
        <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">All Roles</option>
          {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </Select>
        <Select value={hubFilter} onChange={(e) => setHubFilter(e.target.value)}>
          <option value="all">All Hubs</option>
          {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon={<UserCog className="h-7 w-7" />} title="No users found" message="Add a user to grant dashboard access." action={<Button icon={<Plus className="h-4 w-4" />} onClick={openAdd}>Add User</Button>} /></Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold">User</th>
                  <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Role</th>
                  <th className="text-left px-4 py-3 font-semibold hidden md:table-cell">Assigned Hubs</th>
                  <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">License</th>
                  <th className="text-left px-4 py-3 font-semibold hidden lg:table-cell">Created</th>
                  <th className="text-right px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {filtered.map((u) => {
                  const userHubs = userAccessMap[u.id] ?? [];
                  const allHubs = [...userHubs];
                  if (u.hub_id && !allHubs.some((h) => h.id === u.hub_id)) {
                    const h = hubs.find((hub) => hub.id === u.hub_id);
                    if (h) allHubs.push(h);
                  }
                  const canEditThis = isSuperAdmin || (u.role !== 'super_admin' && (
                    allHubs.some((h) => isSuperAdmin || (userAccessMap[currentUser?.id ?? ''] ?? []).some((ah) => ah.id === h.id))
                  ));
                  return (
                    <tr key={u.id} className="group hover:bg-neutral-50 dark:hover:bg-neutral-950/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-brand-600 to-brand-400 text-white flex items-center justify-center font-bold text-sm shadow-soft shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                              {u.name}
                              {u.id === currentUser?.id && <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />}
                              {u.can_create_hub && u.role === 'hub_admin' && (
                                <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/10 text-amber-400 px-1.5 py-0.5 text-[10px] font-bold ring-1 ring-inset ring-amber-500/30">
                                  <Building2 className="h-2.5 w-2.5" /> CAN CREATE
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-neutral-400 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell"><Badge color={ROLE_COLORS[u.role]}>{ROLE_LABELS[u.role]}</Badge></td>
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {u.role === 'super_admin' ? (
                            <span className="text-xs text-neutral-500 italic">All hubs</span>
                          ) : allHubs.length === 0 ? (
                            <span className="text-xs text-neutral-400">No hubs</span>
                          ) : allHubs.slice(0, 3).map((h) => (
                            <span key={h.id} className="inline-flex items-center gap-1 rounded-lg bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 px-2 py-0.5 text-xs font-medium">
                              <Building2 className="h-3 w-3 text-neutral-400" />
                              {h.name}
                            </span>
                          ))}
                          {allHubs.length > 3 && <span className="text-xs text-neutral-400">+{allHubs.length - 3}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 hidden lg:table-cell">
                        {u.role === 'hub_admin' ? (
                          <button
                            onClick={() => isSuperAdmin && openLicenseModal(u)}
                            className={isSuperAdmin ? 'cursor-pointer' : 'cursor-default'}
                            title={isSuperAdmin ? 'View license details' : ''}
                          >
                            {u.license_status === 'activated' ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-green-500/30">
                                <CheckCircle2 className="h-3 w-3" /> Activated
                              </span>
                            ) : u.license_status === 'expired' ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 text-red-500 dark:text-red-400 px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-red-500/30">
                                <AlertTriangle className="h-3 w-3" /> Expired
                              </span>
                            ) : u.license_status === 'pending' ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-amber-500/30">
                                <Clock className="h-3 w-3" /> Pending
                              </span>
                            ) : (
                              <span className="text-xs text-neutral-400">—</span>
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-neutral-500 text-xs hidden lg:table-cell">{formatDate(u.created_at)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                          {canEditThis && (
                            <>
                              {u.role === 'hub_admin' && isSuperAdmin && (
                                <button onClick={() => openLicenseModal(u)} title="License" className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-500 hover:bg-amber-500/10 transition active:scale-90">
                                  <KeyRound className="h-4 w-4" />
                                </button>
                              )}
                              <button onClick={() => setResetUser(u)} title="Reset Password" className="p-1.5 rounded-lg text-neutral-400 hover:text-blue-400 hover:bg-blue-500/10 transition active:scale-90">
                                <Lock className="h-4 w-4" />
                              </button>
                              <button onClick={() => openEdit(u)} title="Edit" className="p-1.5 rounded-lg text-neutral-400 hover:text-brand-600 hover:bg-brand-600/15 transition active:scale-90">
                                <Pencil className="h-4 w-4" />
                              </button>
                              {u.id !== currentUser?.id && (
                                <button onClick={() => handleDelete(u)} title="Delete" className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition active:scale-90">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* User Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit User' : 'Add User'}
        subtitle={editing ? 'Update role, hub assignments, and permissions' : (isSuperAdmin ? 'Create a new dashboard user' : 'Create a new user for your hub')}
        size="md"
        footer={<>
          <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} loading={saving}>{editing ? 'Update User' : 'Create User'}</Button>
        </>}
      >
        <div className="space-y-4">
          <Input label="Full Name" name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} placeholder="John Doe" disabled={!!editing} />
          <Input label="Email" type="email" name="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} placeholder="john@example.com" disabled={!!editing} />
          {!editing && (
            <Input label="Password" type="password" name="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={errors.password} placeholder="Min 6 characters" />
          )}
          <Select label="Role" name="role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
            {assignableRoles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </Select>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 -mt-2">{ROLE_DESCRIPTIONS[form.role]}</p>

          {form.role === 'hub_admin' && (
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800/70 p-3.5 bg-neutral-50 dark:bg-neutral-900/40">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Can Create Hubs</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Allow this Hub Admin to create new hubs</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, can_create_hub: !form.can_create_hub })}
                  className={clsx(
                    'relative h-6 w-11 rounded-full transition-colors',
                    form.can_create_hub ? 'bg-brand-500' : 'bg-neutral-300 dark:bg-neutral-700'
                  )}
                >
                  <span className={clsx('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white dark:bg-neutral-900 shadow-sm transition-transform', form.can_create_hub && 'translate-x-5')} />
                </button>
              </label>
            </div>
          )}

          {form.role !== 'super_admin' && (
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                Assigned Hubs {form.role === 'supervisor' && <span className="text-xs text-neutral-500 dark:text-neutral-400">(select one only)</span>}
                {!isSuperAdmin && <span className="text-xs text-neutral-500 dark:text-neutral-400 ml-1">(your hubs only)</span>}
              </label>
              <div className="max-h-44 overflow-y-auto rounded-xl border border-neutral-200 dark:border-neutral-800/70 divide-y divide-neutral-200 dark:divide-neutral-800">
                {hubs.map((h) => (
                  <label
                    key={h.id}
                    className={clsx(
                      'flex items-center gap-3 px-3.5 py-2.5 cursor-pointer transition hover:bg-neutral-100 dark:hover:bg-neutral-950',
                      selectedHubIds.includes(h.id) && 'bg-brand-50 dark:bg-brand-600/15/40'
                    )}
                  >
                    <div className={clsx(
                      'flex h-5 w-5 items-center justify-center rounded-md border-2 transition',
                      selectedHubIds.includes(h.id) ? 'bg-brand-500 border-brand-500' : 'border-neutral-300 dark:border-neutral-700'
                    )}>
                      {selectedHubIds.includes(h.id) && <Check className="h-3.5 w-3.5 text-white" />}
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedHubIds.includes(h.id)}
                      onChange={() => toggleHub(h.id)}
                      className="sr-only"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 truncate">{h.name}</p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono">{h.code}</p>
                    </div>
                  </label>
                ))}
              </div>
              {errors.hubs && <p className="text-xs text-red-500 mt-1.5">{errors.hubs}</p>}
            </div>
          )}
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        open={!!resetUser}
        onClose={() => { setResetUser(null); setResetPassword(''); }}
        title="Reset Password"
        subtitle={resetUser ? `Set a new password for ${resetUser.name}` : ''}
        size="sm"
        footer={<>
          <Button variant="outline" onClick={() => { setResetUser(null); setResetPassword(''); }}>Cancel</Button>
          <Button onClick={handleResetPassword}>Reset Password</Button>
        </>}
      >
        <Input
          label="New Password"
          type="password"
          value={resetPassword}
          onChange={(e) => setResetPassword(e.target.value)}
          placeholder="Min 6 characters"
          autoFocus
        />
      </Modal>

      {/* License Modal */}
      <Modal
        open={!!licenseModalUser}
        onClose={() => setLicenseModalUser(null)}
        title="License Details"
        subtitle={licenseModalUser ? `${licenseModalUser.name} (${licenseModalUser.email})` : ''}
        size="md"
        footer={<>
          <Button variant="outline" onClick={() => setLicenseModalUser(null)}>Close</Button>
          {isSuperAdmin && (
            <Button onClick={handleRegenerateLicense} loading={licenseSaving} icon={<RefreshCw className="h-4 w-4" />}>
              Regenerate Code
            </Button>
          )}
        </>}
      >
        {licenseLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : licenseCode ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-4">
              <p className="text-xs text-neutral-500 mb-2 font-medium">License Code</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-lg font-mono font-bold tracking-wider text-brand-600 dark:text-brand-400">
                  {licenseCode}
                </code>
                <button onClick={() => copyToClipboard(licenseCode)} className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition" title="Copy">
                  <Copy className="h-4 w-4 text-neutral-500" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-3">
                <p className="text-xs text-neutral-500">Status</p>
                <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 capitalize">
                  {licenseModalUser?.license_status ?? 'pending'}
                </p>
              </div>
              <div className="rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 p-3">
                <p className="text-xs text-neutral-500">Activated</p>
                <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  {licenseModalUser?.license_activated_at ? formatDate(licenseModalUser.license_activated_at) : 'Not yet'}
                </p>
              </div>
            </div>
            {licenseModalUser?.license_status !== 'activated' && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Share this code with the Hub Admin. They must activate it within 24 hours of account creation, after which the code expires and the account locks.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <KeyRound className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm text-neutral-500 mb-4">No license code found for this user.</p>
            {isSuperAdmin && (
              <Button onClick={handleRegenerateLicense} loading={licenseSaving} icon={<RefreshCw className="h-4 w-4" />}>
                Generate License Code
              </Button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
