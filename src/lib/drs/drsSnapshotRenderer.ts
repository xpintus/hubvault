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
  if (parts.length === 0) return 'E';
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
 * Renders the Employee Performance Report Snapshot onto an HTML5 canvas.
 * Optimized for crisp high-DPI export, landscape presentation, and official HubVault branding.
 */
export function generateDRSSnapshotCanvas(options: GenerateSnapshotOptions): HTMLCanvasElement {
  const {
    hubName,
    reportDate,
    summary,
    employeeMetrics,
    scale = 2, // 2x scale produces a crisp 2880px wide image for retina displays & WhatsApp sharing
  } = options;

  const width = 1440;
  const paddingX = 36;
  const contentWidth = width - paddingX * 2; // 1368px

  // Header = 110px, Gap = 16px, KPI Cards = 86px, Gap = 18px, Table Header = 44px
  // Rows = employeeMetrics.length * 44px, Totals Row = 44px, Gap = 14px, Footer = 46px
  const headerHeight = 110;
  const kpiHeight = 86;
  const tableHeaderHeight = 44;
  const rowHeight = 44;
  const totalsRowHeight = 44;
  const footerHeight = 46;

  const totalRows = employeeMetrics.length;
  const totalLogicalHeight =
    headerHeight +
    16 +
    kpiHeight +
    18 +
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

  // Scale all drawing operations by scale factor for crisp rendering
  ctx.scale(scale, scale);

  // 1. Overall Background (Crisp pearl white / soft slate background)
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, totalLogicalHeight);

  // Top Accent Strip: Navy to Royal Blue with subtle Gold
  const topStripGradient = ctx.createLinearGradient(0, 0, width, 0);
  topStripGradient.addColorStop(0, '#0f172a'); // Navy
  topStripGradient.addColorStop(0.3, '#1e3a8a'); // Deep Navy
  topStripGradient.addColorStop(0.7, '#2563eb'); // Royal Blue
  topStripGradient.addColorStop(1, '#f59e0b'); // Subtle Gold
  ctx.fillStyle = topStripGradient;
  ctx.fillRect(0, 0, width, 4);

  // ==========================================
  // 2. HEADER PANEL (White Card with Border)
  // ==========================================
  drawRoundedRect(ctx, paddingX, 12, contentWidth, 98, 10, '#ffffff', '#e2e8f0', 1);

  // HubVault Logo / Brand Emblem
  // Draw rounded vault emblem (38x38)
  drawRoundedRect(ctx, paddingX + 16, 26, 42, 42, 10, '#0f172a', '#1e293b', 1);

  // Stylized Vault / Shield icon inside emblem
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeRect(paddingX + 26, 36, 22, 22);

  // Gold vault dial
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(paddingX + 37, 47, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Dial tick marks
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(paddingX + 37, 40);
  ctx.lineTo(paddingX + 37, 42);
  ctx.moveTo(paddingX + 44, 47);
  ctx.lineTo(paddingX + 42, 47);
  ctx.stroke();

  // HubVault Wordmark
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 21px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('HUBVAULT', paddingX + 68, 48);

  ctx.fillStyle = '#64748b';
  ctx.font = '700 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('COLLECTION RECONCILIATION SUITE', paddingX + 69, 62);

  // Vertical divider between brand and title
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(paddingX + 300, 26);
  ctx.lineTo(paddingX + 300, 78);
  ctx.stroke();

  // Report Title & Subtitle
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('EMPLOYEE PERFORMANCE REPORT', paddingX + 322, 47);

  ctx.fillStyle = '#2563eb'; // Royal Blue
  ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('TEAM LEADERBOARD & LOGISTICS EXECUTIVE ANALYTICS', paddingX + 322, 63);

  // Right Side: Hub Name and Formatted Date Pills
  const formattedDate = formatReportDate(reportDate);
  const rightEdge = paddingX + contentWidth - 16;

  // Date Pill (Rightmost)
  const datePillWidth = 145;
  const datePillX = rightEdge - datePillWidth;
  drawRoundedRect(ctx, datePillX, 32, datePillWidth, 32, 6, '#f8fafc', '#cbd5e1', 1);
  ctx.fillStyle = '#64748b';
  ctx.font = '600 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('REPORT DATE', datePillX + 10, 44);
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(formattedDate, datePillX + 10, 58);

  // Hub Pill
  const hubDisplayName = hubName || 'Main Hub';
  ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const hubTextWidth = ctx.measureText(hubDisplayName).width;
  const hubPillWidth = Math.max(hubTextWidth + 48, 140);
  const hubPillX = datePillX - hubPillWidth - 12;

  drawRoundedRect(ctx, hubPillX, 32, hubPillWidth, 32, 6, '#eff6ff', '#bfdbfe', 1);
  // Hub Icon Dot
  ctx.fillStyle = '#2563eb';
  ctx.beginPath();
  ctx.arc(hubPillX + 14, 48, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1e40af';
  ctx.font = '600 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('OPERATIONAL HUB', hubPillX + 24, 44);
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(hubDisplayName, hubPillX + 24, 58);

  // Status / Official Badge
  const badgeWidth = 105;
  const badgeX = hubPillX - badgeWidth - 12;
  drawRoundedRect(ctx, badgeX, 32, badgeWidth, 32, 6, '#ecfdf5', '#a7f3d0', 1);
  ctx.fillStyle = '#059669';
  ctx.beginPath();
  ctx.arc(badgeX + 14, 48, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#065f46';
  ctx.font = '700 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('VERIFIED DATA', badgeX + 24, 52);

  // Thin Accent Line below Header
  const lineY = 12 + 98;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(paddingX, lineY);
  ctx.lineTo(paddingX + contentWidth, lineY);
  ctx.stroke();

  // ==========================================
  // 3. KPI SUMMARY CARDS (7 Responsive Cards)
  // ==========================================
  const kpiStartY = 126;
  const kpiGap = 14;
  const totalGaps = 6;
  const cardWidth = Math.floor((contentWidth - kpiGap * totalGaps) / 7); // ~183px

  interface KPICardDef {
    label: string;
    value: string;
    sublabel: string;
    accentColor: string;
    textColor: string;
    badgeText?: string;
  }

  const kpis: KPICardDef[] = [
    {
      label: 'TOTAL EMPLOYEES',
      value: String(employeeMetrics.length),
      sublabel: 'Active Delivery Staff',
      accentColor: '#334155', // Slate
      textColor: '#0f172a',
    },
    {
      label: 'TOTAL OFD',
      value: String(summary?.totalOfd ?? 0),
      sublabel: 'Assigned Shipments',
      accentColor: '#1e3a8a', // Deep Navy
      textColor: '#1e3a8a',
    },
    {
      label: 'STATUS OFD',
      value: String(summary?.statusOfd ?? 0),
      sublabel: 'Currently On Road',
      accentColor: '#0284c7', // Sky Blue
      textColor: '#0284c7',
      badgeText: 'On Road',
    },
    {
      label: 'DELIVERED',
      value: String(summary?.totalDelivered ?? 0),
      sublabel: `${summary?.overallDeliveryPct ?? 0}% Delivery Rate`,
      accentColor: '#10b981', // Emerald Green
      textColor: '#059669',
    },
    {
      label: 'UNDEL',
      value: String(summary?.totalUndel ?? 0),
      sublabel: 'Requires Reattempt',
      accentColor: '#ef4444', // Crimson Red
      textColor: '#dc2626',
    },
    {
      label: 'PENDING',
      value: String(summary?.totalPending ?? 0),
      sublabel: 'Pending Resolution',
      accentColor: '#f97316', // Amber / Orange
      textColor: '#ea580c',
    },
    {
      label: 'OVERALL PERFORMANCE',
      value: `${summary?.overallDeliveryPct ?? 0}%`,
      sublabel: `FAD Rate: ${summary?.firstAttemptDeliveryPct ?? 0}%`,
      accentColor: '#6366f1', // Royal / Indigo
      textColor: '#4338ca',
    },
  ];

  kpis.forEach((card, index) => {
    const cardX = paddingX + index * (cardWidth + kpiGap);
    const actualWidth = index === 6 ? contentWidth - (cardX - paddingX) : cardWidth;

    // Card background & border
    drawRoundedRect(ctx, cardX, kpiStartY, actualWidth, kpiHeight, 8, '#ffffff', '#e2e8f0', 1);

    // Top colored accent bar
    drawRoundedRect(
      ctx,
      cardX,
      kpiStartY,
      actualWidth,
      3.5,
      [8, 8, 0, 0],
      card.accentColor
    );

    // Label
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = '700 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(card.label, cardX + 12, kpiStartY + 22);

    // Optional Badge (e.g. 'On Road')
    if (card.badgeText) {
      const badgeText = card.badgeText;
      ctx.font = '700 8.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const bWidth = ctx.measureText(badgeText).width + 10;
      const bX = cardX + actualWidth - bWidth - 10;
      drawRoundedRect(ctx, bX, kpiStartY + 12, bWidth, 15, 4, '#e0f2fe', '#bae6fd', 1);
      ctx.fillStyle = '#0284c7';
      ctx.fillText(badgeText, bX + 5, kpiStartY + 23);
    }

    // Value
    ctx.fillStyle = card.textColor;
    ctx.font = '800 23px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(card.value, cardX + 12, kpiStartY + 52);

    // Sublabel
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(card.sublabel, cardX + 12, kpiStartY + 72);
  });

  // ==========================================
  // 4. EMPLOYEE PERFORMANCE LEADERBOARD TABLE
  // ==========================================
  const tableStartY = kpiStartY + kpiHeight + 18; // 230px

  // Column definitions with exact widths matching 1368px
  // Order: Rank | Employee | Total OFD | Status OFD | Delivered | UNDEL | Pending | 1st Attempt % | Retry Count | Retry % | Overall % | COD | Prepaid
  interface ColumnDef {
    key: string;
    label: string;
    width: number;
    align: 'left' | 'center' | 'right';
  }

  const columns: ColumnDef[] = [
    { key: 'rank', label: 'RANK', width: 56, align: 'center' },
    { key: 'employee', label: 'DELIVERY EXECUTIVE', width: 270, align: 'left' },
    { key: 'total_ofd', label: 'TOTAL OFD', width: 95, align: 'right' },
    { key: 'status_ofd', label: 'STATUS OFD', width: 95, align: 'right' },
    { key: 'delivered', label: 'DELIVERED', width: 92, align: 'right' },
    { key: 'undel', label: 'UNDEL', width: 88, align: 'right' },
    { key: 'pending', label: 'PENDING', width: 88, align: 'right' },
    { key: 'first_attempt', label: '1ST ATTEMPT %', width: 112, align: 'right' },
    { key: 'retry_count', label: 'RETRY COUNT', width: 96, align: 'right' },
    { key: 'retry_pct', label: 'RETRY %', width: 90, align: 'right' },
    { key: 'overall_pct', label: 'OVERALL %', width: 116, align: 'right' },
    { key: 'cod', label: 'COD', width: 85, align: 'right' },
    { key: 'prepaid', label: 'PREPAID', width: 85, align: 'right' },
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
  ctx.font = '700 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.textBaseline = 'middle';

  columns.forEach((col) => {
    let headerTextX = curColX;
    if (col.align === 'center') {
      ctx.textAlign = 'center';
      headerTextX = curColX + col.width / 2;
    } else if (col.align === 'right') {
      ctx.textAlign = 'right';
      headerTextX = curColX + col.width - 12;
    } else {
      ctx.textAlign = 'left';
      headerTextX = curColX + 14;
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
          const badgeSize = 24;
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
            ctx.font = '700 11.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(String(rankNum), badgeCenterX, badgeCenterY);
          }
          break;
        }

        case 'employee': {
          // Circular Avatar with Initials
          const avatarSize = 24;
          const avatarX = cellX + 12;
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
          ctx.font = '700 9.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(initials, avatarX + avatarSize / 2, centerY);

          // Employee Name
          ctx.fillStyle = '#0f172a';
          ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'left';

          // Measure and prevent overflow
          const maxNameWidth = col.width - 48;
          let displayName = emp.employee_name;
          while (ctx.measureText(displayName).width > maxNameWidth && displayName.length > 5) {
            displayName = displayName.slice(0, -1);
          }
          if (displayName !== emp.employee_name) {
            displayName += '…';
          }
          ctx.fillText(displayName, avatarX + avatarSize + 10, centerY);
          break;
        }

        case 'total_ofd': {
          ctx.fillStyle = '#0f172a';
          ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(String(emp.total_ofd), cellX + col.width - 12, centerY);
          break;
        }

        case 'status_ofd': {
          // Status OFD: Royal/Sky Blue
          ctx.textAlign = 'right';
          ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillStyle = '#0284c7';
          ctx.fillText(String(emp.status_ofd), cellX + col.width - 12, centerY);
          break;
        }

        case 'delivered': {
          ctx.fillStyle = '#059669'; // Emerald Green
          ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(String(emp.total_delivered), cellX + col.width - 12, centerY);
          break;
        }

        case 'undel': {
          ctx.fillStyle = emp.total_undel > 0 ? '#dc2626' : '#94a3b8'; // Crimson Red or slate
          ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(String(emp.total_undel), cellX + col.width - 12, centerY);
          break;
        }

        case 'pending': {
          ctx.fillStyle = emp.pending > 0 ? '#ea580c' : '#94a3b8'; // Amber / Orange
          ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(String(emp.pending), cellX + col.width - 12, centerY);
          break;
        }

        case 'first_attempt': {
          ctx.fillStyle = '#2563eb'; // Royal Blue
          ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(`${emp.first_attempt_delivery_pct}%`, cellX + col.width - 12, centerY);
          break;
        }

        case 'retry_count': {
          ctx.fillStyle = '#7c3aed'; // Purple
          ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(String(emp.reattempt_ofd), cellX + col.width - 12, centerY);
          break;
        }

        case 'retry_pct': {
          ctx.fillStyle = '#8b5cf6'; // Violet / Purple
          ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(`${emp.reattempt_delivery_pct}%`, cellX + col.width - 12, centerY);
          break;
        }

        case 'overall_pct': {
          const pct = Math.min(Math.max(emp.overall_delivery_pct, 0), 100);
          const barWidth = 34;
          const barHeight = 5;
          const barX = cellX + col.width - 12 - 46 - barWidth;
          const barY = centerY - barHeight / 2;

          // Micro Progress Bar Background
          drawRoundedRect(ctx, barX, barY, barWidth, barHeight, 2.5, '#e2e8f0');

          // Progress Bar Fill
          const fillWidth = Math.round((pct / 100) * barWidth);
          if (fillWidth > 0) {
            const barColor = pct >= 80 ? '#10b981' : pct >= 65 ? '#f59e0b' : '#ef4444';
            drawRoundedRect(ctx, barX, barY, fillWidth, barHeight, 2.5, barColor);
          }

          // Percentage Text
          ctx.fillStyle = '#059669';
          ctx.font = '800 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(`${emp.overall_delivery_pct}%`, cellX + col.width - 12, centerY);
          break;
        }

        case 'cod': {
          ctx.fillStyle = '#0f172a';
          ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(String(emp.cod_shipments_count), cellX + col.width - 12, centerY);
          break;
        }

        case 'prepaid': {
          ctx.fillStyle = '#0f172a';
          ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(String(emp.prepaid_ofd), cellX + col.width - 12, centerY);
          break;
        }
      }

      cellX += col.width;
    });

    curRowY += rowHeight;
  });

  // ==========================================
  // 5. TABLE TOTALS / TEAM SUMMARY ROW
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
        ctx.font = '800 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`TEAM SUMMARY (${employeeMetrics.length} EXECUTIVES)`, totCellX + 14, totCenterY);
        break;
      }

      case 'total_ofd': {
        ctx.fillStyle = '#0f172a';
        ctx.font = '800 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(String(totalOfdSum), totCellX + col.width - 12, totCenterY);
        break;
      }

      case 'status_ofd': {
        ctx.fillStyle = '#0284c7';
        ctx.font = '800 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(String(statusOfdSum), totCellX + col.width - 12, totCenterY);
        break;
      }

      case 'delivered': {
        ctx.fillStyle = '#059669';
        ctx.font = '800 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(String(deliveredSum), totCellX + col.width - 12, totCenterY);
        break;
      }

      case 'undel': {
        ctx.fillStyle = '#dc2626';
        ctx.font = '800 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(String(undelSum), totCellX + col.width - 12, totCenterY);
        break;
      }

      case 'pending': {
        ctx.fillStyle = '#ea580c';
        ctx.font = '800 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(String(pendingSum), totCellX + col.width - 12, totCenterY);
        break;
      }

      case 'first_attempt': {
        ctx.fillStyle = '#2563eb';
        ctx.font = '800 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${summary?.firstAttemptDeliveryPct ?? 0}%`, totCellX + col.width - 12, totCenterY);
        break;
      }

      case 'retry_count': {
        ctx.fillStyle = '#7c3aed';
        ctx.font = '800 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(String(retrySum), totCellX + col.width - 12, totCenterY);
        break;
      }

      case 'retry_pct': {
        ctx.fillStyle = '#8b5cf6';
        ctx.font = '800 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${summary?.reattemptDeliveryPct ?? 0}%`, totCellX + col.width - 12, totCenterY);
        break;
      }

      case 'overall_pct': {
        ctx.fillStyle = '#059669';
        ctx.font = '800 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${summary?.overallDeliveryPct ?? 0}%`, totCellX + col.width - 12, totCenterY);
        break;
      }

      case 'cod': {
        ctx.fillStyle = '#0f172a';
        ctx.font = '800 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(String(codSum), totCellX + col.width - 12, totCenterY);
        break;
      }

      case 'prepaid': {
        ctx.fillStyle = '#0f172a';
        ctx.font = '800 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(String(prepaidSum), totCellX + col.width - 12, totCenterY);
        break;
      }
    }

    totCellX += col.width;
  });

  // ==========================================
  // 6. FOOTER SECTION
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
