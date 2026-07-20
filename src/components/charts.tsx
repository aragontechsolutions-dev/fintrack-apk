/**
 * Lightweight View-based charts (no native chart dependency).
 * Reliable everywhere; can be swapped for Victory Native later if richer
 * interactions are needed.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CurrencyCode } from '../money/currency';
import { formatMoney } from '../money/money';
import { colors, font, radius, spacing } from '../theme/theme';

/** A single progress bar (0..1 clamped). */
export function ProgressBar({
  ratio,
  color = colors.primary,
  height = 10,
}: {
  ratio: number;
  color?: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <View style={[styles.track, { height }]}>
      <View
        style={{
          width: `${pct}%`,
          height,
          backgroundColor: color,
          borderRadius: radius.pill,
        }}
      />
    </View>
  );
}

export interface BarDatum {
  key: string;
  label: string;
  valueMinor: number;
  color?: string;
}

/** Horizontal bar list, e.g. spending by category. Values in base currency. */
export function BarList({
  data,
  currency,
}: {
  data: BarDatum[];
  currency: CurrencyCode;
}) {
  const max = Math.max(1, ...data.map((d) => d.valueMinor));
  const total = data.reduce((s, d) => s + d.valueMinor, 0);
  return (
    <View>
      {data.map((d) => {
        const pctOfTotal = total > 0 ? Math.round((d.valueMinor / total) * 100) : 0;
        return (
          <View key={d.key} style={styles.barRow}>
            <View style={styles.barHeader}>
              <Text style={styles.barLabel} numberOfLines={1}>
                {d.label} · {pctOfTotal}%
              </Text>
              <Text style={styles.barValue}>
                {formatMoney(d.valueMinor, currency)}
              </Text>
            </View>
            <ProgressBar
              ratio={d.valueMinor / max}
              color={d.color ?? colors.primary}
            />
          </View>
        );
      })}
    </View>
  );
}

export interface ColumnDatum {
  label: string;
  incomeMinor: number;
  expenseMinor: number;
}

/** Paired income/expense columns per month. */
export function MonthlyColumns({
  data,
  currency,
}: {
  data: ColumnDatum[];
  currency: CurrencyCode;
}) {
  const max = Math.max(
    1,
    ...data.map((d) => Math.max(d.incomeMinor, d.expenseMinor)),
  );
  const H = 120;
  return (
    <View>
      <View style={styles.columnsRow}>
        {data.map((d, i) => (
          <View key={i} style={styles.columnGroup}>
            <View style={styles.columnBars}>
              <View
                style={{
                  width: 9,
                  height: Math.max(2, (d.incomeMinor / max) * H),
                  backgroundColor: colors.income,
                  borderTopLeftRadius: 3,
                  borderTopRightRadius: 3,
                }}
              />
              <View
                style={{
                  width: 9,
                  height: Math.max(2, (d.expenseMinor / max) * H),
                  backgroundColor: colors.expense,
                  borderTopLeftRadius: 3,
                  borderTopRightRadius: 3,
                }}
              />
            </View>
            <Text style={styles.columnLabel}>{d.label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.legend}>
        <Legend color={colors.income} label="Ingresos" />
        <Legend color={colors.expense} label="Gastos" />
        <Text style={styles.legendHint}>
          en {currency}
        </Text>
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  barRow: { marginBottom: spacing.md },
  barHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  barLabel: { fontSize: font.sm, color: colors.text, flex: 1, marginRight: spacing.sm },
  barValue: { fontSize: font.sm, color: colors.textMuted },
  columnsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 140,
  },
  columnGroup: { alignItems: 'center', flex: 1 },
  columnBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 124,
  },
  columnLabel: { fontSize: font.sm, color: colors.textMuted, marginTop: spacing.xs },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: font.sm, color: colors.textMuted },
  legendHint: { fontSize: font.sm, color: colors.textMuted, marginLeft: 'auto' },
});
