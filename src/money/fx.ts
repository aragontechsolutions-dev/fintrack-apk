/**
 * Foreign-exchange rate helpers.
 *
 * Rates are stored as integers scaled by 10^6 (6 decimal places), matching the
 * precision the BCU itself publishes (Numeric(11,6)). A rate means:
 *   1 unit of `base` = (rateScaled / 10^6) units of `quote`.
 *
 * The app is offline-first: rates are entered manually or cached. Nothing here
 * requires network access. Optional online refresh (DolarApi / BCU proxy) is a
 * later stage and must never block core functionality.
 */

import { CurrencyCode } from './currency';

export const RATE_SCALE = 6;
export const RATE_ONE = 1_000_000; // 1.000000

/** Parse a human rate string (e.g. "40,25") into a scaled integer. */
export function parseRate(input: string): number {
  const normalized = input.trim().replace(/\s/g, '').replace(',', '.');
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Tasa inválida: "${input}"`);
  }
  return Math.round(value * Math.pow(10, RATE_SCALE));
}

/** Format a scaled rate back to a display string. */
export function formatRate(rateScaled: number): string {
  return (rateScaled / Math.pow(10, RATE_SCALE)).toFixed(4);
}

export interface FxContext {
  base: CurrencyCode;
  /** rate to convert `quote` -> `base`, keyed by quote currency. */
  ratesToBase: Partial<Record<CurrencyCode, number>>;
}

/**
 * Resolve the scaled rate to convert `from` currency into `base`. Returns
 * RATE_ONE when currencies match. Throws if no rate is known.
 */
export function rateToBase(ctx: FxContext, from: CurrencyCode): number {
  if (from === ctx.base) return RATE_ONE;
  const r = ctx.ratesToBase[from];
  if (r === undefined) {
    throw new Error(`No hay tasa de cambio conocida ${from} -> ${ctx.base}`);
  }
  return r;
}
