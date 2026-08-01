import { Party,PartyLedgerEntry,PartySummaryCardData } from '@/types';
import { formatINRNumber } from './khatabook';

export interface LedgerExportRow {
  Date: string;
  Party: string;
  Company: string;
  'Received Amount': number;
  'Cash Paid': number;
  'Online Paid': number;
  'Total Paid': number;
  Difference: number;
  'Running Balance': number;
  Status: string;
  Reference: string;
  Remarks: string;
}

export async function exportPartyLedgerToExcel(
  party: Party | null,
  entries: PartyLedgerEntry[],
  filename = 'party-ledger-statement.xlsx'
) {
  const XLSX = await import('xlsx');

  const rows: LedgerExportRow[] = entries.map((e) => ({
    Date: e.transaction_date,
    Party: e.party?.name || party?.name || 'All Parties',
    Company: e.party?.company_name || party?.company_name || '-',
    'Received Amount': Number(e.amount_received || 0),
    'Cash Paid': Number(e.cash_paid || 0),
    'Online Paid': Number(e.online_paid || 0),
    'Total Paid': Number(e.total_paid || 0),
    Difference: Number(e.difference || 0),
    'Running Balance': Number(e.running_balance || 0),
    Status: e.status_label,
    Reference: e.payment_reference || '-',
    Remarks: e.remarks || '-',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  const sheetName = party ? party.name.slice(0, 30) : 'Ledger Statement';
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

export async function exportPartySummaryToExcel(
  summaries: PartySummaryCardData[],
  filename = 'party-summary-report.xlsx'
) {
  const XLSX = await import('xlsx');

  const rows = summaries.map((s) => ({
    'Party Name': s.party.name,
    Company: s.party.company_name || '-',
    Mobile: s.party.mobile || '-',
    'Opening Balance': Number(s.party.opening_balance || 0),
    Type: s.party.opening_balance_type,
    'Total Received': Number(s.total_received || 0),
    'Cash Paid': Number(s.cash_paid || 0),
    'Online Paid': Number(s.online_paid || 0),
    'Total Paid': Number(s.total_paid || 0),
    'Current Balance': Number(s.current_balance || 0),
    Status: s.status.toUpperCase(),
    'Balance Description': s.balance_text,
    'Last Transaction': s.last_transaction_date || '-',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Parties Summary');
  XLSX.writeFile(wb, filename);
}

export function printKhataBookReport(
  title: string,
  partyInfo: Party | null,
  entries: PartyLedgerEntry[]
) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const partyHeader = partyInfo
    ? `<div style="margin-bottom: 20px; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
        <h2 style="margin: 0 0 5px 0; font-size: 18px; color: #0f172a;">${partyInfo.name}</h2>
        <p style="margin: 0; font-size: 14px; color: #475569;">
          ${partyInfo.company_name ? `Company: ${partyInfo.company_name} | ` : ''}
          ${partyInfo.mobile ? `Mobile: ${partyInfo.mobile} | ` : ''}
          Opening Balance: ${formatINRNumber(partyInfo.opening_balance)} (${partyInfo.opening_balance_type.toUpperCase()})
        </p>
       </div>`
    : '';

  const rowsHtml = entries
    .map(
      (e) => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: left;">${e.transaction_date}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: left;">${e.party?.name || partyInfo?.name || '-'}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #16a34a; font-weight: 500;">${e.amount_received > 0 ? formatINRNumber(e.amount_received) : '-'}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${e.cash_paid > 0 ? formatINRNumber(e.cash_paid) : '-'}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">${e.online_paid > 0 ? formatINRNumber(e.online_paid) : '-'}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600;">${formatINRNumber(e.total_paid)}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700; color: ${e.running_balance > 0 ? '#dc2626' : e.running_balance < 0 ? '#2563eb' : '#16a34a'};">
        ${formatINRNumber(e.running_balance)}
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">
        <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; background: ${
          e.status === 'settled' ? '#dcfce7; color: #166534;' :
          e.status === 'pending' ? '#fee2e2; color: #991b1b;' :
          e.status === 'excess' ? '#dbeafe; color: #1e40af;' : '#fef3c7; color: #92400e;'
        }">${e.status_label}</span>
      </td>
    </tr>
  `
    )
    .join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 20px; color: #1e293b; }
          h1 { font-size: 22px; color: #0f172a; margin-bottom: 5px; }
          .subtitle { font-size: 13px; color: #64748b; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
          th { background: #f1f5f9; padding: 10px 12px; border-bottom: 2px solid #cbd5e1; text-align: left; font-weight: 600; color: #334155; }
          @media print {
            body { margin: 0; }
            @page { size: landscape; }
          }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p class="subtitle">Generated on ${new Date().toLocaleString()} | HubVault KhataBook System</p>
        ${partyHeader}
        <table>
          <thead>
            <tr>
              <th style="text-align: left;">Date</th>
              <th style="text-align: left;">Party Name</th>
              <th style="text-align: right;">Received</th>
              <th style="text-align: right;">Cash Paid</th>
              <th style="text-align: right;">Online Paid</th>
              <th style="text-align: right;">Total Paid</th>
              <th style="text-align: right;">Running Balance</th>
              <th style="text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
