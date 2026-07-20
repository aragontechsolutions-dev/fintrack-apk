import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useSession } from '../../auth/AuthContext';
import { Button, Card } from '../../components/ui';
import { TransactionRow } from '../../components/TransactionRow';
import { Transaction, Account } from '../../db/schema';
import { CurrencyCode } from '../../money/currency';
import { formatMoney } from '../../money/money';
import { startOfMonthISO } from '../../utils/date';
import { MainStackParamList } from '../../navigation/types';
import { colors, font, spacing } from '../../theme/theme';

type Nav = NativeStackNavigationProp<MainStackParamList>;

interface CurrencyTotal {
  currency: CurrencyCode;
  balanceMinor: number;
}

export function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { session, repos } = useSession();
  const [totalsByCurrency, setTotalsByCurrency] = useState<CurrencyTotal[]>([]);
  const [month, setMonth] = useState({ incomeBaseMinor: 0, expenseBaseMinor: 0 });
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const accounts = await repos.accounts.list();
    const byCurrency = new Map<CurrencyCode, number>();
    for (const acc of accounts as Account[]) {
      const bal = await repos.accounts.balanceMinor(acc.id);
      const cur = acc.currency as CurrencyCode;
      byCurrency.set(cur, (byCurrency.get(cur) ?? 0) + bal);
    }
    setTotalsByCurrency(
      [...byCurrency.entries()].map(([currency, balanceMinor]) => ({
        currency,
        balanceMinor,
      })),
    );
    setMonth(await repos.transactions.totalsSince(startOfMonthISO()));
    setRecent(await repos.transactions.listRecent(8));
  }, [repos]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const base = session.baseCurrency;
  const net = month.incomeBaseMinor - month.expenseBaseMinor;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Card>
        <Text style={styles.cardLabel}>Saldo total por moneda</Text>
        {totalsByCurrency.length === 0 ? (
          <Text style={styles.muted}>Sin cuentas todavía.</Text>
        ) : (
          totalsByCurrency.map((t) => (
            <Text key={t.currency} style={styles.bigBalance}>
              {formatMoney(t.balanceMinor, t.currency, { showCode: true })}
            </Text>
          ))
        )}
      </Card>

      <View style={styles.metricsRow}>
        <Card style={styles.metric}>
          <Text style={styles.cardLabel}>Ingresos del mes</Text>
          <Text style={[styles.metricValue, { color: colors.income }]}>
            {formatMoney(month.incomeBaseMinor, base)}
          </Text>
        </Card>
        <Card style={styles.metric}>
          <Text style={styles.cardLabel}>Gastos del mes</Text>
          <Text style={[styles.metricValue, { color: colors.expense }]}>
            {formatMoney(month.expenseBaseMinor, base)}
          </Text>
        </Card>
      </View>

      <Card>
        <Text style={styles.cardLabel}>Balance del mes ({base})</Text>
        <Text
          style={[
            styles.metricValue,
            { color: net >= 0 ? colors.income : colors.expense },
          ]}
        >
          {formatMoney(net, base)}
        </Text>
      </Card>

      <View style={{ flexDirection: 'row', gap: spacing.md, marginVertical: spacing.sm }}>
        <Button
          title="+ Movimiento"
          onPress={() => navigation.navigate('AddTransaction')}
          style={{ flex: 1 }}
        />
        <Button
          title="Cuentas"
          variant="secondary"
          onPress={() => navigation.navigate('Accounts')}
          style={{ flex: 1 }}
        />
      </View>

      <Text style={styles.sectionTitle}>Movimientos recientes</Text>
      {recent.length === 0 ? (
        <Text style={styles.muted}>Todavía no registraste movimientos.</Text>
      ) : (
        recent.map((t) => (
          <TransactionRow
            key={t.id}
            txn={t}
            onPress={() =>
              navigation.navigate('AddTransaction', { transactionId: t.id })
            }
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cardLabel: { fontSize: font.sm, color: colors.textMuted },
  bigBalance: {
    fontSize: font.xxl,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.xs,
  },
  metricsRow: { flexDirection: 'row', gap: spacing.md },
  metric: { flex: 1 },
  metricValue: {
    fontSize: font.lg,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  muted: { color: colors.textMuted, marginTop: spacing.sm },
});
