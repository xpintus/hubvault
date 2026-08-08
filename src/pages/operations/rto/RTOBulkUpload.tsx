import { useToast } from '@/components/ui/Toast';
import { CheckCircle2, ClipboardPaste, Copy, Download, FileSpreadsheet, RotateCcw, Search, Trash2, UploadCloud } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

const STATUSES = ['RTO', 'DTO', 'HOLD', 'DELIVERED', 'OFD', 'LOST', 'CANCELLED', 'PENDING'];
const REASONS = [
  'Confirmed by Client', 'Out of Delivery Area', 'Customer Rejected OTP',
  'Customer Rejected Without OTP', '3 attempts done', 'High Risk / Doubtful order',
  'Station Closed', 'Volumetric Shipment', 'Fraud Seller', 'Damaged Shipment',
  'Wrong Facility', 'Breach At FM', 'Fake Customer', 'Customer did not have cash',
  'Customer faced issue paying via UPI',
];
const STORAGE_KEY = 'hubvault_rto_bulk_workspace_v1';

export interface RTORow { id: string; awb: string; status: string; reason: string }

export function parseUniqueAwbs(raw: string) {
  const seen = new Set<string>();
  return raw
    .split(/[\s,;|]+/)
    .map((value) => value.replace(/^["']|["']$/g, '').trim().toUpperCase())
    .filter((value) => Boolean(value) && /^[A-Z0-9-]+$/.test(value))
    .filter((value) => !seen.has(value) && Boolean(seen.add(value)));
}

export default function RTOBulkUpload() {
  const toast = useToast();
  const [rawInput, setRawInput] = useState('');
  const [rows, setRows] = useState<RTORow[]>([]);
  const [status, setStatus] = useState('RTO');
  const [reason, setReason] = useState(REASONS[0]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved) {
        setRawInput(saved.rawInput || ''); setRows(saved.rows || []);
        setStatus(saved.status || 'RTO'); setReason(saved.reason || REASONS[0]);
      }
    } catch { /* Ignore an invalid local draft. */ }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ rawInput, rows, status, reason }));
  }, [rawInput, rows, status, reason]);

  const parsedCount = parseUniqueAwbs(rawInput).length;
  const duplicateCount = Math.max(0, rawInput.split(/[\s,;|]+/).filter(Boolean).length - parsedCount);
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? rows.filter((row) => `${row.awb} ${row.status} ${row.reason}`.toLowerCase().includes(term)) : rows;
  }, [rows, search]);

  const processAwbs = () => {
    const awbs = parseUniqueAwbs(rawInput);
    if (!awbs.length) return toast.error('Paste at least one valid AWB number.');
    setRows(awbs.map((awb) => ({ id: crypto.randomUUID(), awb, status, reason })));
    toast.success(`${awbs.length} unique AWBs ready.`);
  };

  const applyBulk = () => {
    if (!rows.length) return toast.error('Process AWBs first.');
    setRows((current) => current.map((row) => ({ ...row, status, reason })));
    toast.success('Status and reason applied to all AWBs.');
  };

  const clearWorkspace = () => {
    setRawInput(''); setRows([]); setSearch(''); localStorage.removeItem(STORAGE_KEY);
    toast.success('RTO workspace cleared.');
  };

  const downloadExcel = () => {
    if (!rows.length) return toast.error('No AWBs available to export.');
    const sheet = XLSX.utils.json_to_sheet(rows.map((row, index) => ({
      'SR.NO': index + 1, 'AWB NUMBER': row.awb, Status: row.status, Reason: row.reason,
    })));
    sheet['!cols'] = [{ wch: 10 }, { wch: 24 }, { wch: 16 }, { wch: 38 }];
    sheet['!autofilter'] = { ref: `A1:D${rows.length + 1}` };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'RTO_Bulk_Upload');
    XLSX.writeFile(workbook, `RTO_Bulk_Upload_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('RTO Excel downloaded.');
  };

  const copyAwbs = async () => {
    if (!rows.length) return toast.error('No AWBs available to copy.');
    await navigator.clipboard.writeText(rows.map((row) => row.awb).join('\n'));
    toast.success('AWB list copied.');
  };

  const updateRow = (id: string, patch: Partial<RTORow>) => setRows((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 p-5 text-white shadow-xl sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3"><UploadCloud className="h-7 w-7" /></div>
            <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-200">Valmo operations tool</p><h2 className="mt-1 text-2xl font-black">RTO Bulk Upload Generator</h2><p className="mt-1 max-w-2xl text-xs text-indigo-100/70">Clean mixed AWB lists, remove duplicates, assign RTO decisions and export an upload-ready Excel file.</p></div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[[rows.length, 'Ready'], [duplicateCount, 'Duplicates'], [new Set(rows.map((row) => row.status)).size, 'Statuses']].map(([value, label]) => <div key={label} className="min-w-24 rounded-xl border border-white/10 bg-white/10 px-3 py-2"><strong className="block font-mono text-lg">{value}</strong><span className="text-[9px] font-bold uppercase text-indigo-200">{label}</span></div>)}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-3 flex items-center justify-between"><div><h3 className="font-black text-neutral-900 dark:text-white">Paste AWB Numbers</h3><p className="text-[11px] text-neutral-500 dark:text-neutral-400">Newline, comma, space, tab, semicolon and pipe supported.</p></div><ClipboardPaste className="h-5 w-5 text-brand-600 dark:text-brand-400" /></div>
          <textarea value={rawInput} onChange={(event) => setRawInput(event.target.value)} placeholder={'VM1234567890\nVM1234567891, VM1234567892'} className="min-h-52 w-full resize-y rounded-2xl border border-neutral-200 bg-neutral-50 p-4 font-mono text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-600" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400"><strong className="text-neutral-900 dark:text-white">{parsedCount}</strong> unique AWBs detected</span><div className="flex gap-2"><button onClick={clearWorkspace} className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-xs font-bold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"><RotateCcw className="h-4 w-4" /> Clear</button><button onClick={processAwbs} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-brand-500/20 hover:bg-brand-500"><CheckCircle2 className="h-4 w-4" /> Process & Preview</button></div></div>
        </div>

        <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="font-black text-neutral-900 dark:text-white">Bulk Settings</h3><p className="mb-5 text-[11px] text-neutral-500 dark:text-neutral-400">Apply one decision to every processed AWB.</p>
          <label className="mb-1.5 block text-xs font-bold text-neutral-700 dark:text-neutral-200">Default Status</label><select value={status} onChange={(event) => setStatus(event.target.value)} className="input-base mb-4">{STATUSES.map((item) => <option key={item}>{item}</option>)}</select>
          <label className="mb-1.5 block text-xs font-bold text-neutral-700 dark:text-neutral-200">Default Reason</label><select value={reason} onChange={(event) => setReason(event.target.value)} className="input-base mb-5">{REASONS.map((item) => <option key={item}>{item}</option>)}</select>
          <button onClick={applyBulk} className="w-full rounded-xl bg-violet-600 px-4 py-3 text-xs font-black text-white">Apply to All Rows</button>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-3 border-b border-neutral-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800">
          <div className="relative min-w-0 flex-1 sm:max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search AWB, status or reason" className="input-base pl-9" /></div>
          <div className="flex gap-2"><button onClick={copyAwbs} className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-xs font-bold text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"><Copy className="h-4 w-4" /> Copy AWBs</button><button onClick={downloadExcel} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-500"><Download className="h-4 w-4" /> Download Excel</button></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-neutral-50 text-[10px] font-black uppercase tracking-wider text-neutral-500 dark:bg-neutral-800/50"><tr><th className="px-4 py-3">SR.No</th><th className="px-4 py-3">AWB Number</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3 text-right">Action</th></tr></thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">{filteredRows.length ? filteredRows.map((row) => { const index = rows.findIndex((item) => item.id === row.id); return <tr key={row.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30"><td className="px-4 py-3 font-mono text-neutral-400">{index + 1}</td><td className="px-4 py-3 font-mono font-black text-neutral-900 dark:text-white">{row.awb}</td><td className="px-4 py-3"><select value={row.status} onChange={(event) => updateRow(row.id, { status: event.target.value })} className="input-base min-w-32 py-2">{STATUSES.map((item) => <option key={item}>{item}</option>)}</select></td><td className="px-4 py-3"><select value={row.reason} onChange={(event) => updateRow(row.id, { reason: event.target.value })} className="input-base min-w-72 py-2">{REASONS.map((item) => <option key={item}>{item}</option>)}</select></td><td className="px-4 py-3 text-right"><button onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"><Trash2 className="h-4 w-4" /></button></td></tr>; }) : <tr><td colSpan={5} className="px-4 py-16 text-center"><FileSpreadsheet className="mx-auto mb-3 h-8 w-8 text-neutral-300" /><p className="font-bold text-neutral-500">No processed AWBs yet</p><p className="mt-1 text-[10px] text-neutral-400">Paste AWBs above and click Process & Preview.</p></td></tr>}</tbody>
          </table>
        </div>
        <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-3 text-[11px] font-semibold text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950/40">Showing {filteredRows.length} of {rows.length} AWBs</div>
      </section>
    </div>
  );
}
