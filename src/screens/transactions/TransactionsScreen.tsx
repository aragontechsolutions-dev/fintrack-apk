import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useSession } from '../../auth/AuthContext';
import { Button } from '../../components/ui';
import { TransactionRow } from '../../components/TransactionRow';
import { Account, Transaction } from '../../db/schema';
import { MainStackParamList } from '../../navigation/types';
import { colors, spacing } from '../../theme/theme';

type Nav = NativeStackNavigationProp<MainStackParamList>;

export function TransactionsScreen() {
  const navigation = useNavigation<Nav>();
  const { repos } = useSession();
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [list, accounts] = await Promise.all([
      repos.transactions.listRecent(200),
      repos.accounts.list(true),
    ]);
    const names: Record<string, string> = {};
    (accounts as Account[]).forEach((a) => (names[a.id] = a.name));
    setAccountNames(names);
    setTxns(list);
  }, [repos]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={txns}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: spacing.lg }}
        ListEmptyComponent={
          <Text style={styles.muted}>Todavía no hay movimientos.</Text>
        }
        renderItem={({ item }) => (
          <TransactionRow
            txn={item}
            subtitle={accountNames[item.accountId]}
            onPress={() =>
              navigation.navigate('AddTransaction', { transactionId: item.id })
            }
          />
        )}
      />
      <View style={styles.actions}>
        <Button
          title="+ Movimiento"
          onPress={() => navigation.navigate('AddTransaction')}
          style={{ flex: 1 }}
        />
        <Button
          title="Transferir"
          variant="secondary"
          onPress={() => navigation.navigate('AddTransfer')}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  muted: { color: colors.textMuted },
});
