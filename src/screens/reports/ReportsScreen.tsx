import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useSession } from '../../auth/AuthContext';
import { Button, Card } from '../../components/ui';
import {
  BarDatum,
  BarList,
  ColumnDatum,
  MonthlyColumns,
  ProgressBar,
} from '../../components/charts';
import { formatMoney } from '../../money/money';
import { monthRange } from '../../utils/date';
import { MainStackParamList } from '../../navigation/types';
import { colors, font, spacing } from '../../theme/theme';

type Nav = NativeStackNavigationProp<MainStackParamList>;

const CATEGORY_COLORS = [
  '#1E6F5C', '#C62828', '#1565C0', '#B26A00', '#6A1B9A',
  '#00838F', '#AD1457', '#2E7D32', '#4E342E', '#455A64',
];

const INCOME_COLORS = [
  '#2E7D32', '#388E3C', '#43A047', '#00897B', '#00838F',
  '#558B2F', '#7CB342', '#1B5E20', '#26A69A', '#66BB6A',
];

export function ReportsScreen() {
  const navigation = useNavigation<Nav>();
  const { session, repos } = useSession();
  const base = session.baseCurrency;

  const [month, setMonth] = useState({ incomeBaseMinor: 0, expenseBaseMinor: 0 });
  const [bars, setBars] = useState<BarDatum[]>([]);
  const [incomeBars, setIncomeBars] = useState<BarDatum[]>([]);
  const [columns, setColumns] = useState<ColumnDatum[]>([]);
  const [trend, setTrend] = useState<
    { label: string; rate: number | null; netMinor: number }[]
  >([]);

  const load = useCallback(async () => {
    const current = monthRange(0);
    setMonth(await repos.transactions.totalsBetween(current.from, current.to));

    // Spending by category (current month).
    const cats = await repos.categories.list();
    const nameById = new Map(cats.map((c) => [c.id, c.name]));
    const spending = await repos.transactions.categorySpendingBetween(
      current.from,
      current.to,
    );
    setBars(
      spending
        .filter((s) => s.totalBaseMinor > 0)
        .map((s, i) => ({
          key: s.categoryId ?? 'none',
          label: s.categoryId ? nameById.get(s.categoryId) ?? 'Categoría' : 'Sin categoría',
          valueMinor: s.totalBaseMinor,
          color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
        })),
    );

    // Income by category (current month).
    const income = await repos.transactions.categoryIncomeBetween(
      current.from,
      current.to,
    );
    setIncomeBars(
      income
        .filter((s) => s.totalBaseMinor > 0)
        .map((s, i) => ({
          key: s.categoryId ?? 'none',
          label: s.categoryId ? nameById.get(s.categoryId) ?? 'Categoría' : 'Sin categoría',
          valueMinor: s.totalBaseMinor,
          color: INCOME_COLORS[i % INCOME_COLORS.length],
        })),
    );

    // Last 6 months income vs expense + savings rate trend.
    const cols: ColumnDatum[] = [];
    const tr: { label: string; rate: number | null; netMinor: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const r = monthRange(i);
      const t = await repos.transactions.totalsBetween(r.from, r.to);
      cols.push({
        label: r.label,
        incomeMinor: t.incomeBaseMinor,
        expenseMinor: t.expenseBaseMinor,
      });
      const net = t.incomeBaseMinor - t.expenseBaseMinor;
      tr.push({
        label: r.label,
        netMinor: net,
        rate: t.incomeBaseMinor > 0 ? net / t.incomeBaseMinor : null,
      });
    }
    setColumns(cols);
    setTrend(tr);
  }, [repos]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const net = month.incomeBaseMinor - month.expenseBaseMinor;
  const savingsRate =
    month.incomeBaseMinor > 0 ? net / month.incomeBaseMinor : null;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg }}
    >
      <Card>
        <Text style={styles.cardLabel}>Este mes ({base})</Text>
        <View style={styles.row}>
          <View style={styles.cell}>
            <Text style={styles.small}>Ingresos</Text>
            <Text style={[styles.val, { color: colors.income }]}>
              {formatMoney(month.incomeBaseMinor, base)}
            </Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.small}>Gastos</Text>
            <Text style={[styles.val, { color: colors.expense }]}>
              {formatMoney(month.expenseBaseMinor, base)}
            </Text>
          </View>
        </View>
        <Text style={styles.small}>Balance</Text>
        <Text style={[styles.val, { color: net >= 0 ? colors.income : colors.expense }]}>
          {formatMoney(net, base)}
        </Text>
        {savingsRate !== null ? (
          <Text style={styles.rate}>
            Tasa de ahorro:{' '}
            <Text style={{ color: savingsRate >= 0 ? colors.income : colors.expense, fontWeight: '700' }}>
              {Math.round(savingsRate * 100)}%
            </Text>{' '}
            de tus ingresos
          </Text>
        ) : null}
      </Card>

      <Text style={styles.section}>Ingresos por categoría (este mes)</Text>
      <Card>
        {incomeBars.length === 0 ? (
          <Text style={styles.muted}>Sin ingresos este mes.</Text>
        ) : (
          <BarList data={incomeBars} currency={base} />
        )}
      </Card>

      <Text style={styles.section}>Gastos por categoría (este mes)</Text>
      <Card>
        {bars.length === 0 ? (
          <Text style={styles.muted}>Sin gastos este mes.</Text>
        ) : (
          <BarList data={bars} currency={base} />
        )}
      </Card>

      <Text style={styles.section}>Ingresos vs gastos (6 meses)</Text>
      <Card>
        <MonthlyColumns data={columns} currency={base} />
      </Card>

      <Text style={styles.section}>Tasa de ahorro (6 meses)</Text>
      <Card>
        {trend.every((t) => t.rate === null) ? (
          <Text style={styles.muted}>Sin ingresos registrados aún.</Text>
        ) : (
          trend.map((t) => (
            <View key={t.label} style={styles.trendRow}>
              <View style={styles.trendHeader}>
                <Text style={styles.trendLabel}>{t.label}</Text>
                <Text
                  style={[
                    styles.trendRate,
                    { color: (t.rate ?? 0) >= 0 ? colors.income : colors.expense },
                  ]}
                >
                  {t.rate === null ? '—' : `${Math.round(t.rate * 100)}%`}
                </Text>
              </View>
              <ProgressBar
                ratio={t.rate ?? 0}
                color={(t.rate ?? 0) >= 0 ? colors.income : colors.expense}
              />
            </View>
          ))
        )}
      </Card>

      <Button
        title="Presupuestos por categoría"
        variant="secondary"
        onPress={() => navigation.navigate('Budgets')}
        style={{ marginTop: spacing.sm }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cardLabel: { fontSize: font.sm, color: colors.textMuted, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.sm },
  cell: { flex: 1 },
  small: { fontSize: font.sm, color: colors.textMuted },
  val: { fontSize: font.lg, fontWeight: '700', marginTop: 2 },
  rate: { fontSize: font.sm, color: colors.textMuted, marginTop: spacing.sm },
  trendRow: { marginBottom: spacing.md },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  trendLabel: { fontSize: font.sm, color: colors.text },
  trendRate: { fontSize: font.sm, fontWeight: '700' },
  section: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  muted: { color: colors.textMuted },
});
