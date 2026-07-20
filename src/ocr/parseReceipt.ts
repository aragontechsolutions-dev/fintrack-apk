/**
 * Heuristic receipt parser.
 *
 * ML Kit returns text + geometry but NOT structured fields, so this turns
 * recognised lines into candidate line-items and a detected total. Receipt
 * layouts are wildly inconsistent and thermal print degrades OCR, so every
 * candidate carries a confidence level and the UX REQUIRES manual review before
 * anything is saved. This module is pure (no native deps) and unit-tested.
 */

import { CurrencyCode } from '../money/currency';
import { parseToMinor } from '../money/money';

export interface RecognizedLine {
  text: string;
  /** Vertical position (used to order lines top-to-bottom). */
  top: number;
}

export type Confidence = 'high' | 'medium' | 'low';

export interface ParsedItem {
  description: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  confidence: Confidence;
}

export interface ParsedReceipt {
  items: ParsedItem[];
  detectedTotalMinor: number | null;
  rawLines: string[];
}

// A money token: digits with optional grouping and a final 2-decimal part.
const MONEY = /\d[\d.,]*[.,]\d{2}(?!\d)/g;

// Lines that are receipt metadata, not products.
const META =
  /(SUB\s*-?\s*TOTAL|TOTAL|I\.?V\.?A|DESC(?:UENTO|TO)?|CAMBIO|EFECTIVO|VUELTO|TARJET|CONTADO|R\.?U\.?T|RUC|FECHA|HORA|CAJA|TICKET|GRACIAS|ARTICULOS|ART[ÍI]CULOS|ITEMS|CANT\b|SUCURSAL|TEL[ÉE]FONO|DIRECC)/i;

const CURRENCY_SYMBOLS = /(US?\$|U\$S|\$)/g;

function toMinor(token: string, currency: CurrencyCode): number | null {
  try {
    return parseToMinor(token, currency);
  } catch {
    return null;
  }
}

function tokensOf(text: string): string[] {
  return text.match(MONEY) ?? [];
}

/** Clean a line into a product description by stripping prices/qty/symbols. */
function buildDescription(text: string): string {
  return text
    .replace(MONEY, '')
    .replace(CURRENCY_SYMBOLS, '')
    // Strip an inner quantity marker like "2 x" / "0,5 x".
    .replace(/\b\d+(?:[.,]\d+)?\s*[xX]\s*/g, ' ')
    // Strip a leading quantity/unit prefix.
    .replace(/^\s*\d+(?:[.,]\d+)?\s*(?:un|UN|u\.|kg|KG|gr|GR)?\b/, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[·\-–—:]+\s*$/, '')
    .trim();
}

export function parseReceipt(
  linesIn: RecognizedLine[],
  currency: CurrencyCode = 'UYU',
): ParsedReceipt {
  const lines = [...linesIn].sort((a, b) => a.top - b.top);
  const rawLines = lines.map((l) => l.text);
  const items: ParsedItem[] = [];
  let detectedTotalMinor: number | null = null;

  for (const { text } of lines) {
    const tokens = tokensOf(text);
    const isTotalLine = /\bTOTAL\b/i.test(text) && !/SUB/i.test(text);

    if (isTotalLine && tokens.length > 0) {
      const values = tokens
        .map((t) => toMinor(t, currency))
        .filter((v): v is number => v != null);
      if (values.length > 0) {
        const candidate = Math.max(...values);
        // Keep the largest TOTAL seen (handles "TOTAL A PAGAR" repetitions).
        detectedTotalMinor = Math.max(detectedTotalMinor ?? 0, candidate);
      }
      continue;
    }

    if (META.test(text) || tokens.length === 0) continue;

    const values = tokens
      .map((t) => toMinor(t, currency))
      .filter((v): v is number => v != null);
    if (values.length === 0) continue;

    const lineTotalMinor = values[values.length - 1];
    if (lineTotalMinor <= 0) continue;

    let quantity = 1;
    let unitPriceMinor = lineTotalMinor;
    let confidence: Confidence;

    const qtyX = text.match(/(\d+(?:[.,]\d+)?)\s*[xX]\b/);
    const leadingQty = text.match(/^\s*(\d{1,3})\s+\D/);

    if (qtyX) {
      quantity = parseFloat(qtyX[1].replace(',', '.')) || 1;
      if (values.length >= 2) {
        unitPriceMinor = values[0];
        // High confidence when qty * unit ≈ line total.
        const expected = Math.round(quantity * unitPriceMinor);
        confidence = Math.abs(expected - lineTotalMinor) <= 1 ? 'high' : 'medium';
      } else {
        unitPriceMinor = quantity > 0 ? Math.round(lineTotalMinor / quantity) : lineTotalMinor;
        confidence = 'medium';
      }
    } else {
      if (leadingQty) {
        quantity = parseInt(leadingQty[1], 10) || 1;
        unitPriceMinor = quantity > 0 ? Math.round(lineTotalMinor / quantity) : lineTotalMinor;
      }
      const desc = buildDescription(text);
      confidence = desc.length >= 2 ? (values.length === 1 ? 'high' : 'medium') : 'low';
    }

    const description = buildDescription(text) || '(sin descripción)';
    items.push({
      description,
      quantity,
      unitPriceMinor,
      lineTotalMinor,
      confidence,
    });
  }

  return { items, detectedTotalMinor, rawLines };
}
