import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useSession } from '../../auth/AuthContext';
import { Button, ErrorText, Field } from '../../components/ui';
import { CurrencyPicker } from '../../components/CurrencyPicker';
import { Picker, PickerOption } from '../../components/Picker';
import { Segmented } from '../../components/Segmented';
import { Account, Category } from '../../db/schema';
import { CurrencyCode } from '../../money/currency';
import { formatMoney, parseToMinor } from '../../money/money';
import { RATE_ONE, RATE_SCALE, formatRate, parseRate } from '../../money/fx';
import { convertMinor } from '../../money/money';
import { todayISO } from '../../utils/date';
import { colors } from '../../theme/theme';
import { MainStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<MainStackParamList, 'AddTransaction'>;
type EntryType = 'income' | 'expense';

export function AddTransactionScreen({ route }: Props) {
  const navigation = useNavigation<Props['navigation']>();
  const { session, repos } = useSession();
  const editingId = route.params?.transactionId;
  const base = session.baseCurrency;

  const [type, setType] = useState<EntryType>('expense');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>(base);
  const [rate, setRate] = useState('');
  const [date] = useState(todayISO());
  const [payee, setPayee] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Load accounts + categories for the current type.
  const loadRefs = useCallback(async () => {
    const accs = await repos.accounts.list();
    setAccounts(accs);
    if (!accountId && accs.length > 0) {
      setAccountId(accs[0].id);
      setCurrency(accs[0].currency as CurrencyCode);
    }
  }, [repos, accountId]);

  useEffect(() => {
    loadRefs();
  }, [loadRefs]);

  useEffect(() => {
    repos.categories.list(type).then(setCategories);
  }, [repos, type]);

  // Load existing transaction when editing.
  useEffect(() => {
    if (!editingId) return;
    repos.transactions.get(editingId).then((t) => {
      if (!t) return;
      if (t.type === 'income' || t.type === 'expense') setType(t.type);
      setAccountId(t.accountId);
      setCategoryId(t.categoryId);
      setCurrency(t.currency as CurrencyCode);
      setAmount(formatMoney(t.amountMinor, t.currency as CurrencyCode, { showSymbol: false }));
      setPayee(t.payee ?? '');
      setNotes(t.notes ?? '');
      if (t.currency !== base) setRate(formatRate(t.fxRateToBaseScaled));
    });
  }, [editingId, repos, base]);

  // Prefill FX rate from last known when currency differs from base.
  useEffect(() => {
    if (currency === base) {
      setRate('');
      return;
    }
    repos.rates.latest(currency, base).then((r) => {
      if (r) setRate(formatRate(r));
    });
  }, [currency, base, repos]);

  const accountOptions: PickerOption[] = accounts.map((a) => ({
    value: a.id,
    label: a.name,
    sublabel: `${a.type} · ${a.currency}`,
  }));
  const categoryOptions: PickerOption[] = categories.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const computeBase = (): { amountMinor: number; rateScaled: number; baseMinor: number } => {
    const amountMinor = parseToMinor(amount, currency);
    if (currency === base) {
      return { amountMinor, rateScaled: RATE_ONE, baseMinor: amountMinor };
    }
    const rateScaled = parseRate(rate);
    const baseMinor = convertMinor(amountMinor, rateScaled, RATE_SCALE);
    return { amountMinor, rateScaled, baseMinor };
  };

  const onSubmit = async () => {
    setError(null);
    if (!accountId) return setError('Elegí una cuenta.');
    let calc;
    try {
      calc = computeBase();
    } catch (e) {
      return setError(e instanceof Error ? e.message : 'Monto o tasa inválidos.');
    }
    if (calc.amountMinor <= 0) return setError('El monto debe ser mayor a 0.');

    setBusy(true);
    try {
      if (currency !== base) {
        await repos.rates.save(currency, base, calc.rateScaled, date, 'manual');
      }
      const payload = {
        accountId,
        categoryId,
        type,
        date,
        payee: payee.trim() || null,
        notes: notes.trim() || null,
        amountMinor: calc.amountMinor,
        currency,
        fxRateToBaseScaled: calc.rateScaled,
        amountBaseMinor: calc.baseMinor,
        source: 'manual' as const,
      };
      if (editingId) {
        await repos.transactions.update(editingId, payload);
      } else {
        await repos.transactions.create(payload);
      }
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar.');
      setBusy(false);
    }
  };

  const onDelete = () => {
    if (!editingId) return;
    Alert.alert('Eliminar movimiento', '¿Seguro que querés eliminarlo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await repos.transactions.remove(editingId);
          navigation.goBack();
        },
      },
    ]);
  };

  const showBaseHint = currency !== base && amount.trim() !== '' && rate.trim() !== '';
  let baseHint = '';
  if (showBaseHint) {
    try {
      const c = computeBase();
      baseHint = `≈ ${formatMoney(c.baseMinor, base, { showCode: true })}`;
    } catch {
      baseHint = '';
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Segmented<EntryType>
        value={type}
        onChange={(t) => {
          setType(t);
          setCategoryId(null);
        }}
        options={[
          { value: 'expense', label: 'Gasto', color: colors.expense },
          { value: 'income', label: 'Ingreso', color: colors.income },
        ]}
      />

      <Field
        label="Monto"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        placeholder="0,00"
      />
      <CurrencyPicker
        label="Moneda"
        value={currency}
        onChange={setCurrency}
      />
      {currency !== base ? (
        <Field
          label={`Tasa de cambio (1 ${currency} = ? ${base})`}
          value={rate}
          onChangeText={setRate}
          keyboardType="numeric"
          placeholder="Ej: 40,50"
          error={baseHint ? null : undefined}
        />
      ) : null}
      {baseHint ? <ErrorText>{baseHint}</ErrorText> : null}

      <Picker
        label="Cuenta"
        placeholder="Elegí una cuenta"
        value={accountId}
        options={accountOptions}
        onChange={(id) => {
          setAccountId(id);
          const acc = accounts.find((a) => a.id === id);
          if (acc) setCurrency(acc.currency as CurrencyCode);
        }}
      />
      <Picker
        label="Categoría"
        placeholder="Sin categoría"
        value={categoryId}
        options={categoryOptions}
        onChange={setCategoryId}
      />
      <Field label="Comercio / descripción" value={payee} onChangeText={setPayee} placeholder="Ej: Ta-Ta, Antel" />
      <Field label="Notas" value={notes} onChangeText={setNotes} placeholder="Opcional" />

      <ErrorText>{error}</ErrorText>
      <Button
        title={editingId ? 'Guardar cambios' : 'Guardar movimiento'}
        onPress={onSubmit}
        loading={busy}
      />
      {editingId ? (
        <Button
          title="Eliminar"
          variant="danger"
          onPress={onDelete}
          style={{ marginTop: 8 }}
        />
      ) : null}
    </ScrollView>
  );
}
