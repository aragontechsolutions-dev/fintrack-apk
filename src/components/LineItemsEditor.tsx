/**
 * Editor for a purchase's line items (manual entry). Rows are kept as strings
 * while typing; parsing/validation happens on save in the parent screen.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { CurrencyCode } from '../money/currency';
import { formatMoney, lineTotalMinor, parseQuantity, parseToMinor } from '../money/money';
import { colors, font, radius, spacing } from '../theme/theme';

export interface ItemDraft {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

export function emptyDraft(): ItemDraft {
  return {
    key: Math.random().toString(36).slice(2),
    description: '',
    quantity: '1',
    unitPrice: '',
  };
}

/** Line total for a draft, or null if the row is not yet valid. */
export function draftLineTotalMinor(
  draft: ItemDraft,
  currency: CurrencyCode,
): number | null {
  try {
    const qty = parseQuantity(draft.quantity);
    const unit = parseToMinor(draft.unitPrice, currency);
    return lineTotalMinor(qty, unit);
  } catch {
    return null;
  }
}

/** Subtotal across all valid rows. Rows with empty price count as 0. */
export function draftsSubtotalMinor(
  items: ItemDraft[],
  currency: CurrencyCode,
): number {
  return items.reduce((sum, d) => {
    if (d.unitPrice.trim() === '') return sum;
    const t = draftLineTotalMinor(d, currency);
    return sum + (t ?? 0);
  }, 0);
}

interface Props {
  items: ItemDraft[];
  currency: CurrencyCode;
  onChange: (items: ItemDraft[]) => void;
}

export function LineItemsEditor({ items, currency, onChange }: Props) {
  const update = (key: string, patch: Partial<ItemDraft>) =>
    onChange(items.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  const remove = (key: string) => onChange(items.filter((it) => it.key !== key));

  const add = () => onChange([...items, emptyDraft()]);

  const subtotal = draftsSubtotalMinor(items, currency);

  return (
    <View>
      {items.map((it) => {
        const line = draftLineTotalMinor(it, currency);
        return (
          <View key={it.key} style={styles.row}>
            <TextInput
              style={[styles.input, styles.desc]}
              placeholder="Producto"
              placeholderTextColor={colors.textMuted}
              value={it.description}
              onChangeText={(t) => update(it.key, { description: t })}
            />
            <View style={styles.numsRow}>
              <TextInput
                style={[styles.input, styles.qty]}
                placeholder="Cant."
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={it.quantity}
                onChangeText={(t) => update(it.key, { quantity: t })}
              />
              <Text style={styles.times}>×</Text>
              <TextInput
                style={[styles.input, styles.price]}
                placeholder="Precio unit."
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={it.unitPrice}
                onChangeText={(t) => update(it.key, { unitPrice: t })}
              />
              <Text style={styles.lineTotal}>
                {line != null ? formatMoney(line, currency, { showSymbol: false }) : '—'}
              </Text>
              <Pressable onPress={() => remove(it.key)} hitSlop={8}>
                <Text style={styles.remove}>✕</Text>
              </Pressable>
            </View>
          </View>
        );
      })}

      <Pressable style={styles.addBtn} onPress={add}>
        <Text style={styles.addText}>+ Agregar ítem</Text>
      </Pressable>

      <View style={styles.subtotalRow}>
        <Text style={styles.subtotalLabel}>Subtotal del detalle</Text>
        <Text style={styles.subtotalValue}>{formatMoney(subtotal, currency)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  numsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: font.md,
    color: colors.text,
  },
  desc: { flex: 1 },
  qty: { width: 56, textAlign: 'center' },
  price: { flex: 1 },
  times: { color: colors.textMuted, fontSize: font.md },
  lineTotal: {
    width: 74,
    textAlign: 'right',
    fontSize: font.sm,
    fontWeight: '600',
    color: colors.text,
  },
  remove: { color: colors.danger, fontSize: font.lg, paddingHorizontal: spacing.xs },
  addBtn: { paddingVertical: spacing.sm },
  addText: { color: colors.primary, fontWeight: '600', fontSize: font.md },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  subtotalLabel: { fontSize: font.md, color: colors.textMuted },
  subtotalValue: { fontSize: font.md, fontWeight: '700', color: colors.text },
});
