import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useSession } from '../../auth/AuthContext';
import { Button } from '../../components/ui';
import { ProgressBar } from '../../components/charts';
import { SavingsPlan } from '../../db/schema';
import { CurrencyCode } from '../../money/currency';
import { formatMoney } from '../../money/money';
import { MainStackParamList } from '../../navigation/types';
import { colors, font, radius, spacing } from '../../theme/theme';

type Nav = NativeStackNavigationProp<MainStackParamList>;

interface PlanWithProgress extends SavingsPlan {
  savedMinor: number;
}

export function SavingsScreen() {
  const navigation = useNavigation<Nav>();
  const { repos } = useSession();
  const [plans, setPlans] = useState<PlanWithProgress[]>([]);

  const load = useCallback(async () => {
    const list = await repos.savings.listPlans();
    const withProgress = await Promise.all(
      list.map(async (p) => ({
        ...p,
        savedMinor: await repos.savings.savedMinor(p.id),
      })),
    );
    setPlans(withProgress);
  }, [repos]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={plans}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: spacing.lg }}
        ListEmptyComponent={
          <Text style={styles.muted}>
            No tenés metas de ahorro. Creá una para empezar a juntar.
          </Text>
        }
        renderItem={({ item }) => {
          const cur = item.currency as CurrencyCode;
          const ratio = item.targetMinor > 0 ? item.savedMinor / item.targetMinor : 0;
          const pct = Math.round(Math.min(1, ratio) * 100);
          const remaining = Math.max(0, item.targetMinor - item.savedMinor);
          return (
            <Pressable
              style={styles.card}
              onPress={() =>
                navigation.navigate('SavingsPlanDetail', { planId: item.id })
              }
            >
              <View style={styles.cardHeader}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.badge}>
                  {item.kind === 'envelope' ? 'Sobre' : 'Meta'}
                </Text>
              </View>
              <Text style={styles.amounts}>
                {formatMoney(item.savedMinor, cur)} de{' '}
                {formatMoney(item.targetMinor, cur)} · {pct}%
              </Text>
              <ProgressBar
                ratio={ratio}
                color={pct >= 100 ? colors.income : colors.primary}
              />
              <Text style={styles.remaining}>
                {remaining > 0
                  ? `Faltan ${formatMoney(remaining, cur)}`
                  : '¡Meta alcanzada! 🎉'}
              </Text>
            </Pressable>
          );
        }}
      />
      <View style={{ padding: spacing.lg }}>
        <Button
          title="+ Nueva meta de ahorro"
          onPress={() => navigation.navigate('SavingsPlanForm')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  name: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  badge: {
    fontSize: font.sm,
    color: colors.primary,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  amounts: { fontSize: font.sm, color: colors.textMuted, marginBottom: spacing.sm },
  remaining: { fontSize: font.sm, color: colors.text, marginTop: spacing.sm },
  muted: { color: colors.textMuted },
});
