import { DailyClosing,DailyClosingFinalization } from '@/types';
import { formatINR } from './format';

export async function exportDailyClosingsExcel(rows: DailyClosing[], filename: string) {
  const XLSX = await import('xlsx');
  const data = rows.map((r) => ({
    Date: r.closing_date, Employee: r.collector?.name ?? '', 'Employee ID': r.collector?.employee_id ?? '',
    Hub: r.hub?.name ?? '', 'Expected Cash': Number(r.expected_cash), 'Actual Cash': Number(r.actual_cash),
    'Cash Variance': Number(r.actual_cash) - Number(r.expected_cash),
    'Expected Online': Number(r.expected_online_amount || 0), 'Actual Online': Number(r.online_amount),
    'Online Variance': Number(r.online_amount) - Number(r.expected_online_amount || 0), 'Total Variance': Number(r.shortage_excess),
    Status: r.status, Notes: r.notes ?? '', 'Rejection Reason': r.rejection_reason ?? '',
    Submitted: r.submitted_at, Reviewed: r.reviewed_at ?? '',
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Daily Closings');
  XLSX.writeFile(wb, filename);
}

export function printDailyClosingsPdf(rows: DailyClosing[], title: string, finalization?: DailyClosingFinalization | null) {
  const win = window.open('', '_blank');
  if (!win) throw new Error('Pop-up blocked. Allow pop-ups to generate the PDF report.');
  const body = rows.map((r) => `<tr><td>${r.closing_date}</td><td>${r.collector?.name ?? ''}</td><td>${r.hub?.name ?? ''}</td><td>${formatINR(r.expected_cash)}</td><td>${formatINR(r.actual_cash)}</td><td>${formatINR(Number(r.actual_cash) - Number(r.expected_cash))}</td><td>${formatINR(r.expected_online_amount || 0)}</td><td>${formatINR(r.online_amount)}</td><td>${formatINR(Number(r.online_amount) - Number(r.expected_online_amount || 0))}</td><td>${formatINR(r.shortage_excess)}</td><td>${r.status.toUpperCase()}</td></tr>`).join('');
  const verification = finalization
    ? `<div class="verification"><strong>Daily Closing verified by ${finalization.finalizer?.name ?? 'Authorized user'}</strong><br>${finalization.finalizer?.role?.replace('_', ' ') ?? ''} · ${new Date(finalization.finalized_at).toLocaleString('en-IN')}</div>`
    : '<div class="draft">DRAFT REPORT — Final Daily Close not submitted</div>';
  win.document.write(`<!doctype html><html><head><title>${title}</title><style>body{font-family:Arial;padding:28px;color:#172033}h1{font-size:20px}p{color:#64748b}.verification{margin:14px 0;padding:12px;border:1px solid #86efac;background:#f0fdf4}.draft{margin:14px 0;padding:10px;border:1px solid #fbbf24;background:#fffbeb;font-weight:bold}table{width:100%;border-collapse:collapse;margin-top:20px;font-size:11px}th,td{border:1px solid #cbd5e1;padding:7px;text-align:left}th{background:#f1f5f9}@page{size:landscape;margin:12mm}</style></head><body><h1>${title}</h1><p>Generated ${new Date().toLocaleString('en-IN')}</p>${verification}<table><thead><tr><th>Date</th><th>Employee</th><th>Hub</th><th>Expected Cash</th><th>Actual Cash</th><th>Cash Var.</th><th>Expected Online</th><th>Actual Online</th><th>Online Var.</th><th>Total Var.</th><th>Status</th></tr></thead><tbody>${body}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
  win.document.close();
}
