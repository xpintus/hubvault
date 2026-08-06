import React, { useEffect, useState } from 'react';
import { useHub } from '@/lib/hubContext';
import { fetchImportBatches } from '@/lib/ndr/ndrService';
import { NDRImportBatch } from '@/types/ndr';
import { FileSpreadsheet, History, RefreshCw } from 'lucide-react';

export default function NDRImportHistory() {
  const { selectedHub } = useHub();
  const [batches, setBatches] = useState<NDRImportBatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchImportBatches(selectedHub?.id || null)
      .then(setBatches)
      .finally(() => setLoading(false));
  }, [selectedHub]);


  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <History className="h-5 w-5 text-brand-600" /> Excel Import History
          </h2>
          <p className="text-xs text-neutral-500">Immutable audit log of all uploaded NDR Excel & CSV batches.</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
          {batches.length} Batches Uploaded
        </span>
      </div>

      <div className="rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-soft overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-neutral-500 flex flex-col items-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-brand-600" />
            <span className="text-xs">Loading import history...</span>
          </div>
        ) : batches.length === 0 ? (
          <div className="py-16 text-center text-neutral-500 text-sm">No import history recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-50 dark:bg-neutral-900/60 text-neutral-500 font-semibold border-b border-neutral-200 dark:border-neutral-800">
                <tr>
                  <th className="px-4 py-3">Filename</th>
                  <th className="px-4 py-3">Uploaded By</th>
                  <th className="px-4 py-3">Upload Time</th>
                  <th className="px-4 py-3">Total Rows</th>
                  <th className="px-4 py-3">Valid Rows</th>
                  <th className="px-4 py-3">Duplicates</th>
                  <th className="px-4 py-3">Errors</th>
                  <th className="px-4 py-3 font-semibold">Success Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {batches.map((b) => (
                  <tr key={b.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 font-semibold text-neutral-900 dark:text-neutral-100">
                        <FileSpreadsheet className="h-4 w-4 text-brand-600 shrink-0" />
                        <span className="truncate max-w-[220px]">{b.filename}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300">{b.uploaded_by_name || 'Staff'}</td>
                    <td className="px-4 py-3 text-neutral-500">{new Date(b.upload_time).toLocaleString()}</td>
                    <td className="px-4 py-3 font-bold">{b.total_rows}</td>
                    <td className="px-4 py-3 text-emerald-600 font-bold">{b.valid_rows}</td>
                    <td className="px-4 py-3 text-amber-600 font-bold">{b.duplicate_rows}</td>
                    <td className="px-4 py-3 text-rose-600 font-bold">{b.invalid_rows}</td>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-full font-bold text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        {b.ready_to_import} Imported
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
