import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useSession } from '../../auth/AuthContext';
import { Button } from '../../components/ui';
import { Account } from '../../db/schema';
import { CurrencyCode } from '../../money/currency';
import { formatMoney } from '../../money/money';
import { MainStackParamList } from '../../navigation/types';
import { colors, font, radius, spacing } from '../../theme/theme';

type Nav = NativeStackNavigationProp<MainStackParamList>;

interface AccountWithBalance extends Account {
  balanceMinor: number;
}

const TYPE_LABEL: Record<string, string> = {
  cash: 'Efectivo',
  bank: 'Banco',
  card: 'Tarjeta',
};

export function AccountsScreen() {
  const navigation = useNavigation<Nav>();
  const { repos } = useSession();
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);

  const load = useCallback(async () => {
    const list = await repos.accounts.list();
    const withBal = await Promise.all(
      list.map(async (a) => ({
        ...a,
        balanceMinor: await repos.accounts.balanceMinor(a.id),
      })),
    );
    setAccounts(withBal);
  }, [repos]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={accounts}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: spacing.lg }}
        ListEmptyComponent={
          <Text style={styles.muted}>
            No tenés cuentas. Creá una para empezar.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() =>
              navigation.navigate('AccountDetail', { accountId: item.id })
            }
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.sub}>
                {TYPE_LABEL[item.type] ?? item.type} · {item.currency}
              </Text>
            </View>
            <Text style={styles.balance}>
              {formatMoney(item.balanceMinor, item.currency as CurrencyCode)}
            </Text>
          </Pressable>
        )}
      />
      <View style={{ padding: spacing.lg }}>
        <Button
          title="+ Nueva cuenta"
          onPress={() => navigation.navigate('AccountForm')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  name: { fontSize: font.md, fontWeight: '600', color: colors.text },
  sub: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
  balance: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  muted: { color: colors.textMuted },
});
