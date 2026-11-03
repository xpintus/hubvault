import { formatDate } from '@/lib/format';
import { EmployeeDRSMetrics, OverallDRSSummary } from '@/types/drs';

export interface GenerateSnapshotOptions {
  hubName: string;
  reportDate: string;
  summary: OverallDRSSummary | null;
  employeeMetrics: EmployeeDRSMetrics[];
  scale?: number;
}

/**
 * Helper to draw a rounded rectangle on a 2D canvas context.
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number | [number, number, number, number],
  fillStyle?: string,
  strokeStyle?: string,
  lineWidth: number = 1
) {
  ctx.save();
  ctx.beginPath();

  const [tl, tr, br, bl] = Array.isArray(radius)
    ? radius
    : [radius, radius, radius, radius];

  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + width - tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + tr);
  ctx.lineTo(x + width, y + height - br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - br, y + height);
  ctx.lineTo(x + bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - bl);
  ctx.lineTo(x, y + tl);
  ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();

  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Helper to get clean initials from an employee's name.
 */
function getEmployeeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'EX';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Format date string into human-friendly format (e.g., '03 Nov 2026').
 */
function formatReportDate(rawDate: string): string {
  if (!rawDate || rawDate === 'N/A' || rawDate === 'Current report') {
    return formatDate(new Date(), 'dd MMM yyyy');
  }
  try {
    return formatDate(rawDate, 'dd MMM yyyy');
  } catch {
    return rawDate;
  }
}

/**
 * Renders the complete HubVault Employee Performance Report Snapshot onto an HTML5 canvas.
 * Includes:
 * - Official HubVault Header & Metadata
 * - 6 Main Shipment Volume KPI Cards (Employees, Total OFD, Status OFD, Delivered, UNDEL, Pending)
 * - 4 Dedicated Performance Percentage KPI Cards (COD FAD %, Prepaid FAD %, Overall Delivery %, FAD Delivery %)
 * - 15-Column Leaderboard Table with individual percentage columns for all 4 metrics
 * - Team Aggregates / Summary Row (Σ)
 * - Official Verification Footer
 */
export function generateDRSSnapshotCanvas(options: GenerateSnapshotOptions): HTMLCanvasElement {
  const {
    hubName,
    reportDate,
    summary,
    employeeMetrics,
    scale = 2, // 2x scale renders at 2880px physical width for crisp mobile/WhatsApp sharing
  } = options;

  const width = 1440;
  const paddingX = 36;
  const contentWidth = width - paddingX * 2; // 1368px

  // Vertical Metrics:
  // Header = 98px, Gap = 14px, Row 1 KPI (Shipment volume) = 74px, Gap = 12px
  // Row 2 KPI (Percentages section) = 82px, Gap = 16px, Table Header = 44px
  // Rows = employeeMetrics.length * 42px, Totals Row = 44px, Gap = 14px, Footer = 46px
  const headerHeight = 98;
  const kpiRow1Height = 74;
  const kpiRow2Height = 82;
  const tableHeaderHeight = 44;
  const rowHeight = 42;
  const totalsRowHeight = 44;
  const footerHeight = 46;

  const totalRows = employeeMetrics.length;
  const totalLogicalHeight =
    12 +
    headerHeight +
    14 +
    kpiRow1Height +
    12 +
    kpiRow2Height +
    16 +
    tableHeaderHeight +
    totalRows * rowHeight +
    totalsRowHeight +
    14 +
    footerHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = totalLogicalHeight * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to obtain 2D canvas context');
  }

  // High-DPI scaling
  ctx.scale(scale, scale);

  // 1. Overall Background (Clean pearl white / soft slate)
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, totalLogicalHeight);

  // Top Accent Bar: Navy to Royal Blue with subtle Gold
  const topStripGradient = ctx.createLinearGradient(0, 0, width, 0);
  topStripGradient.addColorStop(0, '#0f172a'); // Navy
  topStripGradient.addColorStop(0.3, '#1e3a8a'); // Deep Navy
  topStripGradient.addColorStop(0.7, '#2563eb'); // Royal Blue
  topStripGradient.addColorStop(1, '#f59e0b'); // Gold
  ctx.fillStyle = topStripGradient;
  ctx.fillRect(0, 0, width, 4);

  // ==========================================
  // 2. HEADER PANEL (White Card with Border)
  // ==========================================
  drawRoundedRect(ctx, paddingX, 12, contentWidth, headerHeight, 10, '#ffffff', '#e2e8f0', 1);

  // HubVault Logo / Brand Emblem (40x40)
  drawRoundedRect(ctx, paddingX + 16, 26, 40, 40, 10, '#0f172a', '#1e293b', 1);

  // Stylized Vault Shield in Emblem
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeRect(paddingX + 26, 36, 20, 20);

  // Gold vault dial
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(paddingX + 36, 46, 3.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(paddingX + 36, 39);
  ctx.lineTo(paddingX + 36, 41);
  ctx.stroke();

  // HubVault Wordmark
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('HUBVAULT', paddingX + 66, 47);

  ctx.fillStyle = '#64748b';
  ctx.font = '700 8.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('COLLECTION RECONCILIATION SUITE', paddingX + 67, 61);

  // Divider line
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(paddingX + 290, 24);
  ctx.lineTo(paddingX + 290, 76);
  ctx.stroke();

  // Report Title & Subtitle
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('EMPLOYEE PERFORMANCE REPORT', paddingX + 310, 46);

  ctx.fillStyle = '#2563eb'; // Royal Blue
  ctx.font = '700 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('TEAM LEADERBOARD & LOGISTICS EXECUTIVE ANALYTICS', paddingX + 310, 61);

  // Right Side: Hub Name and Formatted Date Pills
  const formattedDate = formatReportDate(reportDate);
  const rightEdge = paddingX + contentWidth - 16;

  // Date Pill
  const datePillWidth = 140;
  const datePillX = rightEdge - datePillWidth;
  drawRoundedRect(ctx, datePillX, 28, datePillWidth, 36, 6, '#f8fafc', '#cbd5e1', 1);
  ctx.fillStyle = '#64748b';
  ctx.font = '600 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('REPORT DATE', datePillX + 10, 42);
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(formattedDate, datePillX + 10, 56);

  // Hub Pill
  const hubDisplayName = hubName || 'Main Hub';
  ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const hubTextWidth = ctx.measureText(hubDisplayName).width;
  const hubPillWidth = Math.max(hubTextWidth + 48, 140);
  const hubPillX = datePillX - hubPillWidth - 10;

  drawRoundedRect(ctx, hubPillX, 28, hubPillWidth, 36, 6, '#eff6ff', '#bfdbfe', 1);
  ctx.fillStyle = '#2563eb';
  ctx.beginPath();
  ctx.arc(hubPillX + 13, 46, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1e40af';
  ctx.font = '600 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('OPERATIONAL HUB', hubPillX + 22, 42);
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(hubDisplayName, hubPillX + 22, 56);

  // Official Badge
  const badgeWidth = 105;
  const badgeX = hubPillX - badgeWidth - 10;
  drawRoundedRect(ctx, badgeX, 28, badgeWidth, 36, 6, '#ecfdf5', '#a7f3d0', 1);
  ctx.fillStyle = '#059669';
  ctx.beginPath();
  ctx.arc(badgeX + 13, 46, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#065f46';
  ctx.font = '700 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('VERIFIED DATA', badgeX + 22, 50);

  // ========================================================
  // 3. ROW 1 KPI CARDS: MAIN SHIPMENT VOLUME & FULFILLMENT
  // ========================================================
  const row1Y = 12 + headerHeight + 14; // 124px
  const row1Gap = 14;
  const row1CardWidth = Math.floor((contentWidth - row1Gap * 5) / 6); // 216px

  const shipmentKpis = [
    {
      label: 'TOTAL EMPLOYEES',
      value: String(employeeMetrics.length),
      sublabel: 'Active Delivery Staff',
      accentColor: '#334155',
      textColor: '#0f172a',
    },
    {
      label: 'TOTAL OFD',
      value: String(summary?.totalOfd ?? 0),
      sublabel: 'Total Assigned Shipments',
      accentColor: '#1e3a8a',
      textColor: '#1e3a8a',
    },
    {
      label: 'STATUS OFD',
      value: String(summary?.statusOfd ?? 0),
      sublabel: 'Currently On Road',
      accentColor: '#0284c7',
      textColor: '#0284c7',
      badgeText: 'On Road',
    },
    {
      label: 'DELIVERED',
      value: String(summary?.totalDelivered ?? 0),
      sublabel: 'Successfully Completed',
      accentColor: '#10b981',
      textColor: '#059669',
    },
    {
      label: 'UNDEL',
      value: String(summary?.totalUndel ?? 0),
      sublabel: 'Requires Reattempt',
      accentColor: '#ef4444',
      textColor: '#dc2626',
    },
    {
      label: 'PENDING',
      value: String(summary?.totalPending ?? 0),
      sublabel: 'Pending Resolution',
      accentColor: '#f97316',
      textColor: '#ea580c',
    },
  ];

  shipmentKpis.forEach((card, index) => {
    const cardX = paddingX + index * (row1CardWidth + row1Gap);
    const actualWidth = index === 5 ? contentWidth - (cardX - paddingX) : row1CardWidth;

    drawRoundedRect(ctx, cardX, row1Y, actualWidth, kpiRow1Height, 8, '#ffffff', '#e2e8f0', 1);

    // Top colored accent bar
    drawRoundedRect(ctx, cardX, row1Y, actualWidth, 3, [8, 8, 0, 0], card.accentColor);

    // Label
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = '700 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(card.label, cardX + 12, row1Y + 19);

    if (card.badgeText) {
      ctx.font = '700 8px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const bWidth = ctx.measureText(card.badgeText).width + 8;
      const bX = cardX + actualWidth - bWidth - 10;
      drawRoundedRect(ctx, bX, row1Y + 10, bWidth, 14, 3, '#e0f2fe', '#bae6fd', 1);
      ctx.fillStyle = '#0284c7';
      ctx.fillText(card.badgeText, bX + 4, row1Y + 20);
    }

    // Value
    ctx.fillStyle = card.textColor;
    ctx.font = '800 21px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(card.value, cardX + 12, row1Y + 45);

    // Sublabel
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(card.sublabel, cardX + 12, row1Y + 62);
  });

  // =========================================================================
  // 4. ROW 2 KPI CARDS: COMPLETE PERFORMANCE PERCENTAGE METRICS (4 CARDS)
  // Required: COD FAD % (Blue), Prepaid FAD % (Purple), Overall Delivery % (Green), FAD Delivery % (Gold/Orange)
  // =========================================================================
  const row2Y = row1Y + kpiRow1Height + 12; // 210px
  const row2Gap = 16;
  const row2CardWidth = Math.floor((contentWidth - row2Gap * 3) / 4); // 330px

  const percentageKpis = [
    {
      label: 'COD FAD %',
      title: 'COD FIRST ATTEMPT DELIVERY RATE',
      value: `${summary?.codFadPercent ?? 0}%`,
      sublabel: `${summary?.codFirstAttemptDel ?? 0} delivered of ${summary?.codFirstAttemptOfd ?? 0} COD 1st attempts`,
      accentColor: '#2563eb', // Royal Blue
      textColor: '#1e40af',
      badgeBg: '#dbeafe',
      badgeBorder: '#bfdbfe',
      badgeColor: '#1d4ed8',
      badgeLabel: 'COD FAD',
    },
    {
      label: 'PREPAID FAD %',
      title: 'PREPAID FIRST ATTEMPT DELIVERY RATE',
      value: `${summary?.prepaidFadPercent ?? 0}%`,
      sublabel: `${summary?.prepaidFirstAttemptDel ?? 0} delivered of ${summary?.prepaidFirstAttemptOfd ?? 0} Prepaid 1st attempts`,
      accentColor: '#7c3aed', // Purple
      textColor: '#6d28d9',
      badgeBg: '#f3e8ff',
      badgeBorder: '#e9d5ff',
      badgeColor: '#7e22ce',
      badgeLabel: 'Prepaid FAD',
    },
    {
      label: 'OVERALL DELIVERY %',
      title: 'OVERALL DELIVERY SUCCESS RATE',
      value: `${summary?.overallDeliveryPct ?? 0}%`,
      sublabel: `${summary?.totalDelivered ?? 0} delivered of ${summary?.totalOfd ?? 0} total assigned shipments`,
      accentColor: '#059669', // Green
      textColor: '#047857',
      badgeBg: '#d1fae5',
      badgeBorder: '#a7f3d0',
      badgeColor: '#065f46',
      badgeLabel: 'Overall Del %',
    },
    {
      label: 'FAD DELIVERY %',
      title: 'TOTAL FIRST ATTEMPT DELIVERY RATE',
      value: `${summary?.firstAttemptDeliveryPct ?? 0}%`,
      sublabel: `${summary?.firstAttemptDelivered ?? 0} delivered of ${summary?.firstAttemptOfd ?? 0} total 1st attempts`,
      accentColor: '#d97706', // Gold / Orange
      textColor: '#b45309',
      badgeBg: '#fef3c7',
      badgeBorder: '#fde68a',
      badgeColor: '#b45309',
      badgeLabel: '1st Attempt FAD',
    },
  ];

  percentageKpis.forEach((card, index) => {
    const cardX = paddingX + index * (row2CardWidth + row2Gap);
    const actualWidth = index === 3 ? contentWidth - (cardX - paddingX) : row2CardWidth;

    // Card Box
    drawRoundedRect(ctx, cardX, row2Y, actualWidth, kpiRow2Height, 8, '#ffffff', '#e2e8f0', 1);

    // Distinct Top Colored Accent Line (4px)
    drawRoundedRect(ctx, cardX, row2Y, actualWidth, 4, [8, 8, 0, 0], card.accentColor);

    // Label & Badge Row
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = '800 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(card.label, cardX + 14, row2Y + 22);

    // Pill Badge
    ctx.font = '700 8.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const bWidth = ctx.measureText(card.badgeLabel).width + 12;
    const bX = cardX + actualWidth - bWidth - 12;
    drawRoundedRect(ctx, bX, row2Y + 12, bWidth, 16, 4, card.badgeBg, card.badgeBorder, 1);
    ctx.fillStyle = card.badgeColor;
    ctx.fillText(card.badgeLabel, bX + 6, row2Y + 23);

    // Large Percentage Value
    ctx.fillStyle = card.textColor;
    ctx.font = '900 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(card.value, cardX + 14, row2Y + 52);

    // Subtitle Explanation with Denominator
    ctx.fillStyle = '#64748b';
    ctx.font = '500 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(card.sublabel, cardX + 14, row2Y + 70);
  });

  // =========================================================================
  // 5. EMPLOYEE PERFORMANCE LEADERBOARD TABLE (15 COLUMNS WITH 4 PERCENTAGES)
  // Columns:
  // Rank | Employee | Total OFD | Status OFD | Delivered | UNDEL | Pending |
  // FAD % | COD FAD % | Prepaid FAD % | Retry Count | Retry % | Overall % | COD | Prepaid
  // =========================================================================
  const tableStartY = row2Y + kpiRow2Height + 16; // 308px

  interface ColumnDef {
    key: string;
    label: string;
    width: number;
    align: 'left' | 'center' | 'right';
  }

  // Exact 15 columns summing to 1368px
  const columns: ColumnDef[] = [
    { key: 'rank', label: 'RANK', width: 50, align: 'center' },
    { key: 'employee', label: 'DELIVERY EXECUTIVE', width: 245, align: 'left' },
    { key: 'total_ofd', label: 'TOTAL OFD', width: 85, align: 'right' },
    { key: 'status_ofd', label: 'STATUS OFD', width: 85, align: 'right' },
    { key: 'delivered', label: 'DELIVERED', width: 78, align: 'right' },
    { key: 'undel', label: 'UNDEL', width: 72, align: 'right' },
    { key: 'pending', label: 'PENDING', width: 72, align: 'right' },
    { key: 'fad_pct', label: 'FAD %', width: 86, align: 'right' },
    { key: 'cod_fad_pct', label: 'COD FAD %', width: 92, align: 'right' },
    { key: 'prepaid_fad_pct', label: 'PREPAID FAD %', width: 98, align: 'right' },
    { key: 'retry_count', label: 'RETRY', width: 70, align: 'right' },
    { key: 'retry_pct', label: 'RETRY %', width: 76, align: 'right' },
    { key: 'overall_pct', label: 'OVERALL %', width: 119, align: 'right' },
    { key: 'cod', label: 'COD', width: 70, align: 'right' },
    { key: 'prepaid', label: 'PREPAID', width: 70, align: 'right' },
  ];

  // Table Header Background (Dark Navy #0f172a with rounded top corners)
  drawRoundedRect(
    ctx,
    paddingX,
    tableStartY,
    contentWidth,
    tableHeaderHeight,
    [8, 8, 0, 0],
    '#0f172a',
    '#1e293b',
    1
  );

  // Table Column Headers
  let curColX = paddingX;
  ctx.font = '700 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.textBaseline = 'middle';

  columns.forEach((col) => {
    let headerTextX = curColX;
    if (col.align === 'center') {
      ctx.textAlign = 'center';
      headerTextX = curColX + col.width / 2;
    } else if (col.align === 'right') {
      ctx.textAlign = 'right';
      headerTextX = curColX + col.width - 10;
    } else {
      ctx.textAlign = 'left';
      headerTextX = curColX + 12;
    }

    ctx.fillText(col.label, headerTextX, tableStartY + tableHeaderHeight / 2);
    curColX += col.width;
  });

  // Table Rows (Alternating White / Soft Slate)
  let curRowY = tableStartY + tableHeaderHeight;

  employeeMetrics.forEach((emp, index) => {
    const isEven = index % 2 === 0;
    const rowBg = isEven ? '#ffffff' : '#f8fafc';

    // Row Background
    ctx.fillStyle = rowBg;
    ctx.fillRect(paddingX, curRowY, contentWidth, rowHeight);

    // Subtle Bottom Divider
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(paddingX, curRowY + rowHeight);
    ctx.lineTo(paddingX + contentWidth, curRowY + rowHeight);
    ctx.stroke();

    let cellX = paddingX;
    const centerY = curRowY + rowHeight / 2;

    columns.forEach((col) => {
      ctx.textBaseline = 'middle';

      switch (col.key) {
        case 'rank': {
          const rankNum = index + 1;
          const badgeSize = 22;
          const badgeCenterX = cellX + col.width / 2;
          const badgeCenterY = centerY;

          if (rankNum === 1) {
            // Gold Medal
            drawRoundedRect(
              ctx,
              badgeCenterX - badgeSize / 2,
              badgeCenterY - badgeSize / 2,
              badgeSize,
              badgeSize,
              badgeSize / 2,
              '#fef3c7',
              '#f59e0b',
              1.2
            );
            ctx.fillStyle = '#b45309';
            ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('1', badgeCenterX, badgeCenterY);
          } else if (rankNum === 2) {
            // Silver Medal
            drawRoundedRect(
              ctx,
              badgeCenterX - badgeSize / 2,
              badgeCenterY - badgeSize / 2,
              badgeSize,
              badgeSize,
              badgeSize / 2,
              '#f1f5f9',
              '#94a3b8',
              1.2
            );
            ctx.fillStyle = '#334155';
            ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('2', badgeCenterX, badgeCenterY);
          } else if (rankNum === 3) {
            // Bronze Medal
            drawRoundedRect(
              ctx,
              badgeCenterX - badgeSize / 2,
              badgeCenterY - badgeSize / 2,
              badgeSize,
              badgeSize,
              badgeSize / 2,
              '#ffedd5',
              '#ea580c',
              1.2
            );
            ctx.fillStyle = '#9a3412';
            ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('3', badgeCenterX, badgeCenterY);
          } else {
            ctx.fillStyle = '#64748b';
            ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(String(rankNum), badgeCenterX, badgeCenterY);
          }
          break;
        }

        case 'employee': {
          // Circular Avatar with Initials
          const avatarSize = 22;
          const avatarX = cellX + 10;
          const avatarY = centerY - avatarSize / 2;
          const initials = getEmployeeInitials(emp.employee_name);

          drawRoundedRect(
            ctx,
            avatarX,
            avatarY,
            avatarSize,
            avatarSize,
            avatarSize / 2,
            '#e2e8f0',
            '#cbd5e1',
            1
          );

          ctx.fillStyle = '#334155';
          ctx.font = '700 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(initials, avatarX + avatarSize / 2, centerY);

          // Employee Name
          ctx.fillStyle = '#0f172a';
          ctx.font = '700 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'left';

          const maxNameWidth = col.width - 44;
          let displayName = emp.employee_name;
          while (ctx.measureText(displayName).width > maxNameWidth && displayName.length > 5) {
            displayName = displayName.slice(0, -1);
          }
          if (displayName !== emp.employee_name) {
            displayName += '…';
          }
          ctx.fillText(displayName, avatarX + avatarSize + 8, centerY);
          break;
        }

        case 'total_ofd': {
          ctx.fillStyle = '#0f172a';
          ctx.font = '700 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(String(emp.total_ofd), cellX + col.width - 10, centerY);
          break;
        }

        case 'status_ofd': {
          ctx.textAlign = 'right';
          ctx.font = '700 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillStyle = '#0284c7'; // Sky Blue
          ctx.fillText(String(emp.status_ofd), cellX + col.width - 10, centerY);
          break;
        }

        case 'delivered': {
          ctx.fillStyle = '#059669'; // Emerald Green
          ctx.font = '700 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(String(emp.total_delivered), cellX + col.width - 10, centerY);
          break;
        }

        case 'undel': {
          ctx.fillStyle = emp.total_undel > 0 ? '#dc2626' : '#94a3b8'; // Red
          ctx.font = '700 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(String(emp.total_undel), cellX + col.width - 10, centerY);
          break;
        }

        case 'pending': {
          ctx.fillStyle = emp.pending > 0 ? '#ea580c' : '#94a3b8'; // Amber / Orange
          ctx.font = '700 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(String(emp.pending), cellX + col.width - 10, centerY);
          break;
        }

        case 'fad_pct': {
          // Overall FAD % (Gold/Amber)
          ctx.fillStyle = '#b45309';
          ctx.font = '700 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(`${emp.first_attempt_delivery_pct}%`, cellX + col.width - 10, centerY);
          break;
        }

        case 'cod_fad_pct': {
          // COD FAD % (Royal Blue)
          ctx.fillStyle = '#2563eb';
          ctx.font = '700 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(`${emp.cod_fad_percent}%`, cellX + col.width - 10, centerY);
          break;
        }

        case 'prepaid_fad_pct': {
          // Prepaid FAD % (Purple)
          ctx.fillStyle = '#7c3aed';
          ctx.font = '700 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(`${emp.prepaid_fad_percent}%`, cellX + col.width - 10, centerY);
          break;
        }

        case 'retry_count': {
          ctx.fillStyle = '#64748b';
          ctx.font = '700 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(String(emp.reattempt_ofd), cellX + col.width - 10, centerY);
          break;
        }

        case 'retry_pct': {
          ctx.fillStyle = '#8b5cf6';
          ctx.font = '700 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(`${emp.reattempt_delivery_pct}%`, cellX + col.width - 10, centerY);
          break;
        }

        case 'overall_pct': {
          // Overall Delivery % (Green + Micro Progress Bar)
          const pct = Math.min(Math.max(emp.overall_delivery_pct, 0), 100);
          const barWidth = 32;
          const barHeight = 4.5;
          const barX = cellX + col.width - 10 - 44 - barWidth;
          const barY = centerY - barHeight / 2;

          drawRoundedRect(ctx, barX, barY, barWidth, barHeight, 2.25, '#e2e8f0');
          const fillWidth = Math.round((pct / 100) * barWidth);
          if (fillWidth > 0) {
            const barColor = pct >= 80 ? '#10b981' : pct >= 65 ? '#f59e0b' : '#ef4444';
            drawRoundedRect(ctx, barX, barY, fillWidth, barHeight, 2.25, barColor);
          }

          ctx.fillStyle = '#059669';
          ctx.font = '800 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(`${emp.overall_delivery_pct}%`, cellX + col.width - 10, centerY);
          break;
        }

        case 'cod': {
          ctx.fillStyle = '#0f172a';
          ctx.font = '700 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(String(emp.cod_shipments_count), cellX + col.width - 10, centerY);
          break;
        }

        case 'prepaid': {
          ctx.fillStyle = '#0f172a';
          ctx.font = '700 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(String(emp.prepaid_ofd), cellX + col.width - 10, centerY);
          break;
        }
      }

      cellX += col.width;
    });

    curRowY += rowHeight;
  });

  // ==========================================
  // 6. TABLE TOTALS / TEAM SUMMARY ROW
  // ==========================================
  drawRoundedRect(
    ctx,
    paddingX,
    curRowY,
    contentWidth,
    totalsRowHeight,
    [0, 0, 8, 8],
    '#f1f5f9',
    '#cbd5e1',
    1.5
  );

  let totCellX = paddingX;
  const totCenterY = curRowY + totalsRowHeight / 2;

  // Calculate table aggregates
  const totalOfdSum = employeeMetrics.reduce((sum, e) => sum + e.total_ofd, 0);
  const statusOfdSum = employeeMetrics.reduce((sum, e) => sum + e.status_ofd, 0);
  const deliveredSum = employeeMetrics.reduce((sum, e) => sum + e.total_delivered, 0);
  const undelSum = employeeMetrics.reduce((sum, e) => sum + e.total_undel, 0);
  const pendingSum = employeeMetrics.reduce((sum, e) => sum + e.pending, 0);
  const retrySum = employeeMetrics.reduce((sum, e) => sum + e.reattempt_ofd, 0);
  const codSum = employeeMetrics.reduce((sum, e) => sum + e.cod_shipments_count, 0);
  const prepaidSum = employeeMetrics.reduce((sum, e) => sum + e.prepaid_ofd, 0);

  columns.forEach((col) => {
    ctx.textBaseline = 'middle';

    switch (col.key) {
      case 'rank': {
        ctx.fillStyle = '#0f172a';
        ctx.font = '800 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Σ', totCellX + col.width / 2, totCenterY);
        break;
      }

      case 'employee': {
        ctx.fillStyle = '#0f172a';
        ctx.font = '800 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`TOTALS (${employeeMetrics.length} EXECS)`, totCellX + 12, totCenterY);
        break;
      }

      case 'total_ofd': {
        ctx.fillStyle = '#0f172a';
        ctx.font = '800 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(String(totalOfdSum), totCellX + col.width - 10, totCenterY);
        break;
      }

      case 'status_ofd': {
        ctx.fillStyle = '#0284c7';
        ctx.font = '800 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(String(statusOfdSum), totCellX + col.width - 10, totCenterY);
        break;
      }

      case 'delivered': {
        ctx.fillStyle = '#059669';
        ctx.font = '800 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(String(deliveredSum), totCellX + col.width - 10, totCenterY);
        break;
      }

      case 'undel': {
        ctx.fillStyle = '#dc2626';
        ctx.font = '800 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(String(undelSum), totCellX + col.width - 10, totCenterY);
        break;
      }

      case 'pending': {
        ctx.fillStyle = '#ea580c';
        ctx.font = '800 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(String(pendingSum), totCellX + col.width - 10, totCenterY);
        break;
      }

      case 'fad_pct': {
        ctx.fillStyle = '#b45309';
        ctx.font = '800 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${summary?.firstAttemptDeliveryPct ?? 0}%`, totCellX + col.width - 10, totCenterY);
        break;
      }

      case 'cod_fad_pct': {
        ctx.fillStyle = '#2563eb';
        ctx.font = '800 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${summary?.codFadPercent ?? 0}%`, totCellX + col.width - 10, totCenterY);
        break;
      }

      case 'prepaid_fad_pct': {
        ctx.fillStyle = '#7c3aed';
        ctx.font = '800 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${summary?.prepaidFadPercent ?? 0}%`, totCellX + col.width - 10, totCenterY);
        break;
      }

      case 'retry_count': {
        ctx.fillStyle = '#64748b';
        ctx.font = '800 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(String(retrySum), totCellX + col.width - 10, totCenterY);
        break;
      }

      case 'retry_pct': {
        ctx.fillStyle = '#8b5cf6';
        ctx.font = '800 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${summary?.reattemptDeliveryPct ?? 0}%`, totCellX + col.width - 10, totCenterY);
        break;
      }

      case 'overall_pct': {
        ctx.fillStyle = '#059669';
        ctx.font = '800 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${summary?.overallDeliveryPct ?? 0}%`, totCellX + col.width - 10, totCenterY);
        break;
      }

      case 'cod': {
        ctx.fillStyle = '#0f172a';
        ctx.font = '800 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(String(codSum), totCellX + col.width - 10, totCenterY);
        break;
      }

      case 'prepaid': {
        ctx.fillStyle = '#0f172a';
        ctx.font = '800 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(String(prepaidSum), totCellX + col.width - 10, totCenterY);
        break;
      }
    }

    totCellX += col.width;
  });

  // ==========================================
  // 7. FOOTER SECTION
  // ==========================================
  const footerY = curRowY + totalsRowHeight + 14;
  drawRoundedRect(ctx, paddingX, footerY, contentWidth, footerHeight, 8, '#ffffff', '#e2e8f0', 1);

  // Left Brand Notice
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('HubVault', paddingX + 16, footerY + footerHeight / 2);

  ctx.fillStyle = '#64748b';
  ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(' | Collection Reconciliation Suite', paddingX + 74, footerY + footerHeight / 2);

  // Center: Operational Metadata
  ctx.fillStyle = '#334155';
  ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    `Hub: ${hubDisplayName}   •   Report Date: ${formattedDate}   •   Total Assigned: ${summary?.totalOfd ?? totalOfdSum}`,
    width / 2,
    footerY + footerHeight / 2
  );

  // Right: Generation Timestamp
  const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`Generated ${nowStr} • Confidential Operational Report`, paddingX + contentWidth - 16, footerY + footerHeight / 2);

  // Bottom 3px Royal Navy Strip
  drawRoundedRect(
    ctx,
    paddingX,
    footerY + footerHeight - 3,
    contentWidth,
    3,
    [0, 0, 8, 8],
    '#1e3a8a'
  );

  return canvas;
}

/**
 * Generates a PNG Blob from the redesigned HubVault performance snapshot canvas.
 */
export async function generateDRSSnapshotBlob(options: GenerateSnapshotOptions): Promise<Blob> {
  const canvas = generateDRSSnapshotCanvas(options);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas toBlob returned null'));
        }
      },
      'image/png'
    );
  });
}
