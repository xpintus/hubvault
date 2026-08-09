import { useToast } from '@/components/ui/Toast';
import { Button,Card,EmptyState,Select,Skeleton } from '@/components/ui/primitives';
import { useAuth } from '@/lib/auth';
import { exportEntriesToExcel } from '@/lib/excel';
import { formatDate,formatINR,toISODate } from '@/lib/format';
import { useHub } from '@/lib/hubContext';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { CollectionEntry,Collector,EntryStatus,Hub,STATUS_LABELS } from '@/types';
import { clsx } from 'clsx';
import { eachDayOfInterval,endOfMonth,format,isSameDay,parseISO,startOfMonth,subDays } from 'date-fns';
import { Banknote,Calendar,Download,FileBarChart,Percent,Smartphone,TrendingDown,TrendingUp,TrendingUp as TrendingUpIcon,Wallet } from 'lucide-react';
import { useCallback,useEffect,useMemo,useState } from 'react';
import {
Area,AreaChart,
Bar,
BarChart,
CartesianGrid,
Cell,
Legend,
Pie,
PieChart,
ResponsiveContainer,
Tooltip,
XAxis,YAxis
} from 'recharts';

const STATUS_COLORS: Record<EntryStatus, string> = {
  reconciled: '#10B981',
  pending: '#94A3B8',
  shortage: '#EF4444',
  excess: '#F59E0B',
};

const chartTooltipStyle = { borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12, boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)', background: '#FFFFFF' };
const darkChartTooltipStyle = { borderRadius: 12, border: '1px solid #334155', fontSize: 12, boxShadow: '0 4px 12px rgb(0 0 0 / 0.3)', background: '#1E293B' };
const AXIS_LIGHT = '#64748B';
const AXIS_DARK = '#94A3B8';
const GRID_LIGHT = '#E2E8F0';
const GRID_DARK = '#334155';

export default function Reports() {
  const { profile } = useAuth();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const axisFill = isDark ? AXIS_DARK : AXIS_LIGHT;
  const gridStroke = isDark ? GRID_DARK : GRID_LIGHT;
  const tooltipStyle = isDark ? darkChartTooltipStyle : chartTooltipStyle;
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<CollectionEntry[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [_hubs, setHubs] = useState<Hub[]>([]);
  const [from, setFrom] = useState(toISODate(subDays(new Date(), 29)));
  const [to, setTo] = useState(toISODate(new Date()));
  const [activePreset, setActivePreset] = useState('last30');
  const [collectorFilter, setCollectorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const isSuperAdmin = profile?.role === 'super_admin';
  const hubCtx = useHub();

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const effectiveHub = isSuperAdmin ? hubCtx.selectedHubId : profile.hub_id ?? '';
      let q = supabase
        .from('collection_entries')
        .select('*, collector: collectors(*), hub: hubs(*)')
        .gte('collection_date', from)
        .lte('collection_date', to)
        .order('collection_date', { ascending: true });
      if (effectiveHub) q = q.eq('hub_id', effectiveHub);
      if (collectorFilter !== 'all') q = q.eq('collector_id', collectorFilter);
      if (statusFilter !== 'all') q = q.eq('status', statusFilter as EntryStatus);
      const { data, error } = await q;
      if (error) throw error;
      setEntries(data ?? []);

      if (isSuperAdmin) {
        const { data: h } = await supabase.from('hubs').select('*').order('name');
        setHubs(h ?? []);
      } else {
        setHubs(hubCtx.accessibleHubs);
      }

      let cq = supabase.from('collectors').select('*');
      if (effectiveHub) cq = cq.eq('hub_id', effectiveHub);
      const { data: cols } = await cq.order('name');
      setCollectors(cols ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [profile, from, to, hubCtx.selectedHubId, collectorFilter, statusFilter, isSuperAdmin, hubCtx.accessibleHubs, toast]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const totalExpected = entries.reduce((s, e) => s + Number(e.expected_cod), 0);
    const totalCash = entries.reduce((s, e) => s + Number(e.cash_amount), 0);
    const totalOnline = entries.reduce((s, e) => s + Number(e.online_amount), 0);
    const totalCollection = entries.reduce((s, e) => s + Number(e.total_collection), 0);
    const totalShortage = entries.filter((e) => e.gap < 0).reduce((s, e) => s + Math.abs(Number(e.gap)), 0);
    const totalExcess = entries.filter((e) => e.gap > 0).reduce((s, e) => s + Number(e.gap), 0);
    const reconciled = entries.filter((e) => e.status === 'reconciled').length;
    const rate = entries.length > 0 ? Math.round((reconciled / entries.length) * 100) : 0;
    return { totalExpected, totalCash, totalOnline, totalCollection, totalShortage, totalExcess, rate, count: entries.length };
  }, [entries]);

  const dailyTrend = useMemo(() => {
    const fromD = parseISO(from);
    const toD = parseISO(to);
    const days = eachDayOfInterval({ start: fromD, end: toD });
    return days.map((d) => {
      const dayEntries = entries.filter((e) => isSameDay(parseISO(e.collection_date), d));
      return {
        date: format(d, 'dd MMM'),
        collection: dayEntries.reduce((s, e) => s + Number(e.total_collection), 0),
        expected: dayEntries.reduce((s, e) => s + Number(e.expected_cod), 0),
        cash: dayEntries.reduce((s, e) => s + Number(e.cash_amount), 0),
        online: dayEntries.reduce((s, e) => s + Number(e.online_amount), 0),
      };
    });
  }, [entries, from, to]);

  const cashVsOnline = useMemo(() => [
    { name: 'Cash', value: stats.totalCash, color: '#10B981' },
    { name: 'Online', value: stats.totalOnline, color: '#4F46E5' },
  ], [stats]);

  const collectorWise = useMemo(() => {
    const map = new Map<string, { name: string; collection: number; expected: number; gap: number }>();
    entries.forEach((e) => {
      const key = e.collector_id;
      const name = e.collector?.name ?? 'Unknown';
      const ex = map.get(key) ?? { name, collection: 0, expected: 0, gap: 0 };
      ex.collection += Number(e.total_collection);
      ex.expected += Number(e.expected_cod);
      ex.gap += Number(e.gap);
      map.set(key, ex);
    });
    return Array.from(map.values()).sort((a, b) => b.collection - a.collection).slice(0, 10);
  }, [entries]);

  const statusAnalysis = useMemo(() => {
    const counts: Record<EntryStatus, number> = { reconciled: 0, pending: 0, shortage: 0, excess: 0 };
    entries.forEach((e) => (counts[e.status] += 1));
    return (Object.keys(counts) as EntryStatus[]).map((k) => ({ name: STATUS_LABELS[k], value: counts[k], color: STATUS_COLORS[k] }));
  }, [entries]);

  const handleExport = () => {
    if (entries.length === 0) { toast.warning('No records to export'); return; }
    exportEntriesToExcel(entries, `report_${from}_to_${to}.xlsx`);
    toast.success(`Exported ${entries.length} records`);
  };

  const statCards = [
    { label: 'Total Expected COD', value: stats.totalExpected, icon: Wallet, accent: 'slate' },
    { label: 'Total Cash', value: stats.totalCash, icon: Banknote, accent: 'emerald' },
    { label: 'Total Online', value: stats.totalOnline, icon: Smartphone, accent: 'blue' },
    { label: 'Total Collection', value: stats.totalCollection, icon: TrendingUp, accent: 'brand' },
    { label: 'Total Shortage', value: stats.totalShortage, icon: TrendingDown, accent: 'red' },
    { label: 'Total Excess', value: stats.totalExcess, icon: TrendingUpIcon, accent: 'amber' },
  ];

  const accentMap: Record<string, string> = {
    slate: 'bg-neutral-100 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 ring-neutral-200 dark:ring-neutral-800',
    emerald: 'bg-success-50 dark:bg-success-500/10 text-success-600 dark:text-success-400 ring-success-200 dark:ring-success-500/20',
    blue: 'bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 ring-brand-200 dark:ring-brand-500/20',
    brand: 'bg-brand-50 dark:bg-brand-600/15 text-brand-600 dark:text-brand-400 ring-brand-200 dark:ring-brand-600/30',
    red: 'bg-error-50 dark:bg-error-500/10 text-error-600 dark:text-error-400 ring-error-200 dark:ring-error-500/20',
    amber: 'bg-warning-50 dark:bg-warning-500/10 text-warning-600 dark:text-warning-400 ring-warning-200 dark:ring-warning-500/20',
  };

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">Reports & Analytics</h1>
          <p className="mt-1 text-sm text-neutral-500">Track collection performance and reconciliation trends.</p>
          <div className="mt-2 flex items-center gap-2 text-sm text-neutral-500">
            <Calendar className="h-4 w-4 text-neutral-400" />
            {formatDate(from)} — {formatDate(to)}
            <span className="text-neutral-400">·</span>
            <span className="font-medium text-neutral-400">{stats.count} records</span>
          </div>
        </div>
        <Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={handleExport}>Export Report</Button>
      </div>

      {/* Quick date presets */}
      <div className="flex flex-wrap items-center gap-2">
        {([
          { key: 'today', label: 'Today', set: () => { const d = toISODate(new Date()); return [d, d]; } },
          { key: 'yesterday', label: 'Yesterday', set: () => { const d = toISODate(subDays(new Date(), 1)); return [d, d]; } },
          { key: 'last7', label: 'Last 7 Days', set: () => [toISODate(subDays(new Date(), 6)), toISODate(new Date())] },
          { key: 'last30', label: 'Last 30 Days', set: () => [toISODate(subDays(new Date(), 29)), toISODate(new Date())] },
          { key: 'thisMonth', label: 'This Month', set: () => [toISODate(startOfMonth(new Date())), toISODate(endOfMonth(new Date()))] },
        ] as const).map((preset) => (
          <button
            key={preset.key}
            onClick={() => { const [f, t] = preset.set(); setFrom(f); setTo(t); setActivePreset(preset.key); }}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-all active:scale-95',
              activePreset === preset.key
                ? 'bg-brand-600 text-white shadow-soft'
                : 'bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400'
            )}
          >
            <Calendar className="h-3.5 w-3.5" />
            {preset.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5">From Date</label>
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setActivePreset(''); }} className="input-base py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5">To Date</label>
            <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setActivePreset(''); }} className="input-base py-2 text-sm" />
          </div>
          {isSuperAdmin && hubCtx.isAllHubs && (
            <Select value={hubCtx.selectedHubId} onChange={(e) => { if (e.target.value) hubCtx.selectHub(e.target.value); else hubCtx.selectAllHubs(); }}>
              <option value="">All Hubs</option>
              {hubCtx.accessibleHubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </Select>
          )}
          <Select value={collectorFilter} onChange={(e) => setCollectorFilter(e.target.value)}>
            <option value="all">All Employees</option>
            {collectors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="reconciled">Reconciled</option>
            <option value="pending">Pending</option>
            <option value="shortage">Shortage</option>
            <option value="excess">Excess</option>
          </Select>
        </div>
      </Card>

      {/* Reconciliation rate + stat cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Reconciliation rate card */}
            <div className="relative overflow-hidden col-span-2 lg:col-span-1 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-950 text-white shadow-soft-lg p-5 flex flex-col justify-center animate-fade-in">
              <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -right-4 -bottom-8 h-20 w-20 rounded-full bg-white/5 blur-xl" />
              <div className="relative flex items-center gap-2 mb-2">
                <Percent className="h-5 w-5" />
                <span className="text-sm font-medium text-white/80">Reconciliation Rate</span>
              </div>
              <p className="relative text-4xl font-bold tabular-nums">{stats.rate}%</p>
              <p className="relative text-xs text-white/70 mt-1">
                {entries.filter((e) => e.status === 'reconciled').length} of {stats.count} reconciled
              </p>
            </div>
            {statCards.slice(0, 3).map((c) => (
              <Card key={c.label} hover className="p-5 animate-fade-in">
                <div className={clsx('inline-flex h-11 w-11 items-center justify-center rounded-xl ring-1', accentMap[c.accent])}>
                  <c.icon className="h-5 w-5" />
                </div>
                <p className="mt-3 text-xs font-medium text-neutral-500">{c.label}</p>
                <p className="mt-1 text-xl lg:text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">{formatINR(c.value)}</p>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {statCards.slice(3).map((c) => (
              <Card key={c.label} hover className="p-5 animate-fade-in">
                <div className={clsx('inline-flex h-11 w-11 items-center justify-center rounded-xl ring-1', accentMap[c.accent])}>
                  <c.icon className="h-5 w-5" />
                </div>
                <p className="mt-3 text-xs font-medium text-neutral-500">{c.label}</p>
                <p className="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">{formatINR(c.value)}</p>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Charts */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-80" />)}
        </div>
      ) : entries.length === 0 ? (
        <Card><EmptyState icon={<FileBarChart className="h-7 w-7" />} title="No data for selected filters" message="Try widening the date range or clearing filters." /></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="p-5">
            <h3 className="font-bold text-neutral-900 dark:text-neutral-100">Daily Collection Trend</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 mt-0.5">Collection vs expected over the date range</p>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={dailyTrend}>
                <defs>
                  <linearGradient id="gCol" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: axisFill }} />
                <YAxis tick={{ fontSize: 11, fill: axisFill }} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="expected" name="Expected COD" stroke="#94A3B8" fill="url(#gExp)" strokeWidth={2} />
                <Area type="monotone" dataKey="collection" name="Collection" stroke="#10B981" fill="url(#gCol)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-5">
            <h3 className="font-bold text-neutral-900 dark:text-neutral-100">Cash vs Online</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 mt-0.5">Payment method distribution</p>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={cashVsOnline} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3}>
                  {cashVsOnline.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-5">
            <h3 className="font-bold text-neutral-900 dark:text-neutral-100">Employee-wise Collection</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 mt-0.5">Top employees by total collection</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={collectorWise} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: axisFill }} tickFormatter={(v) => `${v / 1000}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: axisFill }} width={90} />
                <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={tooltipStyle} />
                <Bar dataKey="collection" name="Collection" fill="#10B981" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-5">
            <h3 className="font-bold text-neutral-900 dark:text-neutral-100">Shortage & Excess Analysis</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 mt-0.5">Reconciliation status breakdown</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={statusAnalysis}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: axisFill }} />
                <YAxis tick={{ fontSize: 11, fill: axisFill }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" name="Records" radius={[6, 6, 0, 0]}>
                  {statusAnalysis.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}
    </div>
  );
}
