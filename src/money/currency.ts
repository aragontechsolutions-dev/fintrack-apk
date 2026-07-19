/**
 * Currency catalogue for FinTrack.
 *
 * The app is multi-currency but scoped to UYU (default) and USD. Both use 2
 * decimal places per ISO 4217, so the "minor unit" factor is 100 for both.
 */

export type CurrencyCode = 'UYU' | 'USD';

export interface CurrencyDef {
  code: CurrencyCode;
  name: string;
  symbol: string;
  /** Number of decimal places (ISO 4217). Both supported currencies use 2. */
  minorUnit: number;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyDef> = {
  UYU: { code: 'UYU', name: 'Peso uruguayo', symbol: '$', minorUnit: 2 },
  USD: { code: 'USD', name: 'Dólar estadounidense', symbol: 'US$', minorUnit: 2 },
};

export const DEFAULT_CURRENCY: CurrencyCode = 'UYU';

export const CURRENCY_LIST: CurrencyDef[] = Object.values(CURRENCIES);

export function getCurrency(code: CurrencyCode): CurrencyDef {
  return CURRENCIES[code];
}

export function isCurrencyCode(value: string): value is CurrencyCode {
  return value === 'UYU' || value === 'USD';
}
