import { computeGap,computeStatus,computeTotal } from '@/lib/calc';
import { downloadImportTemplate,ImportPreview,parseImportFile } from '@/lib/excel';
import { supabase } from '@/lib/supabase';
import { Collector,EntryStatus } from '@/types';
import { AlertTriangle,CheckCircle2,Download,FileSpreadsheet,Upload,XCircle } from 'lucide-react';
import { useRef,useState } from 'react';
import Modal from './ui/Modal';
import { Button } from './ui/primitives';
import { useToast } from './ui/Toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  collectors: Collector[];
  hubId: string;
  createdById: string;
}

export default function ImportModal({ open, onClose, onImported, collectors, hubId, createdById }: Props) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

  const reset = () => {
    setPreview(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFile = async (file: File) => {
    try {
      const p = await parseImportFile(file);
      setPreview(p);
      setResult(null);
      if (p.totalRows === 0) toast.warning('The uploaded file appears to be empty.');
    } catch {
      toast.error('Could not read the Excel file. Please check the format.');
    }
  };

  const runImport = async () => {
    if (!preview) return;
    setImporting(true);
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    const byEmpId = new Map(collectors.map((c) => [c.employee_id.toLowerCase(), c]));

    for (const row of preview.valid) {
      const collector = byEmpId.get(row.employeeId.toLowerCase());
      if (!collector) {
        failed++;
        errors.push(`Row ${row.rowIndex}: Employee ID "${row.employeeId}" not found in this hub`);
        continue;
      }
      const total = computeTotal(row.cash_amount, row.online_amount);
      const gap = computeGap(total, row.expected_cod);
      const status: EntryStatus = computeStatus(gap, total > 0);
      const { error } = await supabase.from('collection_entries').insert({
        collection_date: row.collection_date,
        collector_id: collector.id,
        hub_id: hubId,
        expected_cod: row.expected_cod,
        cash_amount: row.cash_amount,
        online_amount: row.online_amount,
        online_payment_mode: row.online_amount > 0 ? row.online_payment_mode : null,
        total_collection: total,
        gap,
        status,
        remarks: row.remarks || null,
        created_by: createdById,
        denominations: undefined,
      });
      if (error) {
        failed++;
        errors.push(`Row ${row.rowIndex}: ${error.message}`);
      } else {
        success++;
      }
    }

    setResult({ success, failed, errors });
    setImporting(false);
    if (success > 0) {
      toast.success(`${success} record${success > 1 ? 's' : ''} imported successfully`);
      onImported();
    }
  };

  const close = () => {
    reset();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import Collections from Excel"
      subtitle="Upload an .xlsx file. Rows are validated before import."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={importing}>
            Close
          </Button>
          <Button variant="ghost" icon={<Download className="h-4 w-4" />} onClick={downloadImportTemplate}>
            Download Template
          </Button>
          {preview && !result && (
            <Button onClick={runImport} loading={importing} disabled={preview.valid.length === 0}>
              Import {preview.valid.length} record{preview.valid.length !== 1 ? 's' : ''}
            </Button>
          )}
        </>
      }
    >
      {!preview && (
        <div
          className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-2xl p-10 text-center hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-600/15/30 transition cursor-pointer group"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}
        >
          <div className="mx-auto h-16 w-16 rounded-2xl bg-brand-50 dark:bg-brand-600/15 text-brand-600 flex items-center justify-center mb-4 ring-1 ring-brand-600/30 group-hover:scale-110 transition-transform">
            <Upload className="h-8 w-8" />
          </div>
          <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Click to upload or drag and drop</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Excel files only (.xlsx, .xls)</p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <div className="mt-5 inline-flex items-center gap-1.5 text-xs text-neutral-500 rounded-lg bg-neutral-100 dark:bg-neutral-950 px-3 py-2 ring-1 ring-neutral-200 dark:ring-neutral-700/60">
            <FileSpreadsheet className="h-4 w-4 text-brand-600" />
            Need the right format?
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                downloadImportTemplate();
              }}
              className="text-brand-600 hover:underline font-semibold"
            >
              Download template
            </button>
          </div>
        </div>
      )}

      {preview && !result && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800/80 p-3 text-center">
              <p className="text-2xl font-bold text-neutral-700 dark:text-neutral-300 tabular-nums">{preview.totalRows}</p>
              <p className="text-xs text-neutral-500 mt-0.5">Total Rows</p>
            </div>
            <div className="rounded-xl bg-brand-50 dark:bg-brand-600/15 border border-brand-600/30 p-3 text-center">
              <p className="text-2xl font-bold text-brand-600 tabular-nums">{preview.valid.length}</p>
              <p className="text-xs text-brand-600 mt-0.5">Valid</p>
            </div>
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-center">
              <p className="text-2xl font-bold text-red-400 tabular-nums">{preview.failed.length}</p>
              <p className="text-xs text-red-500 mt-0.5">With Errors</p>
            </div>
          </div>

          {preview.failed.length > 0 && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10/50 p-3 max-h-40 overflow-y-auto">
              <p className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Errors found ({preview.failed.length})
              </p>
              <ul className="space-y-1 text-xs text-red-400">
                {preview.failed.map((r, i) => (
                  <li key={i}>
                    Row {r.rowIndex}: {r.errors.join(', ')}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview.valid.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">Preview of valid rows</p>
              <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800/80">
                <table className="w-full text-xs">
                  <thead className="bg-neutral-100 dark:bg-neutral-950/80 text-neutral-500">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Date</th>
                      <th className="text-left px-3 py-2 font-semibold">Employee</th>
                      <th className="text-left px-3 py-2 font-semibold">Emp ID</th>
                      <th className="text-right px-3 py-2 font-semibold">COD</th>
                      <th className="text-right px-3 py-2 font-semibold">Cash</th>
                      <th className="text-right px-3 py-2 font-semibold">Online</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {preview.valid.slice(0, 10).map((r, i) => (
                      <tr key={i} className="hover:bg-neutral-100 dark:hover:bg-neutral-900/60 transition">
                        <td className="px-3 py-2 text-neutral-500 dark:text-neutral-400 tabular-nums">{r.collection_date}</td>
                        <td className="px-3 py-2 text-neutral-700 dark:text-neutral-300 font-medium">{r.collectorName}</td>
                        <td className="px-3 py-2 text-neutral-500 font-mono">{r.employeeId}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-neutral-500 dark:text-neutral-400">{r.expected_cod}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-neutral-500 dark:text-neutral-400">{r.cash_amount}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-neutral-500 dark:text-neutral-400">{r.online_amount}</td>
                    </tr>
                    ))}
                  </tbody>
                </table>
                {preview.valid.length > 10 && (
                  <p className="text-center text-xs text-neutral-500 dark:text-neutral-400 py-2 bg-neutral-100 dark:bg-neutral-950/80">
                    + {preview.valid.length - 10} more valid rows
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-brand-600/30 bg-brand-50 dark:bg-brand-600/15/50 p-5 text-center">
              <div className="mx-auto h-12 w-12 rounded-xl bg-brand-600/20 text-brand-600 flex items-center justify-center mb-3">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <p className="text-3xl font-bold text-brand-600 tabular-nums">{result.success}</p>
              <p className="text-sm text-brand-600 mt-1">Imported successfully</p>
            </div>
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10/50 p-5 text-center">
              <div className="mx-auto h-12 w-12 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center mb-3">
                <XCircle className="h-7 w-7" />
              </div>
              <p className="text-3xl font-bold text-red-400 tabular-nums">{result.failed}</p>
              <p className="text-sm text-red-400 mt-1">Failed to import</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10/50 p-3 max-h-40 overflow-y-auto">
              <p className="text-xs font-semibold text-amber-400 mb-2">Import errors</p>
              <ul className="space-y-1 text-xs text-amber-400">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <Button variant="outline" onClick={reset} className="w-full">
            Import another file
          </Button>
        </div>
      )}
    </Modal>
  );
}
