/**
 * Money handling for FinTrack.
 *
 * CORE RULE: money is ALWAYS stored and computed as an integer number of the
 * currency's minor unit (cents). Never use JavaScript `number` floats for
 * accumulating monetary values — 0.1 + 0.2 !== 0.3 in IEEE-754.
 *
 * A monetary amount is represented as `{ minor: number; currency }` where
 * `minor` is a safe integer of cents. JS numbers are 53-bit-safe integers,
 * which covers ~90 trillion cents (~900 billion units) — far beyond any
 * personal-finance amount. SQLite stores these in 64-bit INTEGER columns.
 */

import { CurrencyCode, getCurrency } from './currency';

export interface Money {
  /** Amount in minor units (cents). Always an integer. */
  minor: number;
  currency: CurrencyCode;
}

export function money(minor: number, currency: CurrencyCode): Money {
  if (!Number.isInteger(minor)) {
    throw new Error(`Money.minor must be an integer, received ${minor}`);
  }
  if (!Number.isSafeInteger(minor)) {
    throw new Error(`Money.minor exceeds safe integer range: ${minor}`);
  }
  return { minor, currency };
}

export function zero(currency: CurrencyCode): Money {
  return { minor: 0, currency };
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(
      `Cannot operate on different currencies: ${a.currency} vs ${b.currency}`,
    );
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.minor + b.minor, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.minor - b.minor, a.currency);
}

export function negate(a: Money): Money {
  return money(-a.minor, a.currency);
}

export function isZero(a: Money): boolean {
  return a.minor === 0;
}

export function isNegative(a: Money): boolean {
  return a.minor < 0;
}

/** Round-half-up integer division, used for splitting/prorating cents. */
function divRoundHalfUp(numerator: number, denominator: number): number {
  const sign = Math.sign(numerator) * Math.sign(denominator);
  const q = Math.abs(numerator) / Math.abs(denominator);
  return sign * Math.round(q);
}

/**
 * Apply an FX rate to convert an amount from one currency to another.
 * `rate` is expressed as: 1 unit of `from` = `rate` units of `to`.
 * Rate is provided as an integer scaled by `rateScale` decimals (see fx.ts).
 * Result is rounded half-up to the target currency's minor unit.
 */
export function convertMinor(
  fromMinor: number,
  rateScaled: number,
  rateScale: number,
): number {
  // fromMinor (cents of source) * rate / 10^rateScale  -> cents of target,
  // both currencies share minorUnit=2 so no extra scaling is needed.
  const scale = Math.pow(10, rateScale);
  return divRoundHalfUp(fromMinor * rateScaled, scale);
}

/**
 * Format a minor-unit amount for display, e.g. 1940 UYU -> "$ 1.940,00".
 * Uses es-UY grouping conventions (dot thousands, comma decimals).
 */
export function formatMoney(
  minor: number,
  currency: CurrencyCode,
  opts: { showSymbol?: boolean; showCode?: boolean } = {},
): string {
  const { showSymbol = true, showCode = false } = opts;
  const def = getCurrency(currency);
  const factor = Math.pow(10, def.minorUnit);

  const negative = minor < 0;
  const abs = Math.abs(minor);
  const major = Math.trunc(abs / factor);
  const frac = abs % factor;

  const majorStr = major
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const fracStr = frac.toString().padStart(def.minorUnit, '0');

  let out = `${majorStr},${fracStr}`;
  if (showSymbol) out = `${def.symbol} ${out}`;
  if (negative) out = `-${out}`;
  if (showCode) out = `${out} ${currency}`;
  return out;
}

/**
 * Parse a user-entered major-unit string (e.g. "1940,50" or "1940.50") into
 * minor units. Accepts both comma and dot as decimal separator. Throws on
 * invalid input so callers can surface a validation error.
 */
export function parseToMinor(input: string, currency: CurrencyCode): number {
  const def = getCurrency(currency);
  const cleaned = input.trim().replace(/\s/g, '');
  if (cleaned === '') throw new Error('Monto vacío');

  // Normalise: remove thousands separators, unify decimal separator to '.'.
  // Heuristic: the last separator (',' or '.') is the decimal one.
  let normalized = cleaned;
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  const decimalPos = Math.max(lastComma, lastDot);

  if (decimalPos === -1) {
    normalized = cleaned.replace(/[.,]/g, '');
  } else {
    const intPart = cleaned.slice(0, decimalPos).replace(/[.,]/g, '');
    const fracPart = cleaned.slice(decimalPos + 1).replace(/[.,]/g, '');
    normalized = `${intPart}.${fracPart}`;
  }

  if (!/^-?\d*\.?\d*$/.test(normalized) || normalized === '.') {
    throw new Error(`Monto inválido: "${input}"`);
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) throw new Error(`Monto inválido: "${input}"`);

  const factor = Math.pow(10, def.minorUnit);
  const minor = Math.round(value * factor);
  if (!Number.isSafeInteger(minor)) {
    throw new Error('Monto demasiado grande');
  }
  return minor;
}

/** Sum a list of same-currency amounts. */
export function sumMinor(amounts: number[]): number {
  return amounts.reduce((acc, n) => acc + n, 0);
}

/**
 * Line total for a purchase item: quantity (may be fractional, e.g. 0.5 kg)
 * times unit price in minor units, rounded half-up to whole minor units.
 */
export function lineTotalMinor(quantity: number, unitPriceMinor: number): number {
  const raw = quantity * unitPriceMinor;
  // Math.round is half-up for positive values, which is what we want here.
  return Math.round(raw);
}

/** Parse a quantity string ("1", "0.5", "0,5") into a positive number. */
export function parseQuantity(input: string): number {
  const normalized = input.trim().replace(',', '.');
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Cantidad inválida: "${input}"`);
  }
  return value;
}
