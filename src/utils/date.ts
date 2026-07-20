/** Local-date helpers. Transaction dates are stored as `YYYY-MM-DD` strings. */

export function todayISO(): string {
  const d = new Date();
  return toISODate(d);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDisplayDate(iso: string): string {
  // iso = YYYY-MM-DD -> DD/MM/YYYY
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** First day of the current month, ISO. */
export function startOfMonthISO(ref = new Date()): string {
  return toISODate(new Date(ref.getFullYear(), ref.getMonth(), 1));
}

const MONTH_LABELS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

export interface MonthRange {
  /** Inclusive start, YYYY-MM-DD. */
  from: string;
  /** Exclusive end (first day of next month), YYYY-MM-DD. */
  to: string;
  /** Short month label, e.g. "jul". */
  label: string;
  /** Full label, e.g. "jul 2026". */
  fullLabel: string;
}

/**
 * Half-open month range for the month `monthsBack` before the reference month
 * (0 = current month).
 */
export function monthRange(monthsBack: number, ref = new Date()): MonthRange {
  const start = new Date(ref.getFullYear(), ref.getMonth() - monthsBack, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  return {
    from: toISODate(start),
    to: toISODate(end),
    label: MONTH_LABELS[start.getMonth()],
    fullLabel: `${MONTH_LABELS[start.getMonth()]} ${start.getFullYear()}`,
  };
}
