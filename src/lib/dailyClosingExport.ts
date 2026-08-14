import { DailyClosing, DailyClosingFinalization } from '@/types';
import { formatINR } from './format';

const amount = (value: unknown) => Number(value || 0);
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

function reportMetrics(rows: DailyClosing[]) {
  const totalExpectedCash = rows.reduce((sum, row) => sum + amount(row.expected_cash), 0);
  const totalExpectedOnline = rows.reduce((sum, row) => sum + amount(row.expected_online_amount), 0);
  const totalCash = rows.reduce((sum, row) => sum + amount(row.actual_cash), 0);
  const totalOnline = rows.reduce((sum, row) => sum + amount(row.online_amount), 0);
  const shortages = rows.map((row) => {
    const cashVariance = amount(row.actual_cash) - amount(row.expected_cash);
    const onlineVariance = amount(row.online_amount) - amount(row.expected_online_amount);
    const totalVariance = cashVariance + onlineVariance;
    return { row, cashVariance, onlineVariance, totalVariance, shortage: Math.max(0, -totalVariance) };
  }).filter((item) => item.shortage > 0).sort((a, b) => b.shortage - a.shortage);
  return { totalExpectedCash, totalExpectedOnline, totalExpected: totalExpectedCash + totalExpectedOnline, totalCash, totalOnline, totalCollected: totalCash + totalOnline, totalShortage: shortages.reduce((sum, item) => sum + item.shortage, 0), shortages };
}

export async function exportDailyClosingsExcel(rows: DailyClosing[], filename: string) {
  const XLSX = await import('xlsx');
  const metrics = reportMetrics(rows);
  const data = rows.map((r) => ({
    Date: r.closing_date, Employee: r.collector?.name ?? '', 'Employee ID': r.collector?.employee_id ?? '', Hub: r.hub?.name ?? '',
    'Total Expected': amount(r.expected_cash) + amount(r.expected_online_amount), 'Expected Cash': amount(r.expected_cash), 'Actual Cash': amount(r.actual_cash),
    'Cash Variance': amount(r.actual_cash) - amount(r.expected_cash), 'Expected Online': amount(r.expected_online_amount), 'Actual Online': amount(r.online_amount),
    'Online Variance': amount(r.online_amount) - amount(r.expected_online_amount), 'Total Variance': amount(r.shortage_excess), Status: r.status,
    Notes: r.notes ?? '', 'Rejection Reason': r.rejection_reason ?? '', Submitted: r.submitted_at, Reviewed: r.reviewed_at ?? '',
  }));
  const summary = [
    { Metric: 'Total Expected Amount', Amount: metrics.totalExpected }, { Metric: 'Total Cash Collected', Amount: metrics.totalCash },
    { Metric: 'Total Online Collected', Amount: metrics.totalOnline }, { Metric: 'Total Collected', Amount: metrics.totalCollected },
    { Metric: 'Total Shortage', Amount: metrics.totalShortage }, { Metric: 'Employees with Shortage', Amount: metrics.shortages.length },
  ];
  const shortageRows = metrics.shortages.map(({ row, cashVariance, onlineVariance, shortage }) => ({ Employee: row.collector?.name ?? 'Employee', 'Employee ID': row.collector?.employee_id ?? '', 'Cash Shortage': Math.max(0, -cashVariance), 'Online Shortage': Math.max(0, -onlineVariance), 'Total Shortage': shortage, Status: row.status }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Daily Closings');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(shortageRows.length ? shortageRows : [{ Employee: 'No shortage', 'Total Shortage': 0 }]), 'Shortage Breakdown');
  XLSX.writeFile(wb, filename);
}

export function printDailyClosingsPdf(rows: DailyClosing[], title: string, finalization?: DailyClosingFinalization | null) {
  const win = window.open('', '_blank');
  if (!win) throw new Error('Pop-up blocked. Allow pop-ups to generate the PDF report.');
  const metrics = reportMetrics(rows);
  const hubName = rows[0]?.hub?.name ?? 'Hub';
  const body = rows.map((r, index) => {
    const cashVariance = amount(r.actual_cash) - amount(r.expected_cash);
    const onlineVariance = amount(r.online_amount) - amount(r.expected_online_amount);
    const totalVariance = cashVariance + onlineVariance;
    return `<tr><td>${index + 1}</td><td><strong>${escapeHtml(r.collector?.name ?? 'Employee')}</strong><small>${escapeHtml(r.collector?.employee_id ?? '')}</small></td><td>${formatINR(amount(r.expected_cash) + amount(r.expected_online_amount))}</td><td>${formatINR(r.actual_cash)}</td><td>${formatINR(r.online_amount)}</td><td class="${totalVariance < 0 ? 'negative' : totalVariance > 0 ? 'positive' : 'matched'}">${formatINR(totalVariance)}</td><td><span class="status ${escapeHtml(r.status)}">${escapeHtml(r.status.toUpperCase())}</span></td></tr>`;
  }).join('');
  const shortage = metrics.shortages.length ? `<section class="shortage"><div class="section-title"><div><span>SHORTAGE CONTROL</span><h2>Employee-wise shortage</h2></div><strong>${formatINR(metrics.totalShortage)}</strong></div><div class="shortage-grid">${metrics.shortages.map(({ row, cashVariance, onlineVariance, shortage }, index) => `<article><div class="rank">${index + 1}</div><div><h3>${escapeHtml(row.collector?.name ?? 'Employee')}</h3><p>${escapeHtml(row.collector?.employee_id ?? '')} · Cash ${formatINR(Math.max(0, -cashVariance))} · Online ${formatINR(Math.max(0, -onlineVariance))}</p></div><b>${formatINR(shortage)}</b></article>`).join('')}</div></section>` : '<section class="clear"><b>✓ No shortage recorded</b><span>All submitted collection amounts are fully reconciled.</span></section>';
  const verification = finalization ? `<div class="verification"><span>VERIFIED DAILY CLOSE</span><strong>Daily Closing verified by ${escapeHtml(finalization.finalizer?.name ?? 'Authorized user')}</strong><small>${escapeHtml(finalization.finalizer?.role?.replace('_', ' ') ?? '')} · ${new Date(finalization.finalized_at).toLocaleString('en-IN')}</small></div>` : '<div class="draft">DRAFT REPORT · Final Daily Close not submitted</div>';
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
  *{box-sizing:border-box}body{margin:0;background:#eef2f7;color:#172033;font-family:Inter,Arial,sans-serif}.page{max-width:1400px;margin:auto;background:#fff;min-height:100vh;padding:28px}.hero{display:flex;justify-content:space-between;align-items:flex-start;border-radius:20px;padding:24px 28px;color:#fff;background:linear-gradient(135deg,#111827,#312e81 60%,#6d28d9)}.eyebrow,.section-title span{font-size:9px;font-weight:800;letter-spacing:.18em}.hero h1{margin:7px 0 5px;font-size:25px}.hero p{margin:0;color:#ddd6fe;font-size:12px}.hub{text-align:right}.hub strong{display:block;font-size:17px}.hub span{font-size:10px;color:#c4b5fd}.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin:16px 0}.kpi{padding:15px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc}.kpi span{display:block;font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase}.kpi b{display:block;margin-top:7px;font-size:18px}.kpi.cash b{color:#047857}.kpi.online b{color:#2563eb}.kpi.short b{color:#dc2626}.verification,.draft{display:flex;gap:12px;align-items:center;margin:13px 0;padding:11px 14px;border-radius:11px}.verification{border:1px solid #86efac;background:#f0fdf4}.verification span{font-size:9px;font-weight:900;color:#15803d}.verification strong{font-size:12px}.verification small{margin-left:auto;color:#64748b}.draft{border:1px solid #fbbf24;background:#fffbeb;color:#92400e;font-weight:bold;font-size:11px}.shortage{margin:18px 0;padding:17px;border:1px solid #fecaca;border-radius:16px;background:#fff7f7}.section-title{display:flex;justify-content:space-between;align-items:end}.section-title span{color:#dc2626}.section-title h2{margin:4px 0 0;font-size:16px}.section-title>strong{font-size:20px;color:#dc2626}.shortage-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:12px}.shortage article{display:flex;align-items:center;gap:10px;padding:10px;border-radius:11px;background:#fff;border:1px solid #fee2e2}.rank{display:flex;width:25px;height:25px;align-items:center;justify-content:center;border-radius:8px;background:#fee2e2;color:#dc2626;font-weight:900}.shortage h3{margin:0;font-size:11px}.shortage p{margin:3px 0 0;font-size:9px;color:#64748b}.shortage article>b{margin-left:auto;color:#dc2626;font-size:12px}.clear{display:flex;gap:12px;margin:18px 0;padding:14px;border-radius:13px;background:#ecfdf5;color:#047857}.clear span{font-size:11px;color:#64748b}table{width:100%;border-collapse:separate;border-spacing:0;margin-top:16px;font-size:10px;border:1px solid #e2e8f0;border-radius:13px;overflow:hidden}th{padding:10px;background:#111827;color:#fff;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:.08em}td{padding:9px;border-top:1px solid #e2e8f0}td small{display:block;margin-top:2px;color:#94a3b8}.negative{color:#dc2626;font-weight:800}.positive{color:#d97706;font-weight:800}.matched{color:#059669;font-weight:800}.status{padding:4px 7px;border-radius:999px;background:#e2e8f0;font-size:8px;font-weight:900}.status.approved{background:#dcfce7;color:#15803d}.status.rejected{background:#fee2e2;color:#dc2626}.footer{display:flex;justify-content:space-between;margin-top:15px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:9px;color:#94a3b8}@page{size:landscape;margin:9mm}@media print{body{background:#fff}.page{padding:0}.hero{-webkit-print-color-adjust:exact;print-color-adjust:exact}.kpi,.shortage,.clear,th,.status{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body><main class="page"><header class="hero"><div><span class="eyebrow">HUB OPERATIONS · FINANCIAL CONTROL</span><h1>${escapeHtml(title)}</h1><p>Collector-wise cash and online reconciliation report</p></div><div class="hub"><span>HUB</span><strong>${escapeHtml(hubName)}</strong><span>${escapeHtml(rows[0]?.closing_date ?? '')}</span></div></header><section class="kpis"><div class="kpi"><span>Total Expected</span><b>${formatINR(metrics.totalExpected)}</b></div><div class="kpi cash"><span>Total Cash</span><b>${formatINR(metrics.totalCash)}</b></div><div class="kpi online"><span>Total Online</span><b>${formatINR(metrics.totalOnline)}</b></div><div class="kpi"><span>Total Collected</span><b>${formatINR(metrics.totalCollected)}</b></div><div class="kpi short"><span>Total Shortage</span><b>${formatINR(metrics.totalShortage)}</b></div></section>${verification}${shortage}<table><thead><tr><th>#</th><th>Employee</th><th>Total Expected</th><th>Cash</th><th>Online</th><th>Variance</th><th>Status</th></tr></thead><tbody>${body}</tbody></table><footer class="footer"><span>${rows.length} employee closing records</span><span>Generated ${new Date().toLocaleString('en-IN')}</span></footer></main><script>window.onload=()=>window.print()</script></body></html>`);
  win.document.close();
}
