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
