import { DailyClosing } from '@/types';
import { formatINR } from './format';

export async function exportDailyClosingsExcel(rows: DailyClosing[], filename: string) {
  const XLSX = await import('xlsx');
  const data = rows.map((r) => ({
    Date: r.closing_date, Employee: r.collector?.name ?? '', 'Employee ID': r.collector?.employee_id ?? '',
    Hub: r.hub?.name ?? '', 'Expected Cash': Number(r.expected_cash), 'Actual Cash': Number(r.actual_cash),
    'Online Amount': Number(r.online_amount), 'Shortage / Excess': Number(r.shortage_excess),
    Status: r.status, Notes: r.notes ?? '', 'Rejection Reason': r.rejection_reason ?? '',
    Submitted: r.submitted_at, Reviewed: r.reviewed_at ?? '',
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Daily Closings');
  XLSX.writeFile(wb, filename);
}

export function printDailyClosingsPdf(rows: DailyClosing[], title: string) {
  const win = window.open('', '_blank');
  if (!win) throw new Error('Pop-up blocked. Allow pop-ups to generate the PDF report.');
  const body = rows.map((r) => `<tr><td>${r.closing_date}</td><td>${r.collector?.name ?? ''}</td><td>${r.hub?.name ?? ''}</td><td>${formatINR(r.expected_cash)}</td><td>${formatINR(r.actual_cash)}</td><td>${formatINR(r.online_amount)}</td><td>${formatINR(r.shortage_excess)}</td><td>${r.status.toUpperCase()}</td></tr>`).join('');
  win.document.write(`<!doctype html><html><head><title>${title}</title><style>body{font-family:Arial;padding:28px;color:#172033}h1{font-size:20px}p{color:#64748b}table{width:100%;border-collapse:collapse;margin-top:20px;font-size:11px}th,td{border:1px solid #cbd5e1;padding:7px;text-align:left}th{background:#f1f5f9}@page{size:landscape;margin:12mm}</style></head><body><h1>${title}</h1><p>Generated ${new Date().toLocaleString('en-IN')}</p><table><thead><tr><th>Date</th><th>Employee</th><th>Hub</th><th>Expected Cash</th><th>Actual Cash</th><th>Online</th><th>Variance</th><th>Status</th></tr></thead><tbody>${body}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
  win.document.close();
}
