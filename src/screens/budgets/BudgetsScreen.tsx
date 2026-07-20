import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useSession } from '../../auth/AuthContext';
import { Button, Card, Subtle } from '../../components/ui';
import { ProgressBar } from '../../components/charts';
import { Repositories } from '../../data/repositories';
import { Category } from '../../db/schema';
import { CurrencyCode } from '../../money/currency';
import { formatMoney, parseToMinor } from '../../money/money';
import { monthRange } from '../../utils/date';
import { colors, font, spacing } from '../../theme/theme';
import { Field } from '../../components/ui';

interface RowData {
  category: Category;
  limitMinor: number;
  spentMinor: number;
}

function BudgetRow({
  row,
  base,
  repos,
  onChanged,
}: {
  row: RowData;
  base: CurrencyCode;
  repos: Repositories;
  onChanged: () => void;
}) {
  const [value, setValue] = useState(
    row.limitMinor > 0
      ? formatMoney(row.limitMinor, base, { showSymbol: false })
      : '',
  );
  const [saving, setSaving] = useState(false);

  const ratio = row.limitMinor > 0 ? row.spentMinor / row.limitMinor : 0;
  const over = row.limitMinor > 0 && row.spentMinor > row.limitMinor;

  const save = async () => {
    setSaving(true);
    try {
      const limitMinor = value.trim() === '' ? 0 : parseToMinor(value, base);
      await repos.budgets.upsert({
        categoryId: row.category.id,
        period: 'monthly',
        limitMinor,
        currency: base,
      });
      onChanged();
    } catch {
      /* ignore invalid input; field keeps focus */
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <View style={styles.header}>
        <Text style={styles.name}>{row.category.name}</Text>
        <Text style={styles.spent}>
          {formatMoney(row.spentMinor, base)}
          {row.limitMinor > 0 ? ` / ${formatMoney(row.limitMinor, base)}` : ''}
        </Text>
      </View>
      {row.limitMinor > 0 ? (
        <>
          <ProgressBar ratio={ratio} color={over ? colors.expense : colors.primary} />
          {over ? (
            <Text style={styles.over}>
              Excedido por {formatMoney(row.spentMinor - row.limitMinor, base)}
            </Text>
          ) : null}
        </>
      ) : null}
      <View style={styles.editRow}>
        <View style={{ flex: 1 }}>
          <Field
            label={`Límite mensual (${base})`}
            value={value}
            onChangeText={setValue}
            keyboardType="numeric"
            placeholder="Sin límite"
          />
        </View>
        <Button title="Guardar" onPress={save} loading={saving} style={styles.saveBtn} />
      </View>
    </Card>
  );
}

export function BudgetsScreen() {
  const { session, repos } = useSession();
  const base = session.baseCurrency;
  const [rows, setRows] = useState<RowData[]>([]);

  const load = useCallback(async () => {
    const { from, to } = monthRange(0);
    const cats = await repos.categories.list('expense');
    const data = await Promise.all(
      cats.map(async (category) => {
        const budget = await repos.budgets.forCategory(category.id);
        const spentMinor = await repos.transactions.categoryExpenseBetween(
          category.id,
          from,
          to,
        );
        return {
          category,
          limitMinor: budget?.limitMinor ?? 0,
          spentMinor,
        };
      }),
    );
    setRows(data);
  }, [repos]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg }}
    >
      <Subtle>
        Definí un límite mensual por categoría de gasto. El gasto se compara en{' '}
        {base} contra lo consumido este mes.
      </Subtle>
      <View style={{ height: spacing.md }} />
      {rows.length === 0 ? (
        <Text style={styles.muted}>
          No hay categorías de gasto. Creá algunas primero.
        </Text>
      ) : (
        rows.map((r) => (
          <BudgetRow
            key={r.category.id}
            row={r}
            base={base}
            repos={repos}
            onChanged={load}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  name: { fontSize: font.md, fontWeight: '700', color: colors.text },
  spent: { fontSize: font.sm, color: colors.textMuted },
  over: { fontSize: font.sm, color: colors.expense, marginTop: spacing.xs },
  editRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.sm },
  saveBtn: { marginBottom: spacing.md, paddingHorizontal: spacing.lg },
  muted: { color: colors.textMuted },
});
