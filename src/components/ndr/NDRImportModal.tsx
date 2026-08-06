import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { fetchExistingAWBMap, importNDRBatch } from '@/lib/ndr/ndrService';
import { downloadNDRImportTemplate, parseNDRExcelFile } from '@/lib/ndr/ndrExcel';
import { NDRExcelImportPreview } from '@/types/ndr';
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, RefreshCw, UploadCloud, X } from 'lucide-react';

interface NDRImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  hubId: string | null;
}

export const NDRImportModal: React.FC<NDRImportModalProps> = ({ isOpen, onClose, onSuccess, hubId }) => {
  const { profile } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<NDRExcelImportPreview | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    await processFile(selected);
  };

  const processFile = async (f: File) => {
    setFile(f);
    setLoading(true);
    setErrorMsg(null);
    try {
      // First quick pass to extract AWBs
      const initialPreview = await parseNDRExcelFile(f);
      const awbList = initialPreview.validRows.map((r) => r.waybill_no).filter(Boolean);

      // Fetch existing AWBs from DB for accurate duplication analysis
      const existingMap = await fetchExistingAWBMap(awbList, hubId);
      const existingAWBsSet = new Set(existingMap.keys());

      // Second pass with DB context
      const fullPreview = await parseNDRExcelFile(f, existingAWBsSet);
      setPreview(fullPreview);
    } catch (err: any) {
      console.error('Failed to parse NDR Excel:', err);
      setErrorMsg(err.message || 'Failed to parse Excel file. Please ensure valid XLSX/XLS/CSV format.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!file || !preview || preview.readyToImportCount === 0) return;
    setImporting(true);
    setErrorMsg(null);
    try {
      await importNDRBatch(
        file.name,
        [...preview.validRows, ...preview.invalidRows, ...preview.duplicateRows],
        hubId,
        profile?.id || null,
        profile?.name || 'Operations Admin',
        profile?.role || 'hub_admin'
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Import failed:', err);
      setErrorMsg(err.message || 'Failed to import NDR shipments. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-[var(--card-bg)] border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-50 dark:bg-brand-600/15 text-brand-600 dark:text-brand-400">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">Import Daily NDR Report</h2>
              <p className="text-xs text-neutral-500">Upload XLSX, XLS, or CSV files containing undelivered shipments</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-800/40 text-rose-600 dark:text-rose-400 text-sm flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Download Sample Template */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800">
            <div>
              <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">Need the standard NDR column mapping?</p>
              <p className="text-[11px] text-neutral-500">Supports waybill_no, drs_code, Employee_name, partner_name, reason, etc.</p>
            </div>
            <button
              onClick={downloadNDRImportTemplate}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-700 transition flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" /> Download Template
            </button>
          </div>

          {/* File Drag Drop Zone */}
          <label className="border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-brand-500 dark:hover:border-brand-400 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition bg-neutral-50/50 dark:bg-neutral-900/20 group">
            <UploadCloud className="h-10 w-10 text-neutral-400 group-hover:text-brand-500 transition mb-3" />
            <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              {file ? file.name : 'Click or drop NDR Excel / CSV file here'}
            </p>
            <p className="text-xs text-neutral-500 mt-1">Supports .xlsx, .xls, .csv files up to 50,000+ rows</p>
            <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileChange} className="hidden" />
          </label>

          {loading && (
            <div className="py-8 flex flex-col items-center justify-center gap-3 text-neutral-500">
              <RefreshCw className="h-8 w-8 animate-spin text-brand-600" />
              <p className="text-sm font-medium">Analyzing NDR file and validating AWBs...</p>
            </div>
          )}

          {/* Validation Breakdown Preview Cards */}
          {preview && !loading && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider">
                Import Validation Summary
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-center">
                  <p className="text-xs text-neutral-500 font-medium">Total Rows</p>
                  <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100">{preview.totalRows}</p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Valid Rows</p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{preview.validRows.length}</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">File Duplicates</p>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{preview.duplicateRows.length}</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Existing AWBs</p>
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{preview.existingRows.length}</p>
                </div>
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">Invalid Rows</p>
                  <p className="text-xl font-bold text-rose-600 dark:text-rose-400">{preview.invalidRows.length}</p>
                </div>
                <div className="p-3 rounded-xl bg-brand-500/10 border border-brand-500/20 text-center">
                  <p className="text-xs text-brand-600 dark:text-brand-400 font-medium">Ready to Import</p>
                  <p className="text-xl font-bold text-brand-600 dark:text-brand-400">{preview.readyToImportCount}</p>
                </div>
              </div>

              {/* Sample Data Table Preview */}
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 font-semibold sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">AWB Number</th>
                      <th className="px-3 py-2">Consignee</th>
                      <th className="px-3 py-2">Executive</th>
                      <th className="px-3 py-2">Pincode</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Reason</th>
                      <th className="px-3 py-2">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                    {preview.validRows.slice(0, 10).map((r) => (
                      <tr key={r.rowIndex} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/40">
                        <td className="px-3 py-2 font-mono text-neutral-500">{r.rowIndex}</td>
                        <td className="px-3 py-2 font-semibold text-neutral-900 dark:text-neutral-100">{r.waybill_no}</td>
                        <td className="px-3 py-2">{r.consignee}</td>
                        <td className="px-3 py-2">{r.Employee_name}</td>
                        <td className="px-3 py-2 font-mono">{r.delivery_pincode}</td>
                        <td className="px-3 py-2 font-semibold">₹{r.amount_payable}</td>
                        <td className="px-3 py-2 max-w-[180px] truncate text-neutral-500">{r.reason}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Ready
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition"
          >
            Cancel
          </button>
          <button
            disabled={!preview || preview.readyToImportCount === 0 || importing}
            onClick={handleConfirmImport}
            className="px-5 py-2 rounded-xl text-sm font-bold bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-50 transition shadow-glow flex items-center gap-2"
          >
            {importing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" /> Importing Batch...
              </>
            ) : (
              <>Import {preview?.readyToImportCount || 0} NDR Rows</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
