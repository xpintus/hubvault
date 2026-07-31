import { format, parseISO, isValid } from 'date-fns';

export function formatINR(amount: number | null | undefined): string {
  const value = Number(amount ?? 0);
  if (!isFinite(value)) return '₹0';
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(value));
}

export function formatINRDecimal(amount: number | null | undefined): string {
  const value = Number(amount ?? 0);
  if (!isFinite(value)) return '₹0.00';
  return '₹' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-IN').format(Number(value ?? 0));
}

export function formatDate(date: string | Date, fmt = 'dd MMM yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return '-';
  return format(d, fmt);
}

export function formatDateLong(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return '-';
  return format(d, 'EEEE, dd MMMM yyyy');
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return '-';
  return format(d, 'dd MMM yyyy, h:mm a');
}

export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function parseDateSafe(s: string): Date | null {
  const d = parseISO(s);
  return isValid(d) ? d : null;
}

export function formatTimeShort(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    }).format(d);
  } catch {
    return '-';
  }
}
