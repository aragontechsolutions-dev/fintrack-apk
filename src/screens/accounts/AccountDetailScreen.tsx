import React, { useCallback, useLayoutEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useSession } from '../../auth/AuthContext';
import { Button, Card } from '../../components/ui';
import { TransactionRow } from '../../components/TransactionRow';
import { Account, Transaction } from '../../db/schema';
import { CurrencyCode } from '../../money/currency';
import { formatMoney } from '../../money/money';
import { MainStackParamList } from '../../navigation/types';
import { colors, font, spacing } from '../../theme/theme';

type Props = NativeStackScreenProps<MainStackParamList, 'AccountDetail'>;

export function AccountDetailScreen({ route }: Props) {
  const navigation = useNavigation<Props['navigation']>();
  const { accountId } = route.params;
  const { repos } = useSession();
  const [account, setAccount] = useState<Account | null>(null);
  const [balance, setBalance] = useState(0);
  const [txns, setTxns] = useState<Transaction[]>([]);

  const load = useCallback(async () => {
    const acc = await repos.accounts.get(accountId);
    setAccount(acc ?? null);
    setBalance(await repos.accounts.balanceMinor(accountId));
    setTxns(await repos.transactions.listByAccount(accountId));
  }, [accountId, repos]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({ title: account?.name ?? 'Cuenta' });
  }, [navigation, account]);

  if (!account) return null;
  const cur = account.currency as CurrencyCode;

  return (
    <View style={styles.screen}>
      <FlatList
        data={txns}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: spacing.lg }}
        ListHeaderComponent={
          <>
            <Card>
              <Text style={styles.label}>Saldo actual</Text>
              <Text style={styles.balance}>{formatMoney(balance, cur)}</Text>
            </Card>
            <Button
              title="Editar cuenta"
              variant="secondary"
              onPress={() =>
                navigation.navigate('AccountForm', { accountId })
              }
              style={{ marginBottom: spacing.md }}
            />
            <Text style={styles.section}>Movimientos</Text>
          </>
        }
        ListEmptyComponent={
          <Text style={styles.muted}>Sin movimientos en esta cuenta.</Text>
        }
        renderItem={({ item }) => (
          <TransactionRow
            txn={item}
            onPress={() =>
              navigation.navigate('AddTransaction', { transactionId: item.id })
            }
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  label: { fontSize: font.sm, color: colors.textMuted },
  balance: {
    fontSize: font.xxl,
    fontWeight: '800',
    color: colors.text,
    marginTop: spacing.xs,
  },
  section: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  muted: { color: colors.textMuted },
});
