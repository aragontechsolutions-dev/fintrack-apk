import React, { useCallback, useLayoutEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useSession } from '../../auth/AuthContext';
import { Button, Card, ErrorText, Field } from '../../components/ui';
import { ProgressBar } from '../../components/charts';
import { SavingsContribution, SavingsPlan } from '../../db/schema';
import { CurrencyCode } from '../../money/currency';
import { formatMoney, parseToMinor } from '../../money/money';
import { formatDisplayDate, todayISO } from '../../utils/date';
import { MainStackParamList } from '../../navigation/types';
import { colors, font, spacing } from '../../theme/theme';

type Props = NativeStackScreenProps<MainStackParamList, 'SavingsPlanDetail'>;

/** Estimate remaining months at the observed contribution rate. */
function projectMonths(
  savedMinor: number,
  targetMinor: number,
  contributions: SavingsContribution[],
): number | null {
  if (savedMinor >= targetMinor || contributions.length === 0) return null;
  const dates = contributions.map((c) => new Date(c.date).getTime());
  const first = Math.min(...dates);
  const monthsElapsed = Math.max(
    1,
    (Date.now() - first) / (30 * 24 * 3600 * 1000),
  );
  const rate = savedMinor / monthsElapsed; // minor per month
  if (rate <= 0) return null;
  return Math.ceil((targetMinor - savedMinor) / rate);
}

export function SavingsPlanDetailScreen({ route }: Props) {
  const navigation = useNavigation<Props['navigation']>();
  const { planId } = route.params;
  const { repos } = useSession();

  const [plan, setPlan] = useState<SavingsPlan | null>(null);
  const [saved, setSaved] = useState(0);
  const [contribs, setContribs] = useState<SavingsContribution[]>([]);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const p = await repos.savings.getPlan(planId);
    setPlan(p ?? null);
    setSaved(await repos.savings.savedMinor(planId));
    setContribs(await repos.savings.listContributions(planId));
  }, [planId, repos]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: plan?.name ?? 'Meta',
      headerRight: () =>
        plan ? (
          <Pressable onPress={() => navigation.navigate('SavingsPlanForm', { planId })}>
            <Text style={{ color: colors.textInverse, fontWeight: '600' }}>Editar</Text>
          </Pressable>
        ) : null,
    });
  }, [navigation, plan, planId]);

  if (!plan) return null;
  const cur = plan.currency as CurrencyCode;
  const ratio = plan.targetMinor > 0 ? saved / plan.targetMinor : 0;
  const pct = Math.round(Math.min(1, ratio) * 100);
  const remaining = Math.max(0, plan.targetMinor - saved);
  const months = projectMonths(saved, plan.targetMinor, contribs);

  const onAdd = async () => {
    setError(null);
    let minor: number;
    try {
      minor = parseToMinor(amount, cur);
    } catch {
      return setError('Monto inválido.');
    }
    if (minor <= 0) return setError('El aporte debe ser mayor a 0.');
    setBusy(true);
    try {
      await repos.savings.addContribution({ planId, date: todayISO(), amountMinor: minor });
      setAmount('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al aportar.');
    } finally {
      setBusy(false);
    }
  };

  const onDeletePlan = () => {
    Alert.alert('Archivar meta', '¿Archivar esta meta de ahorro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Archivar',
        style: 'destructive',
        onPress: async () => {
          await repos.savings.archivePlan(planId);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg }}
      data={contribs}
      keyExtractor={(c) => c.id}
      ListHeaderComponent={
        <>
          <Card>
            <Text style={styles.big}>{formatMoney(saved, cur)}</Text>
            <Text style={styles.sub}>
              de {formatMoney(plan.targetMinor, cur)} · {pct}%
            </Text>
            <ProgressBar ratio={ratio} color={pct >= 100 ? colors.income : colors.primary} height={14} />
            <Text style={styles.hint}>
              {remaining > 0
                ? `Faltan ${formatMoney(remaining, cur)}` +
                  (months ? ` · ~${months} mes(es) a este ritmo` : '')
                : '¡Meta alcanzada! 🎉'}
            </Text>
            {plan.targetDate ? (
              <Text style={styles.hint}>Fecha objetivo: {formatDisplayDate(plan.targetDate)}</Text>
            ) : null}
          </Card>

          <Card>
            <Field label="Registrar aporte" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0,00" />
            <ErrorText>{error}</ErrorText>
            <Button title="Aportar" onPress={onAdd} loading={busy} />
          </Card>

          <Text style={styles.section}>Aportes</Text>
        </>
      }
      ListEmptyComponent={<Text style={styles.muted}>Todavía no hay aportes.</Text>}
      renderItem={({ item }) => (
        <Pressable
          style={styles.contribRow}
          onLongPress={() =>
            Alert.alert('Eliminar aporte', '¿Eliminar este aporte?', [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Eliminar',
                style: 'destructive',
                onPress: async () => {
                  await repos.savings.removeContribution(item.id);
                  await load();
                },
              },
            ])
          }
        >
          <Text style={styles.contribDate}>{formatDisplayDate(item.date)}</Text>
          <Text style={styles.contribAmount}>+{formatMoney(item.amountMinor, cur)}</Text>
        </Pressable>
      )}
      ListFooterComponent={
        <Button title="Archivar meta" variant="danger" onPress={onDeletePlan} style={{ marginTop: spacing.lg }} />
      }
    />
  );
}

const styles = StyleSheet.create({
  big: { fontSize: font.xxl, fontWeight: '800', color: colors.text },
  sub: { fontSize: font.md, color: colors.textMuted, marginBottom: spacing.sm },
  hint: { fontSize: font.sm, color: colors.text, marginTop: spacing.sm },
  section: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  contribRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  contribDate: { fontSize: font.md, color: colors.text },
  contribAmount: { fontSize: font.md, fontWeight: '700', color: colors.income },
  muted: { color: colors.textMuted },
});
